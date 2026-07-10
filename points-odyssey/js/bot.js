/**
 * Points Odyssey bot — per-character strategies tuned for higher avg VP.
 *
 * Action economy: 1 free Transfer · 1 Build · 1 Travel
 * Tickets/races ordered; award seats limited per airline/round.
 *
 * Character presets (~10-variant sequential live-field search, skills fixed):
 *  - Consultant → Chase + United tickets
 *  - Family → Chase + United hard dump (0.7)
 *  - Nomad → Amex Gold + Delta tickets
 *  - Foodie → Citi AA pure tickets (Gold dining pin)
 *  - Landlord → Citi + AA soft + light Hilton
 *  - Executive → Marriott hotel race, hard hotel dump (0.65)
 */

import {
  CREDIT_CARDS,
  CITIES,
  ROUTES,
  TRANSFERS,
  listFlightOptions,
  GAME_CONFIG,
} from './data.js?v=nfe1';

/**
 * Per-character bot profile.
 * preferAir: preferred airline when stocking miles
 * hotelPriority: high = race stays; normal; low = tickets first
 * lightHilton: Amex→Hilton only for open 0–1 hop claims
 * hotelXfer: preferred hotel brand when general hotel funding
 * exploreBoost: extra score for new cities (Nomad)
 * airDumpPct: fraction of bank to dump (air for tickets; hotel brand if hotelPriority high)
 * ticketEager: draw tickets more aggressively
 */
const CHAR_STRAT = {
  // Chase → United tickets (best of 10; Hyatt side-fund)
  consultant: {
    cards: ['csp', 'cfu', 'csr', 'bilt_card'],
    preferAir: 'united',
    hotelPriority: 'low',
    lightHilton: false,
    hotelXfer: 'hyatt',
    exploreBoost: false,
    earnPins: {
      csp: ['travel', 'dining', 'flights'],
      cfu: ['others'],
    },
    airDumpPct: 0.55,
    ticketEager: true,
  },
  // Pure AA ticket path + Gold dining pin (beats soft Hilton hybrid)
  foodie: {
    cards: ['strata', 'double_cash', 'custom_cash', 'amex_gold'],
    preferAir: 'american',
    hotelPriority: 'low',
    lightHilton: false,
    hotelXfer: null,
    exploreBoost: false,
    earnPins: {
      amex_gold: ['dining', 'groceries'],
      strata: ['travel', 'gas', 'others'],
    },
    airDumpPct: 0.55,
    ticketEager: true,
  },
  // Gold → Delta tickets (city/flight skills stack with movement)
  nomad: {
    cards: ['amex_gold', 'delta_gold', 'strata', 'csp'],
    preferAir: 'delta',
    hotelPriority: 'low',
    lightHilton: false,
    hotelXfer: null,
    exploreBoost: false,
    earnPins: {
      amex_gold: ['dining', 'groceries', 'flights', 'travel', 'others'],
    },
    airDumpPct: 0.6,
    ticketEager: true,
  },
  // Chase → United hard dump (0.7 + CSR pins); hotel race underperformed
  family: {
    cards: ['csp', 'cfu', 'csr', 'bilt_card'],
    preferAir: 'united',
    hotelPriority: 'low',
    lightHilton: false,
    hotelXfer: 'hyatt',
    exploreBoost: false,
    earnPins: {
      csp: ['travel', 'dining', 'flights'],
      cfu: ['others'],
      csr: ['travel', 'dining'],
    },
    airDumpPct: 0.7,
    ticketEager: true,
  },
  // Citi → AA with soft hotels / light Hilton (slight edge over pure AA)
  landlord: {
    cards: ['strata', 'double_cash', 'custom_cash', 'csp'],
    preferAir: 'american',
    hotelPriority: 'normal',
    lightHilton: true,
    hotelXfer: 'hilton',
    exploreBoost: false,
    earnPins: {
      strata: ['travel', 'dining', 'groceries', 'gas'],
    },
    airDumpPct: 0.45,
    ticketEager: true,
  },
  // Marriott race — aggressive bank → Marriott dump
  executive: {
    cards: ['amex_gold', 'amex_plat', 'bilt_card', 'csp'],
    preferAir: 'delta',
    hotelPriority: 'high',
    lightHilton: false,
    hotelXfer: 'marriott',
    exploreBoost: false,
    earnPins: {
      amex_plat: ['flights', 'hotels'],
      amex_gold: ['dining', 'groceries'],
    },
    airDumpPct: 0.65,
    ticketEager: false,
  },
};

function strat(p) {
  const id = p && p.character && p.character.id;
  return CHAR_STRAT[id] || CHAR_STRAT.consultant;
}

function holdsCard(p, id) {
  return !!(p.cards && p.cards.some((c) => c.id === id));
}

function holdsAmexGold(p) {
  return holdsCard(p, 'amex_gold');
}

function preferDeltaMiles(p) {
  const s = strat(p);
  if (s.preferAir !== 'delta') return false;
  return holdsAmexGold(p) || (p.banks.amex || 0) >= 1000 || holdsCard(p, 'delta_gold');
}

function preferAir(p) {
  return strat(p).preferAir || null;
}

function hotelPriorityHigh(p) {
  return strat(p).hotelPriority === 'high';
}

function hotelPriorityLow(p) {
  return strat(p).hotelPriority === 'low';
}

/** Open Hilton claims within 0–1 hops. */
function nearbyOpenHiltons(game, p) {
  const out = [];
  for (const city of Object.values(CITIES)) {
    const dist = hops(p.city, city.id);
    if (dist > 1) continue;
    for (const h of city.hotels || []) {
      if (h.brand !== 'hilton') continue;
      if (hotelTaken(game, h.id) || p.stayedHotels.has(h.id)) continue;
      const cost = hCost(p, h);
      out.push({
        city: city.id,
        id: h.id,
        name: h.name,
        cost,
        dist,
        vp: hVp(p, h, city.id),
        shortfall: Math.max(0, cost - (p.hotels.hilton || 0)),
      });
    }
  }
  out.sort(
    (a, b) =>
      a.shortfall - b.shortfall || b.vp - a.vp || a.dist - b.dist || a.cost - b.cost
  );
  return out;
}

/** Light Amex → Hilton only for a nearby open underfunded claim. */
function tryLightAmexToHilton(game, p) {
  if (!canTransfer(p)) return false;
  if (!strat(p).lightHilton) return false;
  if ((p.banks.amex || 0) < 1000) return false;
  if (!TRANSFERS.amex || !TRANSFERS.amex.hilton) return false;
  const nearby = nearbyOpenHiltons(game, p);
  if (!nearby.length) return false;
  const target = nearby.find((h) => h.shortfall > 0);
  if (!target) return false;
  const amexNeed = Math.ceil(target.shortfall / 2 / 1000) * 1000;
  const send = Math.min(p.banks.amex, Math.max(1000, Math.min(8000, amexNeed)));
  const amt = Math.floor(send / 1000) * 1000;
  if (amt < 1000) return false;
  return ok(() => game.transferPoints('amex', 'hilton', amt));
}

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
  if (p.character.special === 'polished_routes') c = Math.floor(c * 0.9);
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
  if (p.character.special === 'extra_card') vp += 3;
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
      const pref = preferAir(p);
      let opts = ['delta', 'american', 'united'].filter((a) => partners[a]);
      if (pref && partners[pref]) {
        opts = [pref, ...opts.filter((a) => a !== pref)];
      } else if (opts.length) {
        opts.sort(
          (a, b) =>
            (p.airlines[a] || 0) - (p.airlines[b] || 0) ||
            (a === 'united' ? 1 : 0) - (b === 'united' ? 1 : 0)
        );
      }
      if (opts.length) partner = opts[0];
    }
    if (!partner && kind === 'hotel') {
      // Character hotel brand when funding; Hilton light path is separate
      const hx = strat(p).hotelXfer;
      if (hx && partners[hx]) {
        partner = hx;
      } else {
        partner =
          (partners.hyatt && 'hyatt') ||
          (partners.marriott && 'marriott') ||
          (partners.hilton && 'hilton') ||
          null;
      }
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
  const key = n + ':' + p.cards.map((c) => c.id).sort().join(',');
  if (p._botPrefsKey === key) return;
  p._botPrefsKey = key;
  if (typeof game.initDefaultEarnPrefs === 'function') {
    game.initDefaultEarnPrefs(p);
  }
  // Character-specific earn pins (only if the card is held)
  p.earnPrefs = p.earnPrefs || {};
  const pins = strat(p).earnPins || {};
  for (const [cardId, cats] of Object.entries(pins)) {
    if (!holdsCard(p, cardId)) continue;
    for (const cat of cats) p.earnPrefs[cat] = cardId;
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
    if (!p.visited.has(c)) sc += strat(p).exploreBoost ? 14 : 3;
  }
  sc -= f.cost / 8000;
  return sc;
}

function tryBook(game, f) {
  return ok(() => game.bookFlight(f.to, f.air, f.via || null));
}

function tryXferForAirline(game, p, air, need) {
  if (!canTransfer(p)) return false;
  let want = air;
  const pref = preferAir(p);
  // Prefer character airline when the requested one isn't on Amex and we have Amex
  if (
    preferDeltaMiles(p) &&
    pref === 'delta' &&
    air !== 'delta' &&
    TRANSFERS.amex &&
    TRANSFERS.amex.delta
  ) {
    const chasePartners = TRANSFERS.chase || {};
    if (!TRANSFERS.amex[air] && !chasePartners[air]) want = 'delta';
  }
  // Prefer Amex → Delta when that is the character plan
  if (preferDeltaMiles(p) && (p.banks.amex || 0) >= 1000 && TRANSFERS.amex) {
    const partners = TRANSFERS.amex;
    const tryAir = partners[want] ? want : partners.delta ? 'delta' : null;
    if (tryAir) {
      const needAmt = Math.max(8000, need);
      const amt =
        Math.floor(
          Math.min(p.banks.amex, Math.max(needAmt, Math.floor(p.banks.amex * 0.75))) /
            1000
        ) * 1000;
      if (amt >= 1000 && ok(() => game.transferPoints('amex', tryAir, amt))) {
        return true;
      }
    }
  }
  const plan = makeXfer(p, 'airline', want, Math.max(8000, need));
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
  const topGap = gList[0];
  const canFinishSoon =
    topGap &&
    topGap.rem === 1 &&
    hops(p.city, topGap.city) <= 1 &&
    air >= 5000;

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
      // Ticket-focused chars accept weaker flight scores (post ticket nerf)
      const flyMin =
        strat(p).ticketEager || hotelPriorityLow(p) || preferDeltaMiles(p)
          ? 12
          : 22;
      if (best && bestSc >= flyMin && tryBook(game, best)) {
        return bestSc >= 90 ? `FINISH→${best.to}` : `fly→${best.to}`;
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

    // Hotel here: Family/Executive race claims; others when high VP or not finishing a ticket
    const hotelFirst =
      hotelPriorityHigh(p) || (stay && stay.vp >= 10) || late;
    const hotelOk =
      stay &&
      !hotelPriorityLow(p) &&
      (hotelFirst || !canFinishSoon || stay.vp >= 8);
    if (hotelOk && ok(() => game.bookHotel(stay.id))) {
      return `hotel ${stay.name} +${stay.vp}`;
    }
    // High hotel priority may still stay on lower VP if claim is free
    if (
      hotelPriorityHigh(p) &&
      stay &&
      !canFinishSoon &&
      ok(() => game.bookHotel(stay.id))
    ) {
      return `hotel ${stay.name} +${stay.vp}`;
    }

    // Race hotels: fly toward claimable properties (Family/Executive, or late)
    if (
      (hotelPriorityHigh(p) || late) &&
      stays.length &&
      (!canFinishSoon || hotelPriorityHigh(p))
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

    // Productive mile burn: toward goals, hotels, or new cities (Nomad boost)
    {
      const flights = affordableFlights(game, p);
      const tc = new Set(gList.map((x) => x.city));
      const hc = new Set(stays.map((s) => s.city));
      const explore = strat(p).exploreBoost ? 18 : 8;
      flights.sort((a, b) => {
        const sc = (f) =>
          (tc.has(f.to) ? 40 : 0) +
          (hc.has(f.to) ? (hotelPriorityHigh(p) ? 45 : 30) : 0) +
          (f.via && tc.has(f.via) ? 35 : 0) +
          (p.visited.has(f.to) ? 0 : explore) -
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

    // Strategy dumps: hotel racers fund hotel brand first; ticket paths fund preferAir
    const s = strat(p);
    if (s.airDumpPct > 0) {
      if (hotelPriorityHigh(p) && s.hotelXfer) {
        const hotelDumps = [
          { bank: 'amex', dest: s.hotelXfer },
          { bank: 'chase', dest: s.hotelXfer },
          { bank: 'bilt', dest: s.hotelXfer },
          { bank: 'citi', dest: s.hotelXfer },
        ];
        for (const d of hotelDumps) {
          const partners = TRANSFERS[d.bank];
          if (!partners || !partners[d.dest]) continue;
          const bal = p.banks[d.bank] || 0;
          if (bal < 2000) continue;
          const amt =
            Math.floor(Math.min(bal, Math.max(4000, bal * s.airDumpPct)) / 1000) *
            1000;
          if (amt >= 1000 && ok(() => game.transferPoints(d.bank, d.dest, amt))) {
            return `dump ${d.bank}→${d.dest}`;
          }
        }
      } else if (s.preferAir) {
        // Match ecosystem bank → airline (Chase/UA, Citi/AA, Amex/DL)
        const air = s.preferAir;
        const dumps = [
          air === 'united'
            ? { bank: 'chase', air }
            : air === 'american'
              ? { bank: 'citi', air }
              : { bank: 'amex', air },
          { bank: 'amex', air: 'delta' },
          { bank: 'citi', air: 'american' },
          { bank: 'chase', air: 'united' },
          { bank: 'bilt', air: air === 'american' ? 'american' : 'united' },
        ];
        for (const d of dumps) {
          const partners = TRANSFERS[d.bank];
          if (!partners || !partners[d.air]) continue;
          const bal = p.banks[d.bank] || 0;
          if (bal < 2000) continue;
          const amt =
            Math.floor(Math.min(bal, Math.max(4000, bal * s.airDumpPct)) / 1000) *
            1000;
          if (amt >= 1000 && ok(() => game.transferPoints(d.bank, d.air, amt))) {
            return `dump ${d.bank}→${d.air}`;
          }
        }
      }
    }

    // Ticket path: fuel preferred airline before hotel points
    const prefA = preferAir(p);
    if (prefA && gList.length && !hotelPriorityHigh(p)) {
      const g0 = gList[0];
      const opts = flightsTo(game, p, g0.city);
      for (const f of opts.slice(0, 8)) {
        if (f.ok) continue;
        if (f.air === prefA && tryXferForAirline(game, p, prefA, Math.max(f.need, 8000))) {
          return `fuel ${prefA} tickets`;
        }
      }
      for (const f of opts.slice(0, 6)) {
        if (f.ok) continue;
        if (tryXferForAirline(game, p, f.air, Math.max(f.need, 10000))) {
          return `fuel ${f.air}`;
        }
      }
      if ((p.airlines[prefA] || 0) < 10000) {
        if (tryXferForAirline(game, p, prefA, 10000)) return `stock ${prefA}`;
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
      const plan =
        (prefA && makeXfer(p, 'airline', prefA, 12000)) ||
        makeXfer(p, 'airline', null, 12000);
      if (plan && ok(() => game.transferPoints(plan.bank, plan.partner, plan.amount))) {
        return `miles→${plan.partner}`;
      }
    }

    // Light Amex→Hilton only when open Hilton is 0–1 hops away (Foodie/Family)
    if (!canFinishSoon && tryLightAmexToHilton(game, p)) {
      return `light Amex→Hilton (nearby claim)`;
    }

    // Fund hotels when high hotel priority, or when miles OK / no goals
    const wantHotelPts =
      hotelPriorityHigh(p) ||
      (hot < 18000 && (air >= 8000 || !gList.length || late));
    if (wantHotelPts) {
      const hx = strat(p).hotelXfer;
      const plan =
        (hx && makeXfer(p, 'hotel', hx, 10000)) ||
        makeXfer(p, 'hotel', 'hyatt', 12000) ||
        makeXfer(p, 'hotel', null, 10000);
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
        hotEff < air * 0.7 && (!gList.length || hotelPriorityHigh(p))
          ? makeXfer(p, 'hotel', strat(p).hotelXfer || null, 10000) ||
            makeXfer(p, 'hotel', null, 10000)
          : (prefA && makeXfer(p, 'airline', prefA, 10000)) ||
            makeXfer(p, 'airline', null, 10000);
      if (plan && ok(() => game.transferPoints(plan.bank, plan.partner, plan.amount))) {
        return `xfer→${plan.partner}`;
      }
    }
  }

  // ——— BUILD: card / tickets / rest ———
  // Ticket-path: open preferred earn card ASAP (before rest)
  if (build) {
    const limit = typeof game.cardLimit === 'function' ? game.cardLimit(p) : 2;
    const cardRound = p.character.special === 'extra_card' ? 7 : 6;
    const needGold =
      strat(p).ticketEager &&
      strat(p).cards &&
      strat(p).cards[0] &&
      !holdsCard(p, strat(p).cards[0]);
    if (
      p.cards.length < limit &&
      (round <= cardRound || needGold)
    ) {
      const held = new Set(p.cards.map((c) => c.id));
      for (const id of strat(p).cards || []) {
        if (!held.has(id) && ok(() => game.applyForCard(id))) return `card ${id}`;
      }
      for (const c of CREDIT_CARDS) {
        if (!held.has(c.id) && ok(() => game.applyForCard(c.id))) return `card ${c.id}`;
      }
    }

    // Draw tickets if empty or need more goals (ticket-path chars draw more eagerly)
    const open = (p.tickets || []).length;
    const ticketEager =
      strat(p).ticketEager || hotelPriorityLow(p) || preferDeltaMiles(p);
    if (open === 0 && round <= maxR - 1) {
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
    if (
      open <= (ticketEager ? 2 : 1) &&
      round >= 2 &&
      round <= maxR - (ticketEager ? 1 : 2) &&
      (ticketEager || gList.filter((x) => !x.race).length <= 1)
    ) {
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

/** Mutable strategy table (sims can override per character). */
export { CHAR_STRAT };

/** Replace one character's bot profile (returns previous). */
export function setCharStrat(id, profile) {
  const prev = CHAR_STRAT[id];
  CHAR_STRAT[id] = profile;
  return prev;
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
