import { useCallback, useEffect, useRef, useState } from 'react';
import '@fontsource/marcellus/latin-400.css';
import '@fontsource-variable/mulish/wght.css';
import { event, games } from './content.js';
import RegistrationPortal from './EventPanel.jsx';
import TournamentGuide, { RegistrationClock } from './TournamentGuide.jsx';
import { registrationId } from './registration.js';
import { AmbientField, PointerReticle, useWorldMotion, useReducedPreference } from './motion.jsx';
import SceneVideo, { useMediaVariant } from './SceneVideo.jsx';
import { useSceneJourney } from './useSceneJourney.js';
import './styles.css';
import './motion.css';

const art = import.meta.env.BASE_URL + 'art/';
const frostedLogo = art + 'trinity-frosted-clear.webp';
const chapters = [{ id: 'home', name: 'Home', art: 'home' }, ...games];
const links = [
  ['home', 'Home'], ['prize-pool', 'Prize pool'], ['timeline', 'Timeline'], ['games', 'Games'],
  ['teams', 'Teams'], ['rules', 'Rules'], ['rulebooks', 'Rulebooks'], ['register', 'Registration'],
  ['about', 'About'], ['contact', 'Contact'],
];
const portalGames = new Map(games.map((game) => [registrationId(game.id), game]));
const sectionIds = [...links.slice(1).map(([id]) => id), 'footer', ...portalGames.keys()];
const aliases = {
  'event-hub': 'register', 'registration': 'register', 'registered-teams': 'teams',
  'your-next-chapter': 'prize-pool', 'event': 'about', 'organizers': 'contact',
};
const heroSparks = [[12, 27], [23, 49], [17, 74], [30, 81], [73, 33], [84, 45], [76, 68], [91, 75]];

function Ornament() {
  return <span className="ornament" aria-hidden="true"><i /><i /><i /></span>;
}

function WorldChapter({ chapter, active, warm, visible, variant, blocked, reduced, sceneRef, navigate, onGame }) {
  const home = chapter.id === 'home';
  return <section ref={sceneRef} className={'world-scene world-' + chapter.art + (active ? ' is-active' : '')}
    aria-labelledby={'title-' + chapter.id} aria-hidden={!active} inert={!active}>
    <div className="world-depth" aria-hidden="true">
      <div className="world-camera">
        {home ? <picture className="hero-picture">
          <source media="(max-aspect-ratio: 5/6)" srcSet={art + 'emerald-squad-mobile.webp'} />
          <img className="world-picture" src={art + 'emerald-squad-wide.webp'} alt="" fetchPriority="high" />
        </picture>
          : <SceneVideo game={chapter} warm={warm} visible={visible} active={active}
              variant={variant} blocked={blocked} reduced={reduced} />}
      </div>
    </div>
    <div className="world-shade" aria-hidden="true" />
    {home && <AmbientField scene="home" active={active && visible} />}
    {home && <div className="hero-glare" aria-hidden="true">
      {heroSparks.map(([x, y], index) => <i key={x} style={{ left: x + '%', top: y + '%', '--spark-delay': -index * 1.7 + 's', '--spark-duration': 9 + index % 3 * 3 + 's' }} />)}
    </div>}
    {home ? <div className="chapter-composition hero-composition">
      <div className="hero-main">
        <h1 className="hero-logo" id="title-home"><img src={frostedLogo} alt="Trinity Showdown" width="960" height="454" fetchPriority="high" /></h1>
        <RegistrationClock backdrop active={active} />
      </div>
      <div className="hero-entry">
        <div className="chapter-actions">
          <a className="portal-button" href="#register" onClick={(e) => { e.preventDefault(); navigate('register'); }}>Register now</a>
          <a className="portal-button portal-quiet" href="#cod-mobile" onClick={(e) => { e.preventDefault(); navigate('cod-mobile'); }}>View games</a>
        </div>
        <p className="hero-meta"><span>Four games</span><i /><span>{event.date === 'To be announced' ? 'Event date to be announced' : event.date}</span></p>
      </div>
    </div> : <div className="chapter-composition game-composition">
      <h2 className="chapter-title" id={'title-' + chapter.id}><span>{chapter.art === 'coc' ? chapter.name : <>
        {chapter.title[0].replace(/:$/, '')}{' '}<small>{chapter.title[1]}</small>
      </>}</span></h2>
      <p className="chapter-genre">{chapter.genre}</p>
      <p className="chapter-teaser">{chapter.teaser}</p>
      <div className="chapter-actions">
        <a className="portal-button" href={'#' + registrationId(chapter.id)} onClick={(e) => { e.preventDefault(); navigate(registrationId(chapter.id)); }}>Register now</a>
        <a className="portal-button portal-quiet" href="#games" onClick={(e) => { e.preventDefault(); onGame(chapter.id); navigate('games'); }}>Game details</a>
      </div>
    </div>}
  </section>;
}

function ThemeToggle({ dark, onToggle }) {
  return <button type="button" className="theme-toggle" onClick={onToggle} aria-label="Dark mode"
    aria-pressed={dark} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" /></>
        : <path d="M20.8 14.4A9 9 0 0 1 9.6 3.2a9 9 0 1 0 11.2 11.2Z" />}
    </svg>
  </button>;
}

function NavigationMenu({ open, onClose, navigate, themeControl }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current.open) dialog.current.close();
  }, [open]);
  return <dialog ref={dialog} className="world-menu" aria-labelledby="menu-title" onClose={onClose}>
    <div className="menu-frame">
      {open && <AmbientField scene="dialog" active />}
      <div className="menu-top"><span className="eyebrow" id="menu-title">Trinity Showdown</span>
        <div className="toolbar-actions">{themeControl}
          <form method="dialog"><button className="close-menu" autoFocus>Close <span aria-hidden="true">×</span></button></form>
        </div>
      </div>
      <div className="menu-layout">
        <div className="menu-art" aria-hidden="true"><Ornament /><img src={frostedLogo} alt="" /></div>
        <nav aria-label="Main navigation" className="menu-chapters">
          {links.map(([id, label]) => <a href={'#' + id} key={id} onClick={(e) => {
            e.preventDefault();
            dialog.current.close();
            onClose();
            navigate(id);
          }}><span>{label}</span><i aria-hidden="true" /></a>)}
        </nav>
      </div>
    </div>
  </dialog>;
}

export default function App() {
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState(null);
  const [selectedGame, setSelectedGame] = useState(games[0].id);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme);
  const world = useRef(null);
  const guide = useRef(null);
  const header = useRef(null);
  const isModalOpen = menu || Boolean(panel);
  const reduced = useReducedPreference();
  const variant = useMediaVariant();
  const { active, visible, inGuide, sceneRefs, anchors, goTo } =
    useSceneJourney(chapters, world, isModalOpen, reduced, guide, sectionIds, header);
  useWorldMotion(world, !isModalOpen && !reduced && !inGuide);
  useWorldMotion(guide, !isModalOpen && !reduced && inGuide);

  const navigate = useCallback((id) => {
    const index = chapters.findIndex((chapter) => chapter.id === id);
    if (index !== -1) {
      goTo(index);
      return;
    }
    const target = document.getElementById(id);
    if (!target) return;
    if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    const portalGame = portalGames.get(id);
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: reduced || !inGuide || portalGame ? 'instant' : 'smooth' });
    if (portalGame) setPanel(portalGame);
  }, [goTo, inGuide, reduced]);

  useEffect(() => {
    const fromHash = () => {
      const hash = location.hash.slice(1);
      const id = Object.hasOwn(aliases, hash) ? aliases[hash] : hash;
      const target = document.getElementById(id || 'home');
      if (!target) return;
      if (id && id !== hash) history.replaceState(null, '', '#' + id);
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
      setPanel(portalGames.get(id) ?? null);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  function route(event, id) {
    event.preventDefault();
    navigate(id);
  }

  function closePortal() {
    setPanel(null);
    if (portalGames.has(location.hash.slice(1))) history.replaceState(null, '', '#register');
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
    try { localStorage.setItem('trinity-theme', next); } catch {}
    setTheme(next);
  }

  const next = chapters[active + 1]?.id ?? 'prize-pool';
  const headerExpanded = active > 0 || inGuide;
  const themeControl = <ThemeToggle dark={theme === 'dark'} onToggle={toggleTheme} />;
  return <>
    <a className="skip-link" href={inGuide ? '#prize-pool' : '#chapter-content'}>Skip to content</a>
    <header ref={header} className={'site-header' + (inGuide ? ' is-editorial' : '')}>
      <div className="nav-wing nav-wing-left">
        <div className="nav-actions">
          <button className="menu-toggle" onClick={() => setMenu(true)} aria-haspopup="dialog" aria-expanded={menu} aria-label="Open navigation menu">
            <span className="menu-glyph" aria-hidden="true"><i /><i /><i /></span>Menu
          </button>
          {themeControl}
        </div>
      </div>
      <a className="header-brand" href="#home" onClick={(e) => route(e, 'home')} inert={!headerExpanded} aria-label="Trinity Showdown home">
        <img src={frostedLogo} alt="" width="960" height="454" />
      </a>
      <div className="nav-wing nav-wing-right">
        <a className="registration-link" href="#register" onClick={(e) => route(e, 'register')}><i aria-hidden="true" />Register now</a>
      </div>
    </header>
    <main>
      <div className={'world-stage' + (inGuide ? ' is-behind-guide' : '')} ref={world} inert={inGuide} aria-hidden={inGuide || undefined}>
        <div className="stage-scenes" id="chapter-content" tabIndex={-1}>
          {chapters.map((chapter, index) => <WorldChapter key={chapter.id} chapter={chapter}
            active={active === index} warm={!inGuide && (index === active + 1 || visible.includes(index))}
            visible={visible.includes(index)} variant={variant} blocked={isModalOpen} reduced={reduced}
            sceneRef={(node) => { sceneRefs.current[index] = node; }} navigate={navigate} onGame={setSelectedGame} />)}
        </div>
        <div className="transition-veil" aria-hidden="true" />
      </div>
      <div className="chapter-track" aria-hidden="true">
        {chapters.map((chapter, index) => <div key={chapter.id} className={'chapter-anchor' + (index ? ' game-anchor' : '')}
          id={chapter.id} ref={(node) => { anchors.current[index] = node; }} />)}
      </div>
      <TournamentGuide guideRef={guide} active={inGuide && !isModalOpen} selectedGame={selectedGame} onGame={setSelectedGame}
        reduced={reduced} onNavigate={navigate} />
    </main>
    {!inGuide && <>
      <nav className="chapter-rail" aria-label="Game chapters">
        {chapters.map((chapter, index) => <a key={chapter.id} href={'#' + chapter.id} aria-label={chapter.name}
          aria-current={active === index ? 'step' : undefined} onClick={(e) => route(e, chapter.id)}>
          <i aria-hidden="true" /><span>{chapter.name}</span>
        </a>)}
      </nav>
      <a className="scroll-prompt" href={'#' + next} onClick={(e) => route(e, next)}>
        <span>{active === 0 ? 'Scroll to explore' : active === chapters.length - 1 ? 'View prize pool' : 'Next chapter'}</span>
        <i aria-hidden="true" />
      </a>
    </>}
    <NavigationMenu open={menu} onClose={() => setMenu(false)} navigate={navigate} themeControl={themeControl} />
    <RegistrationPortal game={panel} onClose={closePortal} themeControl={themeControl} />
    <PointerReticle enabled={!inGuide && !reduced && !isModalOpen} />
  </>;
}
