/**
 * Points Odyssey bot — strategy for current rules:
 *
 * Action economy (after income):
 *   1 free Transfer  ·  1 Build  ·  1 Travel
 *
 * Tickets & races are ORDERED: land origin, then later land destination.
 * Award seats:  limited per route per round (skip sold-out legs).
 *
 * Priority each turn:
 *   1) Travel that completes a ticket/race (or huge hotel VP)
 *   2) Free transfer that enables that Travel
 *   3) Travel that advances ordered goals (prefer flights that hit origin→dest in one itinerary)
 *   4) Build: diversify card early, draw tickets if empty, rest last
 */

import {
  CREDIT_CARDS,
  CITIES,
  ROUTES,
  TRANSFERS,
  listFlightOptions,
  GAME_CONFIG,
} from './data.js?v=spendui1';

/**
 * Second+ cards: prefer non-Chase partners first so residual bank mix diversifies.
 * (Chase still available later via csp/csr when needed for Hyatt/UA.)
 */
const CARD_PREFS = {
  consultant: ['amex_gold', 'bilt_card', 'strata', 'csp'],
  family: ['amex_gold', 'strata', 'bilt_card', 'csp'],
  nomad: ['bilt_card', 'amex_gold', 'strata', 'csp'],
  foodie: ['amex_gold', 'strata', 'amex_blue', 'bilt_card'],
  landlord: ['strata', 'amex_gold', 'csp', 'double_cash'],
  executive: ['amex_plat', 'amex_gold', 'bilt_card', 'strata', 'csr'],
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
  if (p.character.special === 'polished_routes') c = Math.floor(c * 0.85);
  if (p.character.special === 'cheap_flight' && !(p.turn && p.turn.flightsThisTurn)) {
    c = Math.floor(c * 0.7);
  }
  return c;
}

function hCost(p, h) {
  if (p.turn && p.turn.freeNightAvailable) return 0;
  let mult =
    ((p.turn && p.turn.hotelMult) || 1) * (GAME_CONFIG.hotelCostMultiplier || 1);
  if (p.character.special === 'group_rate') mult *= 0.75;
  return Math.floor(h.cost * mult);
}

function hVp(p, h, cityId) {
  let vp = Math.round((h.vp || 2) * (GAME_CONFIG.hotelVpMultiplier || 1));
  if (!(p._hotelCities && p._hotelCities.has(cityId))) vp += 1;
  vp += (p.turn && p.turn.hotelVpBonus) || 0;
  if (p.character.special === 'group_rate') vp += 3;
  return vp;
}

/** Ordered ticket progress from journey. */
function ticketProg(p, t) {
  const journey = p.journey || [];
  let origin = false;
  let dest = false;
  for (let i = 0; i < journey.length; i++) {
    if (!origin) {
      if (journey[i] === t.from) origin = true;
    } else if (journey[i] === t.to) {
      dest = true;
      break;
    }
  }
  return { origin, dest, complete: origin && dest };
}

/**
 * Simulate landings after a flight; does this itinerary complete / advance a ticket?
 * landings = cities landed in order (via then dest, or just dest)
 */
function simProgress(p, t, landings) {
  let origin = ticketProg(p, t).origin;
  let dest = false;
  let advanced = false;
  for (const city of landings) {
    if (!origin) {
      if (city === t.from) {
        origin = true;
        advanced = true;
      }
    } else if (city === t.to) {
      dest = true;
      advanced = true;
      break;
    }
  }
  return { origin, dest, complete: origin && dest, advanced };
}

/** Airline still has award inventory this round (1 itinerary = 1 ticket). */
function awardsOk(game, airline) {
  if (typeof game.awardsLeft === 'function') {
    return game.awardsLeft(airline) > 0;
  }
  if (game.airlineAwards && game.airlineAwards[airline] != null) {
    return game.airlineAwards[airline] > 0;
  }
  return true;
}

/** Private tickets + public race goals as ordered objectives. */
function goals(game, p) {
  const round = game.round || 1;
  const maxR = game.maxRounds || GAME_CONFIG.maxRounds || 10;
  const lateFactor = round / maxR;
  const out = [];

  const pushGoal = (t, race) => {
    const prog = ticketProg(p, t);
    if (prog.complete) return;
    const next = prog.origin ? t.to : t.from;
    const rem = prog.origin ? 1 : 2;
    let vp = t.points + (race ? GAME_CONFIG.raceGoalBonusVp || 3 : 0);
    if (p.character.special === 'polished_routes' && !race) vp += 1;
    if (p.character.special === 'cheap_flight' && !race) vp += 1;
    // Late game: incomplete private tickets hurt — weight penalty avoidance
    if (!race && t.penalty) vp += Math.round(t.penalty * (0.5 + lateFactor));
    // Race: slightly prefer when rem=1 (snipe)
    if (race && rem === 1) vp += 2;
    out.push({
      city: next,
      t,
      vp,
      rem,
      race: !!race,
      needOrigin: !prog.origin,
    });
  };

  for (const t of p.tickets || []) pushGoal(t, false);
  for (const t of game.raceGoals || []) pushGoal(t, true);

  out.sort(
    (a, b) =>
      a.rem - b.rem ||
      b.vp - a.vp ||
      hops(p.city, a.city) - hops(p.city, b.city)
  );
  return out;
}

function flightsTo(game, p, dest) {
  const rows = [];
  for (const o of listFlightOptions(p.city)) {
    if (o.to !== dest) continue;
    for (const air of o.airlines) {
      if (!awardsOk(game, air)) continue;
      const cost = fCost(p, o.baseCost);
      const bal = p.airlines[air] || 0;
      rows.push({
        to: o.to,
        via: o.via,
        air,
        cost,
        ok: bal >= cost,
        need: Math.max(0, cost - bal),
        landings: o.via ? [o.via, o.to] : [o.to],
      });
    }
  }
  rows.sort((a, b) => (a.ok === b.ok ? 0 : a.ok ? -1 : 1) || a.cost - b.cost);
  return rows;
}

/** All affordable flights with airline award inventory (for scoring). */
function affordableFlights(game, p) {
  const rows = [];
  for (const o of listFlightOptions(p.city)) {
    for (const air of o.airlines) {
      if (!awardsOk(game, air)) continue;
      const cost = fCost(p, o.baseCost);
      if ((p.airlines[air] || 0) < cost) continue;
      rows.push({
        to: o.to,
        via: o.via,
        air,
        cost,
        landings: o.via ? [o.via, o.to] : [o.to],
      });
    }
  }
  return rows;
}

function hotelTaken(game, hotelId) {
  return !!(game && game.hotelClaims && game.hotelClaims[hotelId]);
}

function bestStay(p, game) {
  const city = CITIES[p.city];
  if (!city) return null;
  let best = null;
  for (const h of city.hotels || []) {
    if (hotelTaken(game, h.id) || p.stayedHotels.has(h.id)) continue;
    const cost = hCost(p, h);
    if ((p.hotels[h.brand] || 0) < cost) continue;
    const vp = hVp(p, h, city.id);
    if (!best || vp > best.vp || (vp === best.vp && cost < best.cost)) {
      best = { id: h.id, brand: h.brand, cost, vp, name: h.name };
    }
  }
  return best;
}

function bookableStays(p, game) {
  const out = [];
  for (const city of Object.values(CITIES)) {
    for (const h of city.hotels || []) {
      if (hotelTaken(game, h.id) || p.stayedHotels.has(h.id)) continue;
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
    if (specific) {
      if (!partners[specific]) continue;
      partner = specific;
    } else if (bonus && partners[bonus.partner]) {
      if (!kind || partners[bonus.partner].type === kind) partner = bonus.partner;
    }
    if (!partner && kind === 'airline') {
      // Prefer the thinnest airline balance (and de-prioritize UA pile-up)
      const opts = ['delta', 'american', 'united'].filter((a) => partners[a]);
      if (opts.length) {
        opts.sort(
          (a, b) =>
            (p.airlines[a] || 0) - (p.airlines[b] || 0) ||
            (a === 'united' ? 1 : 0) - (b === 'united' ? 1 : 0)
        );
        partner = opts[0];
      }
    }
    if (!partner && kind === 'hotel') {
      partner =
        (partners.hyatt && 'hyatt') ||
        (partners.marriott && 'marriott') ||
        (partners.hilton && 'hilton') ||
        null;
    }
    if (!partner || !partners[partner]) continue;

    let amt = Math.min(amount, Math.max(minAmt, Math.floor(amount * 0.75)));
    if (bonus && partner === bonus.partner) amt = Math.floor(amount / 1000) * 1000;
    amt = Math.floor(amt / 1000) * 1000;
    if (amt >= 1000) return { bank, partner, amount: amt };
  }
  return null;
}

function canTransfer(p) {
  return (
    (p.turn.freeTransferLeft || 0) > 0 || (p.turn.buildLeft || 0) > 0
  );
}

function canTravel(p) {
  return (p.turn.travelLeft || 0) > 0;
}

function canBuild(p) {
  return (p.turn.buildLeft || 0) > 0;
}

/** Bots refresh earn prefs when card set changes. */
function ensureBotEarnPrefs(game, p) {
  if (!p.cards.length) return;
  const n = p.cards.length;
  if (p._botPrefsCards === n) return;
  p._botPrefsCards = n;
  if (typeof game.initDefaultEarnPrefs === 'function') {
    game.initDefaultEarnPrefs(p);
  }
}

function keepTickets(p, pending, round) {
  const maxR = GAME_CONFIG.maxRounds || 10;
  const score = (t) => {
    const prog = ticketProg(p, t);
    const dist = hops(p.city, prog.origin ? t.to : t.from);
    return (
      t.points +
      (prog.origin ? 55 : 0) +
      (p.city === t.from ? 45 : 0) +
      // Prefer short remaining path for ordered tickets
      Math.max(0, 20 - dist * 5) +
      (t.points <= 10 ? 12 : 0) +
      // Late: avoid high-penalty long tickets
      (round >= maxR - 2 ? -t.penalty * 2 : 0) +
      (round >= maxR - 2 && hops(t.from, t.to) > 3 ? -15 : 0)
    );
  };
  const ranked = [...pending].sort((a, b) => score(b) - score(a));
  const keep = [ranked[0].id];
  // Keep second only if completable / origin already done / early game short
  if (ranked[1]) {
    const t = ranked[1];
    const prog = ticketProg(p, t);
    if (
      prog.origin ||
      p.city === t.from ||
      hops(t.from, t.to) <= 2 ||
      (round <= 4 && t.points >= 12 && hops(p.city, t.from) <= 2)
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

/**
 * Score a flight option against goals (higher = better Travel use).
 */
function scoreFlight(p, f, gList) {
  let sc = 0;
  for (const g of gList) {
    const sim = simProgress(p, g.t, f.landings);
    if (sim.complete) sc += 100 + g.vp * 3 + (g.race ? 15 : 0);
    else if (sim.advanced) sc += 40 + g.vp + (g.rem === 2 ? 10 : 0);
    else if (f.landings.includes(g.city)) sc += 25 + g.vp * 0.5;
  }
  // Light bonus for new cities (Nomad / exploration)
  for (const c of f.landings) {
    if (!p.visited.has(c)) sc += p.character.special === 'cheap_flight' ? 12 : 3;
  }
  sc -= f.cost / 8000;
  return sc;
}

function tryBook(game, f) {
  return ok(() => game.bookFlight(f.to, f.air, f.via || null));
}

function tryXferForAirline(game, p, air, need) {
  if (!canTransfer(p)) return false;
  const plan = makeXfer(p, 'airline', air, Math.max(8000, need));
  if (!plan) return false;
  return ok(() => game.transferPoints(plan.bank, plan.partner, plan.amount));
}

function doOneAction(game, p) {
  if (p.turn.pendingTickets && p.turn.pendingTickets.length) {
    game.resolveTicketDraw(keepTickets(p, p.turn.pendingTickets, game.round || 1));
    return 'keeps tickets';
  }

  const round = game.round || 1;
  const maxR = game.maxRounds || GAME_CONFIG.maxRounds || 10;
  const gList = goals(game, p);
  const stay = bestStay(p, game);
  const air = sum(p.airlines);
  const hot = sum(p.hotels);
  const bank = sum(p.banks);
  const stays = bookableStays(p, game);
  const late = round >= maxR - 2;
  const travel = canTravel(p);
  const build = canBuild(p);
  const xfer = canTransfer(p);

  // ——— TRAVEL: best available flight by goal score ———
  if (travel) {
    const flights = affordableFlights(game, p);
    if (flights.length && gList.length) {
      let best = null;
      let bestSc = 0;
      for (const f of flights) {
        const sc = scoreFlight(p, f, gList);
        if (sc > bestSc) {
          bestSc = sc;
          best = f;
        }
      }
      // Only fly if it advances something meaningful (or burn miles late)
      if (best && bestSc >= 25 && tryBook(game, best)) {
        return bestSc >= 100 ? `FINISH→${best.to}` : `fly→${best.to}`;
      }
    }

    // Finish rem=1 goals (direct/one-stop) with fuel if needed
    for (const g of gList.filter((x) => x.rem === 1).slice(0, 4)) {
      if (g.city === p.city) continue;
      const opts = flightsTo(game, p, g.city);
      const ready = opts.find((f) => f.ok);
      if (ready && tryBook(game, ready)) return `FINISH ${g.city} +${g.vp}`;
      if (xfer) {
        for (const f of opts.slice(0, 5)) {
          if (f.ok) continue;
          if (tryXferForAirline(game, p, f.air, f.need)) return `fuel FINISH ${g.city}`;
        }
      }
    }

    // Hotel here if strong VP and no imminent ticket finish
    const topGap = gList[0];
    const canFinishSoon =
      topGap &&
      topGap.rem === 1 &&
      hops(p.city, topGap.city) <= 1 &&
      air >= 5000;
    // Family prioritizes claiming hotels while open
    const hotelFirst =
      p.character.special === 'group_rate' || stay?.vp >= 10 || late;
    if (
      stay &&
      (hotelFirst || !canFinishSoon || stay.vp >= 8) &&
      ok(() => game.bookHotel(stay.id))
    ) {
      return `hotel ${stay.name} +${stay.vp}`;
    }

    // Family (or high-VP hotel targets): fly toward claimable properties
    if (
      (p.character.special === 'group_rate' || late) &&
      stays.length &&
      (!canFinishSoon || p.character.special === 'group_rate')
    ) {
      const targets = stays
        .filter((s) => s.dist > 0 && s.dist <= 2)
        .sort((a, b) => b.vp - a.vp || a.dist - b.dist || a.cost - b.cost);
      for (const s of targets.slice(0, 4)) {
        const opts = flightsTo(game, p, s.city);
        const ready = opts.find((f) => f.ok);
        if (ready && tryBook(game, ready)) return `→hotel ${s.city}`;
        if (xfer) {
          for (const f of opts.slice(0, 3)) {
            if (!f.ok && tryXferForAirline(game, p, f.air, f.need)) {
              return `fuel hotel ${s.city}`;
            }
          }
        }
      }
    }

    // Advance rem=2: go to ORIGIN only (never dest first)
    for (const g of gList.filter((x) => x.needOrigin).slice(0, 3)) {
      if (g.city === p.city) continue;
      // Prefer itinerary that lands origin then continues toward dest
      const flights = affordableFlights(game, p).filter((f) =>
        f.landings.includes(g.t.from)
      );
      flights.sort(
        (a, b) =>
          scoreFlight(p, b, [g]) - scoreFlight(p, a, [g]) || a.cost - b.cost
      );
      if (flights[0] && tryBook(game, flights[0])) {
        return `origin ${g.t.from}`;
      }
      const opts = flightsTo(game, p, g.city);
      const ready = opts.find((f) => f.ok);
      if (ready && tryBook(game, ready)) return `→origin ${g.city}`;
      if (xfer) {
        for (const f of opts.slice(0, 4)) {
          if (!f.ok && tryXferForAirline(game, p, f.air, f.need)) {
            return `fuel origin`;
          }
        }
      }
      const hop = nextHop(p.city, g.city);
      if (hop) {
        const hopOpts = flightsTo(game, p, hop);
        const hf = hopOpts.find((f) => f.ok);
        if (hf && tryBook(game, hf)) return `hop ${hop}`;
        if (xfer) {
          for (const f of hopOpts.slice(0, 3)) {
            if (!f.ok && tryXferForAirline(game, p, f.air, f.need)) return `fuel hop`;
          }
        }
      }
    }

    // rem=1 remaining path hops
    for (const g of gList.filter((x) => x.rem === 1).slice(0, 3)) {
      const hop = nextHop(p.city, g.city);
      if (!hop) continue;
      const hopOpts = flightsTo(game, p, hop);
      const hf = hopOpts.find((f) => f.ok);
      if (hf && tryBook(game, hf)) return `hop→${g.city}`;
    }

    // Fly to hotel city if funded stay waiting
    if (stays.length && stays[0].city !== p.city && stays[0].vp >= 6) {
      const opts = flightsTo(game, p, stays[0].city);
      const f = opts.find((x) => x.ok);
      if (f && tryBook(game, f)) return `→hotel ${stays[0].city}`;
      const hop = nextHop(p.city, stays[0].city);
      if (hop) {
        const hf = flightsTo(game, p, hop).find((x) => x.ok);
        if (hf && tryBook(game, hf)) return `hop hotel`;
      }
    }

    // Productive mile burn: toward any goal or new city
    {
      const flights = affordableFlights(game, p);
      const tc = new Set(gList.map((x) => x.city));
      const hc = new Set(stays.map((s) => s.city));
      flights.sort((a, b) => {
        const sc = (f) =>
          (tc.has(f.to) ? 40 : 0) +
          (hc.has(f.to) ? 30 : 0) +
          (f.via && tc.has(f.via) ? 35 : 0) +
          (p.visited.has(f.to) ? 0 : 8) -
          f.cost / 6000;
        return sc(b) - sc(a);
      });
      for (const f of flights.slice(0, 12)) {
        if (tryBook(game, f)) return `explore ${f.to}`;
      }
    }
  }

  // ——— FREE / BUILD TRANSFER: enable next travel or stock ———
  if (xfer && bank >= 1000) {
    // Transfer bonus partner first
    if (p.turn.transferBonus) {
      const plan = makeXfer(p, null, p.turn.transferBonus.partner, 10000);
      if (plan && ok(() => game.transferPoints(plan.bank, plan.partner, plan.amount))) {
        return `bonus→${plan.partner}`;
      }
    }

    // Fuel specific airline for top goal
    if (gList.length && travel) {
      const g = gList[0];
      const opts = flightsTo(game, p, g.city);
      for (const f of opts.slice(0, 6)) {
        if (f.ok) continue;
        if (tryXferForAirline(game, p, f.air, Math.max(f.need, 10000))) {
          return `fuel ${f.air}`;
        }
      }
    }

    // Need miles for goals
    if (air < 12000 && gList.length) {
      const plan = makeXfer(p, 'airline', null, 12000);
      if (plan && ok(() => game.transferPoints(plan.bank, plan.partner, plan.amount))) {
        return `miles→${plan.partner}`;
      }
    }

    // Fund hotels when we have miles or no open goals
    if (hot < 18000 && (air >= 8000 || !gList.length || late)) {
      const plan =
        makeXfer(p, 'hotel', 'hyatt', 12000) || makeXfer(p, 'hotel', null, 10000);
      if (plan && ok(() => game.transferPoints(plan.bank, plan.partner, plan.amount))) {
        return `hotelPts→${plan.partner}`;
      }
    }

    // Default: balance toward the thinner currency
    {
      const hotEff =
        (p.hotels.hyatt || 0) +
        (p.hotels.marriott || 0) +
        (p.hotels.hilton || 0) * 0.45;
      const plan =
        hotEff < air * 0.7 && !gList.length
          ? makeXfer(p, 'hotel', null, 10000)
          : makeXfer(p, 'airline', null, 10000);
      if (plan && ok(() => game.transferPoints(plan.bank, plan.partner, plan.amount))) {
        return `xfer→${plan.partner}`;
      }
    }
  }

  // ——— BUILD: card / tickets / rest ———
  if (build) {
    // Diversify banks via cards (Executive can hold more — open through mid-game)
    const limit = typeof game.cardLimit === 'function' ? game.cardLimit(p) : 2;
    const cardRound = p.character.special === 'extra_card' ? 6 : 4;
    if (p.cards.length < limit && round <= cardRound) {
      const held = new Set(p.cards.map((c) => c.id));
      for (const id of CARD_PREFS[p.character.id] || []) {
        if (!held.has(id) && ok(() => game.applyForCard(id))) return `card ${id}`;
      }
      // Any unowned card as fallback
      for (const c of CREDIT_CARDS) {
        if (!held.has(c.id) && ok(() => game.applyForCard(c.id))) return `card ${c.id}`;
      }
    }

    // Draw tickets if empty or need more goals mid-game (not late with open penalties)
    const open = (p.tickets || []).length;
    if (open === 0 && round <= maxR - 2) {
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
    if (open <= 1 && round >= 3 && round <= maxR - 3 && gList.filter((x) => !x.race).length <= 1) {
      if (
        ok(() => {
          game.drawTickets();
          if (p.turn.pendingTickets) {
            game.resolveTicketDraw(keepTickets(p, p.turn.pendingTickets, round));
          }
        })
      ) {
        return 'draw more tickets';
      }
    }

    if (ok(() => game.restPlan())) return 'rest';
  }

  // Last resort: transfer leftover bank if free slot remains
  if (xfer && bank >= 1000) {
    const plan = makeXfer(p, late ? 'hotel' : 'airline', null, 5000);
    if (plan && ok(() => game.transferPoints(plan.bank, plan.partner, plan.amount))) {
      return `dump→${plan.partner}`;
    }
  }

  return null;
}

function botCanAct(p) {
  if (!p.turn) return false;
  if (p.turn.pendingTickets && p.turn.pendingTickets.length) return true;
  const build = p.turn.buildLeft || 0;
  const travel = p.turn.travelLeft || 0;
  const freeX = p.turn.freeTransferLeft || 0;
  const bank = sum(p.banks);
  return build + travel > 0 || (freeX > 0 && bank >= 1000);
}

export function playBotActions(game) {
  const p = game.currentPlayer;
  const logs = [];
  if (!p.isBot) return { logs };

  ensureBotEarnPrefs(game, p);
  // Income is auto at beginTurn; safety if somehow skipped
  if (!p.turn.incomeDone) {
    const r = game.doIncome();
    logs.push(`${p.name} +${r.totalEarned.toLocaleString()}`);
  } else if (p.turn.lastIncome) {
    logs.push(`${p.name} +${p.turn.lastIncome.totalEarned.toLocaleString()}`);
  }

  let n = 0;
  while (botCanAct(p) && n++ < 16) {
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
    const before = {
      b: p.turn.buildLeft,
      t: p.turn.travelLeft,
      x: p.turn.freeTransferLeft,
    };
    const label = doOneAction(game, p);
    if (!label) break;
    logs.push(`${p.name} ${label}`);
    if (
      p.turn.buildLeft === before.b &&
      p.turn.travelLeft === before.t &&
      p.turn.freeTransferLeft === before.x
    ) {
      break;
    }
  }
  return { logs };
}

export function isBotPlayer(player) {
  return !!(player && player.isBot);
}
