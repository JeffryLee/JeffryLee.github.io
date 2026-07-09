/**
 * Points Odyssey bot — tuned via multi-game simulation for avg VP > 80.
 *
 * Best-performing loop from sims:
 *   card upgrade → finish tickets → hotel stays → hotel tour →
 *   ticket progress → balanced transfers → burn miles
 */

import {
  CREDIT_CARDS,
  CITIES,
  ROUTES,
  TRANSFERS,
  listFlightOptions,
  GAME_CONFIG,
} from './data.js';

/**
 * Second card must expand transfer reach — starter already covers one bank.
 * Chase-only cannot reach Delta-only cities (e.g. MSP); Amex-only misses United/Hyatt.
 */
const CARD_PREFS = {
  consultant: ['bilt_card', 'amex_gold', 'csp'], // starter CFU (Chase) → add Bilt/Amex
  family: ['amex_gold', 'bilt_card', 'csp'], // starter CFF (Chase) → need Delta/AA
  nomad: ['amex_gold', 'bilt_card', 'csp'], // starter CFU
  foodie: ['amex_gold', 'csp', 'bilt_card'], // starter Custom Cash (Citi)
  landlord: ['csp', 'amex_gold', 'strata'], // starter Bilt → add Chase/Amex
  executive: ['csp', 'bilt_card', 'amex_gold'], // starter Blue (Amex) → need UA/Hyatt
};

function buildAdj() {
  const adj = {};
  for (const r of ROUTES) {
    (adj[r.a] = adj[r.a] || []).push(r.b);
    (adj[r.b] = adj[r.b] || []).push(r.a);
  }
  return adj;
}
const ADJ = buildAdj();

function hops(a, b) {
  if (a === b) return 0;
  const seen = new Set([a]);
  const q = [[a, 0]];
  while (q.length) {
    const [c, d] = q.shift();
    for (const n of ADJ[c] || []) {
      if (seen.has(n)) continue;
      if (n === b) return d + 1;
      seen.add(n);
      q.push([n, d + 1]);
    }
  }
  return 99;
}

function nextHop(from, to) {
  if (from === to) return null;
  const parent = { [from]: null };
  const q = [from];
  while (q.length) {
    const c = q.shift();
    for (const n of ADJ[c] || []) {
      if (parent[n] !== undefined) continue;
      parent[n] = c;
      if (n === to) {
        let x = to;
        while (parent[x] !== from && parent[x] != null) x = parent[x];
        return x;
      }
      q.push(n);
    }
  }
  return null;
}

const sum = (o) => Object.values(o || {}).reduce((a, b) => a + (b || 0), 0);

function fCost(p, base) {
  let c = Math.floor(base * ((p.turn && p.turn.flightMult) || 1));
  if (p.character.special === 'polished_routes') {
    c = Math.floor(c * 0.85);
  }
  if (p.character.special === 'cheap_flight' && !(p.turn && p.turn.flightsThisTurn)) {
    c = Math.floor(c * 0.85);
  }
  return c;
}

function hCost(p, h) {
  if (p.turn && p.turn.freeNightAvailable) return 0;
  let mult =
    ((p.turn && p.turn.hotelMult) || 1) * (GAME_CONFIG.hotelCostMultiplier || 1);
  if (p.character.special === 'group_rate') mult *= 0.9;
  return Math.floor(h.cost * mult);
}

function hVp(p, h, cityId) {
  let vp = Math.round((h.vp || 2) * (GAME_CONFIG.hotelVpMultiplier || 1));
  if (!(p._hotelCities && p._hotelCities.has(cityId))) vp += 1;
  vp += (p.turn && p.turn.hotelVpBonus) || 0;
  return vp;
}

function gaps(p) {
  const out = [];
  for (const t of p.tickets) {
    const need = [];
    if (!p.visited.has(t.from)) need.push(t.from);
    if (!p.visited.has(t.to)) need.push(t.to);
    for (const city of need) out.push({ city, t, vp: t.points, rem: need.length });
  }
  out.sort(
    (a, b) =>
      a.rem - b.rem || b.vp - a.vp || hops(p.city, a.city) - hops(p.city, b.city)
  );
  return out;
}

function flightsTo(p, dest) {
  const rows = [];
  for (const o of listFlightOptions(p.city)) {
    if (o.to !== dest) continue;
    for (const air of o.airlines) {
      const cost = fCost(p, o.baseCost);
      const bal = p.airlines[air] || 0;
      rows.push({
        to: o.to,
        via: o.via,
        air,
        cost,
        ok: bal >= cost,
        need: Math.max(0, cost - bal),
      });
    }
  }
  rows.sort((a, b) => (a.ok === b.ok ? 0 : a.ok ? -1 : 1) || a.cost - b.cost);
  return rows;
}

function anyFly(p) {
  const rows = [];
  for (const o of listFlightOptions(p.city)) {
    for (const air of o.airlines) {
      const cost = fCost(p, o.baseCost);
      if ((p.airlines[air] || 0) >= cost) {
        rows.push({ to: o.to, via: o.via, air, cost });
      }
    }
  }
  return rows;
}

function bestStay(p) {
  const city = CITIES[p.city];
  if (!city) return null;
  let best = null;
  for (const h of city.hotels || []) {
    if (p.stayedHotels.has(h.id)) continue;
    const cost = hCost(p, h);
    if ((p.hotels[h.brand] || 0) < cost) continue;
    const vp = hVp(p, h, city.id);
    // Prefer higher VP; break ties with lower cost (hyatt over hilton)
    if (
      !best ||
      vp > best.vp ||
      (vp === best.vp && cost < best.cost)
    ) {
      best = { id: h.id, brand: h.brand, cost, vp, name: h.name };
    }
  }
  return best;
}

function bookableStays(p) {
  const out = [];
  for (const city of Object.values(CITIES)) {
    for (const h of city.hotels || []) {
      if (p.stayedHotels.has(h.id)) continue;
      const cost = hCost(p, h);
      if ((p.hotels[h.brand] || 0) < cost) continue;
      out.push({
        city: city.id,
        id: h.id,
        brand: h.brand,
        cost,
        vp: hVp(p, h, city.id),
        name: h.name,
        dist: hops(p.city, city.id),
      });
    }
  }
  out.sort((a, b) => b.vp - a.vp || a.dist - b.dist || a.cost - b.cost);
  return out;
}

function bankList(p) {
  return Object.entries(p.banks)
    .filter(([, v]) => v >= 1000)
    .sort((a, b) => b[1] - a[1])
    .map(([bank, amount]) => ({ bank, amount }));
}

function makeXfer(p, kind, specific, minAmt = 10000) {
  const bonus = p.turn && p.turn.transferBonus;
  for (const { bank, amount } of bankList(p)) {
    const partners = TRANSFERS[bank];
    if (!partners) continue;

    let partner = null;
    // If a specific partner is required, this bank must support it (no silent fallback)
    if (specific) {
      if (!partners[specific]) continue;
      partner = specific;
    } else if (bonus && partners[bonus.partner]) {
      if (!kind || partners[bonus.partner].type === kind) partner = bonus.partner;
    }
    if (!partner && kind === 'airline') {
      partner =
        (partners.united && 'united') ||
        (partners.delta && 'delta') ||
        (partners.american && 'american') ||
        null;
    }
    if (!partner && kind === 'hotel') {
      partner =
        (partners.hyatt && 'hyatt') ||
        (partners.marriott && 'marriott') ||
        (partners.hilton && 'hilton') ||
        null;
    }
    if (!partner || !partners[partner]) continue;

    let amt = Math.min(amount, Math.max(minAmt, Math.floor(amount * 0.7)));
    if (bonus && partner === bonus.partner) amt = Math.floor(amount / 1000) * 1000;
    amt = Math.floor(amt / 1000) * 1000;
    if (amt >= 1000) return { bank, partner, amount: amt };
  }
  return null;
}

function incomeAlloc(game, p) {
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
  let best = 'everything';
  let br = 0;
  for (const c of cats) {
    const r = game.bestEarnRate(p, c).rate;
    if (r > br) {
      br = r;
      best = c;
    }
  }
  if (p.character.special === 'dining_bonus') {
    const dr = game.bestEarnRate(p, 'dining').rate;
    if (dr > 0 && best !== 'dining') return { dining: 4000, [best]: 1000 };
    if (dr > 0) return { dining: GAME_CONFIG.budgetPerTurn };
  }
  return { [best]: GAME_CONFIG.budgetPerTurn };
}

function keepTickets(p, pending, round) {
  const score = (t) =>
    t.points +
    (p.visited.has(t.from) ? 45 : 0) +
    (p.visited.has(t.to) ? 45 : 0) +
    (t.from === p.city || t.to === p.city ? 20 : 0) +
    Math.max(0, 14 - hops(t.from, t.to) * 4);
  const ranked = [...pending].sort((a, b) => score(b) - score(a));
  const keep = [ranked[0].id];
  if (ranked[1]) {
    const t = ranked[1];
    if (
      p.visited.has(t.from) ||
      p.visited.has(t.to) ||
      hops(t.from, t.to) <= 2 ||
      (round <= 3 && t.points >= 14)
    ) {
      keep.push(t.id);
    }
  }
  return keep;
}

function ok(fn) {
  try {
    fn();
    return true;
  } catch (e) {
    return false;
  }
}

function doOneAction(game, p) {
  if (p.turn.pendingTickets && p.turn.pendingTickets.length) {
    game.resolveTicketDraw(keepTickets(p, p.turn.pendingTickets, game.round || 1));
    return 'keeps tickets';
  }

  const round = game.round || 1;
  const g = gaps(p);
  const stay = bestStay(p);
  const air = sum(p.airlines);
  const hot = sum(p.hotels);
  const bank = sum(p.banks);
  const stays = bookableStays(p);
  const late = round >= 7;

  // A) Upgrade card early (round 1–3, still on starter)
  if (p.cards.length === 1 && round <= 3) {
    const held = new Set(p.cards.map((c) => c.id));
    for (const id of CARD_PREFS[p.character.id] || []) {
      if (!held.has(id) && ok(() => game.applyForCard(id))) return `card ${id}`;
    }
  }

  // B) Finish ticket (1 city left)
  for (const x of g) {
    if (x.rem !== 1 || x.city === p.city) continue;
    const f = flightsTo(p, x.city).find((f) => f.ok);
    if (f && ok(() => game.bookFlight(f.to, f.air, f.via || null))) {
      return `FINISH ${f.to} +${x.vp}`;
    }
  }
  for (const x of g) {
    if (x.rem !== 1 || x.city === p.city) continue;
    for (const f of flightsTo(p, x.city).slice(0, 6)) {
      if (f.ok) continue;
      const plan = makeXfer(p, 'airline', f.air, Math.max(10000, f.need));
      if (plan && ok(() => game.transferPoints(plan.bank, plan.partner, plan.amount))) {
        return `fuel FINISH`;
      }
    }
  }

  // C) Hotel here — main VP engine
  if (stay && ok(() => game.bookHotel(stay.id))) {
    return `hotel ${stay.name} +${stay.vp}`;
  }

  // D) Ticket progress (avoid open-ticket penalties)
  for (const x of g) {
    if (x.city === p.city) continue;
    const f = flightsTo(p, x.city).find((f) => f.ok);
    if (f && ok(() => game.bookFlight(f.to, f.air, f.via || null))) {
      return `ticket ${f.to}`;
    }
  }
  // Fuel + hop for tickets (limit churn: only top 2 gaps)
  for (const x of g.slice(0, 2)) {
    if (x.city === p.city) continue;
    for (const f of flightsTo(p, x.city).slice(0, 4)) {
      if (f.ok) continue;
      const plan = makeXfer(p, 'airline', f.air, Math.max(10000, f.need));
      if (plan && ok(() => game.transferPoints(plan.bank, plan.partner, plan.amount))) {
        return `fuel ticket`;
      }
    }
    const hop = nextHop(p.city, x.city);
    if (hop) {
      const f = flightsTo(p, hop).find((f) => f.ok);
      if (f && ok(() => game.bookFlight(f.to, f.air, f.via || null))) return `hop ${hop}`;
      for (const fl of flightsTo(p, hop).slice(0, 3)) {
        if (fl.ok) continue;
        const plan = makeXfer(p, 'airline', fl.air, Math.max(8000, fl.need));
        if (plan && ok(() => game.transferPoints(plan.bank, plan.partner, plan.amount))) {
          return `fuel hop`;
        }
      }
    }
  }

  // E) Hotel tour — spend hotel pts (need miles)
  for (const h of stays) {
    if (h.city === p.city) continue;
    const f = flightsTo(p, h.city).find((f) => f.ok);
    if (f && ok(() => game.bookFlight(f.to, f.air, f.via || null))) {
      return `→hotel ${h.city}`;
    }
  }
  if (stays.length && stays[0].city !== p.city) {
    const hop = nextHop(p.city, stays[0].city);
    if (hop) {
      const f = flightsTo(p, hop).find((f) => f.ok);
      if (f && ok(() => game.bookFlight(f.to, f.air, f.via || null))) return `hop hotel`;
    }
  }
  if (stays.length && air < 12000 && bank >= 1000) {
    const plan = makeXfer(p, 'airline', null, 12000);
    if (plan && ok(() => game.transferPoints(plan.bank, plan.partner, plan.amount))) {
      return `fuel hotel tour`;
    }
  }

  // F) Stock portfolio
  if (bank >= 1000) {
    let plan = null;
    if (p.turn && p.turn.transferBonus) {
      plan = makeXfer(p, null, p.turn.transferBonus.partner, 10000);
    }
    // Keep hotels funded for stays — but not when we have zero miles to tour
    if (!plan && hot < 20000 && (air >= 8000 || !g.length)) {
      plan = makeXfer(p, 'hotel', 'hyatt', 12000) || makeXfer(p, 'hotel', null, 10000);
    }
    if (!plan && (air < 15000 || g.length)) {
      plan = makeXfer(p, 'airline', null, 12000);
    }
    if (!plan) {
      const hotEff =
        (p.hotels.hyatt || 0) +
        (p.hotels.marriott || 0) +
        (p.hotels.hilton || 0) * 0.4;
      plan =
        hotEff < air
          ? makeXfer(p, 'hotel', null, 10000)
          : makeXfer(p, 'airline', null, 10000);
    }
    if (plan && ok(() => game.transferPoints(plan.bank, plan.partner, plan.amount))) {
      return `xfer→${plan.partner}`;
    }
  }

  // G) Burn miles productively
  {
    const hc = new Set(stays.map((s) => s.city));
    const tc = new Set(g.map((x) => x.city));
    const flights = anyFly(p).sort((a, b) => {
      const sc = (f) =>
        (tc.has(f.to) ? 50 : 0) +
        (hc.has(f.to) ? 45 : 0) +
        (p.visited.has(f.to) ? 0 : 10) -
        f.cost / 5000;
      return sc(b) - sc(a);
    });
    for (const f of flights.slice(0, 18)) {
      if (ok(() => game.bookFlight(f.to, f.air, f.via || null))) return `fly ${f.to}`;
    }
  }

  // H) Tickets draw
  if (p.tickets.length === 0 && round >= 2 && round <= 6) {
    if (
      ok(() => {
        game.drawTickets();
        if (p.turn.pendingTickets) {
          game.resolveTicketDraw(keepTickets(p, p.turn.pendingTickets, round));
        }
      })
    ) {
      return 'draw tickets';
    }
  }

  // I) Late dump to hotels then miles
  if (bank >= 1000) {
    const plan = makeXfer(
      p,
      late || hot < 25000 ? 'hotel' : 'airline',
      null,
      8000
    );
    if (plan && ok(() => game.transferPoints(plan.bank, plan.partner, plan.amount))) {
      return `dump→${plan.partner}`;
    }
  }

  if (ok(() => game.restPlan())) return 'rest';
  return null;
}

export function playBotActions(game) {
  const p = game.currentPlayer;
  const logs = [];
  if (!p.isBot) return { logs };

  if (!p.turn.incomeDone) {
    const r = game.doIncome(incomeAlloc(game, p));
    logs.push(`${p.name} +${r.totalEarned.toLocaleString()}`);
  }

  let n = 0;
  while (p.turn.actionsLeft > 0 && n++ < 14) {
    if (p.turn.pendingTickets && p.turn.pendingTickets.length) {
      try {
        game.resolveTicketDraw(
          keepTickets(p, p.turn.pendingTickets, game.round || 1)
        );
        logs.push(`${p.name} keeps tickets`);
      } catch (e) {
        break;
      }
      continue;
    }
    const label = doOneAction(game, p);
    if (!label) break;
    logs.push(`${p.name} ${label}`);
  }
  return { logs };
}

export function isBotPlayer(player) {
  return !!(player && player.isBot);
}
