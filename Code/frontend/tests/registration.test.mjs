import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewRegistration, rosterRules, rosterSlots } from '../src/features/registration/registration.js';

test('each portal includes the leader in its starter count and offers optional substitutes', () => {
  for (const [id, starters, substitutes] of [['cod-mobile', 5, 1], ['pubg-mobile', 4, 2], ['mlbb', 5, 2], ['clash-of-clans', 5, 1]]) {
    const slots = rosterSlots(rosterRules[id]);
    assert.equal(slots.filter((slot) => !slot.optional).length, starters);
    assert.equal(slots.filter((slot) => slot.optional).length, substitutes);
    assert.deepEqual(slots.filter((slot) => slot.phone).map((slot) => slot.id), ['leader', 'player-2']);
    assert.equal(slots[0].leader, true);
  }
});

function entryWithStarters(slots) {
  const form = new FormData();
  form.set('teamName', 'Sample Team');
  form.set('university', 'Sample University');
  for (const slot of slots.filter((slot) => !slot.optional)) {
    form.set(slot.id + '.name', 'Sample ' + slot.label);
    form.set(slot.id + '.studentId', '000-' + slot.id);
    form.set(slot.id + '.gameName', 'Example-' + slot.id);
  }
  return form;
}

test('review counts attached files and excludes unused optional slots', () => {
  const slots = rosterSlots(rosterRules['pubg-mobile']);
  const form = entryWithStarters(slots);
  form.set('teamLogo', new File(['sample'], 'sample.png', { type: 'image/png' }));
  const result = reviewRegistration(form, slots);
  assert.equal(result.team, 'Sample Team');
  assert.equal(result.files, 1);
  assert.deepEqual(result.players.map((player) => player.id), ['leader', 'player-2', 'player-3', 'player-4']);
  assert.equal(Object.hasOwn(result.players[0], 'studentId'), false);
});

test('review rejects a starter and substitute with the same university ID', () => {
  const slots = rosterSlots(rosterRules.mlbb);
  const form = entryWithStarters(slots);
  form.set('sub-1.name', 'Sample Substitute');
  form.set('sub-1.studentId', ' 000-LEADER ');
  form.set('sub-1.gameName', 'Example-sub');
  const result = reviewRegistration(form, slots);
  assert.match(result.error, /Team leader and Substitute 1 have the same university ID/);
  assert.equal(result.fieldName, 'sub-1.studentId');
});
