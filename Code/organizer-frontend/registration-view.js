import { element, withForm } from './dom.js';

const time = new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' });
const names = { submitted: 'Submitted', approved: 'Approved', rejected: 'Rejected' };

function statusBadge(status) {
  const badge = element('span', names[status], 'badge');
  badge.dataset.status = status;
  return badge;
}

export function renderEmptyDetail(detail) {
  const empty = element('div', undefined, 'empty-detail');
  empty.append(element('h2', 'Registration details'), element('p', 'Select a registration to review its details.'));
  detail.replaceChildren(empty);
}

export function renderRegistrationRow(entry, selectedId, onSelect) {
  const item = element('li');
  const button = element('button', undefined, 'entry');
  button.dataset.entry = entry.id;
  button.setAttribute('aria-current', String(entry.id === selectedId));
  button.append(element('strong', entry.team_name), statusBadge(entry.status), element('small', entry.game_name),
    element('small', time.format(new Date(entry.submitted_at))));
  button.addEventListener('click', () => onSelect(entry.id));
  item.append(button);
  return item;
}

function facts(fields) {
  const list = element('dl', undefined, 'facts');
  for (const [label, value] of Object.entries(fields)) {
    const row = element('div');
    row.append(element('dt', label), element('dd', value ?? '—'));
    list.append(row);
  }
  return list;
}

function image(label, url) {
  const link = element('a', undefined, 'image');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  const preview = element('img');
  preview.src = url;
  preview.alt = '';
  preview.loading = 'lazy';
  link.append(preview, element('span', label));
  return link;
}

function reviewControls(entry, decide) {
  const section = element('section', undefined, 'decision');
  section.append(element('h3', 'Review decision'));
  if (entry.status === 'submitted') {
    const approve = element('form');
    const label = element('label', undefined, 'check');
    const check = element('input');
    check.type = 'checkbox';
    check.required = true;
    label.append(check, 'I reviewed the player list and verified the bank transfer proof.');
    approve.append(label, element('button', 'Approve and publish team', 'primary'));
    withForm(approve, () => decide('approved', { paymentVerified: check.checked }));
    section.append(approve);
  }
  const reject = element('form');
  const label = element('label', 'Internal rejection reason');
  const reason = element('textarea');
  reason.name = 'reason';
  reason.required = true;
  reason.maxLength = 1000;
  label.append(reason);
  reject.append(label, element('button', 'Reject registration', 'danger'));
  withForm(reject, values => decide('rejected', values));
  section.append(reject);
  return section;
}

export function renderRegistrationDetail(detail, entry, decide) {
  const header = element('header', undefined, 'detail-header');
  header.append(element('h2', entry.team_name), statusBadge(entry.status));
  const { townHallLevel, ...entryFields } = entry.entry_fields;
  const overview = facts({
    Game: entry.game_name, Submitted: time.format(new Date(entry.submitted_at)),
    Captain: entry.captain_name, Email: entry.captain_email, Phone: entry.captain_phone, Reference: entry.id,
    'Form version': entry.form_version, 'Rulebook version': entry.rulebook_version, 'Privacy notice': entry.privacy_version,
    ...(townHallLevel != null && { 'Team Town Hall level': townHallLevel }),
    ...Object.fromEntries(Object.entries(entryFields).map(([key, value]) => [key, JSON.stringify(value)])),
  });
  const attachments = element('section');
  const files = element('div', undefined, 'images');
  files.append(image('Team logo', entry.images.logo), image('Bank transfer proof', entry.images.proof));
  attachments.append(element('h3', 'Attachments'), files);
  const players = element('section');
  players.append(element('h3', 'Players'));
  for (const player of entry.players) {
    const playerCard = element('details', undefined, 'player');
    const role = player.is_captain ? 'Team leader' : player.role === 'starter' ? 'Starter' : 'Substitute';
    const { gameName, phone, townHallLevel, ...extra } = player.fields;
    playerCard.append(element('summary', player.full_name + ' · ' + role), facts({
      University: player.university, 'University ID': player.student_number, 'In-game ID': player.in_game_id,
      'In-game name': gameName, Phone: phone,
      ...(townHallLevel != null && { 'Town Hall level': townHallLevel }),
      ...Object.fromEntries(Object.entries(extra).map(([key, value]) => [key, JSON.stringify(value)])),
    }));
    const photos = element('div', undefined, 'images');
    for (const [key, url] of Object.entries(player.images)) {
      photos.append(image({ front: 'University ID front', back: 'University ID back', portrait: 'Leader photo' }[key], url));
    }
    playerCard.append(photos);
    players.append(playerCard);
  }
  detail.replaceChildren(header, overview, attachments, players);
  if (entry.status !== 'rejected') detail.append(reviewControls(entry, decide));
  if (entry.decisions.length) {
    const history = element('section');
    history.append(element('h3', 'Review history'));
    const list = element('ul', undefined, 'review-history');
    for (const decision of entry.decisions) {
      const description = `${names[decision.to_status]} by ${decision.organizer} · ${time.format(new Date(decision.decided_at))}`;
      list.append(element('li', decision.reason ? `${description} · ${decision.reason}` : description));
    }
    history.append(list);
    detail.append(history);
  }
}
