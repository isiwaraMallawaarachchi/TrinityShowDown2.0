import { useCallback, useEffect, useRef, useState } from 'react';
import '@fontsource/marcellus/latin-400.css';
import '@fontsource-variable/mulish/wght.css';
import { event, games } from '../content/event.js';
import RegistrationPortal from '../features/registration/EventPanel.jsx';
import TournamentGuide from '../features/guide/TournamentGuide.jsx';
import { registrationId } from '../features/registration/registration.js';
import { PointerReticle, useWorldMotion, useReducedPreference, useTouchJourney } from '../shared/motion.jsx';
import { useMediaVariant } from '../features/journey/SceneVideo.jsx';
import { useSceneJourney } from '../features/journey/useSceneJourney.js';
import { fetchEvent } from '../shared/api.js';
import WorldChapter from '../features/journey/WorldChapter.jsx';
import { NavigationMenu } from './SiteNavigation.jsx';
import '../styles/site.css';
import '../styles/motion.css';

const frostedLogo = import.meta.env.BASE_URL + 'art/trinity-frosted-clear.webp';
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
export default function App() {
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState(null);
  const [selectedGame, setSelectedGame] = useState(games[0].id);
  const [eventData, setEventData] = useState(null);
  const world = useRef(null);
  const guide = useRef(null);
  const header = useRef(null);
  const isModalOpen = menu || Boolean(panel);
  const reduced = useReducedPreference();
  const touchJourney = useTouchJourney();
  const variant = useMediaVariant(touchJourney);
  const { active, visible, inGuide, sceneRefs, anchors, goTo, goToSection } =
    useSceneJourney(chapters, world, isModalOpen, reduced, guide, sectionIds, header, touchJourney);
  useWorldMotion(world, !isModalOpen && !reduced && !inGuide && !touchJourney);
  useWorldMotion(guide, !isModalOpen && !reduced && inGuide);

  useEffect(() => {
    let controller;
    function update() {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      fetchEvent(controller.signal).then(setEventData).catch(() => {});
    }
    update();
    const timer = setInterval(update, 30_000);
    window.addEventListener('focus', update);
    return () => {
      controller?.abort();
      clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, []);

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
    goToSection(target, reduced || !inGuide || portalGame ? 'instant' : 'smooth');
    if (portalGame) setPanel(portalGame);
  }, [goTo, goToSection, inGuide, reduced]);

  useEffect(() => {
    const previousScrollRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    const fromHash = () => {
      const hash = location.hash.slice(1);
      const id = Object.hasOwn(aliases, hash) ? aliases[hash] : hash;
      const target = document.getElementById(id || 'home');
      if (!target) return;
      if (id && id !== hash) history.replaceState(null, '', '#' + id);
      if (sectionIds.includes(id)) goToSection(target, 'instant');
      else target.scrollIntoView({ block: 'start', behavior: 'instant' });
      setPanel(portalGames.get(id) ?? null);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => {
      history.scrollRestoration = previousScrollRestoration;
      window.removeEventListener('hashchange', fromHash);
    };
  }, [goToSection]);

  function route(event, id) {
    event.preventDefault();
    navigate(id);
  }

  function closePortal() {
    setPanel(null);
    if (portalGames.has(location.hash.slice(1))) history.replaceState(null, '', '#register');
  }

  const next = chapters[active + 1]?.id ?? 'prize-pool';
  const gameWindows = Object.values(eventData?.games ?? {}).filter(settings => settings.opensAt && settings.closesAt);
  const sharedDate = key => {
    const values = [...new Set(gameWindows.map(settings => settings[key]))];
    return values.length === 1 ? values[0] : null;
  };
  const schedule = {
    opensAt: sharedDate('opensAt'),
    closesAt: gameWindows.length ? sharedDate('closesAt') : event.registrationClosesAt,
    startsAt: eventData?.edition?.startsAt,
  };
  const headerExpanded = active > 0 || inGuide;
  const worldClasses = 'world-stage' + (touchJourney ? ' is-touch-journey' : '') +
    (!touchJourney && inGuide ? ' is-behind-guide' : '');
  const chapterAnchor = (chapter, index, children) => <div key={chapter.id}
    className={'chapter-anchor' + (index ? ' game-anchor' : '')} id={chapter.id}
    ref={(node) => { anchors.current[index] = node; }}>{children}</div>;
  return <>
    <a className="skip-link" href={inGuide ? '#prize-pool' : '#chapter-content'}>Skip to content</a>
    <header ref={header} className={'site-header' + (inGuide ? ' is-editorial' : '') + (touchJourney ? ' is-touch-header' : '')}>
      <div className="nav-wing nav-wing-left">
        <button className="menu-toggle" onClick={() => setMenu(true)} aria-haspopup="dialog" aria-expanded={menu} aria-label="Open navigation menu">
          <span className="menu-glyph" aria-hidden="true"><i /><i /><i /></span>Menu
        </button>
      </div>
      <a className="header-brand" href="#home" onClick={(e) => route(e, 'home')} inert={!headerExpanded} aria-label="Trinity Showdown home">
        <img src={frostedLogo} alt="" width="960" height="454" />
      </a>
      <div className="nav-wing nav-wing-right">
        <a className="registration-link" href="#register" onClick={(e) => route(e, 'register')}><i aria-hidden="true" />Register now</a>
      </div>
    </header>
    <main>
      <div className={worldClasses} ref={world} inert={inGuide} aria-hidden={inGuide || undefined}>
        <div className="stage-scenes" id="chapter-content" tabIndex={-1}>
          {chapters.map((chapter, index) => {
            const inView = visible.includes(index);
            const preloadNext = index === active + 1 && (!touchJourney || visible.length < 2);
            const scene = <WorldChapter key={chapter.id} chapter={chapter} logo={frostedLogo}
              active={active === index} warm={!inGuide && (preloadNext || inView)}
              visible={inView} variant={variant} blocked={isModalOpen} reduced={reduced}
              touchJourney={touchJourney} sceneRef={(node) => { sceneRefs.current[index] = node; }}
              navigate={navigate} onGame={setSelectedGame} schedule={schedule} />;
            return touchJourney ? chapterAnchor(chapter, index, scene) : scene;
          })}
        </div>
        {!touchJourney && <div className="transition-veil" aria-hidden="true" />}
      </div>
      {!touchJourney && <div className="chapter-track" aria-hidden="true">
        {chapters.map((chapter, index) => chapterAnchor(chapter, index))}
      </div>}
      <TournamentGuide guideRef={guide} active={inGuide && !isModalOpen} selectedGame={selectedGame} onGame={setSelectedGame} eventData={eventData} schedule={schedule}
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
    <NavigationMenu open={menu} onClose={() => setMenu(false)} navigate={navigate} links={links} logo={frostedLogo} />
    <RegistrationPortal game={panel} settings={eventData?.games?.[panel?.id]} institutions={eventData?.institutions}
      onClose={closePortal} />
    <PointerReticle enabled={!inGuide && !reduced && !isModalOpen} />
  </>;
}
