import { useEffect, useRef, useState } from 'react';
import { requiresTownHallLevel, townHallLevelPattern, trinityBankDetails, trinityBankInstructions } from '../../../../shared/registration-rules.mjs';
import { perPersonFee, registrationFeeLabel, reviewRegistration, teamRules, playerSlots, teamSizeSummary } from './registration.js';
import DownloadIcon from '../../shared/DownloadIcon.jsx';
import { AmbientField } from '../../shared/motion.jsx';
import { submitRegistration } from '../../shared/api.js';
import { formatEventTime } from '../../shared/countdown.js';
import './event-panel.css';

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxBytes = 5 * 1024 * 1024;
const steps = ['Team details', 'Team leader', 'Starting players', 'Substitutes', 'Review'];
const reviewStep = steps.length - 1;

function checkEntry(form, slots) {
  const issues = [];
  for (const panel of form.querySelectorAll('[data-step]')) {
    const invalid = [...panel.querySelectorAll('input, select')].filter((field) => field.willValidate && !field.validity.valid);
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

function PlayerFields({ slot, idLabel, needsTownHallLevel, disabled = false }) {
  const { id, label, phone, leader } = slot;
  return <fieldset className="entry-player" disabled={disabled}>
    <legend>{label}</legend>
    <div className="entry-grid">
      <TextField label="Full name" name={id + '.name'} />
      <TextField label="University ID number" name={id + '.studentId'} maxLength={64} />
      <TextField label="In-game name" name={id + '.gameName'} maxLength={80} />
      <TextField label={idLabel} name={id + '.gameId'} maxLength={80} />
      {needsTownHallLevel && <div className="entry-field">
        <label htmlFor={id + '-town-hall'}>Town Hall level</label>
        <input id={id + '-town-hall'} name={id + '.townHallLevel'} inputMode="numeric"
          pattern={townHallLevelPattern} title="Enter a whole number of 1 or higher" required />
      </div>}
      {phone && <TextField label="Contact number" name={id + '.phone'} type="tel" maxLength={25} />}
      {leader && <TextField label="Leader email for the receipt" name={id + '.email'} type="email" maxLength={254} />}
      {leader && <ImageField label="Leader photo" name={id + '.portrait'} />}
      <ImageField label="University ID photo · Front" name={id + '.idFront'} />
      <ImageField label="University ID photo · Back" name={id + '.idBack'} />
    </div>
  </fieldset>;
}

function PaymentDetails({ gameId, settings, starters }) {
  const bankInstructions = settings?.bankInstructions?.trim().replace(/\r\n/g, '\n');
  const customInstructions = bankInstructions && bankInstructions !== trinityBankInstructions &&
    bankInstructions !== 'Add the approved bank transfer instructions.';
  return <section className="entry-payment" aria-labelledby="entry-payment-title">
    <h4 id="entry-payment-title">Bank details</h4>
    <dl className="entry-payment-details">
      {customInstructions ? <div className="entry-payment-bank">
        <dt>Transfer instructions</dt>
        <dd>{bankInstructions}</dd>
      </div> : Object.entries(trinityBankDetails).map(([label, value]) =>
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      <div className="entry-payment-fee"><dt>Registration fee</dt><dd>{registrationFeeLabel(gameId, settings?.fee)}</dd></div>
    </dl>
    {perPersonFee.games.includes(gameId) && <dl className="entry-payment-total">
      <dt>Total for starters <small>{starters} starters at Rs. {perPersonFee.amount} each</small></dt>
      <dd>Rs. {(starters * perPersonFee.amount).toLocaleString('en-LK')}</dd>
    </dl>}
    <p className="entry-payment-note">The team leader must complete this form and upload proof of payment.</p>
  </section>;
}

function RegistrationForm({ game, settings, institutions }) {
  const fallback = teamRules[game.id];
  const rules = settings?.starters ? { ...fallback, starters: settings.starters, substitutes: settings.substitutes } : fallback;
  const slots = playerSlots(rules);
  const [step, setStep] = useState(0);
  const [substitutes, setSubstitutes] = useState({});
  const [review, setReview] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [reference, setReference] = useState(null);
  const requestId = useRef(null);
  const inFlight = useRef(false);
  const form = useRef(null);
  const stepHeading = useRef(null);
  const pendingFocus = useRef(null);
  const idLabel = rules.playerIdLabel ?? 'In-game ID';
  const needsTownHallLevel = requiresTownHallLevel(game.id);

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

  async function next(e) {
    e.preventDefault();
    if (step < reviewStep) {
      goToStep(step + 1, 'heading');
      return;
    }
    if (!settings?.open || !accepted || inFlight.current || reference) return;
    const result = checkEntry(form.current, slots);
    setReview(result);
    if (!result.entry) return;
    inFlight.current = true;
    setSending(true);
    setSubmitError('');
    try {
      requestId.current ??= crypto.randomUUID();
      const data = new FormData(form.current);
      data.set('requestId', requestId.current);
      data.set('formId', settings.formId);
      data.set('rulesAccepted', 'true');
      setReference(await submitRegistration(game.id, data));
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  const entry = review?.entry;
  const universityName = institutions.find(university => university.id === entry?.university)?.name ?? entry?.university;
  if (reference) return <section className="entry-receipt" aria-live="polite">
    <h3>Registration received</h3>
    <p>Your team is awaiting organizer review. A confirmation email has been queued.</p>
    <p>Reference <strong>{reference}</strong></p>
  </section>;

  return <form ref={form} className="entry-form" noValidate onSubmit={next} autoComplete="off">
    <fieldset className="entry-fields" disabled={sending}>
    <div className="entry-steps" role="tablist" aria-label="Registration steps" onKeyDown={handleTabKeys}>
      {steps.map((label, index) => <button key={label} type="button" role="tab" id={'entry-tab-' + index}
        aria-selected={step === index} aria-controls={'entry-panel-' + index} tabIndex={step === index ? 0 : -1}
        onClick={() => goToStep(index)}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{label}</button>)}
    </div>
    <h3 className="entry-step-title" ref={stepHeading} tabIndex={-1}>{steps[step]}</h3>
    <div data-step="0" id="entry-panel-0" role="tabpanel" aria-labelledby="entry-tab-0" hidden={step !== 0} className="entry-step">
      {settings?.rulebookUrl && <div className="entry-requirements">
        <a className="entry-rulebook" href={settings.rulebookUrl} download>
          <span className="entry-rulebook-copy">
            <strong>Download the game rulebook</strong>
            <small>PDF{settings.rulebookVersion && ` · Version ${settings.rulebookVersion}`}</small>
          </span>
          <span className="entry-rulebook-icon"><DownloadIcon /></span>
        </a>
        {(settings.privacyUrl || settings.closesAt || settings.formId) && <div className="entry-requirements-meta">
          {settings.privacyUrl && <a href={settings.privacyUrl} target="_blank" rel="noopener">Read the privacy notice</a>}
          {settings.closesAt && <p><strong>Deadline</strong> {formatEventTime(settings.closesAt)}</p>}
          {settings.formId && <p>The team name, logo and game will be public if the organizers approve the entry.</p>}
        </div>}
      </div>}
      <PaymentDetails gameId={game.id} settings={settings} starters={rules.starters} />
      <div className="entry-grid">
        <TextField label="Team name" name="teamName" maxLength={100} />
        {settings?.formId && institutions.length ? <label className="entry-field">
          <span>University name</span>
          <select name="university" required defaultValue="">
            <option value="" disabled>Select your university</option>
            {institutions.map(university => <option key={university.id} value={university.id}>{university.name}</option>)}
          </select>
        </label> : <TextField label="University name" name="university" />}
        <ImageField label="Team logo" name="teamLogo" />
        <ImageField label="Proof of payment" name="paymentProof" />
      </div>
    </div>
    <div data-step="1" id="entry-panel-1" role="tabpanel" aria-labelledby="entry-tab-1" hidden={step !== 1} className="entry-step">
      <PlayerFields slot={slots[0]} idLabel={idLabel} needsTownHallLevel={needsTownHallLevel} />
    </div>
    <div data-step="2" id="entry-panel-2" role="tabpanel" aria-labelledby="entry-tab-2" hidden={step !== 2} className="entry-step entry-stack">
      {slots.filter((slot) => !slot.leader && !slot.optional).map((slot) =>
        <PlayerFields key={slot.id} slot={slot} idLabel={idLabel} needsTownHallLevel={needsTownHallLevel} />)}
    </div>
    <div data-step="3" id="entry-panel-3" role="tabpanel" aria-labelledby="entry-tab-3" hidden={step !== 3} className="entry-step entry-stack">
      <p className="entry-help">Substitutes are optional. Add each substitute you want to include.</p>
      {slots.filter((slot) => slot.optional).map((slot) => <div key={slot.id} className="entry-substitute">
        <label className="entry-check"><input type="checkbox" checked={Boolean(substitutes[slot.id])}
          onChange={(e) => setSubstitutes({ ...substitutes, [slot.id]: e.target.checked })} /> Include {slot.label.toLowerCase()}</label>
        <div hidden={!substitutes[slot.id]}>
          <PlayerFields slot={slot} idLabel={idLabel} needsTownHallLevel={needsTownHallLevel} disabled={!substitutes[slot.id]} />
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
        <dl><div><dt>Team</dt><dd>{entry.team}</dd></div><div><dt>University</dt><dd>{universityName}</dd></div>
          <div><dt>Images attached</dt><dd>{entry.files}</dd></div></dl>
        <ul>{entry.players.map((player) => <li key={player.id}>
          <span>{player.role}</span>
          <strong>{player.name}</strong>
          <span>{player.gameName}{player.townHallLevel && <small className="entry-review-town-hall">Town Hall {player.townHallLevel}</small>}</span>
        </li>)}</ul>
      </div>}
      {entry && settings?.open && <label className="entry-check">
        <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
        I accept the game rulebook, acknowledge the privacy notice and understand the submitted entry is permanent.
      </label>}
      {submitError && <p className="entry-submit-error" role="alert">{submitError}</p>}
    </div>
    <div className="entry-actions">
      {step > 0 && <button type="button" className="entry-back" onClick={() => goToStep(step - 1, 'heading')}>Back</button>}
      {step < reviewStep && <button className="portal-button" type="submit">{step === reviewStep - 1 ? 'Review entry' : 'Continue'}</button>}
      {step === reviewStep && <button className="portal-button" type="submit"
        disabled={!settings?.open || !entry || !accepted || sending} aria-describedby="registration-status">
        {sending ? 'Submitting…' : 'Submit registration'}
      </button>}
    </div>
    </fieldset>
  </form>;
}

export default function RegistrationPortal({ game, settings, institutions = [], onClose }) {
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
        <form method="dialog"><button className="close-menu" autoFocus>Close <span aria-hidden="true">×</span></button></form>
      </div>
      <div className="ep-content">
        <p className="eyebrow">Team registration</p>
        <h2 id="registration-panel-title">{game.name}</h2>
        <p className="entry-team-size">{settings?.starters ? teamSizeSummary(game.id, settings) : teamSizeSummary(game.id)}
          {!settings?.starters && teamRules[game.id].provisional && ' · Provisional team size'}</p>
        <p className="entry-status" id="registration-status">{settings?.open ? 'Registration is open.' : 'Registration submissions aren’t open.'}</p>
        <RegistrationForm key={game.id + ':' + (settings?.formId ?? 'preview')} game={game}
          settings={settings} institutions={institutions} />
      </div>
    </div>}
  </dialog>;
}
