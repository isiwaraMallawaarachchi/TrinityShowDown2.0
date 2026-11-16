import { element, get, notify, withForm } from './dom.js';
import { renderEmptyDetail, renderRegistrationDetail, renderRegistrationRow } from './registration-view.js';

const origin = '/api/organizer';
const inviteToken = new URLSearchParams(location.hash.slice(1)).get('invite');
let signedIn = false;
let page = 1;
let selectedId;
let listRequest = 0;
let detailRequest = 0;

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
  renderEmptyDetail(get('detail'));
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

async function loadList() {
  const request = ++listRequest;
  const query = new URLSearchParams({ game: get('game').value, status: get('status').value, page });
  try {
    const result = await api('/registrations?' + query);
    if (request !== listRequest) return;
    const entries = result.entries.map(entry => renderRegistrationRow(entry, selectedId, id => loadDetail(id, true)));
    get('entries').replaceChildren(...entries);
    if (!result.entries.length) get('entries').append(element('li', 'No registrations match these filters.', 'queue-empty muted'));
    get('page').textContent = 'Page ' + page;
    get('previous').disabled = page === 1;
    get('more').disabled = !result.hasNext;
  } catch (error) {
    if (request === listRequest || error.status === 401) notify(error.message);
  }
}

async function decide(entry, decision, values) {
  try {
    await api(`/registrations/${entry.id}/decision`, { expectedStatus: entry.status, decision, ...values });
  } catch (error) {
    if (error.status === 409) await loadDetail(entry.id);
    throw error;
  }
  notify(decision === 'approved' ? 'Approved. The team is now public.' : 'Rejected. The original entry is retained.');
  await Promise.all([loadList(), loadDetail(entry.id)]);
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
    renderRegistrationDetail(get('detail'), entry, (decision, values) => decide(entry, decision, values));
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

renderEmptyDetail(get('detail'));
if (inviteToken) showSignIn(true);
else {
  try { await showWorkspace(await api('/me')); }
  catch (error) {
    showSignIn();
    if (error.status !== 401) notify(error.message);
  }
}
