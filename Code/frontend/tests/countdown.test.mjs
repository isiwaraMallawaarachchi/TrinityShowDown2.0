import test from 'node:test';
import assert from 'node:assert/strict';
import { countdownAt, deadlineTime, formatEventClock, formatEventDate } from '../src/shared/countdown.js';

test('an unconfirmed or ambiguous deadline leaves the countdown pending', () => {
  for (const value of [undefined, null, '', '2027-02-28T23:59:00', 'not a date']) {
    assert.deepEqual(countdownAt(deadlineTime(value), 0), { state: 'pending', units: ['--', '--', '--'] });
  }
});

test('a Sri Lanka deadline counts days, hours and minutes from any locale', () => {
  const close = deadlineTime('2027-02-28T23:59:00+05:30');
  assert.equal(close, Date.parse('2027-02-28T18:29:00Z'));
  assert.deepEqual(countdownAt(close, close - 93_784_000), { state: 'counting', units: ['01', '02', '04'] });
  assert.deepEqual(countdownAt(close, close - 1), { state: 'counting', units: ['00', '00', '01'] });
});

test('the opening date uses the Sri Lankan calendar day even when UTC is a day behind', () => {
  assert.equal(formatEventDate('2026-11-15T18:30:00Z'), '16 November 2026');
});

test('tournament hours use the Sri Lankan clock for database timestamps', () => {
  assert.equal(formatEventClock('2026-12-19T03:30:00.000Z'), '9 AM');
  assert.equal(formatEventClock('2026-12-19T12:30:00.000Z'), '6 PM');
  assert.equal(formatEventClock('2026-12-19T04:00:00.000Z'), '9:30 AM');
});

test('the countdown stops at zero at and after the deadline', () => {
  const close = deadlineTime('2027-02-28T23:59:00+05:30');
  for (const now of [close, close + 86_400_000]) {
    assert.deepEqual(countdownAt(close, now), { state: 'closed', units: ['00', '00', '00'] });
  }
});
