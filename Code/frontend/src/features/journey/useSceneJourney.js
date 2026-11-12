import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp, sceneTimeline } from './scene-timeline.js';

function sectionDestination(target) {
  const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  return clamp(window.scrollY + target.getBoundingClientRect().top - margin, 0, maxScroll);
}

export function useSceneJourney(chapters, world, blocked, reduced, guide, sectionIds, header, touchJourney) {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState([0]);
  const [inGuide, setInGuide] = useState(false);
  const guideActive = useRef(false);
  const activeRef = useRef(0);
  const sceneRefs = useRef([]);
  const anchors = useRef([]);
  const lastVisible = useRef('0');
  const lastY = useRef(0);
  const sectionScroll = useRef(null);

  useEffect(() => {
    let frame = 0;
    let resizing = false;
    let geometryDirty = false;
    let starts = [];
    let height = window.innerHeight;
    let guideStart = Infinity;
    let drawnY = window.scrollY;
    let previousTime = 0;
    let lastNavProgress;
    let scrollIdle;
    const sections = sectionIds.map(id => document.getElementById(id))
      .filter(node => node && node.parentElement === guide.current);
    const sectionHashes = new Set(sections.map(node => '#' + node.id));
    const portalHashes = new Set(sectionIds.map(id => '#' + id).filter(hash => !sectionHashes.has(hash)));
    const setNavProgress = (progress) => {
      const next = progress.toFixed(3);
      if (next === lastNavProgress) return;
      header.current?.style.setProperty('--nav-progress', next);
      lastNavProgress = next;
    };
    const geometry = () => {
      height = window.innerHeight;
      if (touchJourney) {
        const y = window.scrollY;
        height = anchors.current[0]?.offsetHeight || height;
        starts = anchors.current.map(node => node.getBoundingClientRect().top + y);
        guideStart = guide.current ? guide.current.getBoundingClientRect().top + y : Infinity;
        return;
      }
      starts = anchors.current.map((node) => node?.offsetTop || 0);
      guideStart = guide.current?.offsetTop ?? Infinity;
    };
    function syncSectionHash() {
      if (sectionScroll.current || document.body.classList.contains('modal-open') || portalHashes.has(location.hash)) return;
      const readingLine = Math.max(height * .25, (header.current?.getBoundingClientRect().bottom ?? 0) + 16);
      const atBottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight <= 2;
      const section = atBottom ? sections.at(-1) :
        sections.findLast(node => node.getBoundingClientRect().top <= readingLine) ?? sections[0];
      if (section && location.hash !== '#' + section.id) history.replaceState(null, '', '#' + section.id);
    }
    function syncChapters(index, visibleNow, wasInGuide) {
      const key = visibleNow.join(',');
      if (key !== lastVisible.current) { lastVisible.current = key; setVisible(visibleNow); }
      if (index !== activeRef.current || wasInGuide) {
        activeRef.current = index;
        setActive(index);
        if (!sectionScroll.current && (!sectionIds.includes(location.hash.slice(1)) || wasInGuide)) {
          history.replaceState(null, '', `#${chapters[index].id}`);
        }
      }
    }
    function measure(now = performance.now()) {
      frame = 0;
      if (resizing) return;
      if (geometryDirty) {
        geometry();
        geometryDirty = false;
      }
      const targetY = window.scrollY;
      lastY.current = targetY;
      const wasInGuide = guideActive.current;
      const nowInGuide = targetY >= guideStart - 1;
      if (nowInGuide !== wasInGuide) {
        guideActive.current = nowInGuide;
        setInGuide(nowInGuide);
      }
      if (nowInGuide) {
        setNavProgress(1);
        if (!wasInGuide) {
          setVisible([]);
          lastVisible.current = '';
          world.current?.style.setProperty('--veil-opacity', '0');
        }
        syncSectionHash();
        drawnY = targetY;
        previousTime = 0;
        return;
      }
      if (touchJourney) {
        // The chapters scroll in document flow. Only video playback needs the active index.
        const activeIndex = Math.max(0, starts.findLastIndex(start => start <= targetY + height / 2));
        const viewportBottom = targetY + window.innerHeight;
        const visibleNow = [];
        starts.forEach((start, index) => {
          const end = starts[index + 1] ?? guideStart;
          if (start < viewportBottom && end > targetY) visibleNow.push(index);
        });
        setNavProgress(Number(activeIndex > 0));
        syncChapters(activeIndex, visibleNow, wasInGuide);
        return;
      }
      if (wasInGuide && guideStart - targetY > height * 1.5) drawnY = targetY;
      const elapsed = Math.min(50, previousTime ? now - previousTime : 16.67);
      previousTime = now;
      drawnY = reduced ? targetY : drawnY + (targetY - drawnY) * (1 - Math.exp(-elapsed / 48));
      if (Math.abs(targetY - drawnY) < .2) drawnY = targetY;
      const y = drawnY;
      const state = sceneTimeline(y, starts, height, reduced);
      const homeLength = starts[1] || height;
      setNavProgress(reduced ? Number(state.active > 0) : clamp((y / homeLength - .08) / .65));
      const visibleNow = [];
      state.scenes.forEach((scene, i) => {
        const node = sceneRefs.current[i];
        if (!node) return;
        node.style.opacity = String(scene.opacity);
        node.style.visibility = scene.opacity > .001 ? 'visible' : 'hidden';
        node.style.setProperty('--scene-scale', scene.scale.toFixed(4));
        node.style.setProperty('--copy-opacity', scene.copy.toFixed(4));
        node.style.setProperty('--copy-y', `${((1 - scene.copy) * 18).toFixed(2)}px`);
        if (scene.opacity > .001) visibleNow.push(i);
      });
      world.current?.style.setProperty('--veil-opacity', state.veil.toFixed(4));
      syncChapters(state.active, visibleNow, wasInGuide);
      if (drawnY !== targetY) frame = requestAnimationFrame(measure);
      else previousTime = 0;
    }
    function onScroll() {
      const intent = sectionScroll.current;
      if (intent) {
        if (!intent.started && performance.now() - intent.requestedAt > 200) {
          sectionScroll.current = null;
        } else {
          intent.started = true;
          clearTimeout(scrollIdle);
          scrollIdle = setTimeout(() => {
            if (sectionScroll.current !== intent) return;
            sectionScroll.current = null;
            if (Math.abs(window.scrollY - sectionDestination(intent.target)) > 2) onScroll();
          }, 160);
        }
      }
      if (!frame) frame = requestAnimationFrame(measure);
    }
    const onResize = () => {
      if (touchJourney) {
        // Browser toolbar resizes during a swipe must not interrupt native momentum.
        geometryDirty = true;
        if (!frame) frame = requestAnimationFrame(measure);
        return;
      }
      const index = activeRef.current;
      const oldSpan = (starts[index + 1] ?? (starts[index] + height)) - starts[index];
      const relative = (lastY.current - starts[index]) / Math.max(1, oldSpan);
      const guideOffset = Math.max(0, lastY.current - guideStart);
      cancelAnimationFrame(frame);
      resizing = true;
      geometry();
      const sectionId = location.hash.slice(1);
      const guideTarget = sectionScroll.current?.target ?? (!guideActive.current && sectionIds.includes(sectionId)
        ? document.getElementById(sectionId)
        : null);
      if (guideActive.current || guideTarget) {
        // The editorial guide uses ordinary document flow rather than chapter-relative geometry.
        if (guideTarget) guideTarget.scrollIntoView({ behavior: 'instant', block: 'start' });
        else window.scrollTo({ top: guideStart + guideOffset, behavior: 'instant' });
        drawnY = window.scrollY;
        previousTime = 0;
        resizing = false;
        frame = requestAnimationFrame(measure);
        return;
      }
      const newSpan = (starts[index + 1] ?? (starts[index] + height)) - starts[index];
      window.scrollTo({ top: starts[index] + relative * newSpan, behavior: 'instant' });
      drawnY = window.scrollY;
      previousTime = 0;
      // Resizing cancels an in-flight navigation scroll; keep its URL at the retained chapter.
      history.replaceState(null, '', `#${chapters[index].id}`);
      resizing = false;
      frame = requestAnimationFrame(measure);
    };
    geometry();
    frame = requestAnimationFrame(measure);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(scrollIdle);
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [chapters, world, reduced, guide, sectionIds, header, touchJourney]);

  useEffect(() => {
    if (blocked) window.scrollTo({ top: window.scrollY, behavior: 'instant' });
    document.body.classList.toggle('modal-open', blocked);
    return () => document.body.classList.remove('modal-open');
  }, [blocked]);

  const goTo = useCallback((index) => {
    const target = anchors.current[index];
    if (!target) return;
    sectionScroll.current = null;
    if (location.hash !== `#${chapters[index].id}`) history.pushState(null, '', `#${chapters[index].id}`);
    target.scrollIntoView({ behavior: reduced || guideActive.current ? 'instant' : 'smooth', block: 'start' });
  }, [chapters, reduced]);

  const goToSection = useCallback((target, behavior) => {
    // Keep the destination hash while a smooth scroll passes other sections.
    sectionScroll.current = { target, requestedAt: performance.now(), started: false };
    target.scrollIntoView({ behavior, block: 'start' });
  }, []);

  return { active, visible, inGuide, sceneRefs, anchors, goTo, goToSection };
}
