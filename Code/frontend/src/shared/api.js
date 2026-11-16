export async function fetchEvent(signal) {
  const response = await fetch('/api/public/event', { signal });
  if (!response.ok) throw new Error('The registration service is unavailable.');
  return response.json();
}

export async function submitRegistration(gameId, data) {
  const response = await fetch('/api/public/registrations/' + gameId, { method: 'POST', body: data });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.reference) {
    throw new Error(body?.error ?? 'The registration service is unavailable. Retry the same submission.');
  }
  return body;
}
