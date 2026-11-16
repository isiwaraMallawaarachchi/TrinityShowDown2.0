import { parseTownHallLevel } from '../../../../shared/registration-rules.mjs';

export const teamRules = {
  'cod-mobile': { starters: 5, substitutes: 1 },
  'pubg-mobile': { starters: 4, substitutes: 2 },
  mlbb: { starters: 5, substitutes: 2 },
  'clash-of-clans': { starters: 5, substitutes: 1, provisional: true, playerIdLabel: 'In-game player tag' },
};

export const registrationId = (gameId) => 'register-' + gameId;

const feeAmount = 250;
export const perPersonFee = {
  amount: feeAmount,
  label: `Rs. ${feeAmount} per person`,
  games: ['cod-mobile', 'pubg-mobile', 'mlbb', 'clash-of-clans'],
};

export function registrationFeeLabel(gameId, publishedFee) {
  if (perPersonFee.games.includes(gameId)) return perPersonFee.label;
  return publishedFee ? 'LKR ' + publishedFee : 'To be announced';
}

export function playerSlots({ starters, substitutes }) {
  return [
    { id: 'leader', label: 'Team leader', phone: true, leader: true },
    ...Array.from({ length: starters - 1 }, (_, index) => ({
      id: 'player-' + (index + 2), label: 'Player ' + (index + 2), phone: index === 0,
    })),
    ...Array.from({ length: substitutes }, (_, index) => ({
      id: 'sub-' + (index + 1), label: 'Substitute ' + (index + 1), optional: true,
    })),
  ];
}

export function teamSizeSummary(gameId, rules = teamRules[gameId]) {
  const { starters, substitutes } = rules;
  return starters + ' starters · Up to ' + substitutes + ' ' + (substitutes === 1 ? 'substitute' : 'substitutes');
}

export function reviewRegistration(data, slots) {
  const players = [];
  const studentIds = new Map();
  for (const slot of slots) {
    const name = data.get(slot.id + '.name');
    if (slot.optional && name === null) continue;
    const fieldName = slot.id + '.studentId';
    const studentId = data.get(fieldName).trim().toLowerCase();
    if (studentIds.has(studentId)) {
      return {
        error: studentIds.get(studentId) + ' and ' + slot.label + ' have the same university ID.',
        fieldName,
      };
    }
    studentIds.set(studentId, slot.label);
    players.push({ id: slot.id, role: slot.label, name: name.trim(), gameName: data.get(slot.id + '.gameName').trim(),
      townHallLevel: parseTownHallLevel(data.get(slot.id + '.townHallLevel')) });
  }
  return {
    team: data.get('teamName').trim(),
    university: data.get('university').trim(),
    players,
    files: [...data.values()].filter((value) => value instanceof File && value.size > 0).length,
  };
}
