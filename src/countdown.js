const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
export const millisecondsPerMinute = 60_000;

export function deadlineTime(value) {
  if (typeof value !== 'string' || !timestamp.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function countdownAt(deadline, now) {
  if (deadline === null) return { state: 'pending', units: ['--', '--', '--'] };
  const minutes = Math.max(0, Math.ceil((deadline - now) / millisecondsPerMinute));
  return {
    state: minutes === 0 ? 'closed' : 'counting',
    units: [Math.floor(minutes / 1440), Math.floor(minutes / 60) % 24, minutes % 60]
      .map((part) => String(part).padStart(2, '0')),
  };
}
