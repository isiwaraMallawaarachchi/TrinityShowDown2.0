import { useEffect, useRef, useState } from 'react';
import { reviewRegistration, rosterRules, rosterSlots, rosterSummary } from './registration.js';
import './event-panel.css';

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxBytes = 5 * 1024 * 1024;
const steps = ['Team details', 'Team leader', 'Starting players', 'Substitutes', 'Review'];

function TextField({ label, name, type = 'text', maxLength = 120, autoComplete = 'off' }) {
  return <label className="entry-field">
    <span>{label}</span>
    <input type={type} name={name} required maxLength={maxLength} autoComplete={autoComplete}
      pattern={type === 'text' ? '.*\\S.*' : undefined} />
  </label>;
}

function ImageField({ label, name }) {
  return <label className="entry-field entry-file">
    <span>{label}</span>
    <input type="file" name={name} accept={imageTypes.join(',')} required
      onChange={(e) => {
        const input = e.currentTarget;
        const file = input.files[0];
        let error = '';
        if (file && !imageTypes.includes(file.type)) error = 'Choose a JPEG, PNG or WebP image.';
        else if (file && (!file.size || file.size > maxBytes)) error = 'Choose a nonempty image no larger than 5 MB.';
        input.setCustomValidity(error);
        if (error) input.reportValidity();
      }} />
    <small>JPEG, PNG or WebP · Up to 5 MB</small>
  </label>;
}

function PlayerFields({ slot, idLabel, disabled = false }) {
  const { id, label, phone, leader } = slot;
  return <fieldset className="entry-player" disabled={disabled}>
    <legend>{label}</legend>
    <div className="entry-grid">
      <TextField label="Full name" name={id + '.name'} />
      <TextField label="University ID number" name={id + '.studentId'} maxLength={64} />
      <TextField label="In-game name" name={id + '.gameName'} maxLength={80} />
      <TextField label={idLabel} name={id + '.gameId'} maxLength={80} />
      {phone && <TextField label="Contact number" name={id + '.phone'} type="tel" maxLength={25} />}
      {leader && <TextField label="Leader email for the receipt" name={id + '.email'} type="email" maxLength={254} />}
      {leader && <ImageField label="Leader photo" name={id + '.portrait'} />}
      <ImageField label="University ID photo · Front" name={id + '.idFront'} />
      <ImageField label="University ID photo · Back" name={id + '.idBack'} />
    </div>
  </fieldset>;
}

function RegistrationForm({ game }) {
  const rules = rosterRules[game.id];
  const slots = rosterSlots(rules);
  const [step, setStep] = useState(0);
  const [substitutes, setSubstitutes] = useState({});
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const stepHeading = useRef(null);
  const initialFocus = useRef(true);
  const idLabel = rules.playerIdLabel ?? 'In-game ID';

  useEffect(() => {
    if (initialFocus.current) {
      initialFocus.current = false;
      return;
    }
    stepHeading.current?.focus();
  }, [step]);

  function next(e) {
    e.preventDefault();
    setError('');
    if (step === steps.length - 1) return;
    const fields = e.currentTarget.querySelectorAll('[data-step="' + step + '"] input');
    for (const field of fields) {
      if (!field.reportValidity()) return;
    }
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    const entry = reviewRegistration(new FormData(e.currentTarget), slots);
    if (entry.error) {
      setError(entry.error);
      return;
    }
    setReview(entry);
    setStep(4);
  }

  return <form className="entry-form" noValidate onSubmit={next} autoComplete="off">
    <ol className="entry-steps" aria-label="Registration progress">
      {steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}
        className={step > index ? 'is-complete' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{label}</li>)}
    </ol>
    <h3 className="entry-step-title" ref={stepHeading} tabIndex={-1}>{steps[step]}</h3>
    <div data-step="0" hidden={step !== 0} className="entry-step">
      <div className="entry-grid">
        <TextField label="Team name" name="teamName" maxLength={100} />
        <TextField label="University name" name="university" />
        <ImageField label="Team logo" name="teamLogo" />
        <ImageField label="Bank transfer proof" name="paymentProof" />
      </div>
      <p className="entry-help">Use sample images in this preview. The entry fee and bank details will be published before registration opens.</p>
    </div>
    <div data-step="1" hidden={step !== 1} className="entry-step">
      <PlayerFields slot={slots[0]} idLabel={idLabel} />
    </div>
    <div data-step="2" hidden={step !== 2} className="entry-step entry-stack">
      {slots.filter((slot) => !slot.leader && !slot.optional).map((slot) =>
        <PlayerFields key={slot.id} slot={slot} idLabel={idLabel} />)}
    </div>
    <div data-step="3" hidden={step !== 3} className="entry-step entry-stack">
      <p className="entry-help">Substitutes are optional. Add each substitute you want to include.</p>
      {slots.filter((slot) => slot.optional).map((slot) => <div key={slot.id} className="entry-substitute">
        <label className="entry-check"><input type="checkbox" checked={Boolean(substitutes[slot.id])}
          onChange={(e) => setSubstitutes({ ...substitutes, [slot.id]: e.target.checked })} /> Include {slot.label.toLowerCase()}</label>
        <div hidden={!substitutes[slot.id]}>
          <PlayerFields slot={slot} idLabel={idLabel} disabled={!substitutes[slot.id]} />
        </div>
      </div>)}
    </div>
    {step === 4 && review && <div className="entry-review">
      <dl><div><dt>Team</dt><dd>{review.team}</dd></div><div><dt>University</dt><dd>{review.university}</dd></div>
        <div><dt>Images attached</dt><dd>{review.files}</dd></div></dl>
      <ul>{review.players.map((player) => <li key={player.id}><span>{player.role}</span><strong>{player.name}</strong><span>{player.gameName}</span></li>)}</ul>
      <p className="entry-help">This preview ends here. Live registration will open once the event details and secure submission service are ready.</p>
    </div>}
    {error && <p className="entry-error" role="alert">{error}</p>}
    <div className="entry-actions">
      {step > 0 && <button type="button" className="entry-back" onClick={() => { setError(''); setStep(step - 1); }}>Back</button>}
      {step < 4 && <button className="portal-button" type="submit">{step === 3 ? 'Review entry' : 'Continue'}</button>}
      {step === 4 && <button className="portal-button" type="submit" disabled>Submit registration</button>}
    </div>
  </form>;
}

export default function RegistrationPortal({ game, onClose, themeControl }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    if (game && !element.open) element.showModal();
    if (!game && element.open) element.close();
    if (game) element.scrollTop = 0;
  }, [game]);

  return <dialog ref={dialog} className="ep-dialog" aria-labelledby="registration-panel-title" onClose={onClose}>
    {game && <>
      <div className="ep-toolbar">
        <p className="eyebrow">Trinity Showdown · Registration</p>
        <div className="toolbar-actions">{themeControl}
          <form method="dialog"><button className="close-menu" autoFocus>Close <span aria-hidden="true">×</span></button></form>
        </div>
      </div>
      <div className="ep-content">
        <p className="eyebrow">Team registration</p>
        <h2 id="registration-panel-title">{game.name}</h2>
        <p className="entry-roster-count">{rosterSummary(game.id)}{rosterRules[game.id].provisional && ' · Provisional roster'}</p>
        <p className="entry-preview"><strong>Form preview.</strong> Use sample details and files. Your entry is available for review in this tab only.</p>
        <RegistrationForm key={game.id} game={game} />
      </div>
    </>}
  </dialog>;
}
