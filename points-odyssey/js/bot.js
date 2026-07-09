/**
 * Points Odyssey — bot AI strategies
 *
 * Priorities (high → low):
 * 1. Income (lifestyle roll as-is; optional re-roll if 0 earn expected)
 * 2. Open a second card that fits spend profile (if under limit)
 * 3. Fly to complete trip tickets (visit missing endpoint)
 * 4. Book hotel if points allow (VP-efficient)
 * 5. Transfer bank → airline/hotel partners needed for goals
 * 6. Expand map / rest
 */

import {
  CREDIT_CARDS,
  CITIES,
  TRANSFERS,
  listFlightOptions,
  GAME_CONFIG,
} from './data.js';

/** Preferred extra cards by character (beyond starter) */
const CARD_PREFS = {
  consultant: ['csp', 'csr', 'bilt_card'],
  family: ['csp', 'cfu', 'custom_cash'],
  nomad: ['csp', 'bilt_card', 'strata'],
  foodie: ['amex_gold', 'csp', 'cfu'],
  landlord: ['cfu', 'csp', 'custom_cash'],
  executive: ['amex_plat', 'amex_gold', 'csr', 'csp'],
};

const BANK_PARTNERS = {
  chase: [
    { id: 'united', type: 'airline' },
    { id: 'hyatt', type: 'hotel' },
    { id: 'marriott', type: 'hotel' },
  ],
  amex: [
    { id: 'delta', type: 'airline' },
    { id: 'hilton', type: 'hotel' },
    { id: 'marriott', type: 'hotel' },
  ],
  citi: [
    { id: 'american', type: 'airline' },
    { id: 'hilton', type: 'hotel' },
  ],
  bilt: [
    { id: 'united', type: 'airline' },
    { id: 'american', type: 'airline' },
    { id: 'hyatt', type: 'hotel' },
    { id: 'marriott', type: 'hotel' },
  ],
};

function expectedIncome(game, player, alloc) {
  let total = 0;
  for (const [cat, spend] of Object.entries(alloc || {})) {
    if (!spend) continue;
    const { rate } = game.bestEarnRate(player, cat);
    total += Math.floor(spend * rate);
  }
  return total;
}

function missingTicketCities(player) {
  const missing = [];
  for (const t of player.tickets) {
    if (!player.visited.has(t.from)) missing.push({ city: t.from, ticket: t });
    if (!player.visited.has(t.to)) missing.push({ city: t.to, ticket: t });
  }
  // Prefer higher VP tickets
  missing.sort((a, b) => b.ticket.points - a.ticket.points);
  return missing;
}

function cheapestFlightTo(player, dest) {
  const opts = listFlightOptions(player.city);
  const candidates = [];
  for (const o of opts) {
    if (o.to !== dest) continue;
    for (const air of o.airlines) {
      const bal = player.airlines[air] || 0;
      let cost = o.baseCost;
      if (player.character.special === 'cheap_flight' && (player.turn.flightsThisTurn || 0) === 0) {
        cost = Math.floor(cost * 0.9);
      }
      if (player.turn && player.turn.flightMult) {
        cost = Math.floor(cost * player.turn.flightMult);
      }
      if (bal >= cost) {
        candidates.push({ to: o.to, via: o.via, airline: air, cost, stops: o.stops });
      }
    }
  }
  candidates.sort((a, b) => a.cost - b.cost || a.stops - b.stops);
  return candidates[0] || null;
}

function anyAffordableFlight(player) {
  const opts = listFlightOptions(player.city);
  const out = [];
  for (const o of opts) {
    for (const air of o.airlines) {
      let cost = Math.floor(o.baseCost * ((player.turn && player.turn.flightMult) || 1));
      if (player.character.special === 'cheap_flight' && (player.turn.flightsThisTurn || 0) === 0) {
        cost = Math.floor(cost * 0.9);
      }
      if ((player.airlines[air] || 0) >= cost) {
        out.push({ to: o.to, via: o.via, airline: air, cost, stops: o.stops });
      }
    }
  }
  out.sort((a, b) => a.cost - b.cost);
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
    if ((player.hotels[h.brand] || 0) < cost) continue;
    const vp = Math.round((h.vp || 2) * vpMult);
    const score = free ? vp + 10 : vp / Math.max(cost, 1);
    if (!best || score > best.score) {
      best = { hotelId: h.id, cost, vp, score, name: h.name };
    }
  }
  return best;
}

function richestBank(player, min = 1000) {
  let best = null;
  let amt = min - 1;
  for (const [b, v] of Object.entries(player.banks)) {
    if (v > amt) {
      amt = v;
      best = b;
    }
  }
  return best ? { bank: best, amount: amt } : null;
}

function needsMiles(player) {
  // Need miles if we have open tickets and can't fly anywhere useful
  if (!player.tickets.length) {
    return Object.values(player.airlines).every((v) => v < 8000);
  }
  const missing = missingTicketCities(player);
  if (!missing.length) return false;
  // Can we reach any missing city already?
  for (const m of missing) {
    if (cheapestFlightTo(player, m.city)) return false;
  }
  return true;
}

function needsHotelPoints(player) {
  const city = CITIES[player.city];
  if (!city) return false;
  const stay = bestHotelStay(player);
  if (stay) return false;
  // Have bank points but no hotel currency
  const bank = richestBank(player, 8000);
  if (!bank) return false;
  const hotelBal = Object.values(player.hotels).reduce((s, v) => s + v, 0);
  return hotelBal < 12000;
}

function pickTransfer(player) {
  const bankInfo = richestBank(player, 1000);
  if (!bankInfo) return null;
  const { bank, amount } = bankInfo;
  const partners = BANK_PARTNERS[bank] || [];
  if (!partners.length) return null;

  const wantMiles = needsMiles(player);
  const wantHotel = needsHotelPoints(player) || (player.turn && player.turn.freeNightAvailable);

  // Prefer transfer bonus partner
  const bonus = player.turn && player.turn.transferBonus;

  let ordered = [...partners];
  if (wantMiles) {
    ordered = [
      ...partners.filter((p) => p.type === 'airline'),
      ...partners.filter((p) => p.type === 'hotel'),
    ];
  } else if (wantHotel) {
    ordered = [
      ...partners.filter((p) => p.type === 'hotel'),
      ...partners.filter((p) => p.type === 'airline'),
    ];
  }
  // Hyatt preferred for hotel value
  ordered.sort((a, b) => {
    if (bonus && a.id === bonus.partner) return -1;
    if (bonus && b.id === bonus.partner) return 1;
    if (a.id === 'hyatt') return -1;
    if (b.id === 'hyatt') return 1;
    return 0;
  });

  const partner = ordered[0];
  if (!partner) return null;
  const xferAmt = Math.min(amount, Math.max(1000, Math.floor(amount * 0.6)));
  if (xferAmt < 1000) return null;
  // Round down to 1000s
  const rounded = Math.floor(xferAmt / 1000) * 1000;
  if (rounded < 1000) return null;
  return { bank, partner: partner.id, amount: rounded };
}

function pickCard(game, player) {
  if (player.cards.length >= game.cardLimit(player)) return null;
  const held = new Set(player.cards.map((c) => c.id));
  const prefs = CARD_PREFS[player.character.id] || ['csp', 'cfu', 'amex_blue'];
  for (const id of prefs) {
    if (held.has(id)) continue;
    if (CREDIT_CARDS.some((c) => c.id === id)) return id;
  }
  for (const c of CREDIT_CARDS) {
    if (!held.has(c.id)) return c.id;
  }
  return null;
}

/**
 * Choose and execute one action. Returns description string or null if none.
 */
function doOneAction(game, player) {
  // Resolve pending ticket draw if any
  if (player.turn.pendingTickets && player.turn.pendingTickets.length) {
    const keep = [...player.turn.pendingTickets]
      .sort((a, b) => b.points - a.points)
      .slice(0, 1)
      .map((t) => t.id);
    game.resolveTicketDraw(keep);
    return `keeps trip ticket(s)`;
  }

  // Free night → hotel if possible
  if (player.turn.freeNightAvailable) {
    const stay = bestHotelStay(player);
    if (stay) {
      game.bookHotel(stay.hotelId);
      return `uses free night at ${stay.name}`;
    }
  }

  // 1) Card if early game / under limit and few cards
  if (player.cards.length < game.cardLimit(player) && player.cards.length < 2) {
    const cardId = pickCard(game, player);
    if (cardId) {
      try {
        const def = game.applyForCard(cardId);
        return `applies for ${def.name}`;
      } catch (e) {
        /* fall through */
      }
    }
  }

  // 2) Fly to complete tickets
  const missing = missingTicketCities(player);
  for (const m of missing) {
    if (m.city === player.city) continue;
    const flight = cheapestFlightTo(player, m.city);
    if (flight) {
      try {
        game.bookFlight(flight.to, flight.airline, flight.via);
        return `flies to ${flight.to}${flight.via ? ` via ${flight.via}` : ''} (${flight.airline}) for ticket`;
      } catch (e) {
        /* try next */
      }
    }
  }

  // 3) Hotel for VP if we can afford a good stay
  const stay = bestHotelStay(player);
  if (stay && (stay.vp >= 6 || stay.cost === 0 || player.nights < 3)) {
    try {
      game.bookHotel(stay.hotelId);
      return `stays at ${stay.name} (+${stay.vp} VP)`;
    } catch (e) {
      /* fall through */
    }
  }

  // 4) Transfer if we need miles/hotels or sitting on big bank balance
  const rich = richestBank(player, 10000);
  if (rich || needsMiles(player) || needsHotelPoints(player)) {
    const xfer = pickTransfer(player);
    if (xfer) {
      try {
        game.transferPoints(xfer.bank, xfer.partner, xfer.amount);
        return `transfers ${xfer.amount.toLocaleString()} ${xfer.bank} → ${xfer.partner}`;
      } catch (e) {
        /* fall through */
      }
    }
  }

  // 5) Open second card later if still room
  if (player.cards.length < game.cardLimit(player)) {
    const cardId = pickCard(game, player);
    if (cardId) {
      try {
        const def = game.applyForCard(cardId);
        return `applies for ${def.name}`;
      } catch (e) {
        /* fall through */
      }
    }
  }

  // 6) Any affordable flight (explore / ticket progress later)
  const flights = anyAffordableFlight(player);
  // Prefer unvisited cities
  flights.sort((a, b) => {
    const av = player.visited.has(a.to) ? 1 : 0;
    const bv = player.visited.has(b.to) ? 1 : 0;
    return av - bv || a.cost - b.cost;
  });
  if (flights.length) {
    const f = flights[0];
    try {
      game.bookFlight(f.to, f.airline, f.via);
      return `flies to ${f.to}${f.via ? ` via ${f.via}` : ''}`;
    } catch (e) {
      /* fall through */
    }
  }

  // 7) Hotel even if modest VP
  if (stay) {
    try {
      game.bookHotel(stay.hotelId);
      return `stays at ${stay.name}`;
    } catch (e) {
      /* fall through */
    }
  }

  // 8) Draw tickets if few open
  if (player.tickets.length < 2) {
    try {
      game.drawTickets();
      if (player.turn.pendingTickets && player.turn.pendingTickets.length) {
        const keep = [...player.turn.pendingTickets]
          .sort((a, b) => b.points - a.points)
          .slice(0, 1)
          .map((t) => t.id);
        game.resolveTicketDraw(keep);
        return `draws trip tickets`;
      }
    } catch (e) {
      /* fall through */
    }
  }

  // 9) Transfer leftover bank
  const xfer2 = pickTransfer(player);
  if (xfer2) {
    try {
      game.transferPoints(xfer2.bank, xfer2.partner, xfer2.amount);
      return `transfers ${xfer2.amount.toLocaleString()} ${xfer2.bank} → ${xfer2.partner}`;
    } catch (e) {
      /* fall through */
    }
  }

  // 10) Rest
  try {
    game.restPlan();
    return `rests / plans`;
  } catch (e) {
    return null;
  }
}

/**
 * Play a full bot turn: income + actions. Does NOT call endTurn.
 * @returns {{ logs: string[] }}
 */
export function playBotActions(game) {
  const p = game.currentPlayer;
  const logs = [];
  if (!p.isBot) return { logs };

  // Income phase
  if (!p.turn.incomeDone) {
    let alloc = game.autoAllocate(p);
    let exp = expectedIncome(game, p, alloc);
    // One re-roll if expected earn is 0 and we have cards
    if (exp === 0 && p.cards.length && (p.turn.spendRerollsLeft || 0) > 0) {
      try {
        game.rerollSpend();
        alloc = game.autoAllocate(p);
        logs.push(`${p.name} re-rolls lifestyle spend`);
      } catch (e) {
        /* ignore */
      }
    }
    const result = game.doIncome(alloc);
    logs.push(`${p.name} earns ~${result.totalEarned.toLocaleString()} pts`);
  }

  // Action phase
  let safety = 0;
  while (p.turn.actionsLeft > 0 && safety++ < 10) {
    // Handle pending tickets from mid-action draw without consuming extra
    if (p.turn.pendingTickets && p.turn.pendingTickets.length) {
      const keep = [...p.turn.pendingTickets]
        .sort((a, b) => b.points - a.points)
        .slice(0, 1)
        .map((t) => t.id);
      try {
        game.resolveTicketDraw(keep);
        logs.push(`${p.name} keeps a trip ticket`);
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
