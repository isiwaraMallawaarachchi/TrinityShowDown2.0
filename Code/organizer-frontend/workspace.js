const get = id => document.getElementById(id);
const origin = '/api/organizer';
const inviteToken = new URLSearchParams(location.hash.slice(1)).get('invite');
const time = new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' });
const names = { submitted: 'Submitted', approved: 'Approved', rejected: 'Rejected' };
let signedIn = false;
let page = 1;
let selectedId;
let listRequest = 0;
let detailRequest = 0;

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function notify(message, id = 'notice') {
  const notice = get(id);
  notice.textContent = message;
  notice.hidden = !message;
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  get('theme').setAttribute('aria-pressed', String(theme === 'dark'));
}

function initializeTheme() {
  let theme;
  try { theme = localStorage.getItem('trinity-theme'); } catch {}
  if (theme !== 'light' && theme !== 'dark') {
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  setTheme(theme);
}

function statusBadge(status) {
  const badge = element('span', names[status], 'badge');
  badge.dataset.status = status;
  return badge;
}

function clearDetail() {
  const empty = element('div', undefined, 'empty-detail');
  empty.append(element('h2', 'Registration details'), element('p', 'Select a registration to review its details.'));
  get('detail').replaceChildren(empty);
}

async function api(path, values) {
  const response = await fetch(origin + path, values === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401 && signedIn) showSignIn();
    const error = new Error(body?.error ?? 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return body;
}

function showSignIn(accepting = false) {
  signedIn = false;
  selectedId = undefined;
  listRequest++;
  detailRequest++;
  get('workspace').hidden = true;
  get('auth').hidden = false;
  get('login').hidden = accepting;
  get('accept').hidden = !accepting;
  get('auth-title').textContent = accepting ? 'Accept organizer invitation' : 'Organizer sign in';
  get('account').textContent = '';
  get('account-tools').hidden = true;
  get('entries').replaceChildren();
  clearDetail();
  get('invite-dialog').close();
  get('invite').reset();
  get('invite-link').value = '';
  get('invite-result').hidden = true;
  notify('', 'invite-notice');
}

async function showWorkspace(user) {
  signedIn = true;
  page = 1;
  get('auth').hidden = true;
  get('workspace').hidden = false;
  get('account').textContent = user.name;
  get('account-tools').hidden = false;
  await loadList();
}

function withForm(form, handler, report = notify) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit], button:not([type])');
    button.disabled = true;
    report('');
    try {
      await handler(Object.fromEntries(new FormData(form)));
    } catch (error) {
      report(error.message);
    } finally {
      button.disabled = false;
    }
  });
}

async function loadList() {
  const request = ++listRequest;
  const query = new URLSearchParams({ game: get('game').value, status: get('status').value, page });
  try {
    const result = await api('/registrations?' + query);
    if (request !== listRequest) return;
    get('entries').replaceChildren(...result.entries.map(entry => {
      const item = element('li');
      const button = element('button', undefined, 'entry');
      button.dataset.entry = entry.id;
      button.setAttribute('aria-current', String(entry.id === selectedId));
      button.append(element('strong', entry.team_name), statusBadge(entry.status), element('small', entry.game_name),
        element('small', time.format(new Date(entry.submitted_at))));
      button.addEventListener('click', () => loadDetail(entry.id, true));
      item.append(button);
      return item;
    }));
    if (!result.entries.length) get('entries').append(element('li', 'No registrations match these filters.', 'queue-empty muted'));
    get('page').textContent = 'Page ' + page;
    get('previous').disabled = page === 1;
    get('more').disabled = !result.hasNext;
  } catch (error) {
    if (request === listRequest || error.status === 401) notify(error.message);
  }
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

function reviewControls(entry) {
  const section = element('section', undefined, 'decision');
  section.append(element('h3', 'Review decision'));
  const endpoint = `/registrations/${entry.id}/decision`;
  async function decide(decision, values) {
    try {
      await api(endpoint, { expectedStatus: entry.status, decision, ...values });
    } catch (error) {
      if (error.status === 409) await loadDetail(entry.id);
      throw error;
    }
    notify(decision === 'approved' ? 'Approved. The team is now public.' : 'Rejected. The original entry is retained.');
    await Promise.all([loadList(), loadDetail(entry.id)]);
  }
  if (entry.status === 'submitted') {
    const approve = element('form');
    const label = element('label', undefined, 'check');
    const check = element('input');
    check.type = 'checkbox';
    check.required = true;
    label.append(check, 'I reviewed the roster and verified the bank transfer proof.');
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

function renderDetail(entry) {
  const detail = get('detail');
  const header = element('header', undefined, 'detail-header');
  header.append(element('h2', entry.team_name), statusBadge(entry.status));
  const overview = facts({
    Game: entry.game_name, Submitted: time.format(new Date(entry.submitted_at)),
    Captain: entry.captain_name, Email: entry.captain_email, Phone: entry.captain_phone, Reference: entry.id,
    'Form version': entry.form_version, 'Rulebook version': entry.rulebook_version, 'Privacy notice': entry.privacy_version,
    ...Object.fromEntries(Object.entries(entry.entry_fields).map(([key, value]) => [key, JSON.stringify(value)])),
  });
  const attachments = element('section');
  const files = element('div', undefined, 'images');
  files.append(image('Team logo', entry.images.logo), image('Bank transfer proof', entry.images.proof));
  attachments.append(element('h3', 'Attachments'), files);
  const roster = element('section');
  roster.append(element('h3', 'Roster'));
  for (const player of entry.players) {
    const playerCard = element('details', undefined, 'player');
    const role = player.is_captain ? 'Team leader' : player.role === 'starter' ? 'Starter' : 'Substitute';
    const { gameName, phone, ...extra } = player.fields;
    playerCard.append(element('summary', player.full_name + ' · ' + role), facts({
      University: player.university, 'University ID': player.student_number, 'In-game ID': player.in_game_id,
      'In-game name': gameName, Phone: phone,
      ...Object.fromEntries(Object.entries(extra).map(([key, value]) => [key, JSON.stringify(value)])),
    }));
    const photos = element('div', undefined, 'images');
    for (const [key, url] of Object.entries(player.images)) {
      photos.append(image({ front: 'University ID front', back: 'University ID back', portrait: 'Leader photo' }[key], url));
    }
    playerCard.append(photos);
    roster.append(playerCard);
  }
  detail.replaceChildren(header, overview, attachments, roster);
  if (entry.status !== 'rejected') detail.append(reviewControls(entry));
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

async function loadDetail(id, focus = false) {
  const request = ++detailRequest;
  try {
    const entry = await api('/registrations/' + id);
    if (request !== detailRequest) return;
    selectedId = id;
    get('entries').querySelectorAll('[data-entry]').forEach(button => {
      button.setAttribute('aria-current', String(button.dataset.entry === id));
    });
    renderDetail(entry);
    if (focus) get('detail').focus();
  } catch (error) {
    if (request === detailRequest || error.status === 401) notify(error.message);
  }
}

withForm(get('login'), async values => {
  const user = await api('/login', values);
  get('login').reset();
  await showWorkspace(user);
});
withForm(get('accept'), async values => {
  const user = await api('/accept-invite', { ...values, token: inviteToken });
  get('accept').reset();
  history.replaceState(null, '', location.pathname);
  await showWorkspace(user);
});
withForm(get('invite'), async values => {
  const result = await api('/invites', values);
  if (!signedIn) return;
  get('invite-link').value = result.url;
  get('invite-result').hidden = false;
  if (get('invite-dialog').open) get('invite-link').select();
}, message => notify(message, get('invite-dialog').open ? 'invite-notice' : 'notice'));
get('open-invite').addEventListener('click', () => get('invite-dialog').showModal());
get('theme').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
  try { localStorage.setItem('trinity-theme', theme); } catch {}
});
get('logout').addEventListener('click', async () => {
  try {
    await api('/logout', {});
    showSignIn();
    notify('Signed out.');
  } catch (error) {
    notify(error.message);
  }
});
for (const filter of ['game', 'status']) get(filter).addEventListener('change', () => { page = 1; loadList(); });
get('previous').addEventListener('click', () => { page--; loadList(); });
get('more').addEventListener('click', () => { page++; loadList(); });

initializeTheme();
clearDetail();
if (inviteToken) showSignIn(true);
else {
  try { await showWorkspace(await api('/me')); }
  catch (error) {
    showSignIn();
    if (error.status !== 401) notify(error.message);
  }
}
