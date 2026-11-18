export async function fetchEvent(signal) {
  const response = await fetch('/api/public/event', { signal });
  if (!response.ok) throw new Error('The registration service is unavailable.');
  return response.json();
}

function uploadRegistration(url, data, signal, onStatus) {
  const xhr = new XMLHttpRequest();
  const abort = () => xhr.abort();
  return new Promise(resolve => {
    signal.throwIfAborted();
    xhr.open('POST', url);
    xhr.responseType = 'json';
    xhr.timeout = 9 * 60_000;
    const complete = () => resolve({ status: xhr.status, body: xhr.response });
    xhr.onload = xhr.onerror = xhr.ontimeout = xhr.onabort = complete;
    xhr.upload.onprogress = ({ loaded, total, lengthComputable }) => {
      if (!lengthComputable || !total || loaded >= total) return;
      onStatus(`Uploading images… ${Math.floor(loaded / total * 10) * 10}%`);
    };
    xhr.upload.onload = () => onStatus('Upload sent. Waiting for confirmation…');
    signal.addEventListener('abort', abort, { once: true });
    xhr.send(data);
  }).finally(() => signal.removeEventListener('abort', abort));
}

export async function submitRegistration(gameId, data, { signal, onStatus }) {
  const url = '/api/public/registrations/' + gameId;
  const retryDelays = [0, 1500, 4000];
  let error;
  for (const delay of retryDelays) {
    signal.throwIfAborted();
    if (delay) {
      onStatus('Connection interrupted. Retrying…');
      await new Promise(resolve => setTimeout(resolve, delay));
      signal.throwIfAborted();
    }
    onStatus('Uploading images… Keep this page open.');
    const { status, body } = await uploadRegistration(url, data, signal, onStatus);
    signal.throwIfAborted();
    const success = status >= 200 && status < 300;
    if (success && body?.reference) return body;
    error = body?.error;
    if (!success && ![0, 408, 502, 503, 504].includes(status)) {
      throw new Error(error ?? 'The registration service could not accept the submission. Try again from this page.');
    }
  }
  throw new Error(error ?? 'We couldn’t confirm your registration. Your details and images are still here. Retry from this page.');
}
