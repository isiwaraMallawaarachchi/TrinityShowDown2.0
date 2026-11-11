import { useEffect, useRef, useState } from 'react';
import manifest from './scene-media.json';
import { createMediaScrubber } from './media-scrubber.js';
import GameArtwork from './GameArtwork.jsx';

const clips = new Map();
const asset = (file) => `${import.meta.env.BASE_URL}${file}`;

// Fetch a complete tiny clip before scrubbing: seeks never trigger remote byte-range fetches.
// Only the current chapter and its neighbours retain blobs; leaving that window releases them.
function acquireClip(src) {
  let entry = clips.get(src);
  if (!entry) {
    const controller = new AbortController();
    entry = { refs: 0, controller, url: null, promise: null };
    entry.promise = fetch(src, { signal: controller.signal, priority: 'low' })
      .then((response) => { if (!response.ok) throw new Error(`Media ${response.status}`); return response.blob(); })
      .then((blob) => { if (!entry.refs) throw new DOMException('Released', 'AbortError'); entry.url = URL.createObjectURL(blob); return entry.url; });
    clips.set(src, entry);
  }
  entry.refs++;
  return {
    promise: entry.promise,
    release() {
      if (--entry.refs > 0) return;
      entry.controller.abort();
      if (entry.url) URL.revokeObjectURL(entry.url);
      if (clips.get(src) === entry) clips.delete(src);
    },
  };
}

export function useMediaVariant() {
  function select() {
    if (window.matchMedia('(max-width: 600px) and (orientation: portrait)').matches) return 'portrait';
    if (navigator.connection?.saveData || ['slow-2g', '2g'].includes(navigator.connection?.effectiveType)) return 'compact';
    return window.innerWidth * Math.min(window.devicePixelRatio || 1, 1.5) > 1440 || window.innerHeight > 900 ? 'desktop' : 'compact';
  }
  const [variant, setVariant] = useState(select);
  useEffect(() => {
    let timer;
    const resize = () => { clearTimeout(timer); timer = setTimeout(() => setVariant(select()), 180); };
    window.addEventListener('resize', resize);
    return () => { clearTimeout(timer); window.removeEventListener('resize', resize); };
  }, []);
  return variant;
}

export default function SceneVideo({ game, warm, visible, variant, progress, reduced }) {
  const media = manifest[game.art];
  const files = media.variants[variant];
  const [resource, setResource] = useState(null);
  const [readySource, setReadySource] = useState(null);
  const video = useRef(null);
  const source = asset(files.video);
  const blob = warm && !reduced && resource?.source === source && clips.get(source)?.url === resource.url ? resource.url : null;

  useEffect(() => {
    if (!warm || reduced) return;
    let alive = true;
    const lease = acquireClip(source);
    lease.promise.then((url) => { if (alive) setResource({ source, url }); }).catch(() => { /* Game artwork remains visible on network failure. */ });
    return () => { alive = false; lease.release(); };
  }, [source, warm, reduced]);

  useEffect(() => {
    const element = video.current;
    if (!element || !blob || !visible || reduced) return;
    const scrubber = createMediaScrubber(element, { fps: media.fps, duration: media.duration, onReady: () => setReadySource(blob) });
    const unsubscribe = progress.subscribe(scrubber.setProgress);
    const visibility = () => { if (!document.hidden) scrubber.refresh(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { unsubscribe(); scrubber.destroy(); setReadySource(null); document.removeEventListener('visibilitychange', visibility); };
  }, [blob, visible, reduced, media, progress]);

  return <div className="scene-film" data-media={game.art} data-variant={variant} data-ready={Boolean(blob && readySource === blob)}>
    {(warm || visible) && <GameArtwork game={game} className="film-poster" loading="eager" />}
    {blob && visible && !reduced && <video ref={video} className={`film-video${readySource === blob ? ' is-decoded' : ''}`} src={blob} muted playsInline preload="auto" disablePictureInPicture controlsList="nodownload noremoteplayback" aria-hidden="true" tabIndex={-1} />}
  </div>;
}
