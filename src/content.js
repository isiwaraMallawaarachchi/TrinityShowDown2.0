export const games = [
  {
    id: 'cod-mobile',
    art: 'cod',
    name: 'Call of Duty: Mobile',
    shortName: 'COD Mobile',
    title: ['Call of Duty:', 'Mobile'],
    genre: 'Tactical shooter',
    theme: 'ember',
    teaser: 'Take the objective with quick calls, clean rotations and teamwork under pressure.',
  },
  {
    id: 'pubg-mobile',
    art: 'pubg',
    name: 'PUBG Mobile',
    shortName: 'PUBG Mobile',
    title: ['PUBG', 'Mobile'],
    genre: 'Battle royale',
    theme: 'sand',
    teaser: 'Pick your drop. Hold your ground. Make the last circle count.',
  },
  {
    id: 'mlbb',
    art: 'mlbb',
    name: 'Mobile Legends: Bang Bang',
    shortName: 'Mobile Legends',
    title: ['Mobile Legends:', 'Bang Bang'],
    genre: 'MOBA',
    theme: 'violet',
    teaser: 'Draft your lineup, control the map and turn a single fight into a victory.',
  },
  {
    id: 'clash-of-clans',
    art: 'coc',
    name: 'Clash of Clans',
    shortName: 'Clash of Clans',
    title: ['Clash of', 'Clans'],
    genre: 'Strategy',
    theme: 'gold',
    teaser: 'Read the defenses, plan the attack and make every troop count.',
  },
];

export const event = {
  date: 'To be announced',
  venue: 'To be announced',
  registration: 'Opening date to be announced',
  registrationClosesAt: '2026-12-06T23:59:00+05:30',
  milestones: [
    { id: 'registration-opens', title: 'Registration opens', description: 'Choose a game and prepare your team entry.' },
    { id: 'registration-closes', title: 'Registration closes', description: 'Submit your final roster and payment proof before the deadline.' },
    { id: 'tournament-day', title: 'Tournament day', description: 'The schedule and venue will be announced here.' },
  ],
};

// Public, approved records only: { id, name, gameId, logoUrl }.
export const publishedTeams = [];

// Fictional entries for checking the lineup layout before teams are published.
export const previewTeams = {
  'cod-mobile': ['Iron Vipers', 'Night Breach', 'Zero Signal'],
  'pubg-mobile': ['Drop Zone', 'Last Circle', 'Skybound'],
  mlbb: ['Nexus Tide', 'Moonward', 'Storm Crest'],
  'clash-of-clans': ['Ember Keep', 'Rune Wardens', 'Stone Reign'],
};

export const coChairs = [
  { name: 'Lahiru Dodangoda', phone: '0767535881', email: 'lahirudodangoda1@gmail.com' },
  { name: 'Chanitha Samarasinghe', phone: '0743677737', email: 'tivolithe1st@gmail.com' },
];
