import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp, sceneTimeline } from './scene-timeline.js';

export function useSceneJourney(chapters, world, blocked, reduced, guide, sectionIds, header) {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState([0]);
  const [inGuide, setInGuide] = useState(false);
  const guideActive = useRef(false);
  const activeRef = useRef(0);
  const sceneRefs = useRef([]);
  const anchors = useRef([]);
  const lastVisible = useRef('0');
  const lastY = useRef(0);

  useEffect(() => {
    let frame = 0;
    let resizing = false;
    let starts = [];
    let height = window.innerHeight;
    let guideStart = Infinity;
    let drawnY = window.scrollY;
    let previousTime = 0;
    let lastNavProgress;
    const setNavProgress = (progress) => {
      const next = progress.toFixed(3);
      if (next === lastNavProgress) return;
      header.current?.style.setProperty('--nav-progress', next);
      lastNavProgress = next;
    };
    const geometry = () => {
      height = window.innerHeight;
      starts = anchors.current.map((node) => node?.offsetTop || 0);
      guideStart = guide.current?.offsetTop ?? Infinity;
    };
    function measure(now = performance.now()) {
      frame = 0;
      if (resizing) return;
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
          if (!sectionIds.includes(location.hash.slice(1))) history.replaceState(null, '', '#' + sectionIds[0]);
          setVisible([]);
          lastVisible.current = '';
          world.current?.style.setProperty('--veil-opacity', '0');
        }
        drawnY = targetY;
        previousTime = 0;
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
      const key = visibleNow.join(',');
      if (key !== lastVisible.current) { lastVisible.current = key; setVisible(visibleNow); }
      if (state.active !== activeRef.current || wasInGuide) {
        activeRef.current = state.active;
        setActive(state.active);
        if (!sectionIds.includes(location.hash.slice(1)) || wasInGuide) history.replaceState(null, '', `#${chapters[state.active].id}`);
      }
      if (drawnY !== targetY) frame = requestAnimationFrame(measure);
      else previousTime = 0;
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const onResize = () => {
      const index = activeRef.current;
      const oldSpan = (starts[index + 1] ?? (starts[index] + height)) - starts[index];
      const relative = (lastY.current - starts[index]) / Math.max(1, oldSpan);
      const guideOffset = Math.max(0, lastY.current - guideStart);
      cancelAnimationFrame(frame);
      resizing = true;
      geometry();
      const sectionId = location.hash.slice(1);
      const guideTarget = !guideActive.current && sectionIds.includes(sectionId)
        ? document.getElementById(sectionId)
        : null;
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
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); };
  }, [chapters, world, reduced, guide, sectionIds, header]);

  useEffect(() => {
    if (blocked) window.scrollTo({ top: window.scrollY, behavior: 'instant' });
    document.body.classList.toggle('modal-open', blocked);
    return () => document.body.classList.remove('modal-open');
  }, [blocked]);

  const goTo = useCallback((index) => {
    const target = anchors.current[index];
    if (!target) return;
    if (location.hash !== `#${chapters[index].id}`) history.pushState(null, '', `#${chapters[index].id}`);
    target.scrollIntoView({ behavior: reduced || guideActive.current ? 'instant' : 'smooth', block: 'start' });
  }, [chapters, reduced]);

  return { active, visible, inGuide, sceneRefs, anchors, goTo };
}
