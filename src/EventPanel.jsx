import { useEffect, useRef, useState } from 'react';
import { reviewRegistration, rosterRules, rosterSlots, rosterSummary } from './registration.js';
import { AmbientField } from './motion.jsx';
import './event-panel.css';

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxBytes = 5 * 1024 * 1024;
const steps = ['Team details', 'Team leader', 'Starting players', 'Substitutes', 'Review'];
const reviewStep = steps.length - 1;

function checkEntry(form, slots) {
  const issues = [];
  for (const panel of form.querySelectorAll('[data-step]')) {
    const invalid = [...panel.querySelectorAll('input')].filter((field) => field.willValidate && !field.validity.valid);
    if (invalid.length) issues.push({ step: Number(panel.dataset.step), field: invalid[0], count: invalid.length });
  }
  if (issues.length) return { issues };

  const entry = reviewRegistration(new FormData(form), slots);
  if (!entry.error) return { entry };

  const field = form.elements.namedItem(entry.fieldName);
  return { error: entry.error, issues: [{ step: Number(field.closest('[data-step]').dataset.step), field }] };
}

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
  const form = useRef(null);
  const stepHeading = useRef(null);
  const pendingFocus = useRef(null);
  const idLabel = rules.playerIdLabel ?? 'In-game ID';

  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === 'heading') stepHeading.current?.focus();
    else if (target) {
      target.focus();
      target.reportValidity();
    }
  }, [step]);

  function goToStep(index, focusTarget = null) {
    if (index === reviewStep) setReview(checkEntry(form.current, slots));
    pendingFocus.current = focusTarget;
    setStep(index);
  }

  function handleTabKeys(e) {
    let index;
    if (e.key === 'ArrowLeft') index = (step + steps.length - 1) % steps.length;
    else if (e.key === 'ArrowRight') index = (step + 1) % steps.length;
    else if (e.key === 'Home') index = 0;
    else if (e.key === 'End') index = reviewStep;
    else return;
    e.preventDefault();
    goToStep(index);
    e.currentTarget.querySelectorAll('[role="tab"]')[index].focus();
  }

  function next(e) {
    e.preventDefault();
    if (step < reviewStep) goToStep(step + 1, 'heading');
  }

  const entry = review?.entry;
  return <form ref={form} className="entry-form" noValidate onSubmit={next} autoComplete="off">
    <div className="entry-steps" role="tablist" aria-label="Registration steps" onKeyDown={handleTabKeys}>
      {steps.map((label, index) => <button key={label} type="button" role="tab" id={'entry-tab-' + index}
        aria-selected={step === index} aria-controls={'entry-panel-' + index} tabIndex={step === index ? 0 : -1}
        onClick={() => goToStep(index)}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{label}</button>)}
    </div>
    <h3 className="entry-step-title" ref={stepHeading} tabIndex={-1}>{steps[step]}</h3>
    <div data-step="0" id="entry-panel-0" role="tabpanel" aria-labelledby="entry-tab-0" hidden={step !== 0} className="entry-step">
      <div className="entry-grid">
        <TextField label="Team name" name="teamName" maxLength={100} />
        <TextField label="University name" name="university" />
        <ImageField label="Team logo" name="teamLogo" />
        <ImageField label="Bank transfer proof" name="paymentProof" />
      </div>
      <p className="entry-help">The entry fee and bank details will be published before registration opens.</p>
    </div>
    <div data-step="1" id="entry-panel-1" role="tabpanel" aria-labelledby="entry-tab-1" hidden={step !== 1} className="entry-step">
      <PlayerFields slot={slots[0]} idLabel={idLabel} />
    </div>
    <div data-step="2" id="entry-panel-2" role="tabpanel" aria-labelledby="entry-tab-2" hidden={step !== 2} className="entry-step entry-stack">
      {slots.filter((slot) => !slot.leader && !slot.optional).map((slot) =>
        <PlayerFields key={slot.id} slot={slot} idLabel={idLabel} />)}
    </div>
    <div data-step="3" id="entry-panel-3" role="tabpanel" aria-labelledby="entry-tab-3" hidden={step !== 3} className="entry-step entry-stack">
      <p className="entry-help">Substitutes are optional. Add each substitute you want to include.</p>
      {slots.filter((slot) => slot.optional).map((slot) => <div key={slot.id} className="entry-substitute">
        <label className="entry-check"><input type="checkbox" checked={Boolean(substitutes[slot.id])}
          onChange={(e) => setSubstitutes({ ...substitutes, [slot.id]: e.target.checked })} /> Include {slot.label.toLowerCase()}</label>
        <div hidden={!substitutes[slot.id]}>
          <PlayerFields slot={slot} idLabel={idLabel} disabled={!substitutes[slot.id]} />
        </div>
      </div>)}
    </div>
    <div id="entry-panel-4" role="tabpanel" aria-labelledby="entry-tab-4" hidden={step !== reviewStep} tabIndex={0} className="entry-step">
      {review?.issues && <div className="entry-issues">
        <p>{review.error ?? 'Complete the required fields in these sections before submitting.'}</p>
        <ul>{review.issues.map(({ step: issueStep, field, count }) => <li key={issueStep}>
          <button type="button" onClick={() => goToStep(issueStep, field)}>
            <strong>{steps[issueStep]}</strong>
            <span>{count ? `${count} ${count === 1 ? 'field' : 'fields'} to check` : 'Check university ID'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </li>)}</ul>
      </div>}
      {entry && <div className="entry-review">
        <p className="entry-review-status">All required details are complete.</p>
        <dl><div><dt>Team</dt><dd>{entry.team}</dd></div><div><dt>University</dt><dd>{entry.university}</dd></div>
          <div><dt>Images attached</dt><dd>{entry.files}</dd></div></dl>
        <ul>{entry.players.map((player) => <li key={player.id}><span>{player.role}</span><strong>{player.name}</strong><span>{player.gameName}</span></li>)}</ul>
      </div>}
    </div>
    <div className="entry-actions">
      {step > 0 && <button type="button" className="entry-back" onClick={() => goToStep(step - 1, 'heading')}>Back</button>}
      {step < reviewStep && <button className="portal-button" type="submit">{step === reviewStep - 1 ? 'Review entry' : 'Continue'}</button>}
      {step === reviewStep && <button className="portal-button" type="submit" disabled aria-describedby="registration-status">Submit registration</button>}
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
    {game && <div className="ep-frame">
      <AmbientField scene="dialog" active />
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
        <p className="entry-status" id="registration-status">Registration submissions aren’t open yet.</p>
        <RegistrationForm key={game.id} game={game} />
      </div>
    </div>}
  </dialog>;
}
