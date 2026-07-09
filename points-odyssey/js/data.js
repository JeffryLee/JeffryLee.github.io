/**
 * Points Odyssey — static game data
 * Transfer partners simplified from real US ecosystems (Chase/Amex/Citi/Bilt).
 */

export const GAME_CONFIG = {
  minPlayers: 3,
  maxPlayers: 6,
  maxRounds: 10,
  budgetPerTurn: 5000,
  /** Max credit cards (Executive gets +cardLimitBonus) */
  defaultCardLimit: 2,
  maxTripTickets: 4,
  maxNightsPerBooking: 1, // one night per stay; each property once per game
  startingTickets: 3,
  keepTickets: 2,
  /** Free bank seed (small — not a second signup) */
  starterBankPoints: 3000,
  /** Lifestyle re-rolls allowed per income phase */
  maxSpendRerolls: 1,
  /** Hotel economy — stays should beat hoarding points */
  hotelVpMultiplier: 2,
  hotelCostMultiplier: 0.75,
  /** Final leftover conversion (weak so travel/hotels win) */
  leftoverBankPerVp: 12000,
  leftoverHotelPerVp: 25000,
  leftoverAirlinePerVp: 20000,
  /** Rest/plan action */
  restPlanPoints: 3000,
};

/** Character → free starter card id (so round-1 income can earn) */
export const STARTER_CARDS = {
  consultant: 'cfu',
  family: 'cff',
  nomad: 'cfu',
  foodie: 'amex_blue', // flexible Amex earn (was Citi-locked Custom Cash)
  landlord: 'bilt_card',
  executive: 'amex_blue',
};

export const BANKS = {
  chase: { id: 'chase', name: 'Chase', color: '#117ACA', short: 'UR' },
  amex: { id: 'amex', name: 'Amex', color: '#006FCF', short: 'MR' },
  citi: { id: 'citi', name: 'Citi', color: '#003B70', short: 'TY' },
  bilt: { id: 'bilt', name: 'Bilt', color: '#1A1A2E', short: 'Bilt' },
};

export const HOTELS = {
  marriott: { id: 'marriott', name: 'Marriott', color: '#8B1A4A', icon: '🏨' },
  hilton: { id: 'hilton', name: 'Hilton', color: '#004B87', icon: '🛏️' },
  hyatt: { id: 'hyatt', name: 'Hyatt', color: '#6B2D5B', icon: '🔑' },
};

export const AIRLINES = {
  united: { id: 'united', name: 'United', color: '#002244', short: 'UA' },
  delta: { id: 'delta', name: 'Delta', color: '#C8102E', short: 'DL' },
  american: { id: 'american', name: 'American', color: '#0078D2', short: 'AA' },
};

/** Bank → partner transfers. ratio = partner pts per 1 bank pt */
export const TRANSFERS = {
  chase: {
    united: { ratio: 1, type: 'airline' },
    hyatt: { ratio: 1, type: 'hotel' },
    marriott: { ratio: 1, type: 'hotel' },
  },
  amex: {
    delta: { ratio: 1, type: 'airline' },
    hilton: { ratio: 2, type: 'hotel' }, // inflated 1:2
    marriott: { ratio: 1, type: 'hotel' },
  },
  citi: {
    american: { ratio: 1, type: 'airline' },
    hilton: { ratio: 1, type: 'hotel' },
  },
  bilt: {
    united: { ratio: 1, type: 'airline' },
    american: { ratio: 1, type: 'airline' },
    hyatt: { ratio: 1, type: 'hotel' },
    marriott: { ratio: 1, type: 'hotel' },
  },
};

export const CATEGORIES = [
  'dining',
  'groceries',
  'gas',
  'travel',
  'transit',
  'rent',
  'hotels',
  'flights',
  'everything',
];

/**
 * Characters shape which spend categories tend to appear (weights → probability).
 * Earn rates still come only from credit cards (0× without a card).
 *
 * spendProfile: relative weights for category appearance when rolling income.
 * Each income phase rolls SPEND_DRAWS chunks of the budget, each chunk lands
 * on a category sampled proportional to these weights.
 */
export const SPEND_DRAWS = 5; // how many budget chunks are rolled per income

/**
 * Special skills rebalanced so no character is a runaway favorite.
 * (Family no longer stacks free VP on every hotel night.)
 */
export const CHARACTERS = [
  {
    id: 'consultant',
    name: 'The Consultant',
    image: 'assets/char-consultant.jpg',
    blurb: 'Road warrior optimizing every award flight.',
    homeCity: 'NYC',
    cardLimitBonus: 0,
    special: 'polished_routes',
    specialDesc: 'All award flights cost 15% fewer miles. Completing a trip ticket grants +4 bonus VP.',
    spendProfile: {
      travel: 35,
      dining: 25,
      flights: 15,
      hotels: 10,
      transit: 8,
      everything: 7,
    },
  },
  {
    id: 'family',
    name: 'The Family',
    image: 'assets/char-family.jpg',
    blurb: 'Weekend getaways and free-night stacking.',
    homeCity: 'ORD',
    cardLimitBonus: 0,
    special: 'group_rate',
    specialDesc: 'Hotel award nights cost 10% fewer points (no free VP).',
    spendProfile: {
      groceries: 35,
      gas: 20,
      dining: 15,
      everything: 12,
      travel: 10,
      hotels: 8,
    },
  },
  {
    id: 'nomad',
    name: 'The Nomad',
    image: 'assets/char-nomad.jpg',
    blurb: 'Always moving across the map.',
    homeCity: 'DEN',
    cardLimitBonus: 0,
    special: 'cheap_flight',
    specialDesc: 'First flight each turn costs 15% fewer miles. +1 VP the first time you land in a new city.',
    spendProfile: {
      transit: 30,
      travel: 25,
      dining: 15,
      hotels: 12,
      flights: 10,
      everything: 8,
    },
  },
  {
    id: 'foodie',
    name: 'The Foodie',
    image: 'assets/char-foodie.jpg',
    blurb: 'Dining funds the adventures — and the scoreboard.',
    homeCity: 'SFO',
    cardLimitBonus: 0,
    special: 'dining_bonus',
    specialDesc: 'If any dining spend this turn: +1 VP and +2,000 to your best bank (once/turn).',
    spendProfile: {
      dining: 45,
      groceries: 25,
      everything: 12,
      travel: 10,
      transit: 8,
    },
  },
  {
    id: 'landlord',
    name: 'The Landlord',
    image: 'assets/char-landlord.jpg',
    blurb: 'Rent Day believer. Bilt is destiny.',
    homeCity: 'LAX',
    cardLimitBonus: 0,
    special: 'rent_day',
    specialDesc: 'Bilt earn is always +20% for you (stacks with Rent Day events).',
    spendProfile: {
      rent: 50,
      dining: 15,
      everything: 12,
      travel: 10,
      gas: 8,
      groceries: 5,
    },
  },
  {
    id: 'executive',
    name: 'The Executive',
    image: 'assets/char-executive.jpg',
    blurb: 'Premium cards, flights, and client dinners.',
    homeCity: 'ATL',
    cardLimitBonus: 1,
    special: 'extra_card',
    specialDesc: 'Hold up to 3 credit cards (others cap at 2). Signup bonuses are +20% larger for you.',
    spendProfile: {
      flights: 25,
      hotels: 25,
      dining: 20,
      travel: 15,
      everything: 10,
      transit: 5,
    },
  },
];

/** Normalize spendProfile weights to percentages (0–100). */
export function spendProfilePercents(profile) {
  const entries = Object.entries(profile || { everything: 1 });
  const sum = entries.reduce((s, [, w]) => s + w, 0) || 1;
  const out = {};
  for (const [cat, w] of entries) {
    out[cat] = Math.round((w / sum) * 1000) / 10; // one decimal
  }
  return out;
}

/**
 * Roll this turn's spending: budget split into SPEND_DRAWS chunks,
 * each chunk assigned to a category ~ proportional to spendProfile weights.
 */
export function rollSpendAllocation(character, budget = GAME_CONFIG.budgetPerTurn, draws = SPEND_DRAWS) {
  const profile = character.spendProfile || { everything: 1 };
  const entries = Object.entries(profile).filter(([, w]) => w > 0);
  const totalW = entries.reduce((s, [, w]) => s + w, 0) || 1;
  const chunk = Math.floor(budget / draws);
  const alloc = {};
  let assigned = 0;

  function pickCategory() {
    let r = Math.random() * totalW;
    for (let i = 0; i < entries.length; i++) {
      r -= entries[i][1];
      if (r <= 0) return entries[i][0];
    }
    return entries[entries.length - 1][0];
  }

  for (let i = 0; i < draws; i++) {
    const cat = pickCategory();
    const amt = i === draws - 1 ? budget - assigned : chunk;
    alloc[cat] = (alloc[cat] || 0) + amt;
    assigned += amt;
  }
  return alloc;
}

export const CREDIT_CARDS = [
  // Chase — signup bonuses nerfed so monthly spend + travel matter
  {
    id: 'csp',
    name: 'Sapphire Preferred',
    bank: 'chase',
    earn: { travel: 2, dining: 3, everything: 1 },
    signupBonus: 25000,
    minSpend: 4000,
    annualFee: 95,
  },
  {
    id: 'csr',
    name: 'Sapphire Reserve',
    bank: 'chase',
    earn: { travel: 3, dining: 3, everything: 1 },
    signupBonus: 30000,
    minSpend: 4000,
    annualFee: 550,
  },
  {
    id: 'cfu',
    name: 'Freedom Unlimited',
    bank: 'chase',
    earn: { everything: 1.5 },
    signupBonus: 8000,
    minSpend: 500,
    annualFee: 0,
  },
  {
    id: 'cff',
    name: 'Freedom Flex',
    bank: 'chase',
    earn: { groceries: 5, gas: 5, everything: 1 },
    signupBonus: 8000,
    minSpend: 500,
    annualFee: 0,
  },
  // Amex
  {
    id: 'amex_gold',
    name: 'Gold Card',
    bank: 'amex',
    earn: { dining: 4, groceries: 4, flights: 3, everything: 1 },
    signupBonus: 25000,
    minSpend: 6000,
    annualFee: 325,
  },
  {
    id: 'amex_plat',
    name: 'Platinum Card',
    bank: 'amex',
    earn: { flights: 5, hotels: 5, everything: 1 },
    signupBonus: 30000,
    minSpend: 6000,
    annualFee: 695,
  },
  {
    id: 'amex_blue',
    name: 'Blue Business Plus',
    bank: 'amex',
    earn: { everything: 2 },
    signupBonus: 8000,
    minSpend: 3000,
    annualFee: 0,
  },
  {
    id: 'delta_gold',
    name: 'Delta Gold',
    bank: 'amex',
    earn: { flights: 2, dining: 2, everything: 1 },
    signupBonus: 15000,
    minSpend: 2000,
    annualFee: 150,
    directAirline: 'delta',
  },
  // Citi
  {
    id: 'strata',
    name: 'Strata Premier',
    bank: 'citi',
    earn: { travel: 3, dining: 3, groceries: 3, gas: 3, everything: 1 },
    signupBonus: 25000,
    minSpend: 4000,
    annualFee: 95,
  },
  {
    id: 'custom_cash',
    name: 'Custom Cash',
    bank: 'citi',
    earn: { dining: 5, everything: 1 },
    signupBonus: 8000,
    minSpend: 500,
    annualFee: 0,
  },
  {
    id: 'double_cash',
    name: 'Double Cash',
    bank: 'citi',
    earn: { everything: 2 },
    signupBonus: 5000,
    minSpend: 0,
    annualFee: 0,
  },
  // Bilt
  {
    id: 'bilt_card',
    name: 'Bilt Mastercard',
    bank: 'bilt',
    earn: { rent: 1, dining: 3, travel: 2, everything: 1 },
    signupBonus: 10000,
    minSpend: 0,
    annualFee: 0,
  },
];

/**
 * City positions as % of map container (approx US geography).
 * hotels[] = signature properties: one stay (1 night) per property per player per game.
 * brand still drives which hotel points currency pays for the stay.
 */
/**
 * Signature hotels — verified operating properties (or active Honors/Bonvoy/World of Hyatt flags).
 * Park Hyatt Los Angeles is NOT open (Oceanwide Plaza stalled); Waldorf Astoria NYC is closed for reno.
 */
export const CITIES = {
  SEA: {
    id: 'SEA', name: 'Seattle', x: 12, y: 12, region: 'nw',
    hotels: [
      { id: 'sea-marriott', name: 'Seattle Marriott Waterfront', brand: 'marriott', cost: 20000, vp: 3 },
      { id: 'sea-hilton', name: 'Hilton Seattle', brand: 'hilton', cost: 30000, vp: 2 },
      { id: 'sea-hyatt', name: 'Hyatt at Olive 8', brand: 'hyatt', cost: 12000, vp: 4 },
    ],
  },
  SFO: {
    id: 'SFO', name: 'San Francisco', x: 8, y: 42, region: 'west',
    hotels: [
      { id: 'sfo-marriott', name: 'San Francisco Marriott Marquis', brand: 'marriott', cost: 35000, vp: 4 },
      { id: 'sfo-hilton', name: 'Hilton San Francisco Union Square', brand: 'hilton', cost: 38000, vp: 3 },
      { id: 'sfo-hyatt', name: 'Hyatt Regency San Francisco', brand: 'hyatt', cost: 18000, vp: 5 },
    ],
  },
  LAX: {
    id: 'LAX', name: 'Los Angeles', x: 12, y: 58, region: 'west',
    hotels: [
      { id: 'lax-marriott', name: 'JW Marriott Los Angeles L.A. LIVE', brand: 'marriott', cost: 30000, vp: 3 },
      { id: 'lax-hilton', name: 'Hilton Los Angeles Airport', brand: 'hilton', cost: 40000, vp: 3 },
      // No operating Park Hyatt in LA — use Andaz West Hollywood (World of Hyatt)
      { id: 'lax-hyatt', name: 'Andaz West Hollywood', brand: 'hyatt', cost: 15000, vp: 4 },
    ],
  },
  LAS: {
    id: 'LAS', name: 'Las Vegas', x: 18, y: 48, region: 'sw',
    hotels: [
      { id: 'las-marriott', name: 'JW Marriott Las Vegas Resort & Spa', brand: 'marriott', cost: 25000, vp: 4 },
      { id: 'las-hilton', name: 'Waldorf Astoria Las Vegas', brand: 'hilton', cost: 35000, vp: 5 },
      { id: 'las-hyatt', name: 'Grand Hyatt at Resorts World Las Vegas', brand: 'hyatt', cost: 20000, vp: 6 },
    ],
  },
  PHX: {
    id: 'PHX', name: 'Phoenix', x: 22, y: 58, region: 'sw',
    hotels: [
      { id: 'phx-marriott', name: 'The Phoenician, a Luxury Collection Resort, Scottsdale', brand: 'marriott', cost: 28000, vp: 4 },
      { id: 'phx-hilton', name: 'Arizona Biltmore, a Waldorf Astoria Resort', brand: 'hilton', cost: 32000, vp: 4 },
    ],
  },
  DEN: {
    id: 'DEN', name: 'Denver', x: 35, y: 38, region: 'mt',
    hotels: [
      { id: 'den-marriott', name: 'Denver Marriott City Center', brand: 'marriott', cost: 22000, vp: 3 },
      { id: 'den-hilton', name: 'Hilton Denver City Center', brand: 'hilton', cost: 32000, vp: 2 },
      { id: 'den-hyatt', name: 'Grand Hyatt Denver', brand: 'hyatt', cost: 14000, vp: 4 },
    ],
  },
  DFW: {
    id: 'DFW', name: 'Dallas', x: 48, y: 58, region: 'south',
    hotels: [
      { id: 'dfw-marriott', name: 'The Joule, Dallas, Autograph Collection', brand: 'marriott', cost: 22000, vp: 3 },
      { id: 'dfw-hilton', name: 'Hilton Anatole', brand: 'hilton', cost: 30000, vp: 2 },
      { id: 'dfw-hyatt', name: 'Hyatt Regency Dallas', brand: 'hyatt', cost: 12000, vp: 3 },
    ],
  },
  IAH: {
    id: 'IAH', name: 'Houston', x: 50, y: 68, region: 'south',
    hotels: [
      { id: 'iah-marriott', name: 'Houston Marriott Marquis', brand: 'marriott', cost: 18000, vp: 2 },
      { id: 'iah-hilton', name: 'Hilton Americas-Houston', brand: 'hilton', cost: 28000, vp: 2 },
    ],
  },
  MSP: {
    id: 'MSP', name: 'Minneapolis', x: 52, y: 22, region: 'mw',
    hotels: [
      { id: 'msp-marriott', name: 'Minneapolis Marriott City Center', brand: 'marriott', cost: 18000, vp: 2 },
      { id: 'msp-hilton', name: 'Hilton Minneapolis', brand: 'hilton', cost: 25000, vp: 2 },
    ],
  },
  ORD: {
    id: 'ORD', name: 'Chicago', x: 58, y: 32, region: 'mw',
    hotels: [
      { id: 'ord-marriott', name: 'Chicago Marriott Downtown Magnificent Mile', brand: 'marriott', cost: 28000, vp: 3 },
      { id: 'ord-hilton', name: 'Hilton Chicago', brand: 'hilton', cost: 38000, vp: 3 },
      { id: 'ord-hyatt', name: 'Park Hyatt Chicago', brand: 'hyatt', cost: 15000, vp: 4 },
    ],
  },
  ATL: {
    id: 'ATL', name: 'Atlanta', x: 68, y: 58, region: 'se',
    hotels: [
      { id: 'atl-marriott', name: 'Atlanta Marriott Marquis', brand: 'marriott', cost: 22000, vp: 3 },
      { id: 'atl-hilton', name: 'Hilton Atlanta', brand: 'hilton', cost: 32000, vp: 2 },
      { id: 'atl-hyatt', name: 'Grand Hyatt Atlanta in Buckhead', brand: 'hyatt', cost: 14000, vp: 4 },
    ],
  },
  MSY: {
    id: 'MSY', name: 'New Orleans', x: 58, y: 72, region: 'south',
    hotels: [
      { id: 'msy-marriott', name: 'New Orleans Marriott', brand: 'marriott', cost: 20000, vp: 3 },
      { id: 'msy-hilton', name: 'Hilton New Orleans Riverside', brand: 'hilton', cost: 30000, vp: 3 },
    ],
  },
  MIA: {
    id: 'MIA', name: 'Miami', x: 78, y: 82, region: 'se',
    hotels: [
      { id: 'mia-marriott', name: 'JW Marriott Miami Turnberry Resort & Spa', brand: 'marriott', cost: 35000, vp: 5 },
      { id: 'mia-hilton', name: 'Fontainebleau Miami Beach', brand: 'hilton', cost: 45000, vp: 5 },
      { id: 'mia-hyatt', name: 'Hyatt Regency Miami', brand: 'hyatt', cost: 18000, vp: 5 },
    ],
  },
  WAS: {
    id: 'WAS', name: 'Washington DC', x: 80, y: 40, region: 'ne',
    hotels: [
      { id: 'was-marriott', name: 'JW Marriott Washington, DC', brand: 'marriott', cost: 28000, vp: 3 },
      { id: 'was-hilton', name: 'Capital Hilton', brand: 'hilton', cost: 38000, vp: 3 },
      { id: 'was-hyatt', name: 'Park Hyatt Washington, D.C.', brand: 'hyatt', cost: 15000, vp: 4 },
    ],
  },
  NYC: {
    id: 'NYC', name: 'New York', x: 86, y: 32, region: 'ne',
    hotels: [
      { id: 'nyc-marriott', name: 'The Ritz-Carlton New York, Central Park', brand: 'marriott', cost: 45000, vp: 6 },
      // Waldorf Astoria New York closed for multi-year renovation — use operating Hilton flag
      { id: 'nyc-hilton', name: 'New York Hilton Midtown', brand: 'hilton', cost: 45000, vp: 4 },
      { id: 'nyc-hyatt', name: 'Park Hyatt New York', brand: 'hyatt', cost: 25000, vp: 6 },
    ],
  },
  BOS: {
    id: 'BOS', name: 'Boston', x: 90, y: 24, region: 'ne',
    hotels: [
      { id: 'bos-marriott', name: 'Boston Marriott Copley Place', brand: 'marriott', cost: 30000, vp: 3 },
      { id: 'bos-hilton', name: 'Hilton Boston Park Plaza', brand: 'hilton', cost: 40000, vp: 3 },
      { id: 'bos-hyatt', name: 'Hyatt Regency Boston', brand: 'hyatt', cost: 16000, vp: 4 },
    ],
  },
};

/** Look up a signature hotel by id across all cities */
export function getHotelById(hotelId) {
  for (const city of Object.values(CITIES)) {
    const h = (city.hotels || []).find((x) => x.id === hotelId);
    if (h) return { hotel: h, city };
  }
  return null;
}

/**
 * Routes: undirected edges between cities.
 * airlines: which miles can book this route
 * cost: base miles one-way
 */
export const ROUTES = [
  // United corridors
  { a: 'NYC', b: 'ORD', airlines: ['united', 'american'], cost: 12500 },
  { a: 'ORD', b: 'DEN', airlines: ['united'], cost: 10000 },
  { a: 'DEN', b: 'SFO', airlines: ['united'], cost: 12500 },
  { a: 'SFO', b: 'LAX', airlines: ['united', 'delta', 'american'], cost: 7500 },
  { a: 'SFO', b: 'SEA', airlines: ['united', 'delta'], cost: 7500 },
  { a: 'NYC', b: 'IAH', airlines: ['united'], cost: 15000 },
  { a: 'IAH', b: 'LAX', airlines: ['united'], cost: 15000 },
  { a: 'ORD', b: 'LAS', airlines: ['united'], cost: 12500 },
  { a: 'DEN', b: 'SEA', airlines: ['united'], cost: 10000 },
  { a: 'WAS', b: 'ORD', airlines: ['united'], cost: 10000 },
  { a: 'DEN', b: 'LAX', airlines: ['united'], cost: 12500 },
  { a: 'IAH', b: 'ORD', airlines: ['united'], cost: 10000 },
  { a: 'NYC', b: 'SFO', airlines: ['united'], cost: 22500 },
  { a: 'NYC', b: 'LAX', airlines: ['united', 'delta', 'american'], cost: 22500 },
  // Delta corridors
  { a: 'ATL', b: 'NYC', airlines: ['delta'], cost: 12500 },
  { a: 'ATL', b: 'MIA', airlines: ['delta', 'american'], cost: 10000 },
  { a: 'ATL', b: 'MSP', airlines: ['delta'], cost: 12500 },
  { a: 'ATL', b: 'LAX', airlines: ['delta'], cost: 20000 },
  { a: 'ATL', b: 'SEA', airlines: ['delta'], cost: 20000 },
  { a: 'MSP', b: 'SEA', airlines: ['delta'], cost: 12500 },
  { a: 'BOS', b: 'ATL', airlines: ['delta'], cost: 12500 },
  { a: 'ATL', b: 'LAS', airlines: ['delta'], cost: 15000 },
  { a: 'ATL', b: 'ORD', airlines: ['delta'], cost: 10000 },
  { a: 'ATL', b: 'DEN', airlines: ['delta'], cost: 15000 },
  { a: 'MSP', b: 'ORD', airlines: ['delta'], cost: 7500 },
  { a: 'SEA', b: 'LAX', airlines: ['delta', 'united'], cost: 10000 },
  // American corridors
  { a: 'DFW', b: 'NYC', airlines: ['american'], cost: 15000 },
  { a: 'DFW', b: 'LAX', airlines: ['american'], cost: 15000 },
  { a: 'DFW', b: 'MIA', airlines: ['american'], cost: 12500 },
  { a: 'DFW', b: 'PHX', airlines: ['american'], cost: 10000 },
  { a: 'MIA', b: 'NYC', airlines: ['american', 'delta'], cost: 15000 },
  { a: 'PHX', b: 'LAX', airlines: ['american'], cost: 7500 },
  { a: 'ORD', b: 'DFW', airlines: ['american'], cost: 10000 },
  { a: 'WAS', b: 'MIA', airlines: ['american'], cost: 12500 },
  { a: 'WAS', b: 'ATL', airlines: ['american', 'delta'], cost: 10000 },
  { a: 'DFW', b: 'LAS', airlines: ['american'], cost: 10000 },
  { a: 'PHX', b: 'DEN', airlines: ['american', 'united'], cost: 10000 },
  { a: 'MIA', b: 'MSY', airlines: ['american'], cost: 7500 },
  { a: 'DFW', b: 'MSY', airlines: ['american'], cost: 7500 },
  { a: 'BOS', b: 'NYC', airlines: ['american', 'delta', 'united'], cost: 5000 },
  { a: 'WAS', b: 'NYC', airlines: ['american', 'united', 'delta'], cost: 5000 },
  { a: 'LAS', b: 'LAX', airlines: ['american', 'delta', 'united'], cost: 5000 },
  { a: 'LAS', b: 'PHX', airlines: ['american'], cost: 7500 },
  { a: 'BOS', b: 'WAS', airlines: ['american', 'delta'], cost: 7500 },
  { a: 'IAH', b: 'MSY', airlines: ['united'], cost: 7500 },
  { a: 'IAH', b: 'MIA', airlines: ['united', 'american'], cost: 12500 },
];

/**
 * Trip tickets — complete by VISITING both cities (land in origin and destination
 * at least once this game). Higher VP so tickets beat leftover-point hoarding.
 */
export const TRIP_TICKETS = [
  { id: 't1', from: 'NYC', to: 'LAX', points: 18, penalty: 6 },
  { id: 't2', from: 'SEA', to: 'MIA', points: 20, penalty: 7 },
  { id: 't3', from: 'BOS', to: 'DEN', points: 14, penalty: 5 },
  { id: 't4', from: 'ATL', to: 'SFO', points: 18, penalty: 6 },
  { id: 't5', from: 'ORD', to: 'MIA', points: 14, penalty: 5 },
  { id: 't6', from: 'SEA', to: 'NYC', points: 18, penalty: 6 },
  { id: 't7', from: 'LAX', to: 'BOS', points: 18, penalty: 6 },
  { id: 't8', from: 'DFW', to: 'SEA', points: 16, penalty: 5 },
  { id: 't9', from: 'MSP', to: 'MIA', points: 14, penalty: 5 },
  { id: 't10', from: 'DEN', to: 'MIA', points: 16, penalty: 5 },
  { id: 't11', from: 'SFO', to: 'ATL', points: 18, penalty: 6 },
  { id: 't12', from: 'PHX', to: 'NYC', points: 16, penalty: 5 },
  { id: 't13', from: 'LAS', to: 'BOS', points: 16, penalty: 5 },
  { id: 't14', from: 'IAH', to: 'SEA', points: 16, penalty: 5 },
  { id: 't15', from: 'MSY', to: 'SFO', points: 16, penalty: 5 },
  { id: 't16', from: 'WAS', to: 'LAX', points: 16, penalty: 5 },
  { id: 't17', from: 'BOS', to: 'LAX', points: 18, penalty: 6 },
  { id: 't18', from: 'ORD', to: 'SEA', points: 14, penalty: 4 },
  { id: 't19', from: 'ATL', to: 'LAS', points: 12, penalty: 4 },
  { id: 't20', from: 'NYC', to: 'MSY', points: 12, penalty: 4 },
  { id: 't21', from: 'DEN', to: 'NYC', points: 14, penalty: 4 },
  { id: 't22', from: 'SFO', to: 'MIA', points: 20, penalty: 7 },
  { id: 't23', from: 'MSP', to: 'LAX', points: 14, penalty: 5 },
  { id: 't24', from: 'WAS', to: 'SEA', points: 18, penalty: 6 },
  { id: 't25', from: 'DFW', to: 'BOS', points: 14, penalty: 5 },
  { id: 't26', from: 'PHX', to: 'ATL', points: 14, penalty: 4 },
  { id: 't27', from: 'LAS', to: 'MIA', points: 16, penalty: 5 },
  { id: 't28', from: 'ORD', to: 'LAX', points: 14, penalty: 5 },
  { id: 't29', from: 'BOS', to: 'MIA', points: 14, penalty: 4 },
  { id: 't30', from: 'SEA', to: 'DFW', points: 16, penalty: 5 },
  // Short regional tickets — easier early completions
  { id: 't31', from: 'NYC', to: 'BOS', points: 8, penalty: 3 },
  { id: 't32', from: 'NYC', to: 'WAS', points: 8, penalty: 3 },
  { id: 't33', from: 'LAX', to: 'LAS', points: 8, penalty: 3 },
  { id: 't34', from: 'LAX', to: 'SFO', points: 8, penalty: 3 },
  { id: 't35', from: 'ORD', to: 'MSP', points: 8, penalty: 3 },
  { id: 't36', from: 'ATL', to: 'MIA', points: 10, penalty: 3 },
  { id: 't37', from: 'DFW', to: 'IAH', points: 8, penalty: 3 },
  { id: 't38', from: 'DEN', to: 'PHX', points: 10, penalty: 3 },
  { id: 't39', from: 'SEA', to: 'SFO', points: 10, penalty: 3 },
  { id: 't40', from: 'WAS', to: 'ATL', points: 10, penalty: 3 },
];

export const EVENTS = [
  { id: 'xfer_bonus_ua', name: 'Transfer Bonus: United', desc: 'Your next transfer to United gets +30%.', type: 'transfer_bonus', partner: 'united', bonus: 0.3 },
  { id: 'xfer_bonus_hyatt', name: 'Transfer Bonus: Hyatt', desc: 'Your next transfer to Hyatt gets +25%.', type: 'transfer_bonus', partner: 'hyatt', bonus: 0.25 },
  { id: 'xfer_bonus_hilton', name: 'Transfer Bonus: Hilton', desc: 'Your next transfer to Hilton gets +40%.', type: 'transfer_bonus', partner: 'hilton', bonus: 0.4 },
  { id: 'xfer_bonus_delta', name: 'Transfer Bonus: Delta', desc: 'Your next transfer to Delta gets +25%.', type: 'transfer_bonus', partner: 'delta', bonus: 0.25 },
  { id: 'xfer_bonus_aa', name: 'Transfer Bonus: American', desc: 'Your next transfer to American gets +25%.', type: 'transfer_bonus', partner: 'american', bonus: 0.25 },
  { id: 'double_dining', name: 'Double Dip Dining', desc: 'Dining earn is doubled this turn.', type: 'earn_mult', category: 'dining', mult: 2 },
  { id: 'points_audited', name: 'Points Audited', desc: 'Lose 5,000 from your highest bank balance.', type: 'lose_bank', amount: 5000 },
  { id: 'companion', name: 'Companion Certificate', desc: 'Next flight costs 50% miles this turn.', type: 'flight_discount', mult: 0.5 },
  { id: 'award_space', name: 'Award Space Opens', desc: 'All flights cost 20% fewer miles this turn.', type: 'flight_discount', mult: 0.8 },
  { id: 'steal', name: 'Account Takeover', desc: 'Steal 3,000 from the VP leader\'s richest bank.', type: 'steal', amount: 3000 },
  { id: 'status_match', name: 'Status Match', desc: '+3 VP on your next hotel stay this turn.', type: 'hotel_vp_bonus', amount: 3 },
  { id: 'rent_day', name: 'Rent Day!', desc: 'Bilt earn +50% this turn (and rent counts double for Landlord).', type: 'bilt_boost', mult: 1.5 },
  { id: 'flash_sale', name: 'Flash Sale', desc: 'Hotel nights cost 30% fewer points this turn.', type: 'hotel_discount', mult: 0.7 },
  { id: 'deval', name: 'Soft Devaluation', desc: 'Your hotel stays cost +20% this turn.', type: 'hotel_discount', mult: 1.2 },
  { id: 'signup_boost', name: 'Amex Offer Stack', desc: 'Gain 5,000 bank points in a bank you already use (or Chase).', type: 'gain_bank', amount: 5000 },
  { id: 'free_night', name: 'Free Night Certificate', desc: 'Your next signature-hotel stay this turn costs 0 points (still 1 night, once per property).', type: 'free_night' },
  { id: 'miles_sale', name: 'Mileage Sale', desc: 'Gain 8,000 miles in an airline you already hold (or United).', type: 'gain_airline', amount: 8000 },
  { id: 'weather_delay', name: 'Weather Delay', desc: 'Skip one action this turn (only 1 action).', type: 'lose_action' },
  { id: 'portal_bonus', name: 'Portal Booking Bonus', desc: 'Travel spend earns 3× this turn.', type: 'earn_mult', category: 'travel', mult: 3 },
  { id: 'grocery_run', name: 'Costco Run', desc: 'Groceries earn 3× this turn.', type: 'earn_mult', category: 'groceries', mult: 3 },
  { id: 'gas_spike', name: 'Road Trip', desc: 'Gas earn 3× this turn.', type: 'earn_mult', category: 'gas', mult: 3 },
  { id: 'points_found', name: 'Forgotten Points', desc: 'Gain 6,000 bank points in your strongest bank.', type: 'gain_strongest', amount: 6000 },
  { id: 'elite_night', name: 'Elite Night Credit', desc: 'Gain +2 night credits toward achievements (no stay required).', type: 'bonus_nights', amount: 2 },
  { id: 'segment_run', name: 'Crazy Itinerary', desc: 'Your next flight also grants +1 bonus segment.', type: 'bonus_segment' },
];

// Fix accidental id
EVENTS.forEach((e) => {
  if (e.id === '// delayed') e.id = 'weather_delay';
});

export const ACHIEVEMENTS = [
  { id: 'road_warrior', name: 'Road Warrior', desc: 'Complete 8 flight segments', check: (p) => p.segments >= 8, vp: 5 },
  { id: 'million_miler', name: 'Million Miler', desc: 'Complete 12 flight segments', check: (p) => p.segments >= 12, vp: 10 },
  { id: 'hotel_hopper', name: 'Hotel Hopper', desc: 'Stay 10 total nights', check: (p) => p.nights >= 10, vp: 6 },
  { id: 'sixty_night', name: '60-Night Legend', desc: 'Stay 15 total nights', check: (p) => p.nights >= 15, vp: 12 },
  { id: 'hyatt_week', name: 'Hyatt Week', desc: 'Stay 5 nights at Hyatt', check: (p) => (p.nightsByBrand.hyatt || 0) >= 5, vp: 5 },
  { id: 'hub_master', name: 'Hub Master', desc: 'Visit 4 fortress hubs (ATL, DFW, ORD, DEN, SFO)', check: (p) => {
    const hubs = ['ATL', 'DFW', 'ORD', 'DEN', 'SFO'];
    return hubs.filter((h) => p.visited.has(h)).length >= 4;
  }, vp: 5 },
  { id: 'polyglot', name: 'Polyglot Points', desc: 'Hold ≥5,000 in all four banks at once', check: (p) =>
    ['chase', 'amex', 'citi', 'bilt'].every((b) => (p.banks[b] || 0) >= 5000), vp: 6 },
  { id: 'transfer_titan', name: 'Transfer Titan', desc: 'Complete 6 point transfers', check: (p) => p.transfersDone >= 6, vp: 4 },
  { id: 'multi_bank', name: 'Bank Diversifier', desc: 'Hold cards from 3 different banks', check: (p) => {
    const banks = new Set(p.cards.map((c) => c.bank));
    return banks.size >= 3;
  }, vp: 5 },
  { id: 'coast', name: 'Coast to Coast', desc: 'Complete a West↔East trip ticket', check: (p) => p.coastToCoast, vp: 4 },
];

export const WEST = new Set(['SEA', 'SFO', 'LAX', 'LAS', 'PHX']);
export const EAST = new Set(['NYC', 'BOS', 'WAS', 'MIA', 'ATL']);

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function routeKey(a, b) {
  return [a, b].sort().join('-');
}

export function getRoute(a, b) {
  return ROUTES.find(
    (r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)
  );
}

export function neighbors(city) {
  return ROUTES.filter((r) => r.a === city || r.b === city).map((r) =>
    r.a === city ? r.b : r.a
  );
}

/**
 * All bookable itineraries from a city: nonstop + one-stop on the same airline.
 * One-stop requires both legs share at least one common airline.
 * @returns {{ key, to, via, baseCost, airlines, stops }[]}
 */
export function listFlightOptions(fromCity) {
  const options = [];

  // Nonstop
  for (const r of ROUTES) {
    if (r.a !== fromCity && r.b !== fromCity) continue;
    const to = r.a === fromCity ? r.b : r.a;
    options.push({
      key: `${to}|direct`,
      to,
      via: null,
      baseCost: r.cost,
      airlines: r.airlines.slice(),
      stops: 0,
    });
  }

  // One stopover, same airline on both legs
  for (const r1 of ROUTES) {
    if (r1.a !== fromCity && r1.b !== fromCity) continue;
    const via = r1.a === fromCity ? r1.b : r1.a;
    for (const r2 of ROUTES) {
      if (r2.a !== via && r2.b !== via) continue;
      const to = r2.a === via ? r2.b : r2.a;
      if (to === fromCity || to === via) continue;
      const common = r1.airlines.filter((a) => r2.airlines.indexOf(a) !== -1);
      if (!common.length) continue;
      options.push({
        key: `${to}|via|${via}`,
        to,
        via,
        baseCost: r1.cost + r2.cost,
        airlines: common,
        stops: 1,
      });
    }
  }

  options.sort((a, b) => {
    if (a.stops !== b.stops) return a.stops - b.stops;
    if (a.to !== b.to) return a.to.localeCompare(b.to);
    if ((a.via || '') !== (b.via || '')) {
      return (a.via || '').localeCompare(b.via || '');
    }
    return a.baseCost - b.baseCost;
  });

  return options;
}

/** Resolve a specific itinerary; returns legs + total cost or null */
export function resolveItinerary(from, to, airline, via) {
  if (!via) {
    const route = getRoute(from, to);
    if (!route || route.airlines.indexOf(airline) === -1) return null;
    return {
      from,
      to,
      via: null,
      stops: 0,
      baseCost: route.cost,
      legs: [{ from, to, cost: route.cost }],
    };
  }
  const r1 = getRoute(from, via);
  const r2 = getRoute(via, to);
  if (!r1 || !r2) return null;
  if (r1.airlines.indexOf(airline) === -1 || r2.airlines.indexOf(airline) === -1) {
    return null;
  }
  return {
    from,
    to,
    via,
    stops: 1,
    baseCost: r1.cost + r2.cost,
    legs: [
      { from, to: via, cost: r1.cost },
      { from: via, to, cost: r2.cost },
    ],
  };
}
