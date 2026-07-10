/**
 * Points Odyssey — UI controller
 */

import {
  Game,
  CREDIT_CARDS,
  CHARACTERS,
  CITIES,
  ROUTES,
  TRANSFERS,
  ACHIEVEMENTS,
  GAME_CONFIG,
  listFlightOptions,
} from './game.js?v=nomad1';
import { BANKS, HOTELS, AIRLINES, getRoute, STRATEGY_TIPS } from './data.js?v=nomad1';
import { playBotActions } from './bot.js?v=nomad1';
import { initMusicUI, playTrack, ensureMusic } from './music.js?v=nomad1';

const game = new Game();
let setupSelections = [];
/** Prevent overlapping bot auto-play */
let botRunning = false;
const BOT_STEP_MS = 700;
/** During flight anim, keep pawn at origin until plane lands */
let mapCityOverride = null; // { playerId, city }
let flightAnimPlaying = false;
/** First human turn onboarding (session) */
const TUTORIAL_KEY = 'points-odyssey-tutorial-v1';
let tutorialStep = 0; // 0=welcome, 1=income, 2=actions, 3=done

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

/** Award tickets left for an airline this round (1 booking = 1 ticket). */
function awardsLeft(airline) {
  try {
    if (game && typeof game.awardsLeft === 'function') {
      return game.awardsLeft(airline);
    }
    if (game && game.airlineAwards && game.airlineAwards[airline] != null) {
      return game.airlineAwards[airline];
    }
  } catch (e) {
    console.warn('[awardsLeft]', e);
  }
  return GAME_CONFIG.awardsPerAirlinePerRound != null
    ? GAME_CONFIG.awardsPerAirlinePerRound
    : 2;
}

function fmt(n) {
  return Math.round(n).toLocaleString();
}

function formatSpendProfileLines(c) {
  const profile = c.spendProfile || { everything: 1 };
  const sum = Object.values(profile).reduce((s, w) => s + w, 0) || 1;
  return Object.entries(profile)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, w]) => {
      const pct = Math.round((w / sum) * 100);
      return { cat, pct, w };
    });
}

/** Skill lines for UI bullets (prefer skills[]; fall back to specialDesc sentences). */
function characterSkillLines(c) {
  if (!c) return [];
  if (Array.isArray(c.skills) && c.skills.length) {
    return c.skills.map((s) => String(s).trim()).filter(Boolean);
  }
  const desc = (c.specialDesc || '').trim();
  if (!desc) return [];
  return desc
    .split(/(?<=\.)\s+/)
    .map((s) => s.replace(/\.$/, '').trim())
    .filter(Boolean);
}

function characterSkillsListHtml(c, className = 'skill-bullets') {
  const items = characterSkillLines(c)
    .map((s) => `<li>${s}</li>`)
    .join('');
  return items ? `<ul class="${className}">${items}</ul>` : '';
}

/** Format character special + spend appearance probs for tooltips */
function characterSkillsHtml(c) {
  const cardLimit = GAME_CONFIG.defaultCardLimit + (c.cardLimitBonus || 0);
  const home = CITIES[c.homeCity] ? CITIES[c.homeCity].name : c.homeCity;
  const lines = formatSpendProfileLines(c);
  const mults = lines
    .map((x) => `<li><strong>${x.pct}%</strong> ${x.cat}</li>`)
    .join('');
  const skillList = characterSkillsListHtml(c, 'skill-bullets skill-tip-special');
  return `
    <div class="skill-tooltip" role="tooltip">
      <div class="skill-tip-name">${c.name}</div>
      <p class="skill-tip-blurb">${c.blurb || ''}</p>
      <div class="skill-tip-section">
        <span class="skill-tip-label">Spend appearance (chance)</span>
        <ul class="skill-mults">${mults}</ul>
      </div>
      <div class="skill-tip-section">
        <span class="skill-tip-label">Special skill</span>
        ${skillList}
      </div>
      <p class="skill-tip-note">Each income roll draws spend categories by these odds. Earn rates come only from credit cards (0× without a card).</p>
      <div class="skill-tip-meta">
        <span>Home: ${home}</span>
        <span>Cards: up to ${cardLimit}</span>
      </div>
    </div>
  `;
}

function characterSkillsTitle(c) {
  const lines = formatSpendProfileLines(c)
    .slice(0, 4)
    .map((x) => `${x.cat} ${x.pct}%`)
    .join(', ');
  const skills = characterSkillLines(c)
    .map((s) => `• ${s}`)
    .join('\n');
  return `${c.name}\nSpend odds: ${lines}\nSkill:\n${skills || c.specialDesc || '—'}\nEarn: credit cards only (0× default)`;
}

function formatSpendRollHtml(roll) {
  if (!roll) return '<span class="muted">No spend rolled</span>';
  return Object.entries(roll)
    .filter(([, amt]) => amt > 0)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([cat, amt]) =>
        `<div class="spend-chip"><span class="spend-cat">${cat}</span><strong>$${fmt(amt)}</strong></div>`
    )
    .join('');
}

function showScreen(id) {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  // Music beds by screen (no-ops until user has started music once)
  if (id === 'screen-setup' || id === 'screen-rules') {
    playTrack('menu');
  } else if (id === 'screen-game') {
    playTrack('play');
  } else if (id === 'screen-gameover') {
    playTrack('hotel');
  }
}

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

// ——— Setup ———

function renderSetup() {
  const grid = $('#character-grid');
  grid.innerHTML = CHARACTERS.map((c) => {
    const taken = setupSelections.some((s) => s.characterId === c.id);
    const home = CITIES[c.homeCity] ? CITIES[c.homeCity].name : c.homeCity;
    return `
      <div class="char-card has-tooltip ${taken ? 'taken' : ''}" data-id="${c.id}">
        <img src="${c.image}" alt="${c.name}" />
        <div class="char-info">
          <h3>${c.name}</h3>
          <p>${c.blurb}</p>
          ${characterSkillsListHtml(c, 'skill-bullets special')}
          <p class="home">Home: ${home}</p>
          ${
            taken
              ? `<p class="hover-hint">Already in lobby</p>`
              : `<div class="char-join-btns">
                  <button type="button" class="btn primary btn-add-human" data-id="${c.id}">👤 Player</button>
                  <button type="button" class="btn btn-add-bot" data-id="${c.id}">🤖 Bot</button>
                </div>`
          }
        </div>
        ${characterSkillsHtml(c)}
      </div>
    `;
  }).join('');

  grid.onclick = (e) => {
    const humanBtn = e.target.closest('.btn-add-human');
    const botBtn = e.target.closest('.btn-add-bot');
    const btn = humanBtn || botBtn;
    if (!btn) return;
    const id = btn.dataset.id;
    if (setupSelections.some((s) => s.characterId === id)) return;
    if (setupSelections.length >= GAME_CONFIG.maxPlayers) {
      toast('Max 6 players', true);
      return;
    }
    const ch = CHARACTERS.find((c) => c.id === id);
    const isBot = !!botBtn;
    let name;
    if (isBot) {
      name = `Bot ${ch.name.replace(/^The /, '')}`;
    } else {
      name =
        prompt(`Name for ${ch.name}?`, `Player ${setupSelections.length + 1}`) ||
        `Player ${setupSelections.length + 1}`;
    }
    setupSelections.push({ characterId: id, name, isBot });
    renderLobby();
    renderSetup();
  };

  renderLobby();
}

function renderLobby() {
  const list = $('#lobby-list');
  list.innerHTML = setupSelections
    .map((s, i) => {
      const c = CHARACTERS.find((x) => x.id === s.characterId);
      const kind = s.isBot ? '🤖 Bot' : '👤 Player';
      return `<li class="has-tooltip lobby-player ${s.isBot ? 'is-bot' : 'is-human'}">
          <img src="${c.image}" alt="" />
          <span>
            <strong>${s.name}</strong> — ${c.name}
            <em class="seat-kind">${kind}</em>
          </span>
          <button type="button" data-i="${i}" class="toggle-bot" title="Toggle player/bot">${
            s.isBot ? '→ Player' : '→ Bot'
          }</button>
          <button type="button" data-i="${i}" class="remove-p">✕</button>
          ${characterSkillsHtml(c)}
        </li>`;
    })
    .join('');

  list.onclick = (e) => {
    if (e.target.classList.contains('remove-p')) {
      setupSelections.splice(+e.target.dataset.i, 1);
      renderLobby();
      renderSetup();
      return;
    }
    if (e.target.classList.contains('toggle-bot')) {
      const i = +e.target.dataset.i;
      const s = setupSelections[i];
      s.isBot = !s.isBot;
      const c = CHARACTERS.find((x) => x.id === s.characterId);
      if (s.isBot) {
        s.name = `Bot ${c.name.replace(/^The /, '')}`;
      } else if (s.name.startsWith('Bot ')) {
        s.name = `Player ${i + 1}`;
      }
      renderLobby();
      renderSetup();
    }
  };

  const startBtn = $('#start-game');
  const humans = setupSelections.filter((s) => !s.isBot).length;
  const bots = setupSelections.filter((s) => s.isBot).length;
  startBtn.disabled = setupSelections.length < GAME_CONFIG.minPlayers;
  startBtn.textContent =
    setupSelections.length < GAME_CONFIG.minPlayers
      ? `Need ${GAME_CONFIG.minPlayers}+ seats (${setupSelections.length})`
      : `Start (${humans} player${humans === 1 ? '' : 's'}, ${bots} bot${bots === 1 ? '' : 's'})`;
}

// ——— Main render ———

function renderAll() {
  try {
    if (game.phase === 'ended') {
      renderGameOver();
      return;
    }
    if (game.phase !== 'playing') return;

    // Ensure airline award inventory exists
    if (!game.airlineAwards || !Object.keys(game.airlineAwards).length) {
      if (typeof game.resetAirlineAwards === 'function') game.resetAirlineAwards();
      else if (typeof game.resetRouteSeats === 'function') game.resetRouteSeats();
    }

    const snap = game.snapshot();
    const cur = snap.players[snap.currentPlayerIndex];

    $('#round-label').textContent = `Round ${snap.round} / ${snap.maxRounds}`;
    $('#turn-label').textContent = cur.isBot
      ? `🤖 ${cur.name}'s turn`
      : `${cur.name}'s turn`;
    const aw = snap.airlineAwards || game.airlineAwards || {};
    const awEl = $('#awards-left');
    if (awEl) {
      awEl.textContent = `Awards UA ${aw.united != null ? aw.united : '—'} · DL ${
        aw.delta != null ? aw.delta : '—'
      } · AA ${aw.american != null ? aw.american : '—'}`;
    }
    // Prefer live turn for accurate action counts
    const t =
      (game.currentPlayer && game.currentPlayer.turn) || cur.turn;
    if (t) {
      if (!t.incomeDone) {
        $('#actions-left').textContent = 'Income first';
      } else {
        const parts = [];
        if ((Number(t.freeTransferLeft) || 0) > 0) parts.push('↺ free xfer');
        parts.push(`Build ${Number(t.buildLeft) || 0}`);
        parts.push(`Travel ${Number(t.travelLeft) || 0}`);
        $('#actions-left').textContent = parts.join(' · ');
      }
    } else {
      $('#actions-left').textContent = '—';
    }

    renderPlayersBar(snap);
    renderMap(snap);
    renderHand(cur, snap);
    renderRaceGoals(snap, cur);
    renderTurnChecklist(cur, snap);
    renderLog(snap);
    renderPhasePanel(cur, snap);
    // Keep city hotel claim list live after any stay/bot action
    if (lastCityInfoId) showCityInfo(lastCityInfoId, cur);
    maybeShowTutorial(cur, snap);

    // Auto-play bots (not during flight animation)
    if (cur.isBot && !botRunning && !flightAnimPlaying) {
      scheduleBotTurn();
    }
  } catch (err) {
    console.error('[renderAll]', err);
    toast(err && err.message ? err.message : String(err), true);
  }
}

function renderPlayersBar(snap) {
  const bar = $('#players-bar');
  bar.innerHTML = snap.players
    .map((p, i) => {
      const active = i === snap.currentPlayerIndex ? 'active' : '';
      const botTag = p.isBot ? ' <span class="bot-badge">BOT</span>' : '';
      return `
        <div class="p-chip has-tooltip ${active} ${p.isBot ? 'bot-chip' : ''}" title="${characterSkillsTitle(p.character).replace(/"/g, '&quot;')}">
          <img src="${p.character.image}" alt="" />
          <div>
            <strong>${p.name}${botTag}</strong>
            <span>${p.vp} VP · ${p.city}</span>
          </div>
          ${characterSkillsHtml(p.character)}
        </div>
      `;
    })
    .join('');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cityXY(cityId, w = 1000, h = 620) {
  const c = CITIES[cityId];
  return { x: (c.x / 100) * w, y: (c.y / 100) * h };
}

/**
 * Animate plane + character headshot along a flight leg.
 * @param {object} opts
 * @param {string} opts.fromId
 * @param {string} opts.toId
 * @param {string} opts.airline
 * @param {string} [opts.portrait] character image URL
 * @param {string} [opts.ringColor] head ring color
 * @param {number} [opts.durationMs]
 */
function animateFlightLeg({
  fromId,
  toId,
  airline,
  portrait,
  ringColor,
  durationMs = 1100,
}) {
  return new Promise((resolve) => {
    const svg = $('#map-svg');
    if (!svg) {
      resolve();
      return;
    }
    const w = 1000;
    const h = 620;
    const a = cityXY(fromId, w, h);
    const b = cityXY(toId, w, h);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const angle0 = (Math.atan2(dy, dx) * 180) / Math.PI;
    const color =
      (AIRLINES[airline] && AIRLINES[airline].color) || '#f0e6d3';
    const ring = ringColor || color;

    // Trail path (curved)
    const trail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - Math.min(48, Math.hypot(dx, dy) * 0.14);
    const d = `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
    trail.setAttribute('d', d);
    trail.setAttribute('fill', 'none');
    trail.setAttribute('stroke', color);
    trail.setAttribute('stroke-width', '2.5');
    trail.setAttribute('stroke-dasharray', '7 5');
    trail.setAttribute('opacity', '0.9');
    trail.setAttribute('class', 'flight-trail');
    svg.appendChild(trail);

    // Moving group: plane + headshot travel together
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'flight-plane');

    // Headshot behind / slightly offset from plane so both are visible
    const headR = 15;
    const headOffsetY = -28; // above plane in local coords (before path rotation)
    if (portrait) {
      const clipId = `fly-head-clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const defs =
        svg.querySelector('defs') ||
        (() => {
          const d = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          svg.insertBefore(d, svg.firstChild);
          return d;
        })();
      const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
      clip.setAttribute('id', clipId);
      const clipC = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      clipC.setAttribute('cx', '0');
      clipC.setAttribute('cy', String(headOffsetY));
      clipC.setAttribute('r', String(headR));
      clip.appendChild(clipC);
      defs.appendChild(clip);

      const headBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      headBg.setAttribute('cx', '0');
      headBg.setAttribute('cy', String(headOffsetY));
      headBg.setAttribute('r', String(headR + 2));
      headBg.setAttribute('fill', '#0a1224');
      headBg.setAttribute('stroke', ring);
      headBg.setAttribute('stroke-width', '2.5');
      g.appendChild(headBg);

      const head = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      head.setAttribute('href', portrait);
      head.setAttribute('x', String(-headR));
      head.setAttribute('y', String(headOffsetY - headR));
      head.setAttribute('width', String(headR * 2));
      head.setAttribute('height', String(headR * 2));
      head.setAttribute('clip-path', `url(#${clipId})`);
      head.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      // Counter-rotate head later so face stays upright — applied in frame
      head.setAttribute('class', 'flight-head');
      g.appendChild(head);

      // Keep head upright: nest in counter-rotating group
      // Rebuild head as subgroup for upright orientation
      headBg.remove();
      head.remove();
      const headG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      headG.setAttribute('class', 'flight-head-g');
      headG.appendChild(headBg);
      headG.appendChild(head);
      g.appendChild(headG);
    }

    // Boeing 737 bird's-eye icon (transparent PNG; art nose points up → rotate +90° so nose = +X)
    const planeSize = 48;
    const plane = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    plane.setAttribute('href', 'assets/plane.png');
    plane.setAttribute('width', String(planeSize));
    plane.setAttribute('height', String(planeSize));
    plane.setAttribute('x', String(-planeSize / 2));
    plane.setAttribute('y', String(-planeSize / 2));
    // Nose-up art → rotate 90° around icon center so nose faces path +X
    plane.setAttribute('transform', 'rotate(90 0 0)');
    plane.setAttribute('class', 'flight-plane-img');
    g.appendChild(plane);

    svg.appendChild(g);

    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / durationMs);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const omt = 1 - e;
      const x = omt * omt * a.x + 2 * omt * e * mx + e * e * b.x;
      const y = omt * omt * a.y + 2 * omt * e * my + e * e * b.y;
      const tx = 2 * omt * (mx - a.x) + 2 * e * (b.x - mx);
      const ty = 2 * omt * (my - a.y) + 2 * e * (b.y - my);
      const rot = (Math.atan2(ty, tx) * 180) / Math.PI;
      g.setAttribute('transform', `translate(${x}, ${y}) rotate(${rot})`);
      // Keep portrait upright (counter-rotate)
      const headG = g.querySelector('.flight-head-g');
      if (headG) {
        headG.setAttribute('transform', `rotate(${-rot})`);
      }
      trail.setAttribute('opacity', String(0.35 + 0.5 * (1 - t)));
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        g.remove();
        trail.remove();
        resolve();
      }
    }
    g.setAttribute('transform', `translate(${a.x}, ${a.y}) rotate(${angle0})`);
    const headG0 = g.querySelector('.flight-head-g');
    if (headG0) headG0.setAttribute('transform', `rotate(${-angle0})`);
    requestAnimationFrame(frame);
  });
}

async function playPendingFlightAnims() {
  const anims = game.consumeFlightAnims();
  if (!anims.length) return;
  flightAnimPlaying = true;
  const snap0 = game.phase === 'playing' ? game.snapshot() : null;

  for (const anim of anims) {
    // Hide static head icon while this player is flying
    mapCityOverride = { playerId: anim.playerId, hide: true };
    if (game.phase === 'playing') {
      const snap = game.snapshot();
      renderMap(snap);
      renderPlayersBar(snap);
    }

    const player =
      game.players && game.players.find((p) => p.id === anim.playerId);
    const portrait =
      (player && player.character && player.character.image) ||
      (snap0 &&
        snap0.players.find((p) => p.id === anim.playerId) &&
        snap0.players.find((p) => p.id === anim.playerId).character.image) ||
      null;
    const ringColors = [
      '#e74c3c',
      '#3498db',
      '#2ecc71',
      '#f39c12',
      '#9b59b6',
      '#1abc9c',
    ];
    const ringColor = ringColors[(anim.playerId || 0) % ringColors.length];

    await animateFlightLeg({
      fromId: anim.from,
      toId: anim.to,
      airline: anim.airline,
      portrait,
      ringColor,
      durationMs: 1100,
    });
  }
  mapCityOverride = null;
  flightAnimPlaying = false;
  if (game.phase === 'playing') {
    renderMap(game.snapshot());
  }
}

async function scheduleBotTurn() {
  if (botRunning || flightAnimPlaying) return;
  if (game.phase !== 'playing') return;
  const p = game.currentPlayer;
  if (!p || !p.isBot) return;

  botRunning = true;
  try {
    toast(`🤖 ${p.name} is thinking…`);
    await sleep(BOT_STEP_MS);
    if (game.phase !== 'playing' || game.currentPlayer.id !== p.id) {
      botRunning = false;
      return;
    }

    const { logs } = playBotActions(game);
    if (logs.length) {
      toast(`🤖 ${logs[logs.length - 1]}`);
    }
    // Animate any flights before full refresh
    await playPendingFlightAnims();
    renderAll();
    await sleep(400);

    if (game.phase !== 'playing') {
      botRunning = false;
      renderGameOver();
      return;
    }

    const res = game.endTurn();
    botRunning = false;
    if (res.gameOver) {
      renderGameOver();
    } else {
      renderAll();
      toast(
        game.currentPlayer.isBot
          ? `🤖 ${game.currentPlayer.name}'s turn`
          : `${game.currentPlayer.name}'s turn — you're up!`
      );
    }
  } catch (e) {
    botRunning = false;
    flightAnimPlaying = false;
    mapCityOverride = null;
    console.error(e);
    toast(`Bot error: ${e.message}`, true);
    // Try to unstick: end turn if possible
    try {
      if (game.phase === 'playing' && game.currentPlayer.isBot) {
        if (!game.currentPlayer.turn.incomeDone) {
          game.doIncome();
        }
        const res = game.endTurn();
        if (res.gameOver) renderGameOver();
        else renderAll();
      }
    } catch (e2) {
      console.error(e2);
    }
  }
}

function renderMap(snap) {
  const svg = $('#map-svg');
  const w = 1000;
  const h = 620;
  const cur = snap.players[snap.currentPlayerIndex];
  const pawnColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
  const iconR = 16;

  // Ticket / race city highlights
  const focusCities = new Set();
  (cur.tickets || []).forEach((t) => {
    focusCities.add(t.from);
    focusCities.add(t.to);
  });
  (snap.raceGoals || []).forEach((t) => {
    focusCities.add(t.from);
    focusCities.add(t.to);
  });

  // Routes
  let routesHtml = '';
  for (const r of ROUTES) {
    const ca = CITIES[r.a];
    const cb = CITIES[r.b];
    const x1 = (ca.x / 100) * w;
    const y1 = (ca.y / 100) * h;
    const x2 = (cb.x / 100) * w;
    const y2 = (cb.y / 100) * h;
    const primary = r.airlines[0];
    const color = AIRLINES[primary] ? AIRLINES[primary].color : '#888';
    const key = [r.a, r.b].sort().join('-');
    const owned = cur.network.includes(key);
    // Dim route if every airline that serves it is out of award tickets
    const airs = r.airlines || [];
    const anyAwards = airs.some((a) => awardsLeft(a) > 0);
    const soldOut = airs.length > 0 && !anyAwards;
    routesHtml += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
      stroke="${soldOut ? '#555' : color}" stroke-width="${owned ? 5 : 2.5}"
      stroke-opacity="${owned ? 0.95 : soldOut ? 0.22 : 0.55}"
      stroke-linecap="round"
      stroke-dasharray="${owned ? 'none' : soldOut ? '2 6' : '6 4'}" />`;
  }

  // Cities (dots + labels only — players drawn as head icons above)
  let citiesHtml = '';
  for (const c of Object.values(CITIES)) {
    const x = (c.x / 100) * w;
    const y = (c.y / 100) * h;
    const isCur = cur.city === c.id;
    const isFocus = focusCities.has(c.id);
    citiesHtml += `
      <g class="city-node" data-city="${c.id}" style="cursor:pointer">
        ${
          isFocus
            ? `<circle cx="${x}" cy="${y}" r="16" fill="none" stroke="#ffb81c" stroke-width="1.5" stroke-opacity="0.7" stroke-dasharray="3 2" />`
            : ''
        }
        <circle cx="${x}" cy="${y}" r="${isCur ? 11 : 8}"
          fill="${isCur ? '#d4a017' : isFocus ? '#2a3d66' : '#1a2744'}"
          stroke="${isFocus ? '#ffb81c' : '#f0e6d3'}" stroke-width="2" />
        <text x="${x}" y="${y - 16}" text-anchor="middle" fill="#f0e6d3"
          font-size="11" font-weight="600">${c.id}${isFocus ? '★' : ''}</text>
      </g>
    `;
  }

  // Group players by city (hide flying player so headshot moves with plane)
  const byCity = {};
  snap.players.forEach((p, i) => {
    if (mapCityOverride && mapCityOverride.playerId === p.id && mapCityOverride.hide) {
      return; // in the air — drawn by flight animation
    }
    let cityId = p.city;
    if (mapCityOverride && mapCityOverride.playerId === p.id && mapCityOverride.city) {
      cityId = mapCityOverride.city;
    }
    if (!byCity[cityId]) byCity[cityId] = [];
    byCity[cityId].push({ p, i });
  });

  let defs = '';
  let pawns = '';
  Object.entries(byCity).forEach(([cityId, list]) => {
    const c = CITIES[cityId];
    const baseX = (c.x / 100) * w;
    const baseY = (c.y / 100) * h;
    list.forEach(({ p, i }, slot) => {
      // Fan icons around the city dot
      const n = list.length;
      const angle = n === 1 ? -Math.PI / 2 : (slot / n) * Math.PI * 2 - Math.PI / 2;
      const ring = n === 1 ? 0 : 22;
      const x = baseX + Math.cos(angle) * ring;
      const y = baseY + Math.sin(angle) * ring + (n === 1 ? -28 : 0);
      const clipId = `pawn-clip-${i}`;
      const border = pawnColors[i % pawnColors.length];
      const isActive = i === snap.currentPlayerIndex;
      const img = (p.character && p.character.image) || 'assets/logo.jpg';
      const r = isActive ? iconR + 2 : iconR;
      defs += `<clipPath id="${clipId}"><circle cx="${x}" cy="${y}" r="${r}" /></clipPath>`;
      pawns += `
        <g class="player-pawn" data-player="${p.id}" style="pointer-events:none">
          ${
            isActive
              ? `<circle cx="${x}" cy="${y}" r="${r + 4}" fill="none" stroke="${border}" stroke-width="2" opacity="0.9">
                   <animate attributeName="r" values="${r + 3};${r + 6};${r + 3}" dur="1.6s" repeatCount="indefinite" />
                 </circle>`
              : ''
          }
          <circle cx="${x}" cy="${y}" r="${r + 1.5}" fill="#0a1224" stroke="${border}" stroke-width="${isActive ? 3 : 2}" />
          <image href="${img}" x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}"
            clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice" />
          <title>${p.name}${p.isBot ? ' (Bot)' : ''} — ${p.character ? p.character.name : ''}</title>
        </g>
      `;
    });
  });

  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = `
    <defs>${defs}</defs>
    <image href="assets/map-bg.jpg" x="0" y="0" width="${w}" height="${h}" opacity="0.35" preserveAspectRatio="xMidYMid slice" />
    <rect x="0" y="0" width="${w}" height="${h}" fill="rgba(10,18,36,0.55)" />
    ${routesHtml}
    ${citiesHtml}
    ${pawns}
  `;

  svg.onclick = (e) => {
    const g = e.target.closest('.city-node');
    if (!g) return;
    const cityId = g.dataset.city;
    showCityInfo(cityId, cur);
  };
}

let lastCityInfoId = null;

function showCityInfo(cityId, cur) {
  lastCityInfoId = cityId;
  const city = CITIES[cityId];
  const routes = ROUTES.filter((r) => r.a === cityId || r.b === cityId);
  const claims = (game && game.hotelClaims) || {};
  const panel = $('#city-info');
  panel.innerHTML = `
    <h3>${city.name} (${city.id})</h3>
    <p><strong>Signature hotels</strong> <span class="muted">(first stay claims · only claimer earns VP)</span>:</p>
    <ul class="hotel-list">
      ${(city.hotels || [])
        .map((h) => {
          const brand = HOTELS[h.brand] ? HOTELS[h.brand].name : h.brand;
          const claim = claims[h.id];
          let status = '';
          let itemClass = 'hotel-list-item';
          if (claim) {
            const mine = cur && claim.playerId === cur.id;
            status = mine
              ? ' · ✓ you claimed'
              : ` · 🔒 claimed by ${claim.playerName}`;
            itemClass += ' hotel-claimed';
          }
          let hMult = GAME_CONFIG.hotelCostMultiplier || 1;
          if (cur.character && cur.character.special === 'group_rate') hMult *= 0.75;
          const cost = Math.floor(h.cost * hMult);
          // Show preview for current viewer; base VP if no character context
          const vp = cur
            ? previewHotelStayVp(cur, h, cityId)
            : Math.round((h.vp || 2) * (GAME_CONFIG.hotelVpMultiplier || 1));
          const icon = (HOTELS[h.brand] && HOTELS[h.brand].logo) || h.icon || `assets/hotels/brands/${h.brand}.png`;
          return `<li class="${itemClass}">
            <img class="hotel-icon" src="${icon}" alt="" width="48" height="48" loading="lazy" />
            <div>
              <strong>${h.name}</strong><br/>
              <span class="muted">${brand} · ${fmt(cost)} pts · ${vp} VP${status}</span>
            </div>
          </li>`;
        })
        .join('')}
    </ul>
    <p><strong>Routes from here:</strong></p>
    <ul class="route-list">
      ${routes
        .map((r) => {
          const dest = r.a === cityId ? r.b : r.a;
          return `<li>${dest} — ${r.airlines.map((a) => AIRLINES[a].short).join('/')} · ${fmt(r.cost)} mi</li>`;
        })
        .join('')}
    </ul>
    ${
      cur.city === cityId
        ? `<p class="you-are-here">You are here</p>`
        : getRoute(cur.city, cityId)
          ? `<p class="flyable">Direct flight from ${cur.city} available</p>`
          : `<p class="muted">No direct flight from your city (${cur.city})</p>`
    }
  `;
  panel.classList.add('open');
}

function renderHand(cur, snap) {
  // Points
  $('#bank-balances').innerHTML = Object.entries(cur.banks)
    .map(
      ([id, v]) =>
        `<div class="bal" style="--c:${BANKS[id].color}"><span>${BANKS[id].name}</span><strong>${fmt(v)}</strong></div>`
    )
    .join('');

  $('#hotel-balances').innerHTML = Object.entries(cur.hotels)
    .map(
      ([id, v]) =>
        `<div class="bal" style="--c:${HOTELS[id].color}"><span>${HOTELS[id].icon} ${HOTELS[id].name}</span><strong>${fmt(v)}</strong></div>`
    )
    .join('');

  $('#airline-balances').innerHTML = Object.entries(cur.airlines)
    .map(
      ([id, v]) =>
        `<div class="bal" style="--c:${AIRLINES[id].color}"><span>${AIRLINES[id].short}</span><strong>${fmt(v)}</strong></div>`
    )
    .join('');

  // Cards
  $('#my-cards').innerHTML = cur.cards.length
    ? cur.cards
        .map(
          (c) =>
            `<span class="mini-card" style="border-color:${BANKS[c.bank].color}">${c.name}</span>`
        )
        .join('')
    : `<span class="muted">No credit cards yet</span>`;

  // Earn prefs: which card earns each spend category (income is automatic)
  renderEarnPrefs(cur, snap);

  // Tickets — ordered: origin first, then destination
  const openTickets = cur.tickets || [];
  const doneTickets = cur.completedTickets || [];
  if (!openTickets.length && !doneTickets.length) {
    $('#my-tickets').innerHTML = `<span class="muted">No private tickets yet — draw with Build</span>`;
  } else {
    $('#my-tickets').innerHTML = [
      ...openTickets.map((t) => {
        // Prefer engine-computed ordered progress (snapshot)
        const vFrom = t.originDone != null ? t.originDone : false;
        const vTo = t.destDone != null ? t.destDone : false;
        const progress = vFrom && vTo ? 'ready' : vFrom ? 'half' : 'none';
        const hint = !vFrom
          ? `Land in ${t.from} first`
          : !vTo
            ? `Then land in ${t.to}`
            : 'Complete!';
        return `<div class="ticket open prog-${progress}" title="Ordered ticket: ${hint}">
            <span class="ticket-status" aria-label="Open">○</span>
            <strong>${t.from}${vFrom ? '✓' : ''} → ${t.to}${vTo ? '✓' : ''}</strong>
            <span class="ticket-pts">+${t.points} / −${t.penalty}${
              !vFrom
                ? ` · go ${t.from}`
                : !vTo
                  ? ` · then ${t.to}`
                  : ' · complete'
            }</span>
          </div>`;
      }),
      ...doneTickets.map(
        (t) =>
          `<div class="ticket completed" title="Completed · +${t.points} VP earned">
            <span class="ticket-status" aria-label="Completed">✓</span>
            <strong>${t.from} → ${t.to}${t.race ? ' 🏁' : ''}</strong>
            <span class="ticket-pts">+${t.points} VP · done</span>
          </div>`
      ),
    ].join('');
  }

  // Stats
  $('#my-stats').innerHTML = `
    <span>VP <strong>${cur.vp}</strong></span>
    <span>Segments <strong>${cur.segments}</strong></span>
    <span>Nights <strong>${cur.nights}</strong></span>
    <span>Transfers <strong>${cur.transfersDone}</strong></span>
    <span>Cities <strong>${cur.visited.length}</strong></span>
  `;

  // Achievements
  $('#my-achievements').innerHTML = ACHIEVEMENTS.map((a) => {
    const got = cur.achievements.includes(a.id);
    return `<span class="ach ${got ? 'got' : ''}" title="${a.desc}">${got ? '✓' : '○'} ${a.name}</span>`;
  }).join('');

  // Event
  const ev = cur.turn?.event;
  $('#event-display').innerHTML = ev
    ? `
      <img src="assets/event-card.jpg" alt="" class="event-art" />
      <div>
        <h4>Event: ${ev.name}</h4>
        <p>${ev.desc}</p>
        ${
          cur.turn.transferBonus
            ? `<p class="bonus-tag">Active transfer bonus → ${cur.turn.transferBonus.partner} +${Math.round(cur.turn.transferBonus.bonus * 100)}%</p>`
            : ''
        }
      </div>
    `
    : '';
}

function renderLog(snap) {
  $('#game-log').innerHTML = snap.log
    .map((l) => `<div class="log-line"><span class="r">R${l.round}</span> ${l.msg}</div>`)
    .join('');
}

function renderRaceGoals(snap, cur) {
  const el = $('#race-goals');
  if (!el) return;
  const goals = snap.raceGoals || [];
  if (!goals.length) {
    el.innerHTML = `<p class="muted">No open race goals</p>`;
    return;
  }
  const journey = cur.journey || [];
  el.innerHTML = goals
    .map((t) => {
      // Ordered: origin must appear before destination in journey
      let vFrom = false;
      let vTo = false;
      for (let i = 0; i < journey.length; i++) {
        if (!vFrom) {
          if (journey[i] === t.from) vFrom = true;
        } else if (journey[i] === t.to) {
          vTo = true;
          break;
        }
      }
      const bonus =
        GAME_CONFIG.raceGoalBonusVp != null ? GAME_CONFIG.raceGoalBonusVp : 3;
      const hint = !vFrom
        ? `Race: land ${t.from} first`
        : !vTo
          ? `Race: then land ${t.to}`
          : 'Ready to claim!';
      return `<div class="ticket race ${vFrom && !vTo ? 'prog-half' : vFrom && vTo ? 'prog-ready' : ''}" title="${hint}">
        <span class="ticket-status">🏁</span>
        <strong>${t.from}${vFrom ? '✓' : ''} → ${t.to}${vTo ? '✓' : ''}</strong>
        <span class="ticket-pts">+${t.points}+${bonus}${
          !vFrom ? ` · go ${t.from}` : !vTo ? ` · then ${t.to}` : ' · claim!'
        }</span>
      </div>`;
    })
    .join('');
}

function renderTurnChecklist(cur, snap) {
  const el = $('#turn-checklist');
  if (!el || !cur.turn) return;
  if (cur.isBot) {
    el.innerHTML = `<div class="check-row muted">🤖 Watching ${cur.name} play…</div>`;
    return;
  }
  const t = cur.turn;
  const income = t.incomeDone;
  const freeX = (t.freeTransferLeft || 0) > 0;
  const build = (t.buildLeft || 0) > 0;
  const travel = (t.travelLeft || 0) > 0;
  const tip = suggestNextMove(cur, snap);
  el.innerHTML = `
    <div class="check-title">Your turn</div>
    <div class="check-row ${income ? 'done' : 'now'}">${income ? '✓' : '①'} Event + auto income</div>
    <div class="check-row ${!income ? '' : freeX ? 'now' : 'done'}">${
      freeX || !income ? '↺' : '✓'
    } Free transfer <span class="muted">(book prep)</span></div>
    <div class="check-row ${!income ? '' : build ? 'now' : 'done'}">${
      build || !income ? 'B' : '✓'
    } Build <span class="muted">card · tickets · rest</span></div>
    <div class="check-row ${!income ? '' : travel ? 'now' : 'done'}">${
      travel || !income ? 'T' : '✓'
    } Travel <span class="muted">flight · hotel</span></div>
    <div class="check-row">→ End turn</div>
    ${tip ? `<div class="suggest-tip">💡 ${tip}</div>` : ''}
  `;
}

/** Plain-language next-step for humans on game 1 */
const EARN_PREF_CATS = [
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

/** Short labels for earn-pref dropdowns (side panel is narrow) */
const CARD_SHORT = {
  csp: 'CSP',
  csr: 'CSR',
  cfu: 'Freedom Unlim.',
  cff: 'Freedom Flex',
  amex_gold: 'Amex Gold',
  amex_plat: 'Amex Plat',
  amex_blue: 'Amex Blue',
  delta_gold: 'Delta Gold',
  strata: 'Strata',
  custom_cash: 'Custom Cash',
  double_cash: 'Double Cash',
  bilt_card: 'Bilt',
};

function cardShortName(c) {
  return CARD_SHORT[c.id] || c.name || c.id;
}

/** Side-panel: assign which held card earns each spend category */
function renderEarnPrefs(cur, snap) {
  const el = $('#earn-prefs');
  if (!el) return;
  if (cur.isBot) {
    el.innerHTML = `<p class="muted earn-pref-hint">Bot manages earn prefs automatically.</p>`;
    return;
  }
  if (!cur.cards.length) {
    el.innerHTML = `<p class="muted earn-pref-hint">Hold a credit card to set earn preferences.</p>`;
    return;
  }
  const prefs = cur.earnPrefs || {};
  // Editable when this is the human whose turn it is
  const editable =
    game.phase === 'playing' &&
    game.currentPlayer &&
    !game.currentPlayer.isBot &&
    game.currentPlayer.id === cur.id;
  const live = editable ? game.currentPlayer : null;

  // Only categories the player is likely to see (profile + any preferred)
  const profileCats = Object.keys(cur.character.spendProfile || {});
  const cats = EARN_PREF_CATS.filter(
    (cat) =>
      profileCats.includes(cat) ||
      cat === 'everything' ||
      prefs[cat]
  );

  el.innerHTML = `
    <p class="muted earn-pref-hint">
      Auto income uses these cards. <strong>Auto</strong> = best rate. Changes apply next turn.
    </p>
    <div class="earn-pref-list">
      ${cats
        .map((cat) => {
          const selected = prefs[cat] || '';
          const rateInfo = live
            ? game.earnCardForCategory(live, cat)
            : { rate: 0, card: null };
          const rateLabel =
            rateInfo.card && rateInfo.rate
              ? `${rateInfo.rate}×`
              : editable
                ? '0×'
                : '—';
          return `
        <div class="earn-pref-row">
          <div class="earn-pref-meta">
            <span class="earn-pref-cat">${cat}</span>
            <span class="earn-pref-rate">${rateLabel}</span>
          </div>
          <select class="earn-pref-select" data-earn-cat="${cat}" ${
            editable ? '' : 'disabled'
          } title="${cat} earn card">
            <option value="">Auto · best rate</option>
            ${cur.cards
              .map((c) => {
                const def = CREDIT_CARDS.find((x) => x.id === c.id) || c;
                const r = game.cardEarnRate
                  ? game.cardEarnRate(def, cat)
                  : def.earn && def.earn[cat] != null
                    ? def.earn[cat]
                    : def.earn && def.earn.everything != null
                      ? def.earn.everything
                      : 0;
                return `<option value="${c.id}" ${
                  selected === c.id ? 'selected' : ''
                }>${cardShortName(c)} · ${r}×</option>`;
              })
              .join('')}
          </select>
        </div>`;
        })
        .join('')}
    </div>
  `;

  if (editable) {
    el.querySelectorAll('select[data-earn-cat]').forEach((sel) => {
      sel.onchange = () => {
        try {
          game.setEarnPref(sel.dataset.earnCat, sel.value || null);
          toast(
            sel.value
              ? `${sel.dataset.earnCat} → ${sel.options[sel.selectedIndex].text}`
              : `${sel.dataset.earnCat} → Auto`
          );
          // Light re-render of prefs only would be ideal; full render keeps state consistent
          renderAll();
        } catch (e) {
          toast(e.message, true);
        }
      };
    });
  }
}

function suggestNextMove(cur, snap) {
  if (!cur.turn || cur.isBot) return '';
  const t = cur.turn;
  if (!t.incomeDone) {
    return 'Income runs automatically each turn.';
  }
  if (t.pendingTickets) return 'Keep at least one ticket near cities you can reach.';

  const banks = Object.values(cur.banks || {}).reduce((s, v) => s + (v || 0), 0);
  const air = Object.values(cur.airlines || {}).reduce((s, v) => s + (v || 0), 0);
  const hot = Object.values(cur.hotels || {}).reduce((s, v) => s + (v || 0), 0);

  // Ticket targets (ordered: origin before destination)
  const open = cur.tickets || [];
  const needCity = (() => {
    for (const tk of open) {
      if (!tk.originDone) return tk.from;
      if (!tk.destDone) return tk.to;
    }
    return null;
  })();
  const race = (() => {
    const journey = cur.journey || [];
    for (const tk of snap.raceGoals || []) {
      let o = false;
      let d = false;
      for (const c of journey) {
        if (!o) {
          if (c === tk.from) o = true;
        } else if (c === tk.to) {
          d = true;
          break;
        }
      }
      if (!o) return { ...tk, next: tk.from };
      if (!d) return { ...tk, next: tk.to };
    }
    return null;
  })();

  if ((t.freeTransferLeft || 0) > 0 && banks >= 1000 && air < 10000) {
    const bank =
      cur.cards[0]?.bank ||
      Object.entries(cur.banks).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      'chase';
    const partners = TRANSFERS[bank] || {};
    const airPartner = Object.keys(partners).find((p) => partners[p].type === 'airline');
    if (airPartner) {
      return `Free transfer: move ${BANKS[bank]?.name || bank} → ${airPartner} so you can fly.`;
    }
  }
  if ((t.travelLeft || 0) > 0 && air >= 5000 && needCity) {
    return `Travel: fly to ${needCity} (tickets are ordered: origin → destination).`;
  }
  if ((t.travelLeft || 0) > 0 && air >= 5000 && race) {
    return `Race: fly to ${race.next} for 🏁 ${race.from}→${race.to} (origin first).`;
  }
  if ((t.travelLeft || 0) > 0 && hot >= 15000) {
    return 'Travel: book a signature hotel here (or fly to one) — stays score well.';
  }
  if ((t.freeTransferLeft || 0) > 0 && banks >= 1000 && hot < 15000) {
    return 'Free transfer into a hotel program, then Travel to stay for VP.';
  }
  if ((t.buildLeft || 0) > 0 && cur.cards.length < 2 && (snap.round || 1) <= 4) {
    return 'Build: apply for a second card to diversify banks / earn rates.';
  }
  if ((t.buildLeft || 0) > 0 && open.length === 0) {
    return 'Build: draw trip tickets so you have private goals to race.';
  }
  if ((t.travelLeft || 0) === 0 && (t.buildLeft || 0) === 0) {
    return 'Actions done — End Turn when ready.';
  }
  return 'Transfer (free) to fund miles/hotels, then use Travel to score.';
}

function tutorialSeen() {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch (e) {
    return false;
  }
}

function markTutorialSeen() {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1');
  } catch (e) {
    /* ignore */
  }
}

function maybeShowTutorial(cur, snap) {
  const overlay = $('#tutorial-overlay');
  if (!overlay) return;
  if (cur.isBot || game.phase !== 'playing') {
    overlay.classList.remove('show');
    return;
  }
  if (tutorialSeen() && tutorialStep >= 3) {
    overlay.classList.remove('show');
    return;
  }
  // Show welcome once per browser until dismissed
  if (!tutorialSeen() && tutorialStep === 0 && snap.round === 1) {
    showTutorialCard(cur);
  }
}

function showTutorialCard(cur) {
  const overlay = $('#tutorial-overlay');
  if (!overlay) return;
  const tip =
    STRATEGY_TIPS[cur.character.id] ||
    'Transfer bank points → fly to ticket cities → book hotels for VP.';
  overlay.innerHTML = `
    <div class="tutorial-card">
      <h2>How a turn works</h2>
      <ol class="tutorial-steps">
        <li><strong>Income</strong> — automatic lifestyle roll; set earn prefs (card per category).</li>
        <li><strong>Free transfer</strong> — move points into airlines/hotels (once, free).</li>
        <li><strong>Build</strong> — apply for a card, draw tickets, or rest (+points).</li>
        <li><strong>Travel</strong> — book a flight or a signature hotel stay.</li>
      </ol>
      <p class="tutorial-goal"><strong>Win by VP:</strong> complete private tickets, claim 🏁 race goals, and book hotels. Leftover points convert poorly.</p>
      <p class="char-tip"><em>${cur.character.name}:</em> ${tip}</p>
      <p class="muted">Award seats are limited (2/route each round) — popular flights are a race.</p>
      <div class="tutorial-actions">
        <button type="button" class="btn primary" id="btn-tutorial-go">Got it — play</button>
        <button type="button" class="btn" id="btn-tutorial-skip">Don't show again</button>
      </div>
    </div>
  `;
  overlay.classList.add('show');
  $('#btn-tutorial-go').onclick = () => {
    tutorialStep = 3;
    overlay.classList.remove('show');
  };
  $('#btn-tutorial-skip').onclick = () => {
    markTutorialSeen();
    tutorialStep = 3;
    overlay.classList.remove('show');
  };
}

function renderPhasePanel(cur, snap) {
  const panel = $('#phase-panel');
  if (!cur.turn) return;

  // Bot turn — human controls locked
  if (cur.isBot) {
    const inc = cur.turn.lastIncome;
    panel.innerHTML = `
      <h3>🤖 Bot turn</h3>
      <p><strong>${cur.name}</strong> (${cur.character.name}) is playing automatically…</p>
      <p class="muted">Event: ${cur.turn.event ? cur.turn.event.name : '—'}</p>
      ${
        inc
          ? `<div class="spend-roll-box"><div class="spend-roll-label">Auto income +${fmt(inc.totalEarned)}</div>
             <div class="spend-roll-chips">${formatSpendRollHtml(cur.turn.spendRoll)}</div></div>`
          : ''
      }
      <p class="char-tip">Bots also race 🏁 public goals and compete for award seats.</p>
    `;
    return;
  }

  // Income is automatic at turn start — show summary then actions
  if (!cur.turn.incomeDone) {
    // Safety: should not happen; force income
    try {
      game.doIncome();
      renderAll();
    } catch (e) {
      panel.innerHTML = `<p class="bonus-tag" style="color:var(--danger)!important">${e.message}</p>`;
    }
    return;
  }

  if (cur.turn.pendingTickets) {
    panel.innerHTML = `
      <h3>Choose trip tickets (keep ≥1)</h3>
      <div class="ticket-pick" id="ticket-pick">
        ${cur.turn.pendingTickets
          .map(
            (t) => `
          <label class="ticket pick">
            <input type="checkbox" value="${t.id}" checked />
            <strong>${t.from} → ${t.to}</strong>
            <span>+${t.points} / −${t.penalty}</span>
          </label>
        `
          )
          .join('')}
      </div>
      <button type="button" class="btn primary" id="btn-keep-tickets">Confirm keep</button>
    `;
    $('#btn-keep-tickets').onclick = () => {
      const ids = $$('#ticket-pick input:checked').map((i) => i.value);
      try {
        game.resolveTicketDraw(ids);
        renderAll();
      } catch (e) {
        toast(e.message, true);
      }
    };
    return;
  }

  // Actions — always read LIVE turn (not a stale snapshot copy)
  const liveTurn = game.currentPlayer && game.currentPlayer.turn;
  const tAct = liveTurn || cur.turn || {};
  const freeLeft = Number(tAct.freeTransferLeft) || 0;
  const buildLeft = Number(tAct.buildLeft) || 0;
  const travelLeft = Number(tAct.travelLeft) || 0;
  const freeX = freeLeft > 0;
  const buildOk = buildLeft > 0;
  const travelOk = travelLeft > 0;
  const canTransfer = freeX || buildOk;
  const restPts = GAME_CONFIG.restPlanPoints || 3000;
  const lastInc = tAct.lastIncome || cur.turn.lastIncome;
  const incomeHtml = lastInc
    ? `<div class="spend-roll-box">
        <div class="spend-roll-label">Auto income +${fmt(lastInc.totalEarned)} pts</div>
        <div class="spend-roll-chips">${formatSpendRollHtml(cur.turn.spendRoll)}</div>
        ${
          lastInc.lines && lastInc.lines.length
            ? `<ul class="income-lines">${lastInc.lines
                .map(
                  (l) =>
                    `<li><span class="spend-cat">${l.cat}</span> $${fmt(l.spend)} × ${
                      l.rate
                    }× ${l.card || '—'} → <strong>${fmt(l.pts)}</strong></li>`
                )
                .join('')}</ul>`
            : ''
        }
        <p class="muted" style="margin:0.35rem 0 0;font-size:0.75rem">Change earn prefs under Credit cards (applies next income).</p>
      </div>`
    : '';

  panel.innerHTML = `
    <h3>Actions</h3>
    ${incomeHtml}
    <p class="action-economy muted">
      ${freeX ? `<span class="pill free">Free transfer ×${freeLeft}</span>` : '<span class="pill used">No free transfer</span>'}
      <span class="pill ${buildOk ? 'ok' : 'used'}">Build ${buildLeft}</span>
      <span class="pill ${travelOk ? 'ok' : 'used'}">Travel ${travelLeft}</span>
    </p>
    <div class="action-section">
      <div class="action-label">↺ Transfer ${freeX ? '(free)' : buildOk ? '(costs Build)' : '(none left)'}</div>
      <button type="button" class="btn action" data-act="transfer" ${
        canTransfer ? '' : 'disabled'
      } title="${
        canTransfer
          ? 'Move bank points into airline miles or hotel points'
          : 'No free transfer or Build left'
      }">🔄 Transfer Points</button>
    </div>
    <div class="action-section">
      <div class="action-label">Build ${buildOk ? `×${buildLeft}` : '— used'}</div>
      <div class="action-grid">
        <button type="button" class="btn action" data-act="card" ${
          buildOk ? '' : 'disabled'
        } title="Open a new credit card (signup + earn rates)">💳 Apply for Card</button>
        <button type="button" class="btn action" data-act="tickets" ${
          buildOk ? '' : 'disabled'
        } title="Draw 2 private trip tickets, keep ≥1">🎫 Draw Tickets</button>
        <button type="button" class="btn action" data-act="rest" ${
          buildOk ? '' : 'disabled'
        } title="Gain bank points without traveling">📝 Rest (+${fmt(restPts)})</button>
      </div>
    </div>
    <div class="action-section">
      <div class="action-label">Travel ${travelOk ? `×${travelLeft}` : '— used'}</div>
      <div class="action-grid">
        <button type="button" class="btn action" data-act="flight" ${
          travelOk ? '' : 'disabled'
        } title="Fly (uses 1 award ticket for that airline this round)">✈️ Book Flight</button>
        <button type="button" class="btn action" data-act="hotel" ${
          travelOk ? '' : 'disabled'
        } title="1 night at a signature hotel in your city">🏨 Book Hotel</button>
      </div>
    </div>
    <button type="button" class="btn primary end-turn" id="btn-end-turn">End Turn →</button>
  `;

  panel.querySelectorAll('[data-act]').forEach((btn) => {
    btn.onclick = () => handleAction(btn.dataset.act, cur);
  });

  $('#btn-end-turn').onclick = () => {
    try {
      const res = game.endTurn();
      if (res.gameOver) {
        renderGameOver();
      } else {
        renderAll();
        toast(`${game.currentPlayer.name}'s turn`);
      }
    } catch (e) {
      toast(e.message, true);
    }
  };
}

function handleAction(act, cur) {
  try {
    if (act === 'card') openCardModal();
    else if (act === 'transfer') openTransferModal();
    else if (act === 'flight') openFlightModal();
    else if (act === 'hotel') openHotelModal();
    else if (act === 'tickets') {
      game.drawTickets();
      renderAll();
    } else if (act === 'rest') {
      game.restPlan();
      renderAll();
    }
  } catch (e) {
    toast(e.message, true);
  }
}

// ——— Modals ———

function openModal(title, bodyHtml, onConfirm) {
  const overlay = $('#modal-overlay');
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  overlay.classList.add('open');

  const confirm = $('#modal-confirm');
  confirm.onclick = async () => {
    try {
      await Promise.resolve(onConfirm());
      closeModal();
      // If flights were booked, animate plane + headshot before full UI refresh
      if (game.flightAnims && game.flightAnims.length) {
        const snap = game.snapshot();
        const cur = snap.players[snap.currentPlayerIndex];
        mapCityOverride = {
          playerId: game.flightAnims[0].playerId,
          hide: true,
        };
        renderPlayersBar(snap);
        renderMap(snap);
        renderHand(cur, snap);
        renderLog(snap);
        renderPhasePanel(cur, snap);
        await playPendingFlightAnims();
        mapCityOverride = null;
      }
      renderAll();
    } catch (e) {
      toast(e.message, true);
    }
  };
  $('#modal-cancel').onclick = closeModal;
}

function closeModal() {
  $('#modal-overlay').classList.remove('open');
}

function openCardModal() {
  const p = game.currentPlayer;
  const held = new Set(p.cards.map((c) => c.id));
  const available = CREDIT_CARDS.filter((c) => !held.has(c.id));

  openModal(
    'Apply for a credit card',
    `
      <p>Limit: ${p.cards.length} / ${game.cardLimit(p)}</p>
      <div class="card-pick-list">
        ${available
          .map(
            (c) => `
          <label class="card-option">
            <input type="radio" name="card" value="${c.id}" />
            <div>
              <strong>${c.name}</strong>
              <span class="bank-tag" style="background:${BANKS[c.bank].color}">${BANKS[c.bank].name}</span>
              <p>Earn: ${Object.entries(c.earn)
                .map(([k, v]) => `${v}× ${k}`)
                .join(', ')}</p>
              <p>Signup: ${fmt(c.signupBonus)} after $${fmt(c.minSpend)} spend · AF $${c.annualFee}</p>
            </div>
          </label>
        `
          )
          .join('')}
      </div>
    `,
    () => {
      const sel = $('#modal-body input[name=card]:checked');
      if (!sel) throw new Error('Select a card');
      game.applyForCard(sel.value);
      toast('Card approved!');
    }
  );
}

function openTransferModal() {
  const p = game.currentPlayer;
  const banksWithPts = Object.entries(p.banks).filter(([, v]) => v >= 1000);

  openModal(
    'Transfer bank points',
    `
      <label class="field">From bank
        <select id="xfer-bank">
          ${banksWithPts
            .map(
              ([id, v]) =>
                `<option value="${id}">${BANKS[id].name} (${fmt(v)})</option>`
            )
            .join('') || '<option value="">No bank has 1,000+</option>'}
        </select>
      </label>
      <label class="field">To partner
        <select id="xfer-partner"></select>
      </label>
      <label class="field">Amount (min 1,000)
        <input type="number" id="xfer-amt" min="1000" step="1000" value="10000" />
      </label>
      <p id="xfer-preview" class="muted"></p>
    `,
    () => {
      const bank = $('#xfer-bank').value;
      const partner = $('#xfer-partner').value;
      const amount = +$('#xfer-amt').value;
      game.transferPoints(bank, partner, amount);
      toast('Transfer complete');
    }
  );

  const fillPartners = () => {
    const bank = $('#xfer-bank').value;
    const partners = TRANSFERS[bank] || {};
    const bonus = p.turn?.transferBonus;
    $('#xfer-partner').innerHTML = Object.entries(partners)
      .map(([id, info]) => {
        const name =
          info.type === 'hotel'
            ? HOTELS[id]?.name || id
            : AIRLINES[id]?.name || id;
        const b =
          bonus && bonus.partner === id
            ? ` ⭐ +${Math.round(bonus.bonus * 100)}%`
            : '';
        return `<option value="${id}">${name} (${info.ratio}:1 ${info.type})${b}</option>`;
      })
      .join('');
    updatePreview();
  };

  const updatePreview = () => {
    const bank = $('#xfer-bank').value;
    const partner = $('#xfer-partner').value;
    const amount = +$('#xfer-amt').value || 0;
    if (!bank || !partner) return;
    const { ratio } = TRANSFERS[bank][partner];
    let out = Math.floor(amount * ratio);
    const bonus = p.turn?.transferBonus;
    if (bonus && bonus.partner === partner) {
      out = Math.floor(out * (1 + bonus.bonus));
    }
    $('#xfer-preview').textContent = `You will receive ~${fmt(out)} ${partner}`;
  };

  fillPartners();
  $('#xfer-bank').onchange = fillPartners;
  $('#xfer-partner').onchange = updatePreview;
  $('#xfer-amt').oninput = updatePreview;
}

function openFlightModal() {
  const p = game.currentPlayer;
  const from = p.city;
  const options = listFlightOptions(from);
  const flightMult = (p.turn && p.turn.flightMult) || 1;
  const flightsThisTurn = (p.turn && p.turn.flightsThisTurn) || 0;

  openModal(
    `Book flight from ${from}`,
    `
      <p class="muted">Nonstop or <strong>1 stop</strong> (same airline). Each airline has <strong>${GAME_CONFIG.awardsPerAirlinePerRound || 2} award tickets/round</strong> — one itinerary (incl. connection) uses 1 ticket.</p>
      <p class="muted" style="margin-top:0.25rem">Left this round: UA ${awardsLeft('united')} · DL ${awardsLeft('delta')} · AA ${awardsLeft('american')}</p>
      <label class="field flight-search-field">
        Search destination
        <input type="search" id="flight-search" placeholder="e.g. Miami, LAX, Denver…" autocomplete="off" />
      </label>
      <label class="field" style="margin-bottom:0.5rem">
        <span>Show
          <select id="flight-filter">
            <option value="nonstop">Nonstop only</option>
            <option value="all">All (incl. 1-stop)</option>
            <option value="onestop">1-stop only</option>
          </select>
        </span>
      </label>
      <p id="flight-search-count" class="muted" style="margin:0 0 0.4rem;font-size:0.78rem"></p>
      <div class="flight-list" id="flight-list"></div>
      <label class="field">Pay with airline
        <select id="flight-airline"></select>
      </label>
      <p id="flight-cost" class="muted"></p>
    `,
    () => {
      const sel = $('#modal-body input[name=flight]:checked');
      if (!sel) throw new Error('Select a flight');
      const airline = $('#flight-airline').value;
      if (!airline) throw new Error('Select an airline');
      const to = sel.dataset.to;
      const via = sel.dataset.via || null;
      const res = game.bookFlight(to, airline, via);
      let msg = res.via
        ? `Landed in ${res.to} via ${res.via} (+${res.segments} segments)`
        : `Landed in ${res.to}!`;
      if (res.completedTrips && res.completedTrips.length) {
        msg +=
          ' · Ticket: ' +
          res.completedTrips.map((t) => `${t.from}→${t.to}`).join(', ');
      }
      if (res.raceClaims && res.raceClaims.length) {
        msg +=
          ' · 🏁 Race claimed: ' +
          res.raceClaims.map((t) => `${t.from}→${t.to}`).join(', ');
      }
      toast(msg);
    }
  );

  const cityMatchesQuery = (cityId, q) => {
    if (!q) return true;
    const city = CITIES[cityId];
    if (!city) return cityId.toLowerCase().includes(q);
    const name = (city.name || '').toLowerCase();
    const id = (city.id || '').toLowerCase();
    // Match code, full name, or start of any word (e.g. "los" → Los Angeles)
    if (id.includes(q) || name.includes(q)) return true;
    if (name.split(/\s+/).some((w) => w.startsWith(q))) return true;
    // Common aliases
    const aliases = {
      nyc: ['new york', 'ny'],
      lax: ['los angeles', 'la'],
      sfo: ['san francisco', 'sf'],
      ord: ['chicago'],
      dfw: ['dallas'],
      iah: ['houston'],
      sea: ['seattle'],
      den: ['denver'],
      atl: ['atlanta'],
      mia: ['miami'],
      bos: ['boston'],
      was: ['washington', 'dc', 'd.c.', 'washington dc'],
      phx: ['phoenix'],
      las: ['las vegas', 'vegas'],
      msp: ['minneapolis'],
      msy: ['new orleans'],
    };
    const al = aliases[id] || [];
    if (al.some((a) => a.includes(q) || q.includes(a))) return true;
    return false;
  };

  const renderFlightList = () => {
    const filter = ($('#flight-filter') && $('#flight-filter').value) || 'nonstop';
    const rawQ = ($('#flight-search') && $('#flight-search').value) || '';
    const q = rawQ.trim().toLowerCase();

    let filtered = options.filter((opt) => {
      if (filter === 'nonstop' && opt.stops !== 0) return false;
      if (filter === 'onestop' && opt.stops !== 1) return false;
      if (!q) return true;
      // Match destination, via city, or path codes
      if (cityMatchesQuery(opt.to, q)) return true;
      if (opt.via && cityMatchesQuery(opt.via, q)) return true;
      const path = `${opt.to} ${opt.via || ''}`.toLowerCase();
      if (path.includes(q)) return true;
      return false;
    });

    // Prefer exact code / name matches first when searching
    if (q) {
      filtered = [...filtered].sort((a, b) => {
        const aExact =
          a.to.toLowerCase() === q ||
          (CITIES[a.to] && CITIES[a.to].name.toLowerCase() === q)
            ? 0
            : 1;
        const bExact =
          b.to.toLowerCase() === q ||
          (CITIES[b.to] && CITIES[b.to].name.toLowerCase() === q)
            ? 0
            : 1;
        return aExact - bExact || a.stops - b.stops || a.baseCost - b.baseCost;
      });
    }

    const countEl = $('#flight-search-count');
    if (countEl) {
      countEl.textContent = q
        ? `${filtered.length} route${filtered.length === 1 ? '' : 's'} matching “${rawQ.trim()}”`
        : `${filtered.length} route${filtered.length === 1 ? '' : 's'} shown`;
    }

    const list = $('#flight-list');
    if (!filtered.length) {
      list.innerHTML = q
        ? `<p class="muted">No flights match “${rawQ.trim()}”. Try a city name or code (e.g. Miami, LAX).</p>`
        : `<p class="muted">No flights in this filter. Try “All”.</p>`;
      const airSel = $('#flight-airline');
      if (airSel) airSel.innerHTML = '';
      const costEl = $('#flight-cost');
      if (costEl) costEl.textContent = '';
      return;
    }
    list.innerHTML = filtered
      .map((opt, idx) => {
        const destName = CITIES[opt.to] ? CITIES[opt.to].name : opt.to;
        const path = opt.via
          ? `${from} → ${opt.via} → ${opt.to}`
          : `${from} → ${opt.to}`;
        const stopLabel = opt.stops === 0 ? 'Nonstop' : `1 stop via ${opt.via}`;
        const airLabels = opt.airlines
          .map((a) => (AIRLINES[a] ? AIRLINES[a].short : a))
          .join('/');
        const helpsTicket = (p.tickets || []).some((t) => {
          // Ordered: only highlight if this city is the next check on the ticket
          const j = p.journey || [];
          let o = false;
          for (const c of j) {
            if (!o) {
              if (c === t.from) o = true;
            } else if (c === t.to) {
              return false; // already complete path
            }
          }
          if (!o) return opt.to === t.from || opt.via === t.from;
          return opt.to === t.to || opt.via === t.to;
        });
        const helpsRace = (game.raceGoals || []).some((t) => {
          const j = p.journey || [];
          let o = false;
          for (const c of j) {
            if (!o) {
              if (c === t.from) o = true;
            } else if (c === t.to) {
              return false;
            }
          }
          if (!o) return opt.to === t.from || opt.via === t.from;
          return opt.to === t.to || opt.via === t.to;
        });
        // Airline award inventory (any listed airline still open?)
        const openAirs = (opt.airlines || []).filter((a) => awardsLeft(a) > 0);
        const soldOut = openAirs.length === 0;
        const awardHint = soldOut
          ? 'FULL'
          : openAirs
              .map((a) => {
                const sh =
                  a === 'united' ? 'UA' : a === 'delta' ? 'DL' : a === 'american' ? 'AA' : a;
                return `${sh}:${awardsLeft(a)}`;
              })
              .join(' ');
        return `
          <label class="card-option ${soldOut ? 'sold-out' : ''}">
            <input type="radio" name="flight" value="${idx}"
              data-to="${opt.to}"
              data-via="${opt.via || ''}"
              data-airlines='${JSON.stringify(openAirs.length ? openAirs : opt.airlines)}'
              data-cost="${opt.baseCost}"
              data-stops="${opt.stops}"
              ${soldOut ? 'disabled' : ''} />
            <div>
              <strong>${path}</strong> (${destName})${helpsTicket ? ' 🎫' : ''}${
                helpsRace ? ' 🏁' : ''
              } · ${awardHint}
              <p>${stopLabel} · ${airLabels} · base ${fmt(opt.baseCost)} mi${opt.stops ? ' · 2 segments' : ''} · 1 award ticket</p>
            </div>
          </label>
        `;
      })
      .join('');
    list.querySelectorAll('input[name=flight]').forEach((r) => {
      r.onchange = syncAirlines;
    });
    const first = list.querySelector('input[name=flight]:not([disabled])');
    if (first) {
      first.checked = true;
      syncAirlines();
    } else {
      const airSel = $('#flight-airline');
      if (airSel) airSel.innerHTML = '';
      const costEl = $('#flight-cost');
      if (costEl)
        costEl.textContent =
          'No airline has award tickets left for these routes this round.';
    }
  };

  const syncAirlines = () => {
    const sel = $('#modal-body input[name=flight]:checked');
    if (!sel) return;
    const airlines = JSON.parse(sel.dataset.airlines);
    let cost = Math.floor(+sel.dataset.cost * flightMult);
    if (p.character.special === 'polished_routes') {
      cost = Math.floor(cost * 0.85);
    }
    if (p.character.special === 'cheap_flight' && flightsThisTurn === 0) {
      cost = Math.floor(cost * 0.7);
    }
    const segs = +sel.dataset.stops === 1 ? 2 : 1;
    $('#flight-airline').innerHTML = airlines
      .map((a) => {
        const bal = p.airlines[a] || 0;
        const aw = awardsLeft(a);
        const ok = bal >= cost && aw > 0;
        const name = AIRLINES[a] ? AIRLINES[a].name : a;
        let why = '';
        if (aw <= 0) why = ' — no award tickets';
        else if (bal < cost) why = ' — short miles';
        return `<option value="${a}" ${ok ? '' : 'disabled'}>${name} (${fmt(bal)} mi · ${aw} tix)${why}</option>`;
      })
      .join('');
    $('#flight-cost').textContent = `Cost: ${fmt(cost)} miles · ${segs} segment${segs > 1 ? 's' : ''} · 1 award ticket · Travel`;
  };

  $('#flight-filter').onchange = renderFlightList;
  const searchInput = $('#flight-search');
  if (searchInput) {
    searchInput.oninput = renderFlightList;
    searchInput.onkeydown = (e) => {
      // Escape clears search
      if (e.key === 'Escape') {
        searchInput.value = '';
        renderFlightList();
        e.preventDefault();
      }
    };
    // Focus search for quick typing
    setTimeout(() => searchInput.focus(), 50);
  }
  renderFlightList();
}

function previewHotelStayVp(p, h, cityId) {
  let vp = Math.round((h.vp || 2) * (GAME_CONFIG.hotelVpMultiplier || 1));
  vp += (p.turn && p.turn.hotelVpBonus) || 0;
  if (!(p._hotelCities && p._hotelCities.has(cityId))) vp += 1;
  if (p.character && p.character.special === 'group_rate') vp += 3;
  return vp;
}

function openHotelModal() {
  const p = game.currentPlayer;
  const city = CITIES[p.city];
  const hotels = city.hotels || [];
  let hotelMult =
    ((p.turn && p.turn.hotelMult) || 1) *
    (GAME_CONFIG.hotelCostMultiplier || 1);
  if (p.character.special === 'group_rate') hotelMult *= 0.75;
  const freeNight = p.turn && p.turn.freeNightAvailable;
  const claims = game.hotelClaims || {};

  openModal(
    `Book 1 night in ${city.name}`,
    `
      <p class="muted">First player to stay <strong>claims</strong> the property and earns its VP. Claimed hotels are locked for everyone else.</p>
      <div class="flight-list">
        ${hotels
          .map((h) => {
            const cost = Math.floor(h.cost * hotelMult);
            const vp = previewHotelStayVp(p, h, city.id);
            const bal = p.hotels[h.brand] || 0;
            const claim = claims[h.id];
            const claimedByMe = claim && claim.playerId === p.id;
            const claimedByOther = claim && claim.playerId !== p.id;
            const already = p.stayedHotels.has(h.id) || !!claim;
            const brandName = HOTELS[h.brand] ? HOTELS[h.brand].name : h.brand;
            const canPay = freeNight || bal >= cost;
            const disabled = already || !canPay;
            const icon =
              (HOTELS[h.brand] && HOTELS[h.brand].logo) ||
              h.icon ||
              `assets/hotels/brands/${h.brand}.png`;
            let note = '';
            if (claimedByMe) note = ' · <em>you claimed</em>';
            else if (claimedByOther)
              note = ` · <em>claimed by ${claim.playerName}</em>`;
            else if (!canPay) note = ' · <em>short on points</em>';
            return `
              <label class="card-option hotel-pick ${disabled ? 'disabled-opt' : ''}${claimedByOther ? ' hotel-claimed' : ''}">
                <input type="radio" name="hotel" value="${h.id}"
                  ${disabled ? 'disabled' : ''} />
                <img class="hotel-icon hotel-icon-lg" src="${icon}" alt="" width="64" height="64" loading="lazy" />
                <div>
                  <strong>${h.name}</strong>
                  <span class="bank-tag" style="background:${HOTELS[h.brand] ? HOTELS[h.brand].color : '#666'}">${brandName}</span>
                  <p>${fmt(cost)} pts · <strong>${vp} VP</strong> · balance ${fmt(bal)} ${brandName}${note}</p>
                </div>
              </label>
            `;
          })
          .join('')}
      </div>
      ${freeNight ? '<p class="bonus-tag">Free Night Certificate active — stay is free!</p>' : ''}
    `,
    () => {
      const sel = $('#modal-body input[name=hotel]:checked');
      if (!sel) throw new Error('Select a hotel');
      // Re-check live claim state at confirm (another player may have claimed)
      const live = game.hotelClaims && game.hotelClaims[sel.value];
      if (live) {
        throw new Error(
          `Too late — ${live.playerName} already claimed this hotel`
        );
      }
      const res = game.bookHotel(sel.value);
      toast(`Claimed ${res.hotel.name} · +${res.stayVp} VP (locked for others)`);
    }
  );
}

function renderGameOver() {
  showScreen('screen-gameover');
  const snap = game.snapshot();
  $('#winner-banner').textContent = `🏆 ${snap.winner.name} wins with ${snap.winner.vp} VP!`;
  $('#final-table').innerHTML = `
    <table>
      <thead><tr><th>#</th><th>Player</th><th>Character</th><th>VP</th><th>Cities</th><th>Segments</th><th>Longest</th></tr></thead>
      <tbody>
        ${snap.finalScores
          .map(
            (s, i) => `
          <tr class="${i === 0 ? 'winner-row' : ''}">
            <td>${i + 1}</td>
            <td>${s.name}</td>
            <td>${s.character}</td>
            <td><strong>${s.vp}</strong></td>
            <td>${s.cities}</td>
            <td>${s.segments}</td>
            <td>${s.longest}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;
}

// ——— Rules tab ———

function wireNav() {
  $('#btn-show-rules')?.addEventListener('click', () => {
    showScreen('screen-rules');
  });
  $('#btn-back-setup')?.addEventListener('click', () => showScreen('screen-setup'));
  $('#btn-back-game')?.addEventListener('click', () => {
    if (game.phase === 'playing') showScreen('screen-game');
    else showScreen('screen-setup');
  });
  $('#btn-how-to')?.addEventListener('click', () => showScreen('screen-rules'));
  $('#btn-new-game')?.addEventListener('click', () => {
    setupSelections = [];
    game.phase = 'setup';
    renderSetup();
    showScreen('screen-setup');
  });

  $('#start-game').onclick = () => {
    try {
      ensureMusic();
      botRunning = false;
      game.startGame(setupSelections);
      showScreen('screen-game');
      renderAll();
      const cur = game.currentPlayer;
      toast(
        cur.isBot
          ? `Round 1 — 🤖 ${cur.name} starts`
          : `Round 1 — ${cur.name} starts`
      );
    } catch (e) {
      toast(e.message, true);
    }
  };

  // Quick demo: 1 human + 2 bots
  $('#btn-quick-demo')?.addEventListener('click', () => {
    ensureMusic();
    const picks = [...CHARACTERS].sort(() => Math.random() - 0.5).slice(0, 3);
    setupSelections = picks.map((c, i) => ({
      characterId: c.id,
      name: i === 0 ? 'You' : `Bot ${c.name.replace(/^The /, '')}`,
      isBot: i !== 0,
    }));
    botRunning = false;
    game.startGame(setupSelections);
    showScreen('screen-game');
    renderAll();
    toast('Quick demo: you + 2 bots');
  });
}

// Init
wireNav();
initMusicUI();
renderSetup();
showScreen('screen-setup'); // sets desiredTrack = menu (play waits for gesture)
