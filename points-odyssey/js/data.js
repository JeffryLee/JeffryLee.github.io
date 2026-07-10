/**
 * Points Odyssey — static game data
 * Transfer partners simplified from real US ecosystems (Chase/Amex/Citi/Bilt).
 */

export const GAME_CONFIG = {
  minPlayers: 3,
  maxPlayers: 6,
  maxRounds: 10,
  budgetPerTurn: 3000,
  /** Max credit cards (Executive gets +cardLimitBonus) */
  defaultCardLimit: 2,
  maxTripTickets: 4,
  maxNightsPerBooking: 1, // one night per stay; each property once per game
  startingTickets: 3,
  keepTickets: 2,
  /** Free bank seed (small — not a second signup) */
  starterBankPoints: 3000,
  /** Hotel economy — stays should beat hoarding points */
  hotelVpMultiplier: 2,
  hotelCostMultiplier: 0.75,
  /** Final leftover conversion (weak so travel/hotels win) */
  leftoverBankPerVp: 12000,
  leftoverHotelPerVp: 25000,
  leftoverAirlinePerVp: 20000,
  /** Rest/plan action (Build) */
  restPlanPoints: 3000,
  /**
   * Action economy (per turn, after income):
   * - 1 free Transfer (book-prep)
   * - 1 Build: Apply card | Draw tickets | Rest
   * - 1 Travel: Flight | Hotel
   */
  freeTransfersPerTurn: 1,
  buildActionsPerTurn: 1,
  travelActionsPerTurn: 1,
  /**
   * Award inventory: each airline has this many award bookings per round.
   * A nonstop or one-stop itinerary costs 1 ticket (connection legs don't double-count).
   * Resets when the round advances.
   */
  awardsPerAirlinePerRound: 2,
  /** Face-up race goals (ordered origin→dest; first to complete claims) */
  raceGoalCount: 3,
  /** Extra VP for claiming a public race goal */
  raceGoalBonusVp: 2,
};

/** First-game strategy lines shown during onboarding / turn tips */
export const STRATEGY_TIPS = {
  consultant:
    'Transfer Chase → United, fly ticket origins first, then destinations. Ticket bonus stacks.',
  family:
    'Race signature hotels early — cheaper stays and extra VP while properties are open.',
  nomad:
    'First flight each turn is steeply discounted. Farm new cities and chain ordered tickets.',
  foodie:
    'Keep dining on a strong card — free VP every income with food spend.',
  landlord:
    'Rent on Bilt earns hard; transfer to United/American/Hyatt and race public goals.',
  executive:
    'Open a third premium card for fat signups, diversify earn, then transfer and travel.',
};

/** Character → free starter card id (so round-1 income can earn) */
export const STARTER_CARDS = {
  consultant: 'cfu',
  family: 'cff',
  nomad: 'cfu',
  /** Dining specialist — not a flat 2× card */
  foodie: 'custom_cash',
  landlord: 'bilt_card',
  executive: 'csp',
};

export const BANKS = {
  chase: { id: 'chase', name: 'Chase', color: '#117ACA', short: 'UR' },
  amex: { id: 'amex', name: 'Amex', color: '#006FCF', short: 'MR' },
  citi: { id: 'citi', name: 'Citi', color: '#003B70', short: 'TY' },
  bilt: { id: 'bilt', name: 'Bilt', color: '#1A1A2E', short: 'Bilt' },
};

export const HOTELS = {
  marriott: { id: 'marriott', name: 'Marriott', color: '#8B1A4A', icon: '🏨', logo: 'assets/hotels/brands/marriott.png?v=brand4' },
  hilton: { id: 'hilton', name: 'Hilton', color: '#004B87', icon: '🛏️', logo: 'assets/hotels/brands/hilton.png?v=brand4' },
  hyatt: { id: 'hyatt', name: 'Hyatt', color: '#6B2D5B', icon: '🔑', logo: 'assets/hotels/brands/hyatt.png?v=brand4' },
};

export const AIRLINES = {
  // Gold (brand accent) — navy #002244 disappears on the dark map
  united: { id: 'united', name: 'United', color: '#FFB81C', short: 'UA' },
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
  'others',
];

/**
 * Characters shape which spend categories tend to appear (weights → probability).
 * Earn rates still come only from credit cards (0× without a card).
 */
export const SPEND_DRAWS = 5;

/**
 * Skills tuned from 6p bot win-rate sims (target ~fair share 1/n each).
 * Identity stays thematic; VP power from stacking bonuses is capped.
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
    skills: [
      'All award flights cost 15% fewer miles',
      'Private trip tickets grant +1 bonus VP',
    ],
    specialDesc:
      'All award flights cost 15% fewer miles. Completing a private trip ticket grants +1 bonus VP.',
    spendProfile: {
      travel: 35,
      dining: 25,
      flights: 15,
      hotels: 10,
      transit: 8,
      others: 7,
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
    skills: [
      'Hotel nights −25% cost and +3 VP per stay',
      'Start with 8k Marriott + 8k Hyatt',
      'Groceries spend: +1 VP once/turn',
    ],
    specialDesc:
      'Hotel nights −25% cost and +3 VP per stay. Start with 8k Marriott + 8k Hyatt. Groceries spend: +1 VP once/turn.',
    spendProfile: {
      groceries: 30,
      gas: 18,
      dining: 15,
      hotels: 14,
      travel: 13,
      others: 10,
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
    skills: [
      'First flight each turn costs 30% fewer miles',
      '+2 VP per newly visited city when you land there',
      'Private tickets grant +1 bonus VP',
    ],
    specialDesc:
      'First flight each turn costs 30% fewer miles. +2 VP per newly visited city when you land there. Completing a private ticket grants +1 bonus VP.',
    spendProfile: {
      transit: 28,
      travel: 26,
      dining: 14,
      hotels: 12,
      flights: 12,
      others: 8,
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
    skills: ['If any dining spend this turn: +1 VP (once/turn)'],
    specialDesc: 'If any dining spend this turn: +1 VP (once/turn).',
    spendProfile: {
      dining: 45,
      groceries: 25,
      others: 12,
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
    skills: [
      'Bilt earn +35% always (stacks with Rent Day events)',
      'Rent on Bilt at least 2× before boost',
      'Rent spend: +1 VP once/turn',
    ],
    specialDesc:
      'Bilt earn +35% always (stacks with Rent Day events). Rent on Bilt at least 2× before boost. Rent spend: +1 VP once/turn.',
    spendProfile: {
      rent: 50,
      dining: 15,
      others: 12,
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
    skills: [
      'Hold up to 3 cards (others 2)',
      'Signup bonuses +10% larger',
      'Start with a $4k Chase travel fund',
    ],
    specialDesc:
      'Hold up to 3 cards (others 2). Signup bonuses +10% larger. Start with a $4k Chase travel fund.',
    spendProfile: {
      flights: 25,
      hotels: 25,
      dining: 20,
      travel: 15,
      others: 10,
      transit: 5,
    },
  },
];

/** Normalize spendProfile weights to percentages (0–100). */
export function spendProfilePercents(profile) {
  const entries = Object.entries(profile || { others: 1 });
  const sum = entries.reduce((s, [, w]) => s + w, 0) || 1;
  const out = {};
  for (const [k, w] of entries) out[k] = Math.round((100 * w) / sum);
  return out;
}

function pickWeighted(weights) {
  const entries = Object.entries(weights || { others: 1 });
  const total = entries.reduce((s, [, w]) => s + w, 0) || 1;
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

/**
 * Roll lifestyle spend: SPEND_DRAWS chunks of budget by character odds.
 */
export function rollSpendAllocation(character) {
  const profile = character.spendProfile || { others: 1 };
  const budget = GAME_CONFIG.budgetPerTurn;
  const draws = SPEND_DRAWS;
  const chunk = Math.floor(budget / draws);
  const alloc = {};
  let assigned = 0;
  const pickCategory = () => pickWeighted(profile);
  for (let i = 0; i < draws; i++) {
    const cat = pickCategory();
    const amt = i === draws - 1 ? budget - assigned : chunk;
    alloc[cat] = (alloc[cat] || 0) + amt;
    assigned += amt;
  }
  return alloc;
}

/**
 * Credit cards — redesigned earn structure (2026 rebalance):
 *
 * Goals:
 *  - Flat "others" cards are baseline (~7.5–8.5k / $5k), not best-in-slot.
 *  - Premium cards win on THEIR categories + bank partners, not raw avg earn.
 *  - Signup ≈ 2–3 good income turns, not half the game.
 *  - Bank choice (UA/DL/AA/hotels) matters more than maxing a 2× flat card.
 *
 * Rough targets per $5k mixed spend:
 *  - Starter no-fee: ~7–9k
 *  - Premium: ~8–11k on-profile, ~6–8k off-profile
 *  - Category spike cards: high on niche, weak elsewhere
 */
export const CREDIT_CARDS = [
  // ——— Chase (United / Hyatt / Marriott) ———
  {
    id: 'cfu',
    name: 'Freedom Unlimited',
    bank: 'chase',
    // Slightly under other banks' baselines so Chase is not the default pile-up
    earn: { others: 1.4 },
    signupBonus: 10000,
    minSpend: 500,
    annualFee: 0,
    tier: 'starter',
  },
  {
    id: 'cff',
    name: 'Freedom Flex',
    bank: 'chase',
    earn: { groceries: 4, gas: 3, others: 1 },
    signupBonus: 10000,
    minSpend: 500,
    annualFee: 0,
    tier: 'starter',
  },
  {
    id: 'csp',
    name: 'Sapphire Preferred',
    bank: 'chase',
    earn: { travel: 3, dining: 2, others: 1 },
    signupBonus: 20000,
    minSpend: 3000,
    annualFee: 95,
    tier: 'premium',
  },
  {
    id: 'csr',
    name: 'Sapphire Reserve',
    bank: 'chase',
    earn: { travel: 3, dining: 3, hotels: 2, others: 1 },
    signupBonus: 25000,
    minSpend: 4000,
    annualFee: 550,
    tier: 'premium',
  },
  // ——— Amex (Delta / Hilton / Marriott) ———
  {
    id: 'amex_blue',
    name: 'Blue Business Plus',
    bank: 'amex',
    earn: { others: 1.8 },
    signupBonus: 10000,
    minSpend: 3000,
    annualFee: 0,
    tier: 'starter',
  },
  {
    id: 'amex_gold',
    name: 'Gold Card',
    bank: 'amex',
    earn: { dining: 4, groceries: 3, flights: 3, others: 1 },
    signupBonus: 20000,
    minSpend: 3000,
    annualFee: 325,
    tier: 'premium',
  },
  {
    id: 'amex_plat',
    name: 'Platinum Card',
    bank: 'amex',
    earn: { flights: 5, hotels: 4, others: 1 },
    signupBonus: 25000,
    minSpend: 4000,
    annualFee: 695,
    tier: 'premium',
  },
  {
    id: 'delta_gold',
    name: 'Delta Gold',
    bank: 'amex',
    earn: { flights: 3, dining: 2, others: 1 },
    signupBonus: 18000,
    minSpend: 2000,
    annualFee: 150,
    directAirline: 'delta',
    tier: 'cobrand',
  },
  // ——— Citi (American / Hilton) ———
  {
    id: 'double_cash',
    name: 'Double Cash',
    bank: 'citi',
    earn: { others: 1.6 },
    signupBonus: 8000,
    minSpend: 0,
    annualFee: 0,
    tier: 'starter',
  },
  {
    id: 'custom_cash',
    name: 'Custom Cash',
    bank: 'citi',
    earn: { dining: 4, others: 1 },
    signupBonus: 10000,
    minSpend: 500,
    annualFee: 0,
    tier: 'starter',
  },
  {
    id: 'strata',
    name: 'Strata Premier',
    bank: 'citi',
    earn: { travel: 3, dining: 3, groceries: 3, gas: 2, others: 1 },
    signupBonus: 20000,
    minSpend: 3000,
    annualFee: 95,
    tier: 'premium',
  },
  // ——— Bilt (United + American + Hyatt/Marriott) ———
  {
    id: 'bilt_card',
    name: 'Bilt Mastercard',
    bank: 'bilt',
    earn: { rent: 2, dining: 3, travel: 3, others: 1 },
    signupBonus: 10000,
    minSpend: 0,
    annualFee: 0,
    tier: 'starter',
  },
];

/**
 * City positions as % of map container (approx US geography).
 */
export const CITIES = {
  NYC: { id: 'NYC', name: 'New York', x: 82, y: 32, region: 'NE' },
  BOS: { id: 'BOS', name: 'Boston', x: 88, y: 24, region: 'NE' },
  WAS: { id: 'WAS', name: 'Washington', x: 78, y: 40, region: 'NE' },
  ATL: { id: 'ATL', name: 'Atlanta', x: 70, y: 58, region: 'SE' },
  MIA: { id: 'MIA', name: 'Miami', x: 78, y: 82, region: 'SE' },
  ORD: { id: 'ORD', name: 'Chicago', x: 58, y: 30, region: 'MW' },
  MSP: { id: 'MSP', name: 'Minneapolis', x: 50, y: 22, region: 'MW' },
  DFW: { id: 'DFW', name: 'Dallas', x: 48, y: 62, region: 'S' },
  IAH: { id: 'IAH', name: 'Houston', x: 50, y: 72, region: 'S' },
  DEN: { id: 'DEN', name: 'Denver', x: 38, y: 40, region: 'MT' },
  PHX: { id: 'PHX', name: 'Phoenix', x: 28, y: 58, region: 'SW' },
  LAS: { id: 'LAS', name: 'Las Vegas', x: 22, y: 48, region: 'SW' },
  LAX: { id: 'LAX', name: 'Los Angeles', x: 14, y: 55, region: 'W' },
  SFO: { id: 'SFO', name: 'San Francisco', x: 10, y: 40, region: 'W' },
  SEA: { id: 'SEA', name: 'Seattle', x: 14, y: 16, region: 'NW' },
  MSY: { id: 'MSY', name: 'New Orleans', x: 58, y: 72, region: 'S' },
};

// Attach hotels to cities (signature properties)
function attachHotels() {
  const H = {
    NYC: [
      { id: 'nyc-hyatt', name: 'Park Hyatt New York', brand: 'hyatt', cost: 45000, vp: 4 },
      { id: 'nyc-marriott', name: 'New York Marriott Marquis', brand: 'marriott', cost: 40000, vp: 3 },
      { id: 'nyc-hilton', name: 'New York Hilton Midtown', brand: 'hilton', cost: 35000, vp: 3 },
    ],
    BOS: [
      { id: 'bos-marriott', name: 'Boston Marriott Copley', brand: 'marriott', cost: 35000, vp: 3 },
      { id: 'bos-hilton', name: 'Hilton Boston Back Bay', brand: 'hilton', cost: 32000, vp: 3 },
    ],
    WAS: [
      { id: 'was-hyatt', name: 'Park Hyatt Washington', brand: 'hyatt', cost: 40000, vp: 4 },
      { id: 'was-marriott', name: 'JW Marriott Washington', brand: 'marriott', cost: 38000, vp: 3 },
      { id: 'was-hilton', name: 'Hilton Washington DC', brand: 'hilton', cost: 30000, vp: 3 },
    ],
    ATL: [
      { id: 'atl-marriott', name: 'Atlanta Marriott Marquis', brand: 'marriott', cost: 32000, vp: 3 },
      { id: 'atl-hilton', name: 'Hilton Atlanta', brand: 'hilton', cost: 28000, vp: 2 },
    ],
    MIA: [
      { id: 'mia-hyatt', name: 'Hyatt Regency Miami', brand: 'hyatt', cost: 35000, vp: 3 },
      { id: 'mia-marriott', name: 'Miami Marriott Biscayne', brand: 'marriott', cost: 34000, vp: 3 },
      { id: 'mia-hilton', name: 'Hilton Miami Downtown', brand: 'hilton', cost: 30000, vp: 3 },
    ],
    ORD: [
      { id: 'ord-hyatt', name: 'Park Hyatt Chicago', brand: 'hyatt', cost: 42000, vp: 4 },
      { id: 'ord-marriott', name: 'Chicago Marriott Downtown', brand: 'marriott', cost: 36000, vp: 3 },
      { id: 'ord-hilton', name: 'Hilton Chicago', brand: 'hilton', cost: 32000, vp: 3 },
    ],
    MSP: [
      { id: 'msp-marriott', name: 'Minneapolis Marriott City Center', brand: 'marriott', cost: 30000, vp: 3 },
      { id: 'msp-hilton', name: 'Hilton Minneapolis', brand: 'hilton', cost: 28000, vp: 2 },
    ],
    DFW: [
      { id: 'dfw-hyatt', name: 'Grand Hyatt DFW', brand: 'hyatt', cost: 32000, vp: 3 },
      { id: 'dfw-marriott', name: 'Dallas Marriott City Center', brand: 'marriott', cost: 30000, vp: 3 },
      { id: 'dfw-hilton', name: 'Hilton Anatole Dallas', brand: 'hilton', cost: 28000, vp: 2 },
    ],
    IAH: [
      { id: 'iah-marriott', name: 'Houston Marriott Medical Center', brand: 'marriott', cost: 30000, vp: 3 },
      { id: 'iah-hilton', name: 'Hilton Americas-Houston', brand: 'hilton', cost: 28000, vp: 2 },
    ],
    DEN: [
      { id: 'den-hyatt', name: 'Hyatt Regency Denver', brand: 'hyatt', cost: 34000, vp: 3 },
      { id: 'den-marriott', name: 'Denver Marriott Tech Center', brand: 'marriott', cost: 30000, vp: 3 },
      { id: 'den-hilton', name: 'Hilton Denver City Center', brand: 'hilton', cost: 28000, vp: 2 },
    ],
    PHX: [
      { id: 'phx-marriott', name: 'Phoenix Marriott Tempe', brand: 'marriott', cost: 28000, vp: 2 },
      { id: 'phx-hilton', name: 'Hilton Phoenix Tapatio Cliffs', brand: 'hilton', cost: 26000, vp: 2 },
    ],
    LAS: [
      { id: 'las-hyatt', name: 'Park MGM (Hyatt)', brand: 'hyatt', cost: 30000, vp: 3 },
      { id: 'las-marriott', name: 'JW Marriott Las Vegas', brand: 'marriott', cost: 32000, vp: 3 },
      { id: 'las-hilton', name: 'Hilton Grand Vacations Las Vegas', brand: 'hilton', cost: 28000, vp: 2 },
    ],
    LAX: [
      { id: 'lax-hyatt', name: 'Hyatt Regency LAX', brand: 'hyatt', cost: 36000, vp: 3 },
      { id: 'lax-marriott', name: 'Los Angeles Marriott Burbank', brand: 'marriott', cost: 34000, vp: 3 },
      { id: 'lax-hilton', name: 'Hilton Los Angeles Airport', brand: 'hilton', cost: 30000, vp: 3 },
    ],
    SFO: [
      { id: 'sfo-hyatt', name: 'Grand Hyatt San Francisco', brand: 'hyatt', cost: 40000, vp: 4 },
      { id: 'sfo-marriott', name: 'San Francisco Marriott Marquis', brand: 'marriott', cost: 38000, vp: 3 },
    ],
    SEA: [
      { id: 'sea-hyatt', name: 'Hyatt at Olive 8 Seattle', brand: 'hyatt', cost: 36000, vp: 3 },
      { id: 'sea-marriott', name: 'Seattle Marriott Waterfront', brand: 'marriott', cost: 34000, vp: 3 },
      { id: 'sea-hilton', name: 'Hilton Seattle', brand: 'hilton', cost: 30000, vp: 3 },
    ],
    MSY: [
      { id: 'msy-marriott', name: 'New Orleans Marriott', brand: 'marriott', cost: 32000, vp: 3 },
      { id: 'msy-hilton', name: 'Hilton New Orleans Riverside', brand: 'hilton', cost: 30000, vp: 3 },
    ],
  };
  for (const [id, hotels] of Object.entries(H)) {
    if (CITIES[id]) CITIES[id].hotels = hotels;
  }
}
attachHotels();

export function getHotelById(hotelId) {
  for (const c of Object.values(CITIES)) {
    const h = (c.hotels || []).find((x) => x.id === hotelId);
    if (h) return { hotel: h, city: c };
  }
  return null;
}

export const WEST = new Set(['LAX', 'SFO', 'SEA', 'LAS', 'PHX', 'DEN']);
export const EAST = new Set(['NYC', 'BOS', 'WAS', 'ATL', 'MIA']);

/**
 * Routes: undirected edges between cities.
 * airlines: which miles can book this route
 */
export const ROUTES = [
  // West/central corridors — multi-carrier so Chase/UA is not the only path
  { a: 'NYC', b: 'ORD', airlines: ['united', 'american', 'delta'], cost: 12500 },
  { a: 'ORD', b: 'DEN', airlines: ['united', 'delta'], cost: 10000 },
  { a: 'DEN', b: 'SFO', airlines: ['united', 'delta'], cost: 12500 },
  { a: 'SFO', b: 'LAX', airlines: ['united', 'delta', 'american'], cost: 7500 },
  { a: 'SFO', b: 'SEA', airlines: ['united', 'delta'], cost: 7500 },
  { a: 'NYC', b: 'IAH', airlines: ['united', 'american'], cost: 15000 },
  { a: 'IAH', b: 'LAX', airlines: ['united', 'american'], cost: 15000 },
  { a: 'ORD', b: 'LAS', airlines: ['united', 'delta', 'american'], cost: 12500 },
  { a: 'DEN', b: 'SEA', airlines: ['united', 'delta'], cost: 10000 },
  { a: 'WAS', b: 'ORD', airlines: ['united', 'american', 'delta'], cost: 10000 },
  { a: 'DEN', b: 'LAX', airlines: ['united', 'american', 'delta'], cost: 12500 },
  { a: 'IAH', b: 'ORD', airlines: ['united', 'american'], cost: 10000 },
  { a: 'NYC', b: 'SFO', airlines: ['united', 'delta', 'american'], cost: 22500 },
  { a: 'NYC', b: 'LAX', airlines: ['united', 'delta', 'american'], cost: 22500 },
  // Delta
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
  // American
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
  { a: 'IAH', b: 'MSY', airlines: ['united', 'american'], cost: 7500 },
  { a: 'IAH', b: 'MIA', airlines: ['united', 'american', 'delta'], cost: 12500 },
];

/**
 * Trip tickets — ordered: land at origin first, then later land at destination.
 */
export const TRIP_TICKETS = [
  { id: 't1', from: 'NYC', to: 'LAX', points: 11, penalty: 4 },
  { id: 't2', from: 'SEA', to: 'MIA', points: 13, penalty: 4 },
  { id: 't3', from: 'BOS', to: 'DEN', points: 9, penalty: 3 },
  { id: 't4', from: 'ATL', to: 'SFO', points: 11, penalty: 4 },
  { id: 't5', from: 'ORD', to: 'MIA', points: 9, penalty: 3 },
  { id: 't6', from: 'SEA', to: 'NYC', points: 11, penalty: 4 },
  { id: 't7', from: 'LAX', to: 'BOS', points: 11, penalty: 4 },
  { id: 't8', from: 'DFW', to: 'SEA', points: 10, penalty: 3 },
  { id: 't9', from: 'MSP', to: 'MIA', points: 9, penalty: 3 },
  { id: 't10', from: 'DEN', to: 'MIA', points: 10, penalty: 3 },
  { id: 't11', from: 'SFO', to: 'ATL', points: 11, penalty: 4 },
  { id: 't12', from: 'PHX', to: 'NYC', points: 10, penalty: 3 },
  { id: 't13', from: 'LAS', to: 'BOS', points: 10, penalty: 3 },
  { id: 't14', from: 'IAH', to: 'SEA', points: 10, penalty: 3 },
  { id: 't15', from: 'MSY', to: 'SFO', points: 10, penalty: 3 },
  { id: 't16', from: 'WAS', to: 'LAX', points: 10, penalty: 3 },
  { id: 't17', from: 'BOS', to: 'LAX', points: 11, penalty: 4 },
  { id: 't18', from: 'ORD', to: 'SEA', points: 9, penalty: 3 },
  { id: 't19', from: 'ATL', to: 'LAS', points: 8, penalty: 3 },
  { id: 't20', from: 'NYC', to: 'MSY', points: 8, penalty: 3 },
  { id: 't21', from: 'DEN', to: 'NYC', points: 9, penalty: 3 },
  { id: 't22', from: 'SFO', to: 'MIA', points: 13, penalty: 4 },
  { id: 't23', from: 'MSP', to: 'LAX', points: 9, penalty: 3 },
  { id: 't24', from: 'WAS', to: 'SEA', points: 11, penalty: 4 },
  { id: 't25', from: 'DFW', to: 'BOS', points: 9, penalty: 3 },
  { id: 't26', from: 'PHX', to: 'ATL', points: 9, penalty: 3 },
  { id: 't27', from: 'LAS', to: 'MIA', points: 10, penalty: 3 },
  { id: 't28', from: 'ORD', to: 'LAX', points: 9, penalty: 3 },
  { id: 't29', from: 'BOS', to: 'MIA', points: 9, penalty: 3 },
  { id: 't30', from: 'SEA', to: 'DFW', points: 10, penalty: 3 },
  { id: 't31', from: 'NYC', to: 'BOS', points: 5, penalty: 2 },
  { id: 't32', from: 'NYC', to: 'WAS', points: 5, penalty: 2 },
  { id: 't33', from: 'LAX', to: 'LAS', points: 5, penalty: 2 },
  { id: 't34', from: 'LAX', to: 'SFO', points: 5, penalty: 2 },
  { id: 't35', from: 'ORD', to: 'MSP', points: 5, penalty: 2 },
  { id: 't36', from: 'ATL', to: 'MIA', points: 6, penalty: 2 },
  { id: 't37', from: 'DFW', to: 'IAH', points: 5, penalty: 2 },
  { id: 't38', from: 'DEN', to: 'PHX', points: 6, penalty: 2 },
  { id: 't39', from: 'SEA', to: 'SFO', points: 6, penalty: 2 },
  { id: 't40', from: 'WAS', to: 'ATL', points: 6, penalty: 2 },
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
  { id: 'weather_delay', name: 'Weather Delay', desc: 'Lose your Travel action this turn (Build + free transfer still OK).', type: 'lose_action' },
  { id: 'portal_bonus', name: 'Portal Booking Bonus', desc: 'Travel spend earns 3× this turn.', type: 'earn_mult', category: 'travel', mult: 3 },
  { id: 'grocery_run', name: 'Costco Run', desc: 'Groceries earn 3× this turn.', type: 'earn_mult', category: 'groceries', mult: 3 },
  { id: 'gas_spike', name: 'Road Trip', desc: 'Gas earn 3× this turn.', type: 'earn_mult', category: 'gas', mult: 3 },
  { id: 'points_found', name: 'Forgotten Points', desc: 'Gain 6,000 bank points in your strongest bank.', type: 'gain_strongest', amount: 6000 },
  { id: 'elite_night', name: 'Elite Night Credit', desc: 'Gain +2 night credits toward achievements (no stay required).', type: 'bonus_nights', amount: 2 },
  { id: 'segment_run', name: 'Crazy Itinerary', desc: 'Your next flight also grants +1 bonus segment.', type: 'bonus_segment' },
];

EVENTS.forEach((e) => {
  if (!e.id) e.id = e.name;
});

export const ACHIEVEMENTS = [
  {
    id: 'million_miler',
    name: 'Million Miler',
    desc: 'Complete 12 flight segments',
    vp: 10,
    check: (p) => p.segments >= 12,
  },
  {
    id: 'road_warrior',
    name: 'Road Warrior',
    desc: 'Complete 8 flight segments',
    vp: 5,
    check: (p) => p.segments >= 8,
  },
  {
    id: 'hotel_hopper',
    name: 'Hotel Hopper',
    desc: 'Stay 10 total nights',
    vp: 6,
    check: (p) => p.nights >= 10,
  },
  {
    id: 'brand_loyal',
    name: 'Brand Loyalist',
    desc: 'Stay 4 nights with one hotel brand',
    vp: 4,
    check: (p) => Object.values(p.nightsByBrand || {}).some((n) => n >= 4),
  },
  {
    id: 'hub_master',
    name: 'Hub Master',
    desc: 'Visit 4 major hubs (ATL, DFW, ORD, DEN, SFO, LAX, NYC)',
    vp: 5,
    check: (p) => {
      const hubs = ['ATL', 'DFW', 'ORD', 'DEN', 'SFO', 'LAX', 'NYC'];
      return hubs.filter((h) => p.visited.has(h)).length >= 4;
    },
  },
  {
    id: 'coast',
    name: 'Coast to Coast',
    desc: 'Complete a West↔East trip ticket',
    check: (p) => p.coastToCoast,
    vp: 4,
  },
  {
    id: 'polyglot',
    name: 'Points Polyglot',
    desc: 'Hold points in 3 different banks at once',
    vp: 3,
    check: (p) => Object.values(p.banks).filter((v) => v > 0).length >= 3,
  },
  {
    id: 'transfer_king',
    name: 'Transfer King',
    desc: 'Complete 6 transfers',
    vp: 3,
    check: (p) => p.transfersDone >= 6,
  },
];

export function shuffle(arr) {
  const a = arr.slice();
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
 */
export function listFlightOptions(from) {
  const out = [];
  const seen = new Set();

  for (const r of ROUTES) {
    let to = null;
    if (r.a === from) to = r.b;
    else if (r.b === from) to = r.a;
    else continue;
    const key = `0-${to}-${r.airlines.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      to,
      via: null,
      stops: 0,
      baseCost: r.cost,
      airlines: r.airlines.slice(),
    });
  }

  for (const r1 of ROUTES) {
    let mid = null;
    if (r1.a === from) mid = r1.b;
    else if (r1.b === from) mid = r1.a;
    else continue;
    for (const r2 of ROUTES) {
      let to = null;
      if (r2.a === mid) to = r2.b;
      else if (r2.b === mid) to = r2.a;
      else continue;
      if (to === from) continue;
      const common = r1.airlines.filter((a) => r2.airlines.indexOf(a) !== -1);
      if (!common.length) continue;
      const key = `1-${mid}-${to}-${common.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        to,
        via: mid,
        stops: 1,
        baseCost: r1.cost + r2.cost,
        airlines: common,
      });
    }
  }
  return out;
}

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
