export const games = [
  {
    id: 'cod-mobile',
    art: 'cod',
    name: 'Call of Duty: Mobile',
    shortName: 'COD Mobile',
    title: ['Call of Duty:', 'Mobile'],
    genre: 'Tactical shooter',
    teamSlots: 16,
    format: 'Knockout',
    teaser: 'Take the objective with quick calls, clean rotations and teamwork under pressure.',
  },
  {
    id: 'pubg-mobile',
    art: 'pubg',
    name: 'PUBG Mobile',
    shortName: 'PUBG Mobile',
    title: ['PUBG', 'Mobile'],
    genre: 'Battle royale',
    teamSlots: 20,
    format: 'Battle Royale',
    teaser: 'Pick your drop. Hold your ground. Make the last circle count.',
  },
  {
    id: 'mlbb',
    art: 'mlbb',
    name: 'Mobile Legends: Bang Bang',
    shortName: 'Mobile Legends',
    title: ['Mobile Legends:', 'Bang Bang'],
    genre: 'MOBA',
    teamSlots: 16,
    format: 'Knockout',
    teaser: 'Draft your lineup, control the map and turn a single fight into a victory.',
  },
  {
    id: 'clash-of-clans',
    art: 'coc',
    name: 'Clash of Clans',
    shortName: 'Clash of Clans',
    title: ['Clash of', 'Clans'],
    genre: 'Strategy',
    teamSlots: 32,
    format: 'Knockout',
    teaser: 'Read the defenses, plan the attack and make every troop count.',
  },
];

export const event = {
  date: 'To be announced',
  venue: 'To be announced',
  registrationOpensAt: '2026-11-16T00:00:00+05:30',
  registrationClosesAt: '2026-12-06T23:59:00+05:30',
  milestones: [
    { id: 'registration-opens', title: 'Registration opens', description: 'Choose a game and prepare your team entry.' },
    { id: 'registration-closes', title: 'Registration closes', description: 'Submit your final player list and payment proof before the deadline.' },
    { id: 'tournament-day', title: 'Tournament day', description: 'The schedule and venue will be announced here.' },
  ],
};

// Fictional entries for checking the lineup layout before teams are published.
export const previewTeams = {
  'cod-mobile': ['Iron Vipers', 'Night Breach', 'Zero Signal', 'Atlas Unit', 'Ghost Sector', 'Phantom Five', 'Black Circuit', 'Steel Division'],
  'pubg-mobile': ['Drop Zone', 'Last Circle', 'Skybound', 'Ridge Runners', 'Cloud Brigade', 'Flare Squad', 'Silent Drop', 'North Grid'],
  mlbb: ['Nexus Tide', 'Moonward', 'Storm Crest', 'Twilight Core', 'Apex Lane', 'Lunar Guard', 'Dawn Rift', 'Arc Hunters'],
  'clash-of-clans': ['Ember Keep', 'Rune Wardens', 'Stone Reign', 'Bastion Forge', 'Gold Legion', 'Cinder Gate', 'High Citadel', 'Thorn Crown'],
};

export const contacts = [
  { name: 'Lahiru Dodangoda', role: 'Project co-chair', phone: '0767535881', email: 'lahirudodangoda1@gmail.com' },
  { name: 'Chanitha Samarasinghe', role: 'Project co-chair', phone: '0743677737', email: 'tivolithe1st@gmail.com' },
  { name: 'Oshani Malagala', role: 'Tournament contact', phone: '+94 77 795 6720', email: 'oshanimalagala2005@gmail.com' },
];
