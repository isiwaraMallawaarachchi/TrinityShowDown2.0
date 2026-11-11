import { useEffect, useRef, useState } from 'react';

export function useReducedPreference() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return reduced;
}

export function useWorldMotion(world, enabled) {
  useEffect(() => {
    const node = world.current;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0;
    let x = 0;
    let y = 0;
    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      node?.style.setProperty('--pointer-x', '0px');
      node?.style.setProperty('--pointer-y', '0px');
    }
    function move(event) {
      if (!enabled || !fine.matches || event.pointerType !== 'mouse') return;
      x = (event.clientX / window.innerWidth - .5) * 15;
      y = (event.clientY / window.innerHeight - .5) * 10;
      if (!frame) frame = requestAnimationFrame(() => {
        node.style.setProperty('--pointer-x', `${x}px`);
        node.style.setProperty('--pointer-y', `${y}px`);
        frame = 0;
      });
    }
    if (!enabled) reset();
    document.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', reset);
    window.addEventListener('blur', reset);
    return () => { reset(); document.removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', reset); window.removeEventListener('blur', reset); };
  }, [world, enabled]);
}

export function PointerReticle({ enabled = true }) {
  const pointer = useRef(null);
  useEffect(() => {
    const node = pointer.current;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0;
    function hide() { cancelAnimationFrame(frame); frame = 0; node.removeAttribute('data-visible'); node.removeAttribute('data-target'); }
    function move(event) {
      if (!enabled || !fine.matches || event.pointerType !== 'mouse') { hide(); return; }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        node.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
        node.dataset.visible = '';
        node.toggleAttribute('data-target', Boolean(event.target.closest?.('a, button')));
      });
    }
    if (!enabled) hide();
    document.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', hide);
    window.addEventListener('blur', hide);
    return () => { hide(); document.removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', hide); window.removeEventListener('blur', hide); };
  }, [enabled]);
  return <div ref={pointer} className="pointer-reticle" aria-hidden="true"><span /><i /></div>;
}
