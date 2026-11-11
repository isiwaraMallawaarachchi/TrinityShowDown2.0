// One seek in flight. New scroll positions replace the pending target, never queue up.
export function createMediaScrubber(video, { fps, duration, onReady = () => {}, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame, isHidden = () => document.hidden }) {
  let target = 0;
  let frame = 0;
  let destroyed = false;
  let ready = false;
  const lastFrame = Math.max(0, Math.round(duration * fps) - 1);
  const tolerance = 1 / fps / 2;
  function announce() {
    if (!ready && video.readyState >= 2) { ready = true; onReady(); }
  }
  function tick() {
    frame = 0;
    if (destroyed || isHidden() || video.readyState < 1 || video.seeking) return;
    if (Math.abs(video.currentTime - target) < tolerance) { announce(); return; }
    try { video.currentTime = target; } catch { /* A source change can briefly invalidate metadata. */ }
  }
  function schedule() { if (!destroyed && !frame && !isHidden()) frame = requestFrame(tick); }
  function settled() { announce(); schedule(); }
  video.addEventListener('loadeddata', schedule);
  video.addEventListener('loadedmetadata', schedule);
  video.addEventListener('seeked', settled);
  return {
    setProgress(progress) {
      const normalized = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
      target = Math.round(normalized * lastFrame) / fps;
      schedule();
    },
    refresh: schedule,
    destroy() {
      destroyed = true;
      cancelFrame(frame);
      video.removeEventListener('loadeddata', schedule);
      video.removeEventListener('loadedmetadata', schedule);
      video.removeEventListener('seeked', settled);
    },
  };
}
