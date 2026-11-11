export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };

// Geometry is in document pixels. A chapter holds still until its scroll interval begins.
export function sceneTimeline(y, starts, viewportHeight, reduced = false) {
  const travel = Math.max(1, viewportHeight * .72);
  let active = 0;
  for (let i = 1; i < starts.length; i++) {
    if (y >= starts[i] - travel / 2) active = i;
  }
  let crossing = 0;
  const scenes = starts.map((start, i) => {
    const next = starts[i + 1];
    const enter = i === 0 ? 1 : smoothstep((y - (start - travel)) / travel);
    const exit = next === undefined ? 0 : smoothstep((y - (next - travel)) / travel);
    const opacity = reduced ? Number(i === active) : Math.min(enter, 1 - exit);
    const copy = reduced ? opacity : clamp((opacity - .45) / .55);
    if (enter > 0 && enter < 1) crossing = Math.sin(enter * Math.PI);
    const span = next === undefined ? viewportHeight : Math.max(1, next - start - travel);
    return { opacity, copy, scale: reduced ? 1 : 1 + (1 - enter) * .055 + exit * .11, video: clamp((y - start) / span) };
  });
  return { active, scenes, veil: reduced ? 0 : crossing * .72 };
}

export function createProgressSignal() {
  let value = 0;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) { if (next === value) return; value = next; listeners.forEach((listener) => listener(value)); },
    subscribe(listener) { listeners.add(listener); listener(value); return () => listeners.delete(listener); },
  };
}
