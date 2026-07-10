/**
 * Points Odyssey — core game engine
 */

import {
  GAME_CONFIG,
  CHARACTERS,
  CREDIT_CARDS,
  CITIES,
  ROUTES,
  TRIP_TICKETS,
  EVENTS,
  ACHIEVEMENTS,
  TRANSFERS,
  WEST,
  EAST,
  shuffle,
  routeKey,
  getRoute,
  getHotelById,
  resolveItinerary,
  listFlightOptions,
  rollSpendAllocation,
  spendProfilePercents,
  SPEND_DRAWS,
  STARTER_CARDS,
  neighbors,
} from './data.js?v=brand3';

function emptyBanks() {
  return { chase: 0, amex: 0, citi: 0, bilt: 0 };
}
function emptyHotels() {
  return { marriott: 0, hilton: 0, hyatt: 0 };
}
function emptyAirlines() {
  return { united: 0, delta: 0, american: 0 };
}

function createPlayer(index, character, name, isBot = false) {
  const home = character.homeCity;
  return {
    id: index,
    name: name || `Player ${index + 1}`,
    isBot: !!isBot,
    characterId: character.id,
    character,
    city: home,
    visited: new Set([home]),
    /** Ordered landings (home first). Tickets require origin then destination in this sequence. */
    journey: [home],
    banks: emptyBanks(),
    hotels: emptyHotels(),
    airlines: emptyAirlines(),
    cards: [],
    cardSpendProgress: {}, // cardId -> spend toward min
    cardBonusClaimed: {},
    /** category → cardId (which card earns that spend). Empty = best rate. */
    earnPrefs: {},
    tickets: [],
    completedTickets: [],
    segments: 0,
    nights: 0,
    nightsByBrand: { marriott: 0, hilton: 0, hyatt: 0 },
    stayedHotels: new Set(), // property ids — one stay (1 night) each per game
    transfersDone: 0,
    vp: 0,
    achievements: new Set(),
    coastToCoast: false,
    // personal flight network: set of route keys
    network: new Set(),
    // per-turn modifiers
    turn: null,
  };
}

/**
 * Ticket progress (ordered): origin must appear in journey before destination.
 * Visiting NYC before DEN does not count for DEN→NYC; you need DEN first, then NYC later.
 * @returns {{ origin: boolean, dest: boolean, complete: boolean }}
 */
export function ticketProgress(player, ticket) {
  const journey = player.journey || [];
  let origin = false;
  let dest = false;
  for (let i = 0; i < journey.length; i++) {
    const city = journey[i];
    if (!origin) {
      if (city === ticket.from) origin = true;
    } else if (city === ticket.to) {
      dest = true;
      break;
    }
  }
  // Also allow completing if currently sitting on dest after origin was logged
  // (journey already includes each landing)
  return { origin, dest, complete: origin && dest };
}

function recordLanding(player, cityId) {
  if (!player.journey) player.journey = [];
  player.journey.push(cityId);
  player.visited.add(cityId);
}

function cfgInt(key, fallback) {
  const n = Number(GAME_CONFIG[key]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Fresh turn. Action slots are granted again after income
 * (see grantActionSlots) so the action panel never opens empty.
 */
function resetTurnState(player) {
  player.turn = {
    actionsLeft: 0,
    buildLeft: 0,
    travelLeft: 0,
    freeTransferLeft: 0,
    slotsGranted: false,
    /** Event: Weather Delay removes Travel when slots are granted */
    loseTravel: false,
    event: null,
    eventResolved: false,
    incomeDone: false,
    transferBonus: null, // { partner, bonus }
    flightMult: 1,
    hotelMult: 1,
    hotelVpBonus: 0,
    earnMults: {}, // category -> mult
    biltBoost: 1,
    flightsThisTurn: 0,
    bonusSegment: false,
    freeNightAvailable: false,
    diningBonusUsed: false,
    spendRoll: rollSpendAllocation(player.character),
    pendingTickets: null,
    /** Set after auto income: { totalEarned, lines: [{cat, spend, rate, card, pts}] } */
    lastIncome: null,
  };
}

/** Give Build / Travel / free Transfer once income is done */
function grantActionSlots(turn) {
  if (!turn || turn.slotsGranted) return;
  const build = cfgInt('buildActionsPerTurn', 1);
  const travel = cfgInt('travelActionsPerTurn', 1);
  const freeXfer = cfgInt('freeTransfersPerTurn', 1);
  turn.buildLeft = build;
  turn.travelLeft = turn.loseTravel ? 0 : travel;
  turn.freeTransferLeft = freeXfer;
  turn.slotsGranted = true;
  syncActionsLeft(turn);
}

/** Repair missing/NaN slots (never invent actions after the player spent them) */
function normalizeTurnActions(turn) {
  if (!turn) return;
  if (turn.incomeDone && !turn.slotsGranted) {
    grantActionSlots(turn);
  }
  // Coerce NaN / non-numbers to 0
  for (const k of ['buildLeft', 'travelLeft', 'freeTransferLeft', 'actionsLeft']) {
    if (typeof turn[k] !== 'number' || !Number.isFinite(turn[k])) {
      turn[k] = 0;
    }
  }
  syncActionsLeft(turn);
}

function syncActionsLeft(turn) {
  if (!turn) return;
  const b = typeof turn.buildLeft === 'number' && Number.isFinite(turn.buildLeft) ? turn.buildLeft : 0;
  const t = typeof turn.travelLeft === 'number' && Number.isFinite(turn.travelLeft) ? turn.travelLeft : 0;
  turn.actionsLeft = Math.max(0, b) + Math.max(0, t);
}

function giveStarterCard(player) {
  const cardId = STARTER_CARDS[player.character.id] || 'cfu';
  const def = CREDIT_CARDS.find((c) => c.id === cardId);
  if (!def) return null;
  player.cards.push({ ...def });
  player.cardSpendProgress[def.id] = 0;
  player.cardBonusClaimed[def.id] = false;
  // Instant signup if minSpend is 0
  if (def.minSpend <= 0 && def.signupBonus > 0) {
    let bonus = def.signupBonus;
    if (player.character.special === 'extra_card') {
      bonus = Math.floor(bonus * 1.3);
    }
    player.banks[def.bank] = (player.banks[def.bank] || 0) + bonus;
    player.cardBonusClaimed[def.id] = true;
  }
  return def;
}

/**
 * Opening deal score — ordered tickets: origin-at-home is gold
 * (journey already starts at home → origin pre-checked).
 */
function ticketDealScore(ticket, homeCity) {
  let score = ticket.points;
  // Origin already satisfied when home === from
  if (ticket.from === homeCity) score += 55;
  else if (ticket.to === homeCity) score += 12; // dest=home only helps after origin elsewhere
  const near = neighbors(homeCity);
  if (near.includes(ticket.from)) score += 28; // short hop to start the ticket
  if (near.includes(ticket.to) && ticket.from === homeCity) score += 16;
  // Prefer short regional tickets (more completable under ordered rule)
  if (ticket.points <= 10) score += 18;
  else if (ticket.points <= 14) score += 8;
  // Soft penalty for very long ordered routes from a distant origin
  const dFrom = hopsSafe(homeCity, ticket.from);
  if (dFrom >= 3) score -= 8;
  if (dFrom >= 4) score -= 8;
  return score;
}

function hopsSafe(a, b) {
  if (a === b) return 0;
  try {
    const n = neighbors(a);
    if (n.includes(b)) return 1;
    for (const x of n) {
      if (neighbors(x).includes(b)) return 2;
    }
  } catch (e) {
    /* ignore */
  }
  return 3;
}

export class Game {
  constructor() {
    this.phase = 'setup'; // setup | playing | ended
    this.players = [];
    this.currentPlayerIndex = 0;
    this.round = 1;
    this.maxRounds = GAME_CONFIG.maxRounds;
    this.ticketDeck = [];
    this.eventDeck = [];
    this.eventDiscard = [];
    this.log = [];
    this.selectedCharacters = new Set();
    this.winner = null;
    this.finalScores = null;
    /** @type {{ playerId: number, from: string, to: string, via: string|null, airline: string }[]} */
    this.flightAnims = [];
    /** Face-up race goals (public trip tickets — first to visit both claims) */
    this.raceGoals = [];
    /**
     * Award tickets remaining this round per airline.
     * One booking (nonstop or 1-stop same airline) = 1 ticket.
     */
    this.airlineAwards = {};
    this.awardsLeft = this.awardsLeft.bind(this);
    this.resetAirlineAwards = this.resetAirlineAwards.bind(this);
    // Back-compat aliases used by older UI helpers
    this.seatsLeft = this.seatsLeft.bind(this);
    this.resetRouteSeats = this.resetAirlineAwards.bind(this);
  }

  resetAirlineAwards() {
    const n =
      GAME_CONFIG.awardsPerAirlinePerRound != null
        ? GAME_CONFIG.awardsPerAirlinePerRound
        : 2;
    this.airlineAwards = {
      united: n,
      delta: n,
      american: n,
    };
  }

  /** Award tickets left for an airline this round */
  awardsLeft(airline) {
    if (!this.airlineAwards) this.resetAirlineAwards();
    const v = this.airlineAwards[airline];
    if (v == null) return 0;
    return v;
  }

  /**
   * @deprecated Route-based seats removed — award inventory is per airline.
   * Kept so map/UI that still probes legs does not throw; returns 1 if any
   * airline still has inventory (visual only).
   */
  seatsLeft(_a, _b) {
    if (!this.airlineAwards) this.resetAirlineAwards();
    const vals = Object.values(this.airlineAwards);
    return vals.some((n) => n > 0) ? 1 : 0;
  }

  /** @deprecated use resetAirlineAwards */
  resetRouteSeats() {
    this.resetAirlineAwards();
  }

  dealRaceGoals() {
    const n = GAME_CONFIG.raceGoalCount ?? 3;
    this.raceGoals = [];
    for (let i = 0; i < n && this.ticketDeck.length; i++) {
      this.raceGoals.push(this.ticketDeck.pop());
    }
  }

  refillRaceGoals() {
    const n = GAME_CONFIG.raceGoalCount ?? 3;
    while (this.raceGoals.length < n && this.ticketDeck.length) {
      this.raceGoals.push(this.ticketDeck.pop());
    }
  }

  consumeFlightAnims() {
    const list = this.flightAnims || [];
    this.flightAnims = [];
    return list;
  }

  addLog(msg) {
    this.log.unshift({ t: Date.now(), msg, round: this.round });
    if (this.log.length > 80) this.log.pop();
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  cardLimit(player) {
    return GAME_CONFIG.defaultCardLimit + (player.character.cardLimitBonus || 0);
  }

  /** Setup: create players from chosen character ids + names + isBot */
  startGame(selections) {
    // selections: [{ characterId, name, isBot? }]
    if (
      selections.length < GAME_CONFIG.minPlayers ||
      selections.length > GAME_CONFIG.maxPlayers
    ) {
      throw new Error(
        `Need ${GAME_CONFIG.minPlayers}–${GAME_CONFIG.maxPlayers} players`
      );
    }
    const used = new Set();
    this.players = selections.map((sel, i) => {
      if (used.has(sel.characterId)) throw new Error('Duplicate character');
      used.add(sel.characterId);
      const ch = CHARACTERS.find((c) => c.id === sel.characterId);
      if (!ch) throw new Error('Unknown character');
      const isBot = !!sel.isBot;
      const name =
        sel.name ||
        (isBot ? `Bot ${ch.name.replace(/^The /, '')}` : `Player ${i + 1}`);
      return createPlayer(i, ch, name, isBot);
    });

    this.ticketDeck = shuffle(TRIP_TICKETS);
    this.eventDeck = shuffle(EVENTS);
    this.eventDiscard = [];
    this.round = 1;
    this.currentPlayerIndex = 0;
    this.phase = 'playing';
    this.winner = null;
    this.finalScores = null;
    this.log = [];
    this.resetRouteSeats();

    // Deal tickets, starter cards, seed points
    for (const p of this.players) {
      resetTurnState(p);

      // Opening tickets: deal more, keep ones near home when possible
      const pool = [];
      for (let i = 0; i < GAME_CONFIG.startingTickets + 2 && this.ticketDeck.length; i++) {
        pool.push(this.ticketDeck.pop());
      }
      pool.sort(
        (a, b) =>
          ticketDealScore(b, p.city) - ticketDealScore(a, p.city)
      );
      p.tickets = pool.slice(0, GAME_CONFIG.keepTickets);
      const discarded = pool.slice(GAME_CONFIG.keepTickets);
      this.ticketDeck = shuffle([...discarded, ...this.ticketDeck]);

      // Starter credit card so round-1 income can earn
      const starter = giveStarterCard(p);
      p.banks.chase =
        (p.banks.chase || 0) + (GAME_CONFIG.starterBankPoints || 0);
      // Seed a little airline from starter bank theme (optional small fly)
      if (starter) {
        this.addLog(
          `${p.name} starts with ${starter.name} (${starter.bank}) and $${GAME_CONFIG.budgetPerTurn.toLocaleString()}/mo lifestyle spend.`
        );
      }
      // Executive: corporate travel fund (converts signup path into playable points)
      if (p.character.special === 'extra_card') {
        p.banks.chase = (p.banks.chase || 0) + 12000;
        this.addLog(`${p.name} receives a $12,000 Chase travel fund.`);
      }
      // Bots lock earn prefs to best rates (humans use Auto until they set prefs)
      if (p.isBot) this.initDefaultEarnPrefs(p);
    }

    // Public race goals (shared contention)
    this.dealRaceGoals();
    if (this.raceGoals.length) {
      this.addLog(
        `Race goals (first to visit both cities): ${this.raceGoals
          .map((t) => `${t.from}→${t.to}`)
          .join(', ')}.`
      );
    }

    this.addLog(
      `Game started with ${this.players.length} players. Each turn: Income → free Transfer + Build + Travel. Round 1 begins.`
    );
    this.beginTurn();
    return this;
  }

  beginTurn() {
    const p = this.currentPlayer;
    resetTurnState(p);
    this.drawAndResolveEvent(p);
    // If they already visited both ends of a race goal, claim at turn start
    this.checkRaceGoals(p);
    // Income is fully automatic (lifestyle roll × earn prefs / best card)
    try {
      this.doIncome();
    } catch (e) {
      console.error('[beginTurn] income', e);
    }
  }

  drawEvent() {
    if (!this.eventDeck.length) {
      this.eventDeck = shuffle(this.eventDiscard);
      this.eventDiscard = [];
    }
    return this.eventDeck.pop();
  }

  drawAndResolveEvent(player) {
    const ev = this.drawEvent();
    player.turn.event = ev;
    this.eventDiscard.push(ev);
    this.applyEvent(player, ev);
    player.turn.eventResolved = true;
    this.addLog(`${player.name} draws event: ${ev.name} — ${ev.desc}`);
  }

  applyEvent(player, ev) {
    const t = player.turn;
    switch (ev.type) {
      case 'transfer_bonus':
        t.transferBonus = { partner: ev.partner, bonus: ev.bonus };
        break;
      case 'earn_mult':
        t.earnMults[ev.category] = (t.earnMults[ev.category] || 1) * ev.mult;
        break;
      case 'lose_bank': {
        let best = 'chase';
        let bestAmt = -1;
        for (const b of Object.keys(player.banks)) {
          if (player.banks[b] > bestAmt) {
            bestAmt = player.banks[b];
            best = b;
          }
        }
        const lost = Math.min(ev.amount, player.banks[best]);
        player.banks[best] -= lost;
        this.addLog(`${player.name} loses ${lost.toLocaleString()} ${best} points.`);
        break;
      }
      case 'flight_discount':
        t.flightMult *= ev.mult;
        break;
      case 'steal': {
        const leader = [...this.players].sort((a, b) => b.vp - a.vp)[0];
        if (leader.id === player.id) {
          this.addLog('You are the leader — steal fizzles.');
          break;
        }
        let best = 'chase';
        let bestAmt = -1;
        for (const b of Object.keys(leader.banks)) {
          if (leader.banks[b] > bestAmt) {
            bestAmt = leader.banks[b];
            best = b;
          }
        }
        const steal = Math.min(ev.amount, leader.banks[best]);
        leader.banks[best] -= steal;
        player.banks[best] = (player.banks[best] || 0) + steal;
        this.addLog(
          `${player.name} steals ${steal.toLocaleString()} ${best} from ${leader.name}.`
        );
        break;
      }
      case 'hotel_vp_bonus':
        t.hotelVpBonus += ev.amount;
        break;
      case 'bilt_boost':
        t.biltBoost = ev.mult;
        break;
      case 'hotel_discount':
        t.hotelMult *= ev.mult;
        break;
      case 'gain_bank': {
        const bank =
          (player.cards[0] && player.cards[0].bank) ||
          Object.keys(player.banks).find((b) => player.banks[b] > 0) ||
          'chase';
        player.banks[bank] += ev.amount;
        this.addLog(`${player.name} gains ${ev.amount.toLocaleString()} ${bank}.`);
        break;
      }
      case 'free_night':
        t.freeNightAvailable = true;
        break;
      case 'gain_airline': {
        const air =
          Object.keys(player.airlines).find((a) => player.airlines[a] > 0) ||
          'united';
        player.airlines[air] += ev.amount;
        this.addLog(`${player.name} gains ${ev.amount.toLocaleString()} ${air} miles.`);
        break;
      }
      case 'lose_action':
        // Weather Delay: no Travel this turn (applied when slots are granted)
        t.loseTravel = true;
        if (t.slotsGranted) {
          t.travelLeft = 0;
          syncActionsLeft(t);
        }
        break;
      case 'gain_strongest': {
        let best = 'chase';
        let bestAmt = -1;
        for (const b of Object.keys(player.banks)) {
          if (player.banks[b] > bestAmt) {
            bestAmt = player.banks[b];
            best = b;
          }
        }
        player.banks[best] += ev.amount;
        this.addLog(`${player.name} gains ${ev.amount.toLocaleString()} ${best}.`);
        break;
      }
      case 'bonus_nights':
        player.nights += ev.amount;
        this.checkAchievements(player);
        break;
      case 'bonus_segment':
        t.bonusSegment = true;
        break;
      default:
        break;
    }
  }

  /**
   * Automatic income: lifestyle roll (character odds) × earn prefs / best card.
   * No manual allocation or re-roll.
   */
  doIncome() {
    const p = this.currentPlayer;
    if (p.turn.incomeDone) throw new Error('Income already done');

    const allocation = this.autoAllocate(p);
    const effective = {};
    for (const [cat, amt] of Object.entries(allocation)) {
      if (!amt) continue;
      effective[cat] = Math.round(amt);
    }

    for (const [cat, m] of Object.entries(p.turn.earnMults || {})) {
      if (effective[cat]) effective[cat] = Math.round(effective[cat] * m);
    }

    let totalEarned = 0;
    const earnedByBank = emptyBanks();
    const lines = [];

    for (const [cat, spend] of Object.entries(effective)) {
      if (!spend) continue;
      const { bank, rate, card } = this.earnCardForCategory(p, cat);
      if (!card || rate <= 0) {
        lines.push({
          cat,
          spend,
          rate: 0,
          card: null,
          pts: 0,
          note: 'no card / 0×',
        });
        continue;
      }

      let pts = Math.floor(spend * rate);

      // Landlord: rent on Bilt is at least 2×, then +35% Bilt earn (stacks with Rent Day event)
      let earnRate = rate;
      if (
        p.character.special === 'rent_day' &&
        bank === 'bilt' &&
        cat === 'rent'
      ) {
        earnRate = Math.max(earnRate, 2);
        pts = Math.floor(spend * earnRate);
      }
      let biltMult = p.turn.biltBoost || 1;
      if (p.character.special === 'rent_day' && bank === 'bilt') {
        biltMult *= 1.35;
      }
      if (bank === 'bilt') {
        pts = Math.floor(pts * biltMult);
      }

      if (card.directAirline) {
        p.airlines[card.directAirline] =
          (p.airlines[card.directAirline] || 0) + pts;
      } else {
        p.banks[bank] = (p.banks[bank] || 0) + pts;
        earnedByBank[bank] += pts;
      }
      totalEarned += pts;

      p.cardSpendProgress[card.id] =
        (p.cardSpendProgress[card.id] || 0) + spend;
      this.maybeClaimSignup(p, card);

      lines.push({
        cat,
        spend,
        rate,
        card: card.name,
        cardId: card.id,
        bank,
        pts,
      });
    }

    if (
      p.character.special === 'dining_bonus' &&
      (effective.dining || 0) > 0 &&
      !p.turn.diningBonusUsed
    ) {
      const diningEarn = this.earnCardForCategory(p, 'dining');
      const bank =
        (diningEarn.card && diningEarn.bank) ||
        (p.cards[0] && p.cards[0].bank) ||
        null;
      p.vp += 1;
      p.turn.diningBonusUsed = true;
      this.addLog(`${p.name}'s Foodie skill: +1 VP (dining).`);
    }

    p.turn.incomeDone = true;
    p.turn.lastIncome = { totalEarned, lines, spendRoll: { ...effective } };
    grantActionSlots(p.turn);
    normalizeTurnActions(p.turn);
    if (!p.cards.length) {
      this.addLog(
        `${p.name} spends but earns 0 pts (no credit card — apply for one!).`
      );
    } else {
      this.addLog(
        `${p.name} auto-income ~${totalEarned.toLocaleString()} pts (lifestyle roll).`
      );
    }
    return { totalEarned, earnedByBank, effective, lines };
  }

  cardEarnRate(cardDef, category) {
    if (!cardDef || !cardDef.earn) return 0;
    if (cardDef.earn[category] != null) return cardDef.earn[category];
    if (cardDef.earn.everything != null) return cardDef.earn.everything;
    return 0;
  }

  /**
   * Earn card for a category: player preference if held, else best rate.
   */
  earnCardForCategory(player, category) {
    if (!player.cards.length) {
      return { bank: null, rate: 0, card: null };
    }
    const prefs = player.earnPrefs || {};
    const prefId = prefs[category] || prefs.everything || null;
    if (prefId) {
      const held = player.cards.find((c) => c.id === prefId);
      if (held) {
        const def = CREDIT_CARDS.find((x) => x.id === prefId) || held;
        const rate = this.cardEarnRate(def, category);
        return { bank: def.bank, rate, card: def, preferred: true };
      }
    }
    return { ...this.bestEarnRate(player, category), preferred: false };
  }

  /**
   * Best card earn rate for a category. Default: 0× (no free character bonus).
   */
  bestEarnRate(player, category) {
    let best = { bank: null, rate: 0, card: null };
    if (!player.cards.length) return best;

    for (const c of player.cards) {
      const def = CREDIT_CARDS.find((x) => x.id === c.id) || c;
      const rate = this.cardEarnRate(def, category);
      if (rate > best.rate) {
        best = { bank: def.bank, rate, card: def };
      }
    }
    return best;
  }

  /**
   * Assign which card earns a spend category. cardId null/'' = Auto (best rate).
   */
  setEarnPref(category, cardId) {
    const p = this.currentPlayer;
    if (!p.earnPrefs) p.earnPrefs = {};
    if (!cardId) {
      delete p.earnPrefs[category];
    } else {
      if (!p.cards.some((c) => c.id === cardId)) {
        throw new Error('You do not hold that card');
      }
      p.earnPrefs[category] = cardId;
    }
    return { ...p.earnPrefs };
  }

  /** Fill earn prefs with best card per category (bots). */
  initDefaultEarnPrefs(player) {
    if (!player.earnPrefs) player.earnPrefs = {};
    const cats = [
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
    for (const cat of cats) {
      const best = this.bestEarnRate(player, cat);
      if (best.card && best.rate > 0) player.earnPrefs[cat] = best.card.id;
    }
  }

  maybeClaimSignup(player, card) {
    if (player.cardBonusClaimed[card.id]) return;
    const progress = player.cardSpendProgress[card.id] || 0;
    if (progress >= card.minSpend && card.signupBonus > 0) {
      let bonus = card.signupBonus;
      // Executive: +30% larger signup bonuses
      if (player.character.special === 'extra_card') {
        bonus = Math.floor(bonus * 1.3);
      }
      player.banks[card.bank] = (player.banks[card.bank] || 0) + bonus;
      player.cardBonusClaimed[card.id] = true;
      this.addLog(
        `${player.name} hits min-spend on ${card.name}! +${bonus.toLocaleString()} ${card.bank}.`
      );
    }
  }

  /**
   * This turn's spending = character lifestyle roll (category appearance probs).
   * Earn rates come from earn prefs or best held card (0× without a card).
   */
  autoAllocate(player) {
    if (player.turn && player.turn.spendRoll) {
      return { ...player.turn.spendRoll };
    }
    return rollSpendAllocation(player.character);
  }

  // ——— Actions (Build / Travel / free Transfer) ———

  requireTurn(player) {
    if (this.phase !== 'playing') throw new Error('Game not active');
    if (player.id !== this.currentPlayer.id) throw new Error('Not your turn');
    if (!player.turn.incomeDone) throw new Error('Complete income first');
    normalizeTurnActions(player.turn);
  }

  /** Any remaining Build or Travel (not free transfer) */
  requireAction(player) {
    this.requireTurn(player);
    if (player.turn.actionsLeft <= 0) {
      throw new Error('No Build or Travel actions left — End Turn');
    }
  }

  requireBuild(player) {
    this.requireTurn(player);
    if (player.turn.buildLeft <= 0) {
      throw new Error(
        'No Build left this turn (Apply card / Draw tickets / Rest). Use Travel or End Turn.'
      );
    }
  }

  requireTravel(player) {
    this.requireTurn(player);
    if (player.turn.travelLeft <= 0) {
      throw new Error(
        'No Travel left this turn (Book flight / Book hotel). Use Build or End Turn.'
      );
    }
  }

  spendBuild(player) {
    player.turn.buildLeft = Math.max(0, player.turn.buildLeft - 1);
    syncActionsLeft(player.turn);
  }

  spendTravel(player) {
    player.turn.travelLeft = Math.max(0, player.turn.travelLeft - 1);
    syncActionsLeft(player.turn);
  }

  /**
   * Spend free transfer if available; otherwise spends Build.
   * @returns {'free'|'build'}
   */
  spendTransferSlot(player) {
    if (player.turn.freeTransferLeft > 0) {
      player.turn.freeTransferLeft -= 1;
      return 'free';
    }
    this.requireBuild(player);
    this.spendBuild(player);
    return 'build';
  }

  applyForCard(cardId) {
    const p = this.currentPlayer;
    this.requireBuild(p);
    if (p.cards.length >= this.cardLimit(p)) {
      throw new Error('Card limit reached');
    }
    if (p.cards.some((c) => c.id === cardId)) {
      throw new Error('Already hold this card');
    }
    const def = CREDIT_CARDS.find((c) => c.id === cardId);
    if (!def) throw new Error('Unknown card');

    p.cards.push({ ...def });
    p.cardSpendProgress[def.id] = 0;
    p.cardBonusClaimed[def.id] = false;
    // Immediate signup if minSpend 0
    this.maybeClaimSignup(p, def);

    this.spendBuild(p);
    this.addLog(`${p.name} is approved for ${def.name} (${def.bank}).`);
    this.checkAchievements(p);
    return def;
  }

  transferPoints(bank, partner, amount) {
    const p = this.currentPlayer;
    this.requireTurn(p);
    // Need free transfer or Build
    if (p.turn.freeTransferLeft <= 0 && p.turn.buildLeft <= 0) {
      throw new Error(
        'No free Transfer or Build left — transfer next turn or End Turn'
      );
    }
    amount = Math.floor(amount);
    if (amount < 1000) throw new Error('Minimum transfer 1,000');
    if ((p.banks[bank] || 0) < amount) throw new Error('Not enough bank points');

    const partners = TRANSFERS[bank];
    if (!partners || !partners[partner]) {
      throw new Error('Invalid transfer partner');
    }
    const { ratio, type } = partners[partner];
    let out = Math.floor(amount * ratio);

    // Transfer bonus event
    if (p.turn.transferBonus && p.turn.transferBonus.partner === partner) {
      out = Math.floor(out * (1 + p.turn.transferBonus.bonus));
      this.addLog(
        `Transfer bonus applied (+${Math.round(p.turn.transferBonus.bonus * 100)}%)!`
      );
      p.turn.transferBonus = null;
    }

    p.banks[bank] -= amount;
    if (type === 'hotel') {
      p.hotels[partner] = (p.hotels[partner] || 0) + out;
    } else {
      p.airlines[partner] = (p.airlines[partner] || 0) + out;
    }
    p.transfersDone += 1;
    const slot = this.spendTransferSlot(p);
    this.addLog(
      `${p.name} transfers ${amount.toLocaleString()} ${bank} → ${out.toLocaleString()} ${partner}${
        slot === 'free' ? ' (free prep)' : ' (Build)'
      }.`
    );
    this.checkAchievements(p);
    return { out, type, slot };
  }

  /**
   * Book a nonstop or one-stop itinerary.
   * One-stop requires the same airline on both legs (hub connection).
   * @param {string} toCity
   * @param {string} airline
   * @param {string|null} viaCity - connection city, or null for nonstop
   */
  bookFlight(toCity, airline, viaCity = null) {
    const p = this.currentPlayer;
    this.requireTravel(p);
    const from = p.city;
    if (viaCity === toCity || viaCity === from) {
      throw new Error('Invalid connection city');
    }

    const itinerary = resolveItinerary(from, toCity, airline, viaCity || null);
    if (!itinerary) {
      throw new Error(
        viaCity
          ? `No ${airline} one-stop via ${viaCity} to ${toCity}`
          : `No direct ${airline} flight to ${toCity}`
      );
    }

    // Shared contention: 1 award ticket per airline booking (nonstop or 1-stop)
    if (!this.airlineAwards) this.resetAirlineAwards();
    if ((this.airlineAwards[airline] || 0) <= 0) {
      const short =
        airline === 'united' ? 'UA' : airline === 'delta' ? 'DL' : airline === 'american' ? 'AA' : airline;
      throw new Error(
        `No ${short} award tickets left this round (${GAME_CONFIG.awardsPerAirlinePerRound || 2}/airline). Try another airline or wait for next round.`
      );
    }

    let cost = Math.floor(itinerary.baseCost * p.turn.flightMult);
    // Consultant: all flights −15%
    if (p.character.special === 'polished_routes') {
      cost = Math.floor(cost * 0.85);
    }
    // Nomad: first flight each turn −20%
    if (p.character.special === 'cheap_flight' && p.turn.flightsThisTurn === 0) {
      cost = Math.floor(cost * 0.8);
    }
    if ((p.airlines[airline] || 0) < cost) {
      throw new Error(`Need ${cost.toLocaleString()} ${airline} miles`);
    }

    p.airlines[airline] -= cost;

    // Consume 1 airline award ticket for the whole itinerary (not per leg)
    this.airlineAwards[airline] = Math.max(
      0,
      (this.airlineAwards[airline] || 0) - 1
    );

    // Record network + ordered journey landings
    let newCities = 0;
    for (const leg of itinerary.legs) {
      const key = routeKey(leg.from, leg.to);
      p.network.add(key);
      const firstVisit = !p.visited.has(leg.to);
      recordLanding(p, leg.to);
      if (firstVisit) newCities += 1;
    }
    p.city = toCity;
    // Nomad: +1 VP per newly visited city this flight
    if (p.character.special === 'cheap_flight' && newCities > 0) {
      p.vp += newCities;
      this.addLog(`${p.name}'s Nomad skill: +${newCities} VP for new cities.`);
    }

    const legCount = itinerary.legs.length;
    p.segments += legCount;
    if (p.turn.bonusSegment) {
      p.segments += 1;
      p.turn.bonusSegment = false;
    }
    p.turn.flightsThisTurn += 1;
    this.spendTravel(p);

    const pathLabel = viaCity
      ? `${from} → ${viaCity} → ${toCity}`
      : `${from} → ${toCity}`;
    this.addLog(
      `${p.name} flies ${pathLabel} on ${airline} (${legCount} segment${legCount > 1 ? 's' : ''}) for ${cost.toLocaleString()} miles.`
    );

    // Queue map animation (legs for one-stop)
    if (!this.flightAnims) this.flightAnims = [];
    for (const leg of itinerary.legs) {
      this.flightAnims.push({
        playerId: p.id,
        from: leg.from,
        to: leg.to,
        airline,
        playerName: p.name,
      });
    }

    const completedTrips = this.checkTripTickets(p);
    const raceClaims = this.checkRaceGoals(p);
    this.checkAchievements(p);
    return {
      from,
      to: toCity,
      via: viaCity || null,
      cost,
      segments: legCount,
      itinerary,
      completedTrips,
      raceClaims,
    };
  }

  /**
   * Book one night at a signature hotel property.
   * Rule: each property may be stayed at only once per player per game (exactly 1 night).
   * @param {string} hotelId - property id e.g. 'nyc-ritz' / 'nyc-marriott'
   */
  bookHotel(hotelId) {
    const p = this.currentPlayer;
    this.requireTravel(p);
    const city = CITIES[p.city];
    const hotel = (city.hotels || []).find((h) => h.id === hotelId);
    if (!hotel) {
      throw new Error('That hotel is not in your current city');
    }
    if (p.stayedHotels.has(hotelId)) {
      throw new Error(
        `Already stayed at ${hotel.name} this game (1 night max per hotel)`
      );
    }

    const brand = hotel.brand;
    let costMult =
      (p.turn.hotelMult || 1) * (GAME_CONFIG.hotelCostMultiplier || 1);
    // Family: group rate −15% hotel costs
    if (p.character.special === 'group_rate') {
      costMult *= 0.85;
    }
    let totalCost = Math.floor(hotel.cost * costMult);
    const nights = 1;

    if (p.turn.freeNightAvailable) {
      totalCost = 0;
      p.turn.freeNightAvailable = false;
      this.addLog(`${p.name} uses Free Night Certificate at ${hotel.name}.`);
    }

    if ((p.hotels[brand] || 0) < totalCost) {
      throw new Error(
        `Need ${totalCost.toLocaleString()} ${brand} points for ${hotel.name}`
      );
    }

    p.hotels[brand] -= totalCost;
    p.nights += nights;
    p.nightsByBrand[brand] = (p.nightsByBrand[brand] || 0) + nights;
    p.stayedHotels.add(hotelId);

    // Buff hotel VP so staying beats hoarding leftovers
    let stayVp = Math.round(
      (hotel.vp || 2) * (GAME_CONFIG.hotelVpMultiplier || 1)
    );
    stayVp += p.turn.hotelVpBonus;
    // First stay in a new city: +1 VP
    if (!p._hotelCities) p._hotelCities = new Set();
    if (!p._hotelCities.has(city.id)) {
      p._hotelCities.add(city.id);
      stayVp += 1;
    }
    p.turn.hotelVpBonus = 0;
    // Family: small stay bonus; Executive: client stays score extra
    if (p.character.special === 'group_rate') {
      stayVp += 1;
    }
    if (p.character.special === 'extra_card') {
      stayVp += 3;
    }
    p.vp += stayVp;
    this.spendTravel(p);

    this.addLog(
      `${p.name} stays 1n at ${hotel.name} (${city.name}) −${totalCost.toLocaleString()} ${brand} pts, +${stayVp} VP.`
    );
    this.checkAchievements(p);
    return { hotel, nights, totalCost, stayVp, brand };
  }

  drawTickets() {
    const p = this.currentPlayer;
    this.requireBuild(p);
    const drawn = [];
    for (let i = 0; i < 2; i++) {
      if (!this.ticketDeck.length) break;
      drawn.push(this.ticketDeck.pop());
    }
    if (!drawn.length) throw new Error('Ticket deck empty');
    this.spendBuild(p);
    // Return drawn for UI to choose keep; temporarily store
    p.turn.pendingTickets = drawn;
    this.addLog(`${p.name} draws ${drawn.length} trip ticket(s).`);
    return drawn;
  }

  resolveTicketDraw(keepIds) {
    const p = this.currentPlayer;
    const pending = p.turn.pendingTickets || [];
    if (!pending.length) throw new Error('No pending tickets');
    if (!keepIds.length) throw new Error('Keep at least one ticket');

    const keep = pending.filter((t) => keepIds.includes(t.id));
    const discard = pending.filter((t) => !keepIds.includes(t.id));
    if (!keep.length) throw new Error('Keep at least one ticket');

    p.tickets.push(...keep);
    this.ticketDeck = shuffle([...discard, ...this.ticketDeck]);

    // Cap tickets
    while (p.tickets.length > GAME_CONFIG.maxTripTickets) {
      const dropped = p.tickets.pop();
      this.ticketDeck.push(dropped);
      this.ticketDeck = shuffle(this.ticketDeck);
    }

    p.turn.pendingTickets = null;
    this.addLog(`${p.name} keeps ${keep.length} trip ticket(s).`);
    return keep;
  }

  restPlan() {
    const p = this.currentPlayer;
    this.requireBuild(p);
    let best = 'chase';
    let bestAmt = -1;
    for (const b of Object.keys(p.banks)) {
      if (p.banks[b] >= bestAmt) {
        bestAmt = p.banks[b];
        best = b;
      }
    }
    // Prefer bank of a held card
    if (p.cards.length) best = p.cards[0].bank;
    const gain = GAME_CONFIG.restPlanPoints || 3000;
    p.banks[best] = (p.banks[best] || 0) + gain;
    this.spendBuild(p);
    this.addLog(`${p.name} plans ahead: +${gain.toLocaleString()} ${best}.`);
  }

  /**
   * Ticket complete only in order: land at origin first, then later at destination.
   * Example DEN→NYC: journey must include DEN, then a later NYC landing.
   * Visiting NYC before DEN does not check off NYC for that ticket.
   */
  ticketComplete(player, ticket) {
    return ticketProgress(player, ticket).complete;
  }

  checkTripTickets(player) {
    const remaining = [];
    const newlyCompleted = [];
    for (const t of player.tickets) {
      if (this.ticketComplete(player, t)) {
        let ticketVp = t.points;
        // Consultant: +3 VP on private tickets
        if (player.character.special === 'polished_routes') {
          ticketVp += 3;
        }
        player.vp += ticketVp;
        player.completedTickets.push(t);
        newlyCompleted.push(t);
        this.addLog(
          `${player.name} completes ordered trip ${t.from}→${t.to} for ${ticketVp} VP!`
        );
        if (
          (WEST.has(t.from) && EAST.has(t.to)) ||
          (EAST.has(t.from) && WEST.has(t.to))
        ) {
          player.coastToCoast = true;
        }
      } else {
        remaining.push(t);
      }
    }
    player.tickets = remaining;
    return newlyCompleted;
  }

  /**
   * Public race goals: first to complete origin→destination in order claims it.
   */
  checkRaceGoals(player) {
    if (!this.raceGoals || !this.raceGoals.length) return [];
    const remaining = [];
    const claimed = [];
    const bonus = GAME_CONFIG.raceGoalBonusVp != null ? GAME_CONFIG.raceGoalBonusVp : 3;
    for (const t of this.raceGoals) {
      if (this.ticketComplete(player, t)) {
        let ticketVp = t.points + bonus;
        // Consultant: smaller race bonus (races are already shared contention)
        if (player.character.special === 'polished_routes') {
          ticketVp += 1;
        }
        player.vp += ticketVp;
        player.completedTickets.push({ ...t, race: true });
        claimed.push(t);
        this.addLog(
          `🏁 ${player.name} claims RACE ${t.from}→${t.to} (origin then dest) for ${ticketVp} VP!`
        );
        if (
          (WEST.has(t.from) && EAST.has(t.to)) ||
          (EAST.has(t.from) && WEST.has(t.to))
        ) {
          player.coastToCoast = true;
        }
      } else {
        remaining.push(t);
      }
    }
    this.raceGoals = remaining;
    this.refillRaceGoals();
    return claimed;
  }

  checkAchievements(player) {
    for (const ach of ACHIEVEMENTS) {
      if (player.achievements.has(ach.id)) continue;
      if (ach.check(player)) {
        player.achievements.add(ach.id);
        player.vp += ach.vp;
        this.addLog(
          `${player.name} unlocks ${ach.name} (+${ach.vp} VP)!`
        );
      }
    }
  }

  endTurn() {
    const p = this.currentPlayer;
    if (!p.turn.incomeDone) {
      this.doIncome();
    }
    // Burn remaining actions? Optional — we just end
    this.addLog(`${p.name} ends turn.`);

    this.currentPlayerIndex =
      (this.currentPlayerIndex + 1) % this.players.length;

    if (this.currentPlayerIndex === 0) {
      this.round += 1;
      if (this.round > this.maxRounds) {
        this.finalScoring();
        return { gameOver: true };
      }
      // New round: refill per-airline award tickets
      this.resetAirlineAwards();
      const n = GAME_CONFIG.awardsPerAirlinePerRound || 2;
      this.addLog(
        `—— Round ${this.round} —— Award tickets refilled (${n} each: UA / DL / AA).`
      );
    }

    this.beginTurn();
    return { gameOver: false };
  }

  longestPath(player) {
    // Approximate: BFS depth from each node in network
    const adj = {};
    for (const key of player.network) {
      const [a, b] = key.split('-');
      if (!adj[a]) adj[a] = [];
      if (!adj[b]) adj[b] = [];
      adj[a].push(b);
      adj[b].push(a);
    }
    const nodes = Object.keys(adj);
    if (!nodes.length) return 0;

    function dfs(node, seen) {
      let best = 0;
      for (const n of adj[node] || []) {
        const edge = routeKey(node, n);
        if (seen.has(edge)) continue;
        seen.add(edge);
        best = Math.max(best, 1 + dfs(n, seen));
        seen.delete(edge);
      }
      return best;
    }

    let max = 0;
    for (const n of nodes) {
      max = Math.max(max, dfs(n, new Set()));
    }
    return max;
  }

  finalScoring() {
    this.phase = 'ended';
    const scores = [];

    for (const p of this.players) {
      let ticketPen = 0;
      for (const t of p.tickets) {
        ticketPen += t.penalty;
        p.vp -= t.penalty;
      }

      // Leftover points — weak conversion so travel/hotels/tickets dominate
      let leftoverVp = 0;
      const bankDiv = GAME_CONFIG.leftoverBankPerVp || 12000;
      const hotelDiv = GAME_CONFIG.leftoverHotelPerVp || 25000;
      const airDiv = GAME_CONFIG.leftoverAirlinePerVp || 20000;
      for (const b of Object.keys(p.banks)) {
        leftoverVp += Math.floor((p.banks[b] || 0) / bankDiv);
      }
      for (const h of Object.keys(p.hotels)) {
        leftoverVp += Math.floor((p.hotels[h] || 0) / hotelDiv);
      }
      for (const a of Object.keys(p.airlines)) {
        leftoverVp += Math.floor((p.airlines[a] || 0) / airDiv);
      }
      p.vp += leftoverVp;

      scores.push({
        player: p,
        vp: p.vp,
        cities: p.visited.size,
        segments: p.segments,
        longest: this.longestPath(p),
        ticketPen,
        leftoverVp,
      });
    }

    // Most cities
    const maxCities = Math.max(...scores.map((s) => s.cities));
    const cityLeaders = scores.filter((s) => s.cities === maxCities);
    const cityBonus = cityLeaders.length === 1 ? 3 : 2;
    for (const s of cityLeaders) {
      s.player.vp += cityBonus;
      s.vp = s.player.vp;
      s.cityBonus = cityBonus;
    }

    // Longest route
    const maxLong = Math.max(...scores.map((s) => s.longest));
    if (maxLong > 0) {
      const longLeaders = scores.filter((s) => s.longest === maxLong);
      for (const s of longLeaders) {
        s.player.vp += 4;
        s.vp = s.player.vp;
        s.longBonus = 4;
      }
    }

    scores.sort((a, b) => b.vp - a.vp || b.cities - a.cities || b.segments - a.segments);
    this.finalScores = scores;
    this.winner = scores[0].player;
    this.addLog(
      `Game over! ${this.winner.name} wins with ${this.winner.vp} VP.`
    );
  }

  /** Serialize for UI (Sets → arrays) */
  snapshot() {
    if (!this.airlineAwards) this.resetAirlineAwards();
    return {
      phase: this.phase,
      round: this.round,
      maxRounds: this.maxRounds,
      airlineAwards: { ...this.airlineAwards },
      awardsPerAirlinePerRound: GAME_CONFIG.awardsPerAirlinePerRound || 2,
      currentPlayerIndex: this.currentPlayerIndex,
      log: this.log.slice(0, 30),
      raceGoals: (this.raceGoals || []).map((t) => ({ ...t })),
      winner: this.winner
        ? { id: this.winner.id, name: this.winner.name, vp: this.winner.vp }
        : null,
      finalScores: this.finalScores
        ? this.finalScores.map((s) => ({
            id: s.player.id,
            name: s.player.name,
            character: s.player.character.name,
            vp: s.vp,
            cities: s.cities,
            segments: s.segments,
            longest: s.longest,
          }))
        : null,
      players: this.players.map((p) => {
        if (p.turn) normalizeTurnActions(p.turn);
        return {
          id: p.id,
          name: p.name,
          isBot: !!p.isBot,
          character: p.character,
          city: p.city,
          visited: [...p.visited],
          journey: (p.journey || []).slice(),
          banks: { ...p.banks },
          hotels: { ...p.hotels },
          airlines: { ...p.airlines },
          cards: p.cards.map((c) => ({ id: c.id, name: c.name, bank: c.bank })),
          earnPrefs: { ...(p.earnPrefs || {}) },
          tickets: p.tickets.map((t) => {
            const prog = ticketProgress(p, t);
            return {
              ...t,
              originDone: prog.origin,
              destDone: prog.dest,
              orderedReady: prog.complete,
            };
          }),
          completedTickets: p.completedTickets.map((t) => ({ ...t })),
          completedTicketCount: p.completedTickets.length,
          segments: p.segments,
          nights: p.nights,
          nightsByBrand: { ...p.nightsByBrand },
          stayedHotels: [...p.stayedHotels],
          transfersDone: p.transfersDone,
          vp: p.vp,
          achievements: [...p.achievements],
          network: [...p.network],
          turn: p.turn
            ? {
                actionsLeft: p.turn.actionsLeft,
                buildLeft: p.turn.buildLeft,
                travelLeft: p.turn.travelLeft,
                freeTransferLeft: p.turn.freeTransferLeft,
                event: p.turn.event,
                incomeDone: p.turn.incomeDone,
                transferBonus: p.turn.transferBonus,
                flightMult: p.turn.flightMult,
                hotelMult: p.turn.hotelMult,
                freeNightAvailable: p.turn.freeNightAvailable,
                pendingTickets: p.turn.pendingTickets,
                spendRoll: p.turn.spendRoll ? { ...p.turn.spendRoll } : null,
                lastIncome: p.turn.lastIncome
                  ? {
                      totalEarned: p.turn.lastIncome.totalEarned,
                      lines: (p.turn.lastIncome.lines || []).map((l) => ({
                        ...l,
                      })),
                    }
                  : null,
                spendProfile: spendProfilePercents(p.character.spendProfile),
              }
            : null,
        };
      }),
    };
  }
}

export {
  CREDIT_CARDS,
  CHARACTERS,
  CITIES,
  ROUTES,
  TRANSFERS,
  ACHIEVEMENTS,
  GAME_CONFIG,
  listFlightOptions,
  resolveItinerary,
  spendProfilePercents,
  rollSpendAllocation,
  SPEND_DRAWS,
};
