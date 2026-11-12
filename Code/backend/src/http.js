export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const isUuid = value => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const statuses = ['submitted', 'approved', 'rejected'];

export function text(value, label, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /\u0000/.test(value)) {
    throw new HttpError(400, `${label} is required and must be at most ${max} characters.`);
  }
  return value.trim();
}

export function email(value) {
  const normalized = text(value, 'Email address', 254).toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(normalized)) {
    throw new HttpError(400, 'Enter a valid email address.');
  }
  return normalized;
}

export function sendMedia(res, row) {
  if (!row) throw new HttpError(404, 'File unavailable.');
  const content = Buffer.from(row.bytes);
  res.set('Content-Length', String(content.length));
  res.type(row.content_type).end(content);
}
