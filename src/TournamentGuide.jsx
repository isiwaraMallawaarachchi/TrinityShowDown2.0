import { useEffect, useRef, useState } from 'react';
import { coChairs, event, games, previewTeams, publishedTeams } from './content.js';
import { countdownAt, deadlineTime, millisecondsPerMinute } from './countdown.js';
import { registrationId, rosterRules, rosterSummary } from './registration.js';
import GameArtwork from './GameArtwork.jsx';
import { AmbientField } from './motion.jsx';
import './tournament-guide.css';

const asset = (path) => import.meta.env.BASE_URL + path;
const deadline = event.registrationClosesAt ?? import.meta.env.VITE_REGISTRATION_CLOSES_AT;
const closesAt = deadlineTime(deadline);
const dateText = closesAt === null ? 'To be announced' : new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
  timeZone: 'Asia/Colombo',
}).format(closesAt);
const hosts = [
  { id: 'mora', name: 'Mora Esports Community', file: 'mora-esports.png', width: 533, height: 469 },
  { id: 'rotaract', name: 'Rotaract Club of University of Moratuwa', file: 'rotaract-mora.png', width: 1216, height: 336 },
];
const socialLinks = [
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/rotaractmora/',
    icon: <>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1.1" />
    </>,
  },
  {
    name: 'Facebook',
    href: 'https://web.facebook.com/rotaractmora',
    icon: <path d="M14 21v-8h2.8l.4-3H14V8.1c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.8-.1-1.7-.2-2.5-.2-2.5 0-4.2 1.5-4.2 4.2V10H8v3h2.6v8Z" />,
  },
  {
    name: 'LinkedIn',
    href: 'https://www.linkedin.com/company/rotaract-club-of-university-of-moratuwa',
    icon: <path d="M4 9h3.5v11H4Zm1.75-5A1.9 1.9 0 1 1 5.75 7.8 1.9 1.9 0 0 1 5.75 4ZM10 9h3.3v1.5A3.7 3.7 0 0 1 16.6 8.7c3.5 0 4.1 2.3 4.1 5.1V20h-3.5v-5.5c0-1.3 0-2.9-1.8-2.9s-2.1 1.4-2.1 2.8V20H10Z" />,
  },
  {
    name: 'YouTube',
    href: 'https://www.youtube.com/user/rotaractmora',
    icon: <path fillRule="evenodd" d="M6 5h12a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Zm4 3.6v6.8l5.8-3.4Z" />,
  },
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

function useInView(ref, enabled) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, enabled]);
  return enabled && visible;
}

const victoryConfetti = Array.from({ length: 26 }, (_, index) => {
  const duration = 5.8 + (index % 7) * .56;
  return {
    left: `${5 + (index * 29 % 91)}%`,
    '--confetti-rest': `${8 + (index * 17 % 72)}%`,
    '--confetti-width': `${5 + (index * 5 % 6)}px`,
    '--confetti-angle': `${index * 49 % 360}deg`,
    '--confetti-drift': `${(index * 23 % 99) - 49}px`,
    '--confetti-duration': `${duration}s`,
    '--confetti-delay': `${-duration * ((index * 7 % 26) / 26)}s`,
  };
});

function PrizePool({ active, reduced }) {
  const stage = useRef(null);
  const visible = useInView(stage, active && !reduced);
  return <section className="guide-section guide-prizes" id="prize-pool" tabIndex={-1} aria-labelledby="prize-pool-title">
    <div className="prize-hero">
      <div ref={stage} className="victory-stage" data-active={visible} aria-hidden="true">
        <div className="victory-plinth"><span /><span /><span /></div>
        <img className="victory-cup" src={asset('art/championship-trophy.webp')} alt="" width="800" height="960" loading="lazy" decoding="async" />
        <div className="victory-confetti">
          {victoryConfetti.map((style) => <i key={style.left} style={style} />)}
        </div>
      </div>
      <div className="prize-hero-copy">
        <SectionHeading id="prize-pool-title" title="Grand prize pool" />
        <p className="grand-prize">{event.prizePool ?? 'To be announced'}</p>
      </div>
    </div>
    <dl className="prize-breakdown" aria-label="Prize pools by game">
      {games.map((game) => <div key={game.id}>
        <dt>{game.name}</dt>
        <dd>{game.prizePool ?? 'To be announced'}</dd>
      </div>)}
    </dl>
  </section>;
}

const milestoneIcons = {
  'registration-opens': 'M12 5v14m-7-7h14M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
  'registration-closes': 'M12 8v5l3 2m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  'tournament-day': 'M8 4h8v6a4 4 0 0 1-8 0Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v5m-4 1h8',
};

function TournamentTimeline({ reduced }) {
  const steps = useRef(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (reduced || started) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio < .25) return;
      setStarted(true);
      observer.disconnect();
    }, { threshold: .25 });
    observer.observe(steps.current);
    return () => observer.disconnect();
  }, [reduced, started]);

  return <section className="guide-section guide-timeline" id="timeline" tabIndex={-1} aria-labelledby="timeline-title">
    <SectionHeading id="timeline-title" title="Event timeline" />
    <ol ref={steps} className="timeline-steps" role="list" data-started={started}>
      {event.milestones.map((milestone, index) => <li key={milestone.id} className="timeline-step" style={{ '--milestone-index': index }}>
        <span className="timeline-node" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
            <path d={milestoneIcons[milestone.id]} />
          </svg>
        </span>
        {index < event.milestones.length - 1 && <span className="timeline-connector" aria-hidden="true" />}
        <div className="timeline-milestone">
          <h3>{milestone.title}</h3>
          <p className="timeline-date">{milestone.id === 'registration-closes' && closesAt !== null
            ? <time dateTime={deadline}>{dateText}</time>
            : milestone.id === 'tournament-day' ? event.date : 'To be announced'}</p>
          <p>{milestone.description}</p>
        </div>
      </li>)}
    </ol>
  </section>;
}

function About() {
  return <section className="guide-section guide-about" id="about" tabIndex={-1} aria-labelledby="about-title">
    <SectionHeading id="about-title" title="About Trinity Showdown"
      description="Four mobile games bring university teams together for one tournament." />
    <div className="about-copy">
      <article><h3>Our mission</h3><p>Give university players a place to compete, develop their skills, and represent their teams.</p></article>
      <article><h3>Our vision</h3><p>Build a lasting community for competitive mobile gaming in Sri Lanka.</p></article>
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
        <GameArtwork game={item} />
        <span className="game-tab-label">{item.shortName}</span>
      </button>)}
    </div>
    {games.map((game, i) => <GamePanel key={game.id} game={game} active={i === index} onNavigate={onNavigate} />)}
  </section>;
}

function GamePanel({ game, active, onNavigate }) {
  return <div className="game-details" role="tabpanel" aria-labelledby={'game-tab-' + game.id}
      id={'game-panel-' + game.id} tabIndex={0} hidden={!active}>
      <figure className="editorial-image"><GameArtwork game={game} /></figure>
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
          <a className="guide-link" href="#rulebooks" onClick={(e) => { e.preventDefault(); onNavigate('rulebooks'); }}>Game rulebooks <span aria-hidden="true">↗</span></a>
          <a className="guide-link" href={'#' + registrationId(game.id)} onClick={(e) => { e.preventDefault(); onNavigate(registrationId(game.id)); }}>Register now <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </div>;
}

function TeamTrack({ game, teams, preview, reduced }) {
  const track = useRef(null);
  const firstList = useRef(null);
  const [size, setSize] = useState({ list: 0, viewport: 0 });
  const overflowing = size.list > size.viewport + 2;
  const looping = !reduced && teams.length > 1 && size.list > 0;
  const copies = looping ? Math.ceil(size.viewport / size.list) : 0;
  const visible = useInView(track, looping);

  useEffect(() => {
    const viewport = track.current;
    const list = firstList.current;
    function update() {
      const width = list.getBoundingClientRect().width;
      const available = viewport.clientWidth;
      setSize((previous) => previous.list === width && previous.viewport === available
        ? previous : { list: width, viewport: available });
    }
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(list);
    update();
    return () => observer.disconnect();
  }, []);

  function slide(direction) {
    const [first, second] = firstList.current.children;
    const step = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth;
    track.current.scrollBy({ left: direction * step, behavior: 'instant' });
  }

  function renderList(copy) {
    return <ul key={copy} ref={copy === 0 ? firstList : undefined} className="team-tiles" role="list"
      aria-hidden={copy ? true : undefined} aria-label={copy ? undefined : game.name + (preview ? ' sample teams' : ' registered teams')}>
      {teams.map((team) => <li key={team.id}>
        <div className="team-emblem">
          {preview ? <span className="team-sample-emblem" aria-hidden="true">{team.name.split(' ').map((word) => word[0]).join('')}</span>
            : team.logoUrl ? <img src={team.logoUrl} alt="" loading="lazy" /> : <Crest />}
        </div>
        <h4>{team.name}</h4>
      </li>)}
    </ul>;
  }

  return <div ref={track} className="team-track" data-loop={looping} data-active={visible}
      role="region" aria-label={`${game.name} team logos`} tabIndex={!looping && overflowing ? 0 : undefined}
      onKeyDown={(e) => {
        if (looping || !overflowing || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        slide(e.key === 'ArrowLeft' ? -1 : 1);
      }}>
      <div className="team-belt" style={{ '--team-cycle': `${-size.list}px`, '--team-duration': `${size.list / 36}s` }}>
        {Array.from({ length: 1 + copies }, (_, index) => renderList(index))}
      </div>
    </div>;
}

function TeamLineup({ reduced, onNavigate }) {
  const previewEnabled = import.meta.env.DEV || import.meta.env.VITE_SHOW_SAMPLE_TEAMS === 'true';
  const showPreview = previewEnabled && publishedTeams.length === 0;
  return <section className="guide-section guide-teams" id="teams" tabIndex={-1} aria-labelledby="teams-title">
    <SectionHeading id="teams-title" title="Competing teams" />
    <div className="lineup-groups">{games.map((game) => {
      const teams = showPreview ? (previewTeams[game.id] ?? []).map((name) => ({ id: name, name }))
        : publishedTeams.filter((team) => team.gameId === game.id);
      return <section key={game.id} className="lineup-group" aria-labelledby={'lineup-' + game.id}>
        <h3 className="lineup-game" id={'lineup-' + game.id}>{game.name}</h3>
        {teams.length ? <TeamTrack game={game} teams={teams} preview={showPreview} reduced={reduced} /> :
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

function RuleItem({ children }) {
  return <li>
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3.5 8 3 3 6-6" />
    </svg>
    <span>{children}</span>
  </li>;
}

function Rules() {
  return <section className="guide-section guide-rules" id="rules" tabIndex={-1} aria-labelledby="rules-title">
    <SectionHeading id="rules-title" title="Rules & eligibility" />
    <div className="rules-columns">
      <article>
        <h3>Eligibility</h3>
        <ul role="list">
          <RuleItem>Open to players of all skill levels and regions</RuleItem>
          <RuleItem>All participants must be undergraduate students from the same university</RuleItem>
          <RuleItem>Teams must register with valid in-game IDs and contact information</RuleItem>
          <RuleItem>Each player can only register with one team per game</RuleItem>
        </ul>
      </article>
      <article>
        <h3>Fair Play Policy</h3>
        <ul role="list">
          <RuleItem>Use of any third-party software, hacks, or game modifications will result in immediate disqualification</RuleItem>
          <RuleItem>Players must use their registered accounts only. Account sharing is prohibited</RuleItem>
          <RuleItem>Teaming with opposing players, match-fixing, or intentional throwing is strictly forbidden</RuleItem>
        </ul>
      </article>
    </div>
  </section>;
}

function DownloadIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path className="rulebook-icon-arrow" d="M12 3v12m-5-5 5 5 5-5" />
    <path d="M4 16v4h16v-4" />
  </svg>;
}

function Rulebooks() {
  return <section className="guide-section guide-rulebooks" id="rulebooks" tabIndex={-1} aria-labelledby="rulebooks-title">
    <SectionHeading id="rulebooks-title" title="Game rulebooks" />
    <ul className="rulebooks" role="list">
      {games.map((game) => {
        const Card = game.rulebookUrl ? 'a' : 'div';
        return <li key={game.id}>
          <Card className="rulebook-card" href={game.rulebookUrl} download={game.rulebookUrl ? true : undefined}>
            <span className="rulebook-art"><GameArtwork game={game} /></span>
            <span className="rulebook-copy">
              <span className="rulebook-name">{game.name}</span>
              <span className="rulebook-status">{game.rulebookUrl ? 'Download PDF' : 'PDF coming soon'}</span>
            </span>
            <span className="rulebook-icon"><DownloadIcon /></span>
          </Card>
        </li>;
      })}
    </ul>
  </section>;
}

function Registration({ onNavigate }) {
  return <section className="registration-section" id="register" tabIndex={-1} aria-labelledby="register-title">
    <div className="registration-inner">
      <SectionHeading id="register-title" title="Register your team" />
      <RegistrationClock />
      <dl className="registration-facts">
        <div><dt>Deadline</dt><dd>{dateText}</dd></div>
        <div><dt>Team size</dt><dd><a href="#games" onClick={(e) => { e.preventDefault(); onNavigate('games'); }}>See game details</a></dd></div>
        <div><dt>Entry fee</dt><dd>{event.entryFee ?? 'To be announced'}</dd></div>
      </dl>
      <p className="registration-game-prompt" id="registration-game-prompt">Select your game</p>
      <div className="registration-portals" role="group" aria-labelledby="registration-game-prompt">{games.map((game) => {
        const id = registrationId(game.id);
        return <article id={id} key={id} tabIndex={-1} className="registration-card">
          <a href={'#' + id} aria-haspopup="dialog" aria-label={'Register for ' + game.name} onClick={(e) => { e.preventDefault(); onNavigate(id); }}>
            <GameArtwork game={game} />
            <span className="registration-card-copy" aria-hidden="true">
              <span className="registration-card-title">{game.name}</span>
              <span className="registration-card-action">Register now</span>
            </span>
          </a>
        </article>;
      })}</div>
    </div>
  </section>;
}

function ContactIcon({ kind }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'phone'
      ? <path d="M5 3h4l2 5-2.6 2a14 14 0 0 0 5.6 5.6l2-2.6 5 2v4a2 2 0 0 1-2 2C10.2 21 3 13.8 3 5a2 2 0 0 1 2-2Z" />
      : <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>}
  </svg>;
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
            <a href={'tel:+94' + phone.slice(1)}><ContactIcon kind="phone" /><span>{phone}</span></a>
            <a href={'mailto:' + email}><ContactIcon kind="email" /><span>{email}</span></a>
          </li>)}
        </ul>
      </article>
      <article><h3>Tournament organizers</h3><OrganizerMarks /></article>
    </div>
  </section>;
}

function Footer({ onNavigate }) {
  const columns = [
    ['Explore', [['games', 'Games'], ['teams', 'Competing teams'], ['rules', 'Rules'], ['rulebooks', 'Rulebooks'], ['about', 'About us']]],
    ['Tournament', [['prize-pool', 'Prize pool'], ['timeline', 'Event timeline'], ['register', 'Registration'], ['contact', 'Contact']]],
  ];
  return <footer className="site-footer" id="footer" tabIndex={-1}>
    <div className="footer-inner">
      <div className="footer-identity">
        <img src={asset('art/trinity.svg')} alt="Trinity Showdown" width="174" height="77" />
        <OrganizerMarks compact />
      </div>
      {columns.map(([heading, links]) => <nav key={heading} aria-label={heading}><h2 className="eyebrow">{heading}</h2>
        {links.map(([id, name]) => <a href={'#' + id} key={id} onClick={(e) => { e.preventDefault(); onNavigate(id); }}>{name}</a>)}
      </nav>)}
      <div>
        <h2 className="eyebrow">Follow us</h2>
        <ul className="footer-socials" role="list">
          {socialLinks.map(({ name, href, icon }) => <li key={name}>
            <a href={href} aria-label={name} title={name}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{icon}</svg>
            </a>
          </li>)}
        </ul>
      </div>
    </div>
  </footer>;
}

export default function TournamentGuide({ guideRef, active, selectedGame, onGame, reduced, onNavigate }) {
  return <div className="tournament-guide" ref={guideRef}>
    <AmbientField scene="guide" active={active} />
    <PrizePool active={active} reduced={reduced} />
    <TournamentTimeline reduced={reduced} />
    <GameDetails selected={selectedGame} onSelect={onGame} onNavigate={onNavigate} />
    <TeamLineup reduced={reduced} onNavigate={onNavigate} />
    <Rules />
    <Rulebooks />
    <Registration onNavigate={onNavigate} />
    <About />
    <Contact />
    <Footer onNavigate={onNavigate} />
  </div>;
}
