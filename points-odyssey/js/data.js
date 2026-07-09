/**
 * Points Odyssey — static game data
 * Transfer partners simplified from real US ecosystems (Chase/Amex/Citi/Bilt).
 */

export const GAME_CONFIG = {
  minPlayers: 3,
  maxPlayers: 6,
  maxRounds: 10,
  budgetPerTurn: 2000,
  defaultCardLimit: 3,
  executiveCardLimit: 4,
  maxTripTickets: 5,
  maxNightsPerBooking: 3,
  startingTickets: 3,
  keepTickets: 2,
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

export const CHARACTERS = [
  {
    id: 'consultant',
    name: 'The Consultant',
    image: 'assets/char-consultant.jpg',
    blurb: 'Road warrior with fat travel & dining spend.',
    multipliers: { travel: 3, dining: 2, everything: 1 },
    homeCity: 'NYC',
    cardLimitBonus: 0,
    special: 'travel_focus',
    specialDesc: 'Travel spend is king. Great for Chase/United.',
  },
  {
    id: 'family',
    name: 'The Family',
    image: 'assets/char-family.jpg',
    blurb: 'Groceries, gas, and weekend getaways.',
    multipliers: { groceries: 3, gas: 2, everything: 1 },
    homeCity: 'ORD',
    cardLimitBonus: 0,
    special: 'family_nights',
    specialDesc: '+1 VP when booking 2+ hotel nights.',
  },
  {
    id: 'nomad',
    name: 'The Nomad',
    image: 'assets/char-nomad.jpg',
    blurb: 'Always moving — transit and travel.',
    multipliers: { travel: 2, transit: 3, everything: 1 },
    homeCity: 'DEN',
    cardLimitBonus: 0,
    special: 'cheap_flight',
    specialDesc: 'First flight each turn costs 10% fewer miles.',
  },
  {
    id: 'foodie',
    name: 'The Foodie',
    image: 'assets/char-foodie.jpg',
    blurb: 'Dining and markets fund the adventures.',
    multipliers: { dining: 4, groceries: 2, everything: 1 },
    homeCity: 'SFO',
    cardLimitBonus: 0,
    special: 'dining_bonus',
    specialDesc: '+500 bonus bank pts once per turn from dining.',
  },
  {
    id: 'landlord',
    name: 'The Landlord',
    image: 'assets/char-landlord.jpg',
    blurb: 'Rent Day is payday. Bilt is destiny.',
    multipliers: { rent: 5, everything: 1 },
    homeCity: 'LAX',
    cardLimitBonus: 0,
    special: 'rent_day',
    specialDesc: 'Rent spend only works well with Bilt cards.',
  },
  {
    id: 'executive',
    name: 'The Executive',
    image: 'assets/char-executive.jpg',
    blurb: 'Premium flights, hotels, and client dinners.',
    multipliers: { flights: 3, hotels: 3, dining: 2, everything: 1 },
    homeCity: 'ATL',
    cardLimitBonus: 1,
    special: 'extra_card',
    specialDesc: 'Hold up to 4 credit cards.',
  },
];

export const CREDIT_CARDS = [
  // Chase
  {
    id: 'csp',
    name: 'Sapphire Preferred',
    bank: 'chase',
    earn: { travel: 2, dining: 3, everything: 1 },
    signupBonus: 60000,
    minSpend: 4000,
    annualFee: 95,
  },
  {
    id: 'csr',
    name: 'Sapphire Reserve',
    bank: 'chase',
    earn: { travel: 3, dining: 3, everything: 1 },
    signupBonus: 75000,
    minSpend: 4000,
    annualFee: 550,
  },
  {
    id: 'cfu',
    name: 'Freedom Unlimited',
    bank: 'chase',
    earn: { everything: 1.5 },
    signupBonus: 20000,
    minSpend: 500,
    annualFee: 0,
  },
  {
    id: 'cff',
    name: 'Freedom Flex',
    bank: 'chase',
    earn: { groceries: 5, gas: 5, everything: 1 },
    signupBonus: 20000,
    minSpend: 500,
    annualFee: 0,
  },
  // Amex
  {
    id: 'amex_gold',
    name: 'Gold Card',
    bank: 'amex',
    earn: { dining: 4, groceries: 4, flights: 3, everything: 1 },
    signupBonus: 60000,
    minSpend: 6000,
    annualFee: 325,
  },
  {
    id: 'amex_plat',
    name: 'Platinum Card',
    bank: 'amex',
    earn: { flights: 5, hotels: 5, everything: 1 },
    signupBonus: 80000,
    minSpend: 6000,
    annualFee: 695,
  },
  {
    id: 'amex_blue',
    name: 'Blue Business Plus',
    bank: 'amex',
    earn: { everything: 2 },
    signupBonus: 15000,
    minSpend: 3000,
    annualFee: 0,
  },
  {
    id: 'delta_gold',
    name: 'Delta Gold',
    bank: 'amex',
    earn: { flights: 2, dining: 2, everything: 1 },
    signupBonus: 40000,
    minSpend: 2000,
    annualFee: 150,
    directAirline: 'delta', // earns Delta miles directly at 1x of points equivalent
  },
  // Citi
  {
    id: 'strata',
    name: 'Strata Premier',
    bank: 'citi',
    earn: { travel: 3, dining: 3, groceries: 3, gas: 3, everything: 1 },
    signupBonus: 60000,
    minSpend: 4000,
    annualFee: 95,
  },
  {
    id: 'custom_cash',
    name: 'Custom Cash',
    bank: 'citi',
    earn: { dining: 5, everything: 1 },
    signupBonus: 20000,
    minSpend: 500,
    annualFee: 0,
  },
  {
    id: 'double_cash',
    name: 'Double Cash',
    bank: 'citi',
    earn: { everything: 2 },
    signupBonus: 0,
    minSpend: 0,
    annualFee: 0,
  },
  // Bilt
  {
    id: 'bilt_card',
    name: 'Bilt Mastercard',
    bank: 'bilt',
    earn: { rent: 1, dining: 3, travel: 2, everything: 1 },
    signupBonus: 30000,
    minSpend: 0,
    annualFee: 0,
  },
];

/** City positions as % of map container (approx US geography) */
export const CITIES = {
  SEA: { id: 'SEA', name: 'Seattle', x: 12, y: 12, region: 'nw', hotels: { marriott: 20000, hilton: 30000, hyatt: 12000 }, hotelVp: { marriott: 3, hilton: 2, hyatt: 4 } },
  SFO: { id: 'SFO', name: 'San Francisco', x: 8, y: 42, region: 'west', hotels: { marriott: 35000, hyatt: 18000 }, hotelVp: { marriott: 4, hyatt: 5 } },
  LAX: { id: 'LAX', name: 'Los Angeles', x: 12, y: 58, region: 'west', hotels: { marriott: 30000, hilton: 40000, hyatt: 15000 }, hotelVp: { marriott: 3, hilton: 3, hyatt: 4 } },
  LAS: { id: 'LAS', name: 'Las Vegas', x: 18, y: 48, region: 'sw', hotels: { marriott: 25000, hilton: 35000, hyatt: 20000 }, hotelVp: { marriott: 4, hilton: 4, hyatt: 6 } },
  PHX: { id: 'PHX', name: 'Phoenix', x: 22, y: 58, region: 'sw', hotels: { marriott: 18000, hilton: 28000 }, hotelVp: { marriott: 2, hilton: 2 } },
  DEN: { id: 'DEN', name: 'Denver', x: 35, y: 38, region: 'mt', hotels: { marriott: 22000, hilton: 32000, hyatt: 14000 }, hotelVp: { marriott: 3, hilton: 2, hyatt: 4 } },
  DFW: { id: 'DFW', name: 'Dallas', x: 48, y: 58, region: 'south', hotels: { marriott: 20000, hilton: 30000, hyatt: 12000 }, hotelVp: { marriott: 2, hilton: 2, hyatt: 3 } },
  IAH: { id: 'IAH', name: 'Houston', x: 50, y: 68, region: 'south', hotels: { marriott: 18000, hilton: 28000 }, hotelVp: { marriott: 2, hilton: 2 } },
  MSP: { id: 'MSP', name: 'Minneapolis', x: 52, y: 22, region: 'mw', hotels: { marriott: 18000, hilton: 25000 }, hotelVp: { marriott: 2, hilton: 2 } },
  ORD: { id: 'ORD', name: 'Chicago', x: 58, y: 32, region: 'mw', hotels: { marriott: 28000, hilton: 38000, hyatt: 15000 }, hotelVp: { marriott: 3, hilton: 3, hyatt: 4 } },
  ATL: { id: 'ATL', name: 'Atlanta', x: 68, y: 58, region: 'se', hotels: { marriott: 22000, hilton: 32000 }, hotelVp: { marriott: 3, hilton: 2 } },
  MSY: { id: 'MSY', name: 'New Orleans', x: 58, y: 72, region: 'south', hotels: { marriott: 20000, hilton: 30000 }, hotelVp: { marriott: 3, hilton: 3 } },
  MIA: { id: 'MIA', name: 'Miami', x: 78, y: 82, region: 'se', hotels: { marriott: 35000, hilton: 45000, hyatt: 18000 }, hotelVp: { marriott: 5, hilton: 4, hyatt: 5 } },
  WAS: { id: 'WAS', name: 'Washington DC', x: 80, y: 40, region: 'ne', hotels: { marriott: 28000, hilton: 38000, hyatt: 15000 }, hotelVp: { marriott: 3, hilton: 3, hyatt: 4 } },
  NYC: { id: 'NYC', name: 'New York', x: 86, y: 32, region: 'ne', hotels: { marriott: 40000, hilton: 55000, hyatt: 22000 }, hotelVp: { marriott: 5, hilton: 4, hyatt: 6 } },
  BOS: { id: 'BOS', name: 'Boston', x: 90, y: 24, region: 'ne', hotels: { marriott: 30000, hilton: 40000 }, hotelVp: { marriott: 3, hilton: 3 } },
};

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

export const TRIP_TICKETS = [
  { id: 't1', from: 'NYC', to: 'LAX', points: 12, penalty: 6 },
  { id: 't2', from: 'SEA', to: 'MIA', points: 15, penalty: 8 },
  { id: 't3', from: 'BOS', to: 'DEN', points: 10, penalty: 5 },
  { id: 't4', from: 'ATL', to: 'SFO', points: 12, penalty: 6 },
  { id: 't5', from: 'ORD', to: 'MIA', points: 9, penalty: 4 },
  { id: 't6', from: 'SEA', to: 'NYC', points: 14, penalty: 7 },
  { id: 't7', from: 'LAX', to: 'BOS', points: 14, penalty: 7 },
  { id: 't8', from: 'DFW', to: 'SEA', points: 11, penalty: 5 },
  { id: 't9', from: 'MSP', to: 'MIA', points: 10, penalty: 5 },
  { id: 't10', from: 'DEN', to: 'MIA', points: 11, penalty: 5 },
  { id: 't11', from: 'SFO', to: 'ATL', points: 12, penalty: 6 },
  { id: 't12', from: 'PHX', to: 'NYC', points: 11, penalty: 5 },
  { id: 't13', from: 'LAS', to: 'BOS', points: 13, penalty: 6 },
  { id: 't14', from: 'IAH', to: 'SEA', points: 12, penalty: 6 },
  { id: 't15', from: 'MSY', to: 'SFO', points: 12, penalty: 6 },
  { id: 't16', from: 'WAS', to: 'LAX', points: 12, penalty: 6 },
  { id: 't17', from: 'BOS', to: 'LAX', points: 13, penalty: 6 },
  { id: 't18', from: 'ORD', to: 'SEA', points: 9, penalty: 4 },
  { id: 't19', from: 'ATL', to: 'LAS', points: 8, penalty: 4 },
  { id: 't20', from: 'NYC', to: 'MSY', points: 8, penalty: 4 },
  { id: 't21', from: 'DEN', to: 'NYC', points: 9, penalty: 4 },
  { id: 't22', from: 'SFO', to: 'MIA', points: 14, penalty: 7 },
  { id: 't23', from: 'MSP', to: 'LAX', points: 10, penalty: 5 },
  { id: 't24', from: 'WAS', to: 'SEA', points: 13, penalty: 6 },
  { id: 't25', from: 'DFW', to: 'BOS', points: 10, penalty: 5 },
  { id: 't26', from: 'PHX', to: 'ATL', points: 9, penalty: 4 },
  { id: 't27', from: 'LAS', to: 'MIA', points: 12, penalty: 6 },
  { id: 't28', from: 'ORD', to: 'LAX', points: 10, penalty: 5 },
  { id: 't29', from: 'BOS', to: 'MIA', points: 9, penalty: 4 },
  { id: 't30', from: 'SEA', to: 'DFW', points: 11, penalty: 5 },
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
  { id: 'status_match', name: 'Status Match', desc: '+2 VP on your next hotel stay this turn.', type: 'hotel_vp_bonus', amount: 2 },
  { id: 'rent_day', name: 'Rent Day!', desc: 'Bilt earn +50% this turn (and rent counts double for Landlord).', type: 'bilt_boost', mult: 1.5 },
  { id: 'flash_sale', name: 'Flash Sale', desc: 'Hotel nights cost 30% fewer points this turn.', type: 'hotel_discount', mult: 0.7 },
  { id: 'deval', name: 'Soft Devaluation', desc: 'Your hotel stays cost +20% this turn.', type: 'hotel_discount', mult: 1.2 },
  { id: 'signup_boost', name: 'Amex Offer Stack', desc: 'Gain 5,000 bank points in a bank you already use (or Chase).', type: 'gain_bank', amount: 5000 },
  { id: 'free_night', name: 'Free Night Certificate', desc: 'Book 1 hotel night for free in your current city (best available brand).', type: 'free_night' },
  { id: 'miles_sale', name: 'Mileage Sale', desc: 'Gain 8,000 miles in an airline you already hold (or United).', type: 'gain_airline', amount: 8000 },
  { id: '// delayed', name: 'Weather Delay', desc: 'Skip one action this turn (only 1 action).', type: 'lose_action' },
  { id: 'portal_bonus', name: 'Portal Booking Bonus', desc: 'Travel spend earns 3× this turn.', type: 'earn_mult', category: 'travel', mult: 3 },
  { id: 'grocery_run', name: 'Costco Run', desc: 'Groceries earn 3× this turn.', type: 'earn_mult', category: 'groceries', mult: 3 },
  { id: 'gas_spike', name: 'Road Trip', desc: 'Gas earn 3× this turn.', type: 'earn_mult', category: 'gas', mult: 3 },
  { id: 'points_found', name: 'Forgotten Points', desc: 'Gain 10,000 bank points in your strongest bank.', type: 'gain_strongest', amount: 10000 },
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
