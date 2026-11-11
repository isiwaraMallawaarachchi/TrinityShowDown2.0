import { useEffect, useRef, useState } from 'react';
import manifest from './scene-media.json';
import GameArtwork from './GameArtwork.jsx';

const asset = (file) => `${import.meta.env.BASE_URL}${file}`;
const constrained = () => navigator.connection?.saveData ||
  ['slow-2g', '2g', '3g'].includes(navigator.connection?.effectiveType);

function selectVariant() {
  if (window.matchMedia('(max-width: 680px) and (max-aspect-ratio: 3/4)').matches) return 'portrait';
  if (constrained()) return 'compact';
  const density = Math.min(window.devicePixelRatio || 1, 1.5);
  return Math.max(window.innerWidth, window.innerHeight * 16 / 9) * density >= 1280 ? 'desktop' : 'compact';
}

export function useMediaVariant() {
  const [variant, setVariant] = useState(selectVariant);
  useEffect(() => {
    let timer;
    const update = () => { clearTimeout(timer); timer = setTimeout(() => setVariant(selectVariant()), 180); };
    window.addEventListener('resize', update);
    navigator.connection?.addEventListener('change', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', update);
      navigator.connection?.removeEventListener('change', update);
    };
  }, []);
  return variant;
}

function SceneFilm({ game, variant, active, blocked, reduced }) {
  const [decoded, setDecoded] = useState(false);
  const video = useRef(null);

  useEffect(() => {
    const element = video.current;
    if (!element || !active || blocked) return;
    function syncPlayback() {
      if (document.hidden) element.pause();
      // A finished clip stays on its last frame while this scene is mounted.
      else if (element.paused && !element.ended) {
        element.play().catch(() => { /* If autoplay is unavailable, show the still artwork or decoded frame. */ });
      }
    }
    syncPlayback();
    document.addEventListener('visibilitychange', syncPlayback);
    return () => {
      document.removeEventListener('visibilitychange', syncPlayback);
      element.pause();
    };
  }, [active, blocked, reduced]);

  return <div className="scene-film" data-media={game.art} data-variant={variant} data-ready={!reduced && decoded}>
    <GameArtwork game={game} className="film-poster" loading="eager" />
    {!reduced && <video ref={video} className={`film-video${decoded ? ' is-decoded' : ''}`}
      src={asset(manifest[game.art].variants[variant].video)} muted playsInline
      preload={active || !constrained() ? 'auto' : 'metadata'}
      onLoadedData={() => setDecoded(true)} onPlaying={() => setDecoded(true)} onError={() => setDecoded(false)}
      disablePictureInPicture disableRemotePlayback aria-hidden="true" tabIndex={-1} />}
  </div>;
}

export default function SceneVideo({ game, warm, visible, active, blocked, variant, reduced }) {
  const [retainedVariant, setRetainedVariant] = useState(variant);
  useEffect(() => {
    // Keep the same element and playhead through orientation changes while on screen.
    if (!visible) setRetainedVariant(variant);
  }, [variant, visible]);
  if (!warm) return null;
  const quality = visible ? retainedVariant : variant;
  return <SceneFilm key={`${quality}:${reduced}`} game={game} variant={quality} active={active}
    blocked={blocked} reduced={reduced} />;
}
