import test from 'node:test';
import assert from 'node:assert/strict';
import { countdownAt, deadlineTime } from '../src/countdown.js';

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

test('the countdown stops at zero at and after the deadline', () => {
  const close = deadlineTime('2027-02-28T23:59:00+05:30');
  for (const now of [close, close + 86_400_000]) {
    assert.deepEqual(countdownAt(close, now), { state: 'closed', units: ['00', '00', '00'] });
  }
});
