export const trinityBankDetails = Object.freeze({
  'Account name': 'Rotaract Club of University of Moratuwa',
  'Account number': '307599',
  Bank: 'Bank of Ceylon',
  Branch: 'Katubedda',
});

export const trinityBankInstructions = Object.entries(trinityBankDetails)
  .map(([label, value]) => `${label}: ${value}`).join('\n');

export const townHallLevelPattern = '0*[1-9][0-9]*';
const townHallLevelRegex = new RegExp(`^${townHallLevelPattern}$`);

export function requiresTownHallLevel(gameId) {
  return gameId === 'clash-of-clans';
}

export function parseTownHallLevel(value) {
  if (typeof value !== 'string' || !townHallLevelRegex.test(value)) return null;
  return value.replace(/^0+/, '');
}
