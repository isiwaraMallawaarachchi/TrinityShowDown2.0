import { event } from '../../content/event.js';
import { RegistrationClock } from '../guide/TournamentGuide.jsx';
import { registrationId } from '../registration/registration.js';
import { AmbientField } from '../../shared/motion.jsx';
import GameArtwork from '../../shared/GameArtwork.jsx';
import { formatEventTime } from '../../shared/countdown.js';
import SceneVideo from './SceneVideo.jsx';

const art = import.meta.env.BASE_URL + 'art/';
const heroSparks = [[12, 27], [23, 49], [17, 74], [30, 81], [73, 33], [84, 45], [76, 68], [91, 75]];

export default function WorldChapter({ chapter, logo, active, warm, visible, variant, blocked, reduced, touchJourney, sceneRef, navigate, onGame, schedule }) {
  const home = chapter.id === 'home';
  return <section ref={sceneRef} className={'world-scene world-' + chapter.art + (active ? ' is-active' : '')}
    aria-labelledby={'title-' + chapter.id} aria-hidden={!active} inert={!active}>
    <div className="world-depth" aria-hidden="true">
      <div className="world-camera">
        {home ? <picture className="hero-picture">
          <source media="(max-aspect-ratio: 5/6)" srcSet={art + 'emerald-squad-mobile.webp'} />
          <img className="world-picture" src={art + 'emerald-squad-wide.webp'} alt="" fetchPriority="high" />
        </picture>
          : <>
            {touchJourney && <GameArtwork game={chapter} className="film-poster" loading={warm ? 'eager' : 'lazy'} />}
            <SceneVideo game={chapter} warm={warm} visible={visible} active={active}
              variant={variant} blocked={blocked} reduced={reduced} showPoster={!touchJourney} />
          </>}
      </div>
    </div>
    <div className="world-shade" aria-hidden="true" />
    {home && <AmbientField scene="home" active={active && visible} />}
    {home && <div className="hero-glare" aria-hidden="true">
      {heroSparks.map(([x, y], index) => <i key={x} style={{ left: x + '%', top: y + '%', '--spark-delay': -index * 1.7 + 's', '--spark-duration': 9 + index % 3 * 3 + 's' }} />)}
    </div>}
    {home ? <div className="chapter-composition hero-composition">
      <div className="hero-main">
        <h1 className="hero-logo" id="title-home"><img src={logo} alt="Trinity Showdown" width="960" height="454" fetchPriority="high" /></h1>
        <RegistrationClock backdrop active={active} deadline={schedule.closesAt} />
      </div>
      <div className="hero-entry">
        <div className="chapter-actions">
          <a className="portal-button" href="#register" onClick={(e) => { e.preventDefault(); navigate('register'); }}>Register now</a>
          <a className="portal-button portal-quiet" href="#cod-mobile" onClick={(e) => { e.preventDefault(); navigate('cod-mobile'); }}>View games</a>
        </div>
        <p className="hero-meta"><span>Four games</span><i /><span>{schedule.startsAt ? formatEventTime(schedule.startsAt) :
          event.date === 'To be announced' ? 'Event date to be announced' : event.date}</span></p>
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
