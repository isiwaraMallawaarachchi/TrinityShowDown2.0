import { useEffect, useRef, useState } from 'react';
import { coChairs, event, games, publishedTeams } from './content.js';
import { countdownAt, deadlineTime, millisecondsPerMinute } from './countdown.js';
import { registrationId, rosterRules, rosterSummary } from './registration.js';
import media from './scene-media.json';
import './tournament-guide.css';

const asset = (path) => import.meta.env.BASE_URL + path;
const deadline = event.registrationClosesAt ?? import.meta.env.VITE_REGISTRATION_CLOSES_AT;
const closesAt = deadlineTime(deadline);
const dateText = closesAt === null ? 'To be announced' : new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
  timeZone: 'Asia/Colombo', timeZoneName: 'short',
}).format(closesAt);
const hosts = [
  { id: 'mora', name: 'Mora Esports Community', file: 'mora-esports.png', width: 533, height: 469 },
  { id: 'rotaract', name: 'Rotaract Club of University of Moratuwa', file: 'rotaract-mora.png', width: 1216, height: 336 },
];

function OrganizerMarks({ compact = false }) {
  return <ul className={'host-marks' + (compact ? ' host-marks-compact' : '')}>
    {hosts.map((host) => <li key={host.id} className={'host-mark host-' + host.id}>
      <img src={asset('art/' + host.file)} alt={compact ? host.name : ''} width={host.width} height={host.height} />
      {!compact && <span>{host.name}</span>}
    </li>)}
  </ul>;
}

export function RegistrationClock({ backdrop = false, active = true }) {
  const [clock, setClock] = useState(() => countdownAt(closesAt, Date.now()));
  useEffect(() => {
    if (!active || closesAt === null) return;
    let timer;
    function update() {
      clearTimeout(timer);
      if (document.hidden) return;
      const now = Date.now();
      const value = countdownAt(closesAt, now);
      setClock(value);
      if (value.state === 'counting') {
        const nextMinute = (closesAt - now) % millisecondsPerMinute || millisecondsPerMinute;
        timer = setTimeout(update, nextMinute);
      }
    }
    update();
    document.addEventListener('visibilitychange', update);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', update); };
  }, [active]);

  const label = { pending: 'Registration deadline to be announced', counting: 'Registration closes in', closed: 'Registration closed' }[clock.state];
  return <div className={'registration-clock' + (backdrop ? ' clock-backdrop' : '')}>
    <p className="clock-caption" role="status">{label}</p>
    <dl className="clock-digits" role="timer" aria-live="off" aria-label="Time left to register">
      {['Days', 'Hours', 'Minutes'].map((unit, index) => <div key={unit}>
        <dt>{unit}</dt><dd>{backdrop && clock.state === 'pending' ? '—' : clock.units[index]}</dd>
      </div>)}
    </dl>
  </div>;
}

function Crest({ className = '' }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path d="M32 4 54 14v20c0 11-8 20-22 26C18 54 10 45 10 34V14L32 4Z" stroke="currentColor" strokeWidth="1.25" />
    <path d="m32 17 14 14-14 14-14-14 14-14Z M32 24v14m-7-7h14" stroke="currentColor" strokeWidth="1.25" />
  </svg>;
}

function SectionHeading({ id, title, description }) {
  return <header className="guide-heading">
    <h2 id={id}>{title}</h2>
    {description && <p className="guide-intro">{description}</p>}
  </header>;
}

function About() {
  return <section className="guide-section guide-about" id="about" tabIndex={-1} aria-labelledby="about-title">
    <SectionHeading id="about-title" title="About Trinity Showdown"
      description="Four mobile games bring university teams together for one tournament." />
    <div className="about-copy">
      <article><h3>Our mission</h3><p>Give university players a place to compete, develop their skills, and represent their teams.</p></article>
      <article><h3>Our vision</h3><p>Build a lasting community for competitive mobile gaming in Sri Lanka.</p></article>
    </div>
    <div className="about-hosts">
      <p className="eyebrow">Organized by</p>
      <OrganizerMarks />
    </div>
    <div className="timeline">
      <h3>Tournament timeline</h3>
      <ol>{event.milestones.map((milestone, index) => <li key={milestone.title}>
        <h4>{milestone.title}</h4>
        <p className="detail-note">{index === 1 ? dateText : index === 2 ? event.date : 'To be announced'}</p>
        <p>{milestone.description}</p>
      </li>)}</ol>
    </div>
  </section>;
}

function GameDetails({ selected, onSelect, onNavigate }) {
  const index = Math.max(0, games.findIndex((game) => game.id === selected));
  function handleKeys(e) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    let next = index;
    if (e.key === 'ArrowLeft') next = (index - 1 + games.length) % games.length;
    if (e.key === 'ArrowRight') next = (index + 1) % games.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = games.length - 1;
    onSelect(games[next].id);
    e.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  }
  return <section className="guide-section guide-games" id="games" tabIndex={-1} aria-labelledby="games-title">
    <SectionHeading id="games-title" title="Games" />
    <div className="game-tabs" role="tablist" aria-label="Choose a game" onKeyDown={handleKeys}>
      {games.map((item, i) => <button key={item.id} type="button" role="tab" id={'game-tab-' + item.id}
        aria-selected={index === i} aria-controls={'game-panel-' + item.id} tabIndex={index === i ? 0 : -1}
        onClick={() => onSelect(item.id)}>
        <img src={asset(media[item.art].variants.compact.poster)} alt="" loading="lazy" />
        <span>{item.shortName}</span>
      </button>)}
    </div>
    {games.map((game, i) => <GamePanel key={game.id} game={game} active={i === index} onNavigate={onNavigate} />)}
  </section>;
}

function GamePanel({ game, active, onNavigate }) {
  return <div className="game-details" role="tabpanel" aria-labelledby={'game-tab-' + game.id}
      id={'game-panel-' + game.id} tabIndex={0} hidden={!active}>
      <figure className="editorial-image"><img src={asset(media[game.art].variants.compact.poster)} width="1280" height="720" alt="" loading="lazy" /></figure>
      <div className="game-details-copy">
        <p className="eyebrow">{game.genre}</p><h3>{game.name}</h3><p>{game.teaser}</p>
        <dl className="game-facts">
          {[
            ['Match format', game.format], ['Team size', rosterRules[game.id].provisional ? 'Provisional · ' + rosterSummary(game.id) : rosterSummary(game.id)],
            ['Match duration', game.duration], ['Prize pool', game.prizePool],
            ['Schedule', game.schedule], ['Entry fee', game.entryFee ?? event.entryFee],
          ].map(([label, value]) =>
            <div key={label}><dt>{label}</dt><dd>{value ?? 'To be announced'}</dd></div>)}
        </dl>
        <div className="game-details-links">
          <a className="guide-link" href="#rules" onClick={(e) => { e.preventDefault(); onNavigate('rules'); }}>Read the rules <span aria-hidden="true">↗</span></a>
          <a className="guide-link" href={'#' + registrationId(game.id)} onClick={(e) => { e.preventDefault(); onNavigate(registrationId(game.id)); }}>Register now <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </div>;
}

function TeamTrack({ game, teams, reduced }) {
  const track = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const list = track.current;
    function update() {
      const start = list.scrollLeft < 2;
      const end = list.scrollLeft >= list.scrollWidth - list.clientWidth - 2;
      setEdges((old) => old.start === start && old.end === end ? old : { start, end });
    }
    const observer = new ResizeObserver(update);
    observer.observe(list);
    list.addEventListener('scroll', update, { passive: true });
    update();
    return () => { observer.disconnect(); list.removeEventListener('scroll', update); };
  }, [teams.length]);

  function slide(direction) {
    const list = track.current;
    const first = list.firstElementChild;
    const step = first.nextElementSibling ? first.nextElementSibling.offsetLeft - first.offsetLeft : first.offsetWidth;
    list.scrollBy({ left: direction * step, behavior: reduced ? 'instant' : 'smooth' });
  }

  const trackId = 'teams-' + game.id;
  return <div className="lineup" role="region" aria-label={game.name + ' team lineup'}>
      <div className="lineup-bar"><p className="eyebrow">{teams.length} {teams.length === 1 ? 'team' : 'teams'} approved</p>
        {!(edges.start && edges.end) && <div className="lineup-arrows">
          <button type="button" onClick={() => slide(-1)} disabled={edges.start} aria-controls={trackId} aria-label="Previous team cards">←</button>
          <button type="button" onClick={() => slide(1)} disabled={edges.end} aria-controls={trackId} aria-label="Next team cards">→</button>
        </div>}
      </div>
      <ul ref={track} id={trackId} className="team-track" tabIndex={0} aria-label={game.name + ' registered teams'} onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        slide(e.key === 'ArrowLeft' ? -1 : 1);
      }}>
        {teams.map((team) => <li key={team.id}>
          <div className="team-emblem">{team.logoUrl ? <img src={team.logoUrl} alt="" loading="lazy" /> : <Crest />}</div>
          <h4>{team.name}</h4>
        </li>)}
      </ul>
    </div>;
}

function TeamLineup({ reduced, onNavigate }) {
  return <section className="guide-section guide-teams" id="teams" tabIndex={-1} aria-labelledby="teams-title">
    <SectionHeading id="teams-title" title="Competing teams" />
    <div className="lineup-groups">{games.map((game) => {
      const teams = publishedTeams.filter((team) => team.gameId === game.id);
      return <section key={game.id} className="lineup-group" aria-labelledby={'lineup-' + game.id}>
        <header className="lineup-game">
          <img src={asset(media[game.art].variants.compact.poster)} alt="" loading="lazy" />
          <h3 id={'lineup-' + game.id}>{game.name}</h3>
        </header>
        {teams.length ? <TeamTrack game={game} teams={teams} reduced={reduced} /> :
          <div className="lineup-empty">
            <p><Crest /> No approved teams yet.</p>
            <a className="guide-link" href={'#' + registrationId(game.id)} aria-haspopup="dialog"
              aria-label={'Register for ' + game.name} onClick={(e) => { e.preventDefault(); onNavigate(registrationId(game.id)); }}>
              Register a team <span aria-hidden="true">↗</span>
            </a>
          </div>}
      </section>;
    })}</div>
  </section>;
}

function Rules() {
  return <section className="guide-section guide-rules" id="rules" tabIndex={-1} aria-labelledby="rules-title">
    <SectionHeading id="rules-title" title="Rules & eligibility" />
    <div className="rules-columns">
      <article><h3>Eligibility</h3><ul>
        <li>Each player may enter one team in one game for this edition.</li>
        <li>Captains must provide player details and university IDs as part of registration.</li>
        <li>Follow your game's published roster and eligibility requirements.</li>
      </ul></article>
      <article><h3>Fair play</h3><ul>
        <li>Use the account listed in your registration.</li>
        <li>Follow the match rules and organizer instructions.</li>
        <li>Cheating, account sharing, and match fixing are prohibited.</li>
      </ul></article>
    </div>
    <h3 className="rulebook-title">Game rulebooks</h3>
    <ul className="rulebooks">{games.map((game) => <li key={game.id}><span>{game.name}</span>
      {game.rulebookUrl ? <a className="guide-link" href={game.rulebookUrl}>Download rulebook <span aria-hidden="true">↗</span></a> : <span className="detail-note">To be announced</span>}
    </li>)}</ul>
  </section>;
}

function Registration({ onNavigate }) {
  return <section className="registration-section" id="register" tabIndex={-1} aria-labelledby="register-title">
    <div className="registration-inner">
      <SectionHeading id="register-title" title="Register your team"
        description="The captain submits one entry with the roster, team logo, and bank transfer proof." />
      <RegistrationClock />
      <dl className="registration-facts">
        <div><dt>Deadline</dt><dd>{dateText}</dd></div>
        <div><dt>Team size</dt><dd><a href="#games" onClick={(e) => { e.preventDefault(); onNavigate('games'); }}>See game details</a></dd></div>
        <div><dt>Entry fee</dt><dd>{event.entryFee ?? 'To be announced'}</dd></div>
      </dl>
      <div className="registration-portals">{games.map((game) => {
        const id = registrationId(game.id);
        return <article id={id} key={id} tabIndex={-1} className="registration-card">
          <a href={'#' + id} aria-haspopup="dialog" aria-label={'Register for ' + game.name} onClick={(e) => { e.preventDefault(); onNavigate(id); }}>
            <img src={asset(media[game.art].variants.compact.poster)} width="1280" height="720" alt="" loading="lazy" />
            <div className="registration-card-copy">
              <h3>{game.name}</h3>
              <p>{rosterSummary(game.id)}{rosterRules[game.id].provisional && ' · Provisional'}</p>
              <span className="registration-card-action">Register now <span aria-hidden="true">↗</span></span>
            </div>
          </a>
        </article>;
      })}</div>
    </div>
  </section>;
}

function Contact() {
  return <section className="guide-section guide-contact" id="contact" tabIndex={-1} aria-labelledby="contact-title">
    <SectionHeading id="contact-title" title="Contact us" />
    <div className="contact-columns">
      <article>
        <h3>Get in touch</h3>
        <ul className="contact-list">
          {coChairs.map(({ name, phone, email }) => <li key={email}>
            <p className="contact-role">Project co-chair</p>
            <p className="contact-name">{name}</p>
            <a href={'tel:+94' + phone.slice(1)}>{phone}</a>
            <a href={'mailto:' + email}>{email}</a>
          </li>)}
        </ul>
      </article>
      <article><h3>Tournament organizers</h3><OrganizerMarks /></article>
    </div>
  </section>;
}

function Footer({ onNavigate }) {
  const columns = [
    ['Explore', [['about', 'About us'], ['games', 'Games'], ['teams', 'Competing teams'], ['rules', 'Rules']]],
    ['Tournament', [['register', 'Registration'], ['games', 'Prize pool'], ['contact', 'Contact']]],
  ];
  return <footer className="site-footer" id="footer" tabIndex={-1}>
    <div className="footer-inner">
      <div className="footer-identity">
        <OrganizerMarks compact />
        <img src={asset('art/trinity.svg')} alt="Trinity Showdown" width="174" height="77" />
      </div>
      {columns.map(([heading, links]) => <nav key={heading} aria-label={heading}><h2 className="eyebrow">{heading}</h2>
        {links.map(([id, name]) => <a href={'#' + id} key={id} onClick={(e) => { e.preventDefault(); onNavigate(id); }}>{name}</a>)}
      </nav>)}
      <div><h2 className="eyebrow">Follow us</h2><p>Official channels to be announced.</p></div>
    </div>
  </footer>;
}

export default function TournamentGuide({ guideRef, selectedGame, onGame, reduced, onNavigate }) {
  return <div className="tournament-guide" ref={guideRef}>
    <About />
    <GameDetails selected={selectedGame} onSelect={onGame} onNavigate={onNavigate} />
    <TeamLineup reduced={reduced} onNavigate={onNavigate} />
    <Rules />
    <Registration onNavigate={onNavigate} />
    <Contact />
    <Footer onNavigate={onNavigate} />
  </div>;
}
