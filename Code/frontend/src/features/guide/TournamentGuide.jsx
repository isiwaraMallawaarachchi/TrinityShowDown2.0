import { useEffect, useRef, useState } from 'react';
import { contacts, event, games, previewTeams } from '../../content/event.js';
import { countdownAt, deadlineTime, formatEventClock, formatEventDate, formatEventTime, millisecondsPerMinute } from '../../shared/countdown.js';
import { perPersonFee, registrationFeeLabel, registrationId, teamRules, teamSizeSummary } from '../registration/registration.js';
import DownloadIcon from '../../shared/DownloadIcon.jsx';
import GameArtwork from '../../shared/GameArtwork.jsx';
import { AmbientField } from '../../shared/motion.jsx';
import { rulebookUpdateNotice } from '../../../../shared/rulebook-status.mjs';
import RulebookLink from '../../shared/RulebookLink.jsx';
import './tournament-guide.css';

const asset = (path) => import.meta.env.BASE_URL + path;
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
  {
    name: 'TikTok',
    href: 'https://rotaract.social/trinity-showdown_tiktok',
    icon: <path d="M13.2 2.5h3.2c.3 2.6 1.9 4.3 4.6 4.5v3.2a8 8 0 0 1-4.6-1.5v7a5.9 5.9 0 1 1-5.9-5.9c.3 0 .6 0 .9.1v3.3a2.7 2.7 0 1 0 1.8 2.5Z" />,
  },
  {
    name: 'WhatsApp Channel',
    href: 'https://rotaract.social/trinity-showdown_whatsapp-channel',
    icon: <>
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.5 7.2c-.7 0-1.5 1-1.5 2.1 0 2.5 3.4 6 6.5 6.9 1.4.4 2.6-.2 3.1-1.1.2-.4.4-1 .1-1.2l-2.1-1.1c-.3-.2-.6-.1-.8.2l-.8 1c-1.5-.6-2.7-1.7-3.3-3l.7-.8c.2-.2.3-.5.1-.8l-.9-1.9c-.2-.3-.5-.3-1.1-.3Z" />
    </>,
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

export function RegistrationClock({ backdrop = false, active = true, deadline }) {
  const closesAt = deadlineTime(deadline);
  const [now, setNow] = useState(Date.now);
  const clock = countdownAt(closesAt, now);
  useEffect(() => {
    if (!active || closesAt === null) return;
    let timer;
    function update() {
      clearTimeout(timer);
      if (document.hidden) return;
      const now = Date.now();
      const value = countdownAt(closesAt, now);
      setNow(now);
      if (value.state === 'counting') {
        const nextMinute = (closesAt - now) % millisecondsPerMinute || millisecondsPerMinute;
        timer = setTimeout(update, nextMinute);
      }
    }
    update();
    document.addEventListener('visibilitychange', update);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', update); };
  }, [active, closesAt]);

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

function TournamentTimeline({ reduced, schedule }) {
  const steps = useRef(null);
  const [started, setStarted] = useState(false);
  const dates = { 'registration-opens': schedule.opensAt, 'registration-closes': schedule.closesAt, 'tournament-day': schedule.startsAt };

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
          <p className="timeline-date">{dates[milestone.id]
            ? <time dateTime={dates[milestone.id]}>{milestone.id === 'registration-closes'
              ? formatEventTime(dates[milestone.id]) : formatEventDate(dates[milestone.id])}</time>
            : 'To be announced'}</p>
          {milestone.id === 'tournament-day' ? <>
            <p>{schedule.venue}</p>
            <p>
              <time dateTime={schedule.startsAt}>{formatEventClock(schedule.startsAt)}</time>
              {schedule.endsAt && <> – <time dateTime={schedule.endsAt}>{formatEventClock(schedule.endsAt)}</time></>}
              {' · Sri Lanka time'}
            </p>
          </> : <p>{milestone.description}</p>}
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

function GameDetails({ selected, onSelect, onNavigate, gameSettings, publishedTeams }) {
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
    {games.map((game, i) => <GamePanel key={game.id} game={game} settings={gameSettings?.[game.id]}
      publishedTeams={publishedTeams} active={i === index} onNavigate={onNavigate} />)}
  </section>;
}

function GamePanel({ game, settings, publishedTeams, active, onNavigate }) {
  const approvedCount = publishedTeams?.filter((team) => team.gameId === game.id).length;
  return <div className="game-details" role="tabpanel" aria-labelledby={'game-tab-' + game.id}
      id={'game-panel-' + game.id} tabIndex={0} hidden={!active}>
      <figure className="editorial-image"><GameArtwork game={game} /></figure>
      <div className="game-details-copy">
        <p className="eyebrow">{game.genre}</p><h3>{game.name}</h3><p>{game.teaser}</p>
        <dl className="game-facts">
          <div>
            <dt>Team size</dt>
            <dd>{settings?.starters ? teamSizeSummary(game.id, settings) :
              (teamRules[game.id].provisional ? 'Provisional · ' : '') + teamSizeSummary(game.id)}</dd>
          </div>
          <div>
            <dt>Available team slots</dt>
            <dd className="game-slot-count" aria-live="polite" aria-atomic="true">
              {approvedCount === undefined ? 'Awaiting live count' : Math.max(0, game.teamSlots - approvedCount)}
              <small>{approvedCount === undefined ? `${game.teamSlots} total slots` : `${approvedCount} of ${game.teamSlots} filled`}</small>
            </dd>
          </div>
          <div>
            <dt>Prize pool</dt>
            <dd>{game.prizePool ?? 'To be announced'}</dd>
          </div>
          <div className="game-fact-fee">
            <dt>Registration fee</dt>
            <dd>{registrationFeeLabel(game.id, settings?.fee)}</dd>
          </div>
          {game.format && <div className="game-fact-format">
            <dt>Tournament format</dt>
            <dd>{game.format}</dd>
          </div>}
        </dl>
        <div className="game-details-links">
          <a className="guide-link" href="#rules" onClick={(e) => { e.preventDefault(); onNavigate('rules'); }}>Read the rules <span aria-hidden="true">↗</span></a>
          {settings?.rulebookUrl || rulebookUpdateNotice('trinity-showdown', game.id)
            ? <RulebookLink gameId={game.id} className="guide-link" href={settings?.rulebookUrl}>Download rulebook (PDF)</RulebookLink> :
            <a className="guide-link" href="#rulebooks" onClick={(e) => { e.preventDefault(); onNavigate('rulebooks'); }}>Game rulebooks <span aria-hidden="true">↗</span></a>}
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

function TeamLineup({ reduced, onNavigate, publishedTeams }) {
  const previewEnabled = import.meta.env.DEV || import.meta.env.VITE_SHOW_SAMPLE_TEAMS === 'true';
  const showPreview = previewEnabled && !publishedTeams;
  return <section className="guide-section guide-teams" id="teams" tabIndex={-1} aria-labelledby="teams-title">
    <SectionHeading id="teams-title" title="Competing teams" />
    <div className="lineup-groups">{games.map((game) => {
      const teams = showPreview ? (previewTeams[game.id] ?? []).map((name) => ({ id: name, name }))
        : (publishedTeams ?? []).filter((team) => team.gameId === game.id);
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

function Rulebooks({ gameSettings }) {
  return <section className="guide-section guide-rulebooks" id="rulebooks" tabIndex={-1} aria-labelledby="rulebooks-title">
    <SectionHeading id="rulebooks-title" title="Game rulebooks" />
    <ul className="rulebooks" role="list">
      {games.map((game) => {
        const url = gameSettings?.[game.id]?.rulebookUrl ?? game.rulebookUrl;
        const notice = rulebookUpdateNotice('trinity-showdown', game.id);
        return <li key={game.id}>
          <RulebookLink gameId={game.id} className="rulebook-card" href={url}>
            <span className="rulebook-art"><GameArtwork game={game} /></span>
            <span className="rulebook-copy">
              <span className="rulebook-name">{game.name}</span>
              <span className="rulebook-status">{notice ? 'Rulebook being updated' : url ? 'Download PDF' : 'PDF coming soon'}</span>
            </span>
            <span className="rulebook-icon"><DownloadIcon /></span>
          </RulebookLink>
        </li>;
      })}
    </ul>
  </section>;
}

function Registration({ onNavigate, deadline }) {
  return <section className="registration-section" id="register" tabIndex={-1} aria-labelledby="register-title">
    <div className="registration-inner">
      <SectionHeading id="register-title" title="Register your team"
        description="The team leader must complete the registration form and upload proof of payment." />
      <RegistrationClock deadline={deadline} />
      <dl className="registration-facts">
        <div><dt>Deadline</dt><dd>{formatEventTime(deadline)}</dd></div>
        <div><dt>Team size</dt><dd><a href="#games" onClick={(e) => { e.preventDefault(); onNavigate('games'); }}>See game details</a></dd></div>
        <div><dt>Registration fee</dt><dd><strong>{perPersonFee.label}</strong></dd></div>
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
          {contacts.map(({ name, role, phone, email }) => <li key={email}>
            <p className="contact-role">{role}</p>
            <p className="contact-name">{name}</p>
            <a href={'tel:' + phone.replace(/\s/g, '').replace(/^0/, '+94')}><ContactIcon kind="phone" /><span>{phone}</span></a>
            <a href={'mailto:' + email}><ContactIcon kind="email" /><span>{email}</span></a>
          </li>)}
        </ul>
      </article>
      <article><h3>Tournament organizers</h3><OrganizerMarks /></article>
    </div>
  </section>;
}

function Footer({ onNavigate, privacyUrl }) {
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
        {heading === 'Tournament' && privacyUrl && <a href={privacyUrl} target="_blank" rel="noopener">Privacy notice</a>}
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

export default function TournamentGuide({ guideRef, active, selectedGame, onGame, reduced, onNavigate, eventData, schedule }) {
  const gameSettings = eventData?.games;
  const privacyUrl = Object.values(gameSettings ?? {}).find(settings => settings.privacyUrl)?.privacyUrl;
  return <div className="tournament-guide" ref={guideRef}>
    <AmbientField scene="guide" active={active} />
    <PrizePool active={active} reduced={reduced} />
    <TournamentTimeline reduced={reduced} schedule={schedule} />
    <GameDetails selected={selectedGame} onSelect={onGame} onNavigate={onNavigate}
      gameSettings={gameSettings} publishedTeams={eventData?.teams} />
    <TeamLineup reduced={reduced} onNavigate={onNavigate} publishedTeams={eventData?.teams} />
    <Rules />
    <Rulebooks gameSettings={gameSettings} />
    <Registration onNavigate={onNavigate} deadline={schedule.closesAt} />
    <About />
    <Contact />
    <Footer onNavigate={onNavigate} privacyUrl={privacyUrl} />
  </div>;
}
