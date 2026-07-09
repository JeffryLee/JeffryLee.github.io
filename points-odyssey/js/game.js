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
} from './data.js';

function emptyBanks() {
  return { chase: 0, amex: 0, citi: 0, bilt: 0 };
}
function emptyHotels() {
  return { marriott: 0, hilton: 0, hyatt: 0 };
}
function emptyAirlines() {
  return { united: 0, delta: 0, american: 0 };
}

function createPlayer(index, character, name) {
  return {
    id: index,
    name: name || `Player ${index + 1}`,
    characterId: character.id,
    character,
    city: character.homeCity,
    visited: new Set([character.homeCity]),
    banks: emptyBanks(),
    hotels: emptyHotels(),
    airlines: emptyAirlines(),
    cards: [],
    cardSpendProgress: {}, // cardId -> spend toward min
    cardBonusClaimed: {},
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

function resetTurnState(player) {
  player.turn = {
    actionsLeft: 2,
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
    // Lifestyle roll: which spend categories appear this turn
    spendRoll: rollSpendAllocation(player.character),
  };
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

  /** Setup: create players from chosen character ids + names */
  startGame(selections) {
    // selections: [{ characterId, name }]
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
      return createPlayer(i, ch, sel.name);
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

    // Deal tickets
    for (const p of this.players) {
      resetTurnState(p);
      const dealt = [];
      for (let i = 0; i < GAME_CONFIG.startingTickets; i++) {
        if (this.ticketDeck.length) dealt.push(this.ticketDeck.pop());
      }
      // Auto-keep best 2 by points (player can manage later via draw)
      dealt.sort((a, b) => b.points - a.points);
      p.tickets = dealt.slice(0, GAME_CONFIG.keepTickets);
      const discarded = dealt.slice(GAME_CONFIG.keepTickets);
      this.ticketDeck = shuffle([...discarded, ...this.ticketDeck]);

      // Starter: Freedom Unlimited style soft entry — 5k Chase
      p.banks.chase = 5000;
    }

    this.addLog(
      `Game started with ${this.players.length} players. Round 1 begins.`
    );
    this.beginTurn();
    return this;
  }

  beginTurn() {
    const p = this.currentPlayer;
    resetTurnState(p);
    this.drawAndResolveEvent(p);
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
        t.actionsLeft = Math.max(1, t.actionsLeft - 1);
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
   * Income phase: allocate budget across categories, earn on best cards.
   * allocation: { dining: 500, groceries: 500, ... } sums to budget
   */
  doIncome(allocation) {
    const p = this.currentPlayer;
    if (p.turn.incomeDone) throw new Error('Income already done');
    if (p.turn.actionsLeft < 0) throw new Error('Invalid state');

    const total = Object.values(allocation).reduce((s, v) => s + (v || 0), 0);
    if (total > GAME_CONFIG.budgetPerTurn + 1) {
      throw new Error('Over budget');
    }

    // Spend dollars as allocated — no character spend multipliers.
    // Earn rates come only from credit cards (default 0× with no card).
    const effective = {};
    for (const [cat, amt] of Object.entries(allocation)) {
      if (!amt) continue;
      effective[cat] = Math.round(amt);
    }

    // Event earn mults (e.g. double dining) scale spend for earn calc only
    for (const [cat, m] of Object.entries(p.turn.earnMults)) {
      if (effective[cat]) effective[cat] = Math.round(effective[cat] * m);
    }

    let totalEarned = 0;
    const earnedByBank = emptyBanks();

    for (const [cat, spend] of Object.entries(effective)) {
      if (!spend) continue;
      const { bank, rate, card } = this.bestEarnRate(p, cat);
      if (!card || rate <= 0) continue; // 0× without a card

      let pts = Math.floor(spend * rate);

      let biltMult = p.turn.biltBoost || 1;
      if (p.character.special === 'rent_day' && bank === 'bilt') {
        biltMult *= 1.25;
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
    }

    // Foodie dining bonus (ability, not a spend multiplier)
    if (
      p.character.special === 'dining_bonus' &&
      (allocation.dining || 0) > 0 &&
      !p.turn.diningBonusUsed
    ) {
      const best = this.bestEarnRate(p, 'dining');
      const bank = best.card ? best.bank : p.cards[0] ? p.cards[0].bank : null;
      if (bank) {
        p.banks[bank] = (p.banks[bank] || 0) + 500;
        totalEarned += 500;
        p.turn.diningBonusUsed = true;
      }
    }

    p.turn.incomeDone = true;
    if (!p.cards.length) {
      this.addLog(
        `${p.name} spends but earns 0 pts (no credit card — apply for one!).`
      );
    } else {
      this.addLog(
        `${p.name} spends and earns ~${totalEarned.toLocaleString()} points.`
      );
    }
    return { totalEarned, earnedByBank, effective };
  }

  /**
   * Best card earn rate for a category. Default: 0× (no free character bonus).
   */
  bestEarnRate(player, category) {
    let best = { bank: null, rate: 0, card: null };
    if (!player.cards.length) return best;

    for (const c of player.cards) {
      const def = CREDIT_CARDS.find((x) => x.id === c.id) || c;
      const rate =
        def.earn[category] != null
          ? def.earn[category]
          : def.earn.everything != null
            ? def.earn.everything
            : 0;
      if (rate > best.rate) {
        best = { bank: def.bank, rate, card: def };
      }
    }
    return best;
  }

  maybeClaimSignup(player, card) {
    if (player.cardBonusClaimed[card.id]) return;
    const progress = player.cardSpendProgress[card.id] || 0;
    if (progress >= card.minSpend && card.signupBonus > 0) {
      player.banks[card.bank] =
        (player.banks[card.bank] || 0) + card.signupBonus;
      player.cardBonusClaimed[card.id] = true;
      this.addLog(
        `${player.name} hits min-spend on ${card.name}! +${card.signupBonus.toLocaleString()} ${card.bank}.`
      );
    }
  }

  /**
   * This turn's spending = character lifestyle roll (category appearance probs).
   * Earn rates still come only from credit cards (0× without a card).
   */
  autoAllocate(player) {
    if (player.turn && player.turn.spendRoll) {
      return { ...player.turn.spendRoll };
    }
    return rollSpendAllocation(player.character);
  }

  /** Re-roll lifestyle spend for this turn (optional UI action, free). */
  rerollSpend() {
    const p = this.currentPlayer;
    if (p.turn.incomeDone) throw new Error('Income already done');
    p.turn.spendRoll = rollSpendAllocation(p.character);
    this.addLog(`${p.name} re-rolls lifestyle spend for this turn.`);
    return { ...p.turn.spendRoll };
  }

  // ——— Actions ———

  requireAction(player) {
    if (this.phase !== 'playing') throw new Error('Game not active');
    if (player.id !== this.currentPlayer.id) throw new Error('Not your turn');
    if (!player.turn.incomeDone) throw new Error('Complete income first');
    if (player.turn.actionsLeft <= 0) throw new Error('No actions left');
  }

  applyForCard(cardId) {
    const p = this.currentPlayer;
    this.requireAction(p);
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

    p.turn.actionsLeft -= 1;
    this.addLog(`${p.name} is approved for ${def.name} (${def.bank}).`);
    this.checkAchievements(p);
    return def;
  }

  transferPoints(bank, partner, amount) {
    const p = this.currentPlayer;
    this.requireAction(p);
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

    // Consultant: +10% on United transfers
    if (p.character.special === 'travel_focus' && partner === 'united') {
      out = Math.floor(out * 1.1);
      this.addLog(`${p.name}'s Consultant skill: +10% United transfer.`);
    }

    p.banks[bank] -= amount;
    if (type === 'hotel') {
      p.hotels[partner] = (p.hotels[partner] || 0) + out;
    } else {
      p.airlines[partner] = (p.airlines[partner] || 0) + out;
    }
    p.transfersDone += 1;
    p.turn.actionsLeft -= 1;
    this.addLog(
      `${p.name} transfers ${amount.toLocaleString()} ${bank} → ${out.toLocaleString()} ${partner}.`
    );
    this.checkAchievements(p);
    return { out, type };
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
    this.requireAction(p);
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

    let cost = Math.floor(itinerary.baseCost * p.turn.flightMult);
    if (p.character.special === 'cheap_flight' && p.turn.flightsThisTurn === 0) {
      cost = Math.floor(cost * 0.9);
    }
    if ((p.airlines[airline] || 0) < cost) {
      throw new Error(`Need ${cost.toLocaleString()} ${airline} miles`);
    }

    p.airlines[airline] -= cost;

    // Record every flown leg on personal network + visit cities
    for (const leg of itinerary.legs) {
      p.network.add(routeKey(leg.from, leg.to));
      p.visited.add(leg.to);
    }
    p.city = toCity;

    const legCount = itinerary.legs.length;
    p.segments += legCount;
    if (p.turn.bonusSegment) {
      p.segments += 1;
      p.turn.bonusSegment = false;
    }
    p.turn.flightsThisTurn += 1;
    p.turn.actionsLeft -= 1;

    const pathLabel = viaCity
      ? `${from} → ${viaCity} → ${toCity}`
      : `${from} → ${toCity}`;
    this.addLog(
      `${p.name} flies ${pathLabel} on ${airline} (${legCount} segment${legCount > 1 ? 's' : ''}) for ${cost.toLocaleString()} miles.`
    );

    const completedTrips = this.checkTripTickets(p);
    this.checkAchievements(p);
    return {
      from,
      to: toCity,
      via: viaCity || null,
      cost,
      segments: legCount,
      itinerary,
      completedTrips,
    };
  }

  /**
   * Book one night at a signature hotel property.
   * Rule: each property may be stayed at only once per player per game (exactly 1 night).
   * @param {string} hotelId - property id e.g. 'nyc-ritz' / 'nyc-marriott'
   */
  bookHotel(hotelId) {
    const p = this.currentPlayer;
    this.requireAction(p);
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
    let totalCost = Math.floor(hotel.cost * p.turn.hotelMult);
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

    let stayVp = hotel.vp || 2;
    if (p.character.special === 'family_nights') {
      stayVp += 1;
    }
    stayVp += p.turn.hotelVpBonus;
    p.turn.hotelVpBonus = 0;
    p.vp += stayVp;
    p.turn.actionsLeft -= 1;

    this.addLog(
      `${p.name} stays 1n at ${hotel.name} (${city.name}) −${totalCost.toLocaleString()} ${brand} pts, +${stayVp} VP.`
    );
    this.checkAchievements(p);
    return { hotel, nights, totalCost, stayVp, brand };
  }

  drawTickets() {
    const p = this.currentPlayer;
    this.requireAction(p);
    const drawn = [];
    for (let i = 0; i < 2; i++) {
      if (!this.ticketDeck.length) break;
      drawn.push(this.ticketDeck.pop());
    }
    if (!drawn.length) throw new Error('Ticket deck empty');
    p.turn.actionsLeft -= 1;
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
    this.requireAction(p);
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
    p.banks[best] = (p.banks[best] || 0) + 1000;
    p.turn.actionsLeft -= 1;
    this.addLog(`${p.name} plans ahead: +1,000 ${best}.`);
  }

  // Graph connectivity for trip tickets
  canConnect(player, from, to) {
    if (from === to) return true;
    const adj = {};
    for (const key of player.network) {
      const [a, b] = key.split('-');
      if (!adj[a]) adj[a] = [];
      if (!adj[b]) adj[b] = [];
      adj[a].push(b);
      adj[b].push(a);
    }
    const seen = new Set([from]);
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      for (const n of adj[cur] || []) {
        if (seen.has(n)) continue;
        if (n === to) return true;
        seen.add(n);
        q.push(n);
      }
    }
    return false;
  }

  checkTripTickets(player) {
    const remaining = [];
    const newlyCompleted = [];
    for (const t of player.tickets) {
      if (this.canConnect(player, t.from, t.to)) {
        player.vp += t.points;
        player.completedTickets.push(t);
        newlyCompleted.push(t);
        this.addLog(
          `${player.name} completes trip ${t.from}→${t.to} for ${t.points} VP!`
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
      // Auto income if they forgot
      this.doIncome(this.autoAllocate(p));
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
      this.addLog(`—— Round ${this.round} ——`);
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

      // Leftover points
      let leftoverVp = 0;
      for (const b of Object.keys(p.banks)) {
        leftoverVp += Math.floor((p.banks[b] || 0) / 5000);
      }
      for (const h of Object.keys(p.hotels)) {
        leftoverVp += Math.floor((p.hotels[h] || 0) / 10000);
      }
      for (const a of Object.keys(p.airlines)) {
        leftoverVp += Math.floor((p.airlines[a] || 0) / 8000);
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
    return {
      phase: this.phase,
      round: this.round,
      maxRounds: this.maxRounds,
      currentPlayerIndex: this.currentPlayerIndex,
      log: this.log.slice(0, 30),
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
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        character: p.character,
        city: p.city,
        visited: [...p.visited],
        banks: { ...p.banks },
        hotels: { ...p.hotels },
        airlines: { ...p.airlines },
        cards: p.cards.map((c) => ({ id: c.id, name: c.name, bank: c.bank })),
        tickets: p.tickets.map((t) => ({ ...t })),
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
              event: p.turn.event,
              incomeDone: p.turn.incomeDone,
              transferBonus: p.turn.transferBonus,
              flightMult: p.turn.flightMult,
              hotelMult: p.turn.hotelMult,
              freeNightAvailable: p.turn.freeNightAvailable,
              pendingTickets: p.turn.pendingTickets,
              spendRoll: p.turn.spendRoll ? { ...p.turn.spendRoll } : null,
              spendProfile: spendProfilePercents(p.character.spendProfile),
            }
          : null,
      })),
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
