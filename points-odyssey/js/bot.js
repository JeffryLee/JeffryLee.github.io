/**
 * Points Odyssey — stronger bot AI
 *
 * Core loop each action:
 *   1. Complete tickets (visit both cities) — highest VP
 *   2. Transfer just enough (or dump) bank → miles/hotels
 *   3. Book hotels for boosted VP
 *   4. Expand toward ticket cities / new cities
 *   5. Cards only early; never rest while bank points remain
 */

import {
  CREDIT_CARDS,
  CITIES,
  ROUTES,
  TRANSFERS,
  listFlightOptions,
  GAME_CONFIG,
} from './data.js';

const CARD_PREFS = {
  consultant: ['csp', 'csr', 'bilt_card', 'amex_gold'],
  family: ['csp', 'cff', 'custom_cash', 'amex_gold'],
  nomad: ['csp', 'bilt_card', 'strata', 'csr'],
  foodie: ['amex_gold', 'csp', 'custom_cash', 'cfu'],
  landlord: ['csp', 'cfu', 'custom_cash', 'strata'],
  executive: ['amex_plat', 'amex_gold', 'csr', 'csp', 'bilt_card'],
};

/** Airlines each bank can feed */
const BANK_TO_AIRLINE = {
  chase: ['united'],
  amex: ['delta'],
  citi: ['american'],
  bilt: ['united', 'american'],
};

const BANK_TO_HOTEL = {
  chase: ['hyatt', 'marriott'],
  amex: ['hilton', 'marriott'],
  citi: ['hilton'],
  bilt: ['hyatt', 'marriott'],
};

// ——— helpers ———

function flightCost(player, baseCost) {
  let cost = Math.floor(baseCost * ((player.turn && player.turn.flightMult) || 1));
  if (
    player.character.special === 'cheap_flight' &&
    (player.turn.flightsThisTurn || 0) === 0
  ) {
    cost = Math.floor(cost * 0.9);
  }
  return cost;
}

function totalBank(player) {
  return Object.values(player.banks).reduce((s, v) => s + (v || 0), 0);
}

function totalAirline(player) {
  return Object.values(player.airlines).reduce((s, v) => s + (v || 0), 0);
}

function totalHotel(player) {
  return Object.values(player.hotels).reduce((s, v) => s + (v || 0), 0);
}

function richestBanks(player) {
  return Object.entries(player.banks)
    .filter(([, v]) => v >= 1000)
    .sort((a, b) => b[1] - a[1])
    .map(([bank, amount]) => ({ bank, amount }));
}

function missingTicketCities(player) {
  const missing = [];
  for (const t of player.tickets) {
    if (!player.visited.has(t.from)) {
      missing.push({ city: t.from, ticket: t, vp: t.points });
    }
    if (!player.visited.has(t.to)) {
      missing.push({ city: t.to, ticket: t, vp: t.points });
    }
  }
  missing.sort((a, b) => b.vp - a.vp);
  return missing;
}

/** BFS hop distance on the route graph */
function hopDistance(from, to) {
  if (from === to) return 0;
  const adj = {};
  for (const r of ROUTES) {
    if (!adj[r.a]) adj[r.a] = [];
    if (!adj[r.b]) adj[r.b] = [];
    adj[r.a].push(r.b);
    adj[r.b].push(r.a);
  }
  const seen = new Set([from]);
  const q = [[from, 0]];
  while (q.length) {
    const [c, d] = q.shift();
    for (const n of adj[c] || []) {
      if (seen.has(n)) continue;
      if (n === to) return d + 1;
      seen.add(n);
      q.push([n, d + 1]);
    }
  }
  return 99;
}

function nearestMissingDist(player, city) {
  const missing = missingTicketCities(player);
  if (!missing.length) return 50;
  let best = 99;
  for (const m of missing) {
    best = Math.min(best, hopDistance(city, m.city));
  }
  return best;
}

/**
 * All itineraries to dest with cost, whether affordable or not.
 */
function flightsToward(player, dest) {
  const opts = listFlightOptions(player.city).filter((o) => o.to === dest);
  const out = [];
  for (const o of opts) {
    for (const air of o.airlines) {
      const cost = flightCost(player, o.baseCost);
      const bal = player.airlines[air] || 0;
      out.push({
        to: o.to,
        via: o.via,
        airline: air,
        cost,
        stops: o.stops,
        affordable: bal >= cost,
        shortfall: Math.max(0, cost - bal),
      });
    }
  }
  out.sort(
    (a, b) =>
      (a.affordable === b.affordable ? 0 : a.affordable ? -1 : 1) ||
      a.cost - b.cost ||
      a.stops - b.stops
  );
  return out;
}

function allAffordableFlights(player) {
  const opts = listFlightOptions(player.city);
  const out = [];
  for (const o of opts) {
    for (const air of o.airlines) {
      const cost = flightCost(player, o.baseCost);
      if ((player.airlines[air] || 0) >= cost) {
        out.push({
          to: o.to,
          via: o.via,
          airline: air,
          cost,
          stops: o.stops,
        });
      }
    }
  }
  return out;
}

function bestHotelStay(player) {
  const city = CITIES[player.city];
  if (!city || !city.hotels) return null;
  const costMult =
    ((player.turn && player.turn.hotelMult) || 1) *
    (GAME_CONFIG.hotelCostMultiplier || 1);
  const vpMult = GAME_CONFIG.hotelVpMultiplier || 1;
  const free = player.turn && player.turn.freeNightAvailable;
  let best = null;
  for (const h of city.hotels) {
    if (player.stayedHotels.has(h.id)) continue;
    const cost = free ? 0 : Math.floor(h.cost * costMult);
    const bal = player.hotels[h.brand] || 0;
    const canPay = bal >= cost;
    const vp =
      Math.round((h.vp || 2) * vpMult) +
      (player.character.special === 'family_nights' ? 2 : 0) +
      1; // city bonus estimate
    const score = !canPay
      ? -1
      : free
        ? vp + 20
        : vp * 1000 / Math.max(cost, 1);
    if (canPay && (!best || score > best.score)) {
      best = {
        hotelId: h.id,
        brand: h.brand,
        cost,
        vp,
        score,
        name: h.name,
        shortfall: 0,
      };
    } else if (!canPay && cost > 0) {
      const shortfall = cost - bal;
      // track best unaffordable for transfer planning
      if (!best || best.score < 0) {
        const need = { hotelId: h.id, brand: h.brand, cost, vp, score: -1, name: h.name, shortfall };
        if (!best || shortfall < best.shortfall) best = need;
      }
    }
  }
  return best;
}

/** Find bank→airline transfer that can fund shortfall miles */
function planAirlineTransfer(player, airline, shortfall) {
  const need = Math.max(1000, Math.ceil(shortfall / 1000) * 1000);
  // Prefer transfer bonus
  const bonus = player.turn && player.turn.transferBonus;
  const banks = richestBanks(player);
  // Sort: bonus partner bank first, then character prefs
  banks.sort((a, b) => {
    const aCan = (BANK_TO_AIRLINE[a.bank] || []).includes(airline);
    const bCan = (BANK_TO_AIRLINE[b.bank] || []).includes(airline);
    if (aCan !== bCan) return aCan ? -1 : 1;
    if (bonus && bonus.partner === airline) {
      // prefer banks that transfer to bonus partner
    }
    // consultant prefers chase→united
    if (player.character.special === 'travel_focus') {
      if (a.bank === 'chase' && airline === 'united') return -1;
      if (b.bank === 'chase' && airline === 'united') return 1;
    }
    return b.amount - a.amount;
  });

  for (const { bank, amount } of banks) {
    const partners = TRANSFERS[bank];
    if (!partners || !partners[airline]) continue;
    // Transfer enough for shortfall, or dump most of bank for fuel
    let amt = Math.min(amount, Math.max(need, Math.floor(amount * 0.85)));
    amt = Math.floor(amt / 1000) * 1000;
    if (amt < 1000) continue;
    return { bank, partner: airline, amount: amt };
  }
  return null;
}

function planHotelTransfer(player, brand, shortfall) {
  const need = Math.max(1000, Math.ceil(shortfall / 1000) * 1000);
  const bonus = player.turn && player.turn.transferBonus;
  for (const { bank, amount } of richestBanks(player)) {
    const partners = TRANSFERS[bank];
    if (!partners || !partners[brand]) continue;
    // Prefer hyatt; honor transfer bonus
    let amt = Math.min(amount, Math.max(need, Math.floor(amount * 0.85)));
    amt = Math.floor(amt / 1000) * 1000;
    if (amt < 1000) continue;
    if (bonus && bonus.partner === brand) {
      return { bank, partner: brand, amount: amt };
    }
    return { bank, partner: brand, amount: amt };
  }
  // Any hotel partner from richest bank
  for (const { bank, amount } of richestBanks(player)) {
    const hotels = BANK_TO_HOTEL[bank] || [];
    if (!hotels.length) continue;
    let partner = hotels.includes('hyatt') ? 'hyatt' : hotels[0];
    if (bonus && hotels.includes(bonus.partner)) partner = bonus.partner;
    let amt = Math.floor(Math.min(amount, Math.max(need, amount * 0.85)) / 1000) * 1000;
    if (amt < 1000) continue;
    return { bank, partner, amount: amt };
  }
  return null;
}

/** Dump bank points into most useful partner */
function dumpBankTransfer(player) {
  const banks = richestBanks(player);
  if (!banks.length) return null;
  const bonus = player.turn && player.turn.transferBonus;
  const { bank, amount } = banks[0];
  const partners = TRANSFERS[bank];
  if (!partners) return null;

  const missing = missingTicketCities(player);
  const wantAirline =
    missing.length > 0 || totalAirline(player) < 15000 || player.tickets.length > 0;

  let partner = null;
  if (bonus && partners[bonus.partner]) {
    partner = bonus.partner;
  } else if (wantAirline) {
    const airs = BANK_TO_AIRLINE[bank] || [];
    partner = airs[0] || Object.keys(partners)[0];
    // Consultant → united
    if (player.character.special === 'travel_focus' && partners.united) {
      partner = 'united';
    }
  } else {
    const hotels = BANK_TO_HOTEL[bank] || [];
    partner = hotels.includes('hyatt')
      ? 'hyatt'
      : hotels[0] || Object.keys(partners)[0];
  }

  if (!partner || !partners[partner]) {
    partner = Object.keys(partners)[0];
  }
  // Dump nearly everything (leave <1k)
  let amt = Math.floor(amount / 1000) * 1000;
  if (amt < 1000) return null;
  return { bank, partner, amount: amt };
}

function pickCard(game, player) {
  if (player.cards.length >= game.cardLimit(player)) return null;
  // Only open cards in early-mid game, or if still on starter only
  if (game.round > 6 && player.cards.length >= 2) return null;
  const held = new Set(player.cards.map((c) => c.id));
  const prefs = CARD_PREFS[player.character.id] || ['csp', 'amex_gold', 'cfu'];
  for (const id of prefs) {
    if (held.has(id)) continue;
    if (CREDIT_CARDS.some((c) => c.id === id)) return id;
  }
  for (const c of CREDIT_CARDS) {
    if (!held.has(c.id) && c.signupBonus >= 8000) return c.id;
  }
  return null;
}

function expectedIncome(game, player, alloc) {
  let total = 0;
  for (const [cat, spend] of Object.entries(alloc || {})) {
    if (!spend) continue;
    const { rate } = game.bestEarnRate(player, cat);
    total += Math.floor(spend * rate);
  }
  return total;
}

/** Best single-category dump for income estimate */
function bestCategoryEarn(game, player) {
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
  let best = 0;
  for (const cat of cats) {
    const { rate } = game.bestEarnRate(player, cat);
    best = Math.max(best, Math.floor(GAME_CONFIG.budgetPerTurn * rate));
  }
  return best;
}

// ——— action selection ———

function tryFly(game, flight) {
  game.bookFlight(flight.to, flight.airline, flight.via || null);
  return `flies to ${flight.to}${flight.via ? ` via ${flight.via}` : ''} on ${flight.airline}`;
}

function tryTransfer(game, xfer) {
  game.transferPoints(xfer.bank, xfer.partner, xfer.amount);
  return `transfers ${xfer.amount.toLocaleString()} ${xfer.bank} → ${xfer.partner}`;
}

function doOneAction(game, player) {
  // Pending ticket keep
  if (player.turn.pendingTickets && player.turn.pendingTickets.length) {
    const sorted = [...player.turn.pendingTickets].sort(
      (a, b) => b.points - a.points
    );
    // Keep all if ≤2 and good; else keep best 1–2
    const keep = sorted.slice(0, Math.min(2, sorted.length)).map((t) => t.id);
    game.resolveTicketDraw(keep);
    return `keeps trip ticket(s)`;
  }

  const missing = missingTicketCities(player);
  const round = game.round || 1;

  // A) Free night hotel
  if (player.turn.freeNightAvailable) {
    const stay = bestHotelStay(player);
    if (stay && stay.score > 0) {
      game.bookHotel(stay.hotelId);
      return `free night at ${stay.name}`;
    }
  }

  // B) Fly to complete / progress tickets if affordable
  for (const m of missing) {
    if (m.city === player.city) continue;
    const options = flightsToward(player, m.city);
    const aff = options.find((o) => o.affordable);
    if (aff) {
      try {
        return tryFly(game, aff) + ` (ticket ${m.ticket.from}→${m.ticket.to})`;
      } catch (e) {
        /* continue */
      }
    }
  }

  // C) Transfer to fund a ticket flight, then next action flies
  for (const m of missing) {
    if (m.city === player.city) continue;
    const options = flightsToward(player, m.city);
    for (const o of options.slice(0, 6)) {
      if (o.affordable) continue;
      const xfer = planAirlineTransfer(player, o.airline, o.shortfall);
      if (xfer) {
        try {
          return tryTransfer(game, xfer) + ` (fuel for ${m.city})`;
        } catch (e) {
          /* try next */
        }
      }
    }
  }

  // D) Step toward ticket city (affordable flight that reduces hop distance)
  if (missing.length) {
    const flights = allAffordableFlights(player);
    const hereDist = nearestMissingDist(player, player.city);
    flights.sort((a, b) => {
      const da = nearestMissingDist(player, a.to);
      const db = nearestMissingDist(player, b.to);
      // Prefer reducing distance; bonus if destination is missing ticket city
      const aTicket = missing.some((m) => m.city === a.to) ? -5 : 0;
      const bTicket = missing.some((m) => m.city === b.to) ? -5 : 0;
      return da + aTicket - (db + bTicket) || a.cost - b.cost;
    });
    for (const f of flights) {
      const d = nearestMissingDist(player, f.to);
      if (d < hereDist || missing.some((m) => m.city === f.to)) {
        try {
          return tryFly(game, f) + ' (toward tickets)';
        } catch (e) {
          /* continue */
        }
      }
    }
  }

  // E) Hotel for VP when we can pay
  {
    const stay = bestHotelStay(player);
    if (stay && stay.score > 0 && (stay.vp >= 5 || stay.cost === 0 || round >= 4)) {
      try {
        game.bookHotel(stay.hotelId);
        return `stays at ${stay.name} (~${stay.vp} VP)`;
      } catch (e) {
        /* continue */
      }
    }
  }

  // F) Transfer for hotel if we have bank and can't stay
  {
    const stay = bestHotelStay(player);
    if (stay && stay.shortfall > 0 && totalBank(player) >= 1000) {
      const xfer = planHotelTransfer(player, stay.brand, stay.shortfall);
      if (xfer) {
        try {
          return tryTransfer(game, xfer) + ' (hotel points)';
        } catch (e) {
          /* continue */
        }
      }
    }
  }

  // G) Early card (max 1 extra in first 4 rounds if only starter)
  if (
    player.cards.length < game.cardLimit(player) &&
    (player.cards.length === 1 && round <= 5)
  ) {
    const cardId = pickCard(game, player);
    if (cardId) {
      try {
        const def = game.applyForCard(cardId);
        return `applies for ${def.name}`;
      } catch (e) {
        /* continue */
      }
    }
  }

  // H) Dump bank → miles if we have tickets or low miles
  if (totalBank(player) >= 1000 && (missing.length || totalAirline(player) < 20000 || round >= 3)) {
    const xfer = dumpBankTransfer(player);
    if (xfer) {
      try {
        return tryTransfer(game, xfer);
      } catch (e) {
        /* continue */
      }
    }
  }

  // I) Any flight to unvisited city (coverage / cities VP)
  {
    const flights = allAffordableFlights(player);
    flights.sort((a, b) => {
      const av = player.visited.has(a.to) ? 1 : 0;
      const bv = player.visited.has(b.to) ? 1 : 0;
      return av - bv || a.cost - b.cost;
    });
    if (flights.length) {
      try {
        return tryFly(game, flights[0]);
      } catch (e) {
        /* continue */
      }
    }
  }

  // J) Transfer remaining bank even without clear goal (leftover VP is weak)
  if (totalBank(player) >= 1000) {
    const xfer = dumpBankTransfer(player);
    if (xfer) {
      try {
        return tryTransfer(game, xfer);
      } catch (e) {
        /* continue */
      }
    }
  }

  // K) Hotel any affordable
  {
    const stay = bestHotelStay(player);
    if (stay && stay.score > 0) {
      try {
        game.bookHotel(stay.hotelId);
        return `stays at ${stay.name}`;
      } catch (e) {
        /* continue */
      }
    }
  }

  // L) Draw tickets if we finished ours or have few
  if (player.tickets.length < 2 && round >= 2) {
    try {
      game.drawTickets();
      if (player.turn.pendingTickets && player.turn.pendingTickets.length) {
        const sorted = [...player.turn.pendingTickets].sort(
          (a, b) => b.points - a.points
        );
        const keep = sorted.slice(0, Math.min(2, sorted.length)).map((t) => t.id);
        game.resolveTicketDraw(keep);
        return `draws trip tickets`;
      }
    } catch (e) {
      /* continue */
    }
  }

  // M) Second card if still room mid-game
  if (player.cards.length < game.cardLimit(player) && round <= 7) {
    const cardId = pickCard(game, player);
    if (cardId) {
      try {
        const def = game.applyForCard(cardId);
        return `applies for ${def.name}`;
      } catch (e) {
        /* continue */
      }
    }
  }

  // N) Rest only if truly stuck
  try {
    game.restPlan();
    return `rests / plans`;
  } catch (e) {
    return null;
  }
}

/**
 * Play full bot turn (income + all actions). Does not end turn.
 */
export function playBotActions(game) {
  const p = game.currentPlayer;
  const logs = [];
  if (!p.isBot) return { logs };

  // Income: re-roll if roll is weak vs best category
  if (!p.turn.incomeDone) {
    let alloc = game.autoAllocate(p);
    let exp = expectedIncome(game, p, alloc);
    const ceiling = bestCategoryEarn(game, p);
    if (
      p.cards.length &&
      (p.turn.spendRerollsLeft || 0) > 0 &&
      ceiling > 0 &&
      exp < ceiling * 0.45
    ) {
      try {
        game.rerollSpend();
        alloc = game.autoAllocate(p);
        exp = expectedIncome(game, p, alloc);
        logs.push(`${p.name} re-rolls for better spend categories`);
      } catch (e) {
        /* ignore */
      }
    }
    // If still weak, optionally force allocate budget to best earn categories
    if (p.cards.length && exp < ceiling * 0.5) {
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
      let bestCat = 'everything';
      let bestRate = 0;
      for (const cat of cats) {
        const { rate } = game.bestEarnRate(p, cat);
        if (rate > bestRate) {
          bestRate = rate;
          bestCat = cat;
        }
      }
      if (bestRate > 0) {
        alloc = { [bestCat]: GAME_CONFIG.budgetPerTurn };
        logs.push(`${p.name} redirects spend to ${bestCat} (${bestRate}×)`);
      }
    }
    const result = game.doIncome(alloc);
    logs.push(`${p.name} earns ~${result.totalEarned.toLocaleString()} pts`);
  }

  let safety = 0;
  while (p.turn.actionsLeft > 0 && safety++ < 12) {
    if (p.turn.pendingTickets && p.turn.pendingTickets.length) {
      const sorted = [...p.turn.pendingTickets].sort(
        (a, b) => b.points - a.points
      );
      const keep = sorted.slice(0, Math.min(2, sorted.length)).map((t) => t.id);
      try {
        game.resolveTicketDraw(keep);
        logs.push(`${p.name} keeps trip ticket(s)`);
      } catch (e) {
        break;
      }
      continue;
    }
    const desc = doOneAction(game, p);
    if (!desc) break;
    logs.push(`${p.name} ${desc}`);
  }

  return { logs };
}

export function isBotPlayer(player) {
  return !!(player && player.isBot);
}
