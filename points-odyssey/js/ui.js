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
} from './game.js';
import { BANKS, HOTELS, AIRLINES, getRoute } from './data.js';
import { playBotActions } from './bot.js';

const game = new Game();
let setupSelections = [];
/** Prevent overlapping bot auto-play */
let botRunning = false;
const BOT_STEP_MS = 700;

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

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

/** Format character special + spend appearance probs for tooltips */
function characterSkillsHtml(c) {
  const cardLimit = GAME_CONFIG.defaultCardLimit + (c.cardLimitBonus || 0);
  const home = CITIES[c.homeCity] ? CITIES[c.homeCity].name : c.homeCity;
  const lines = formatSpendProfileLines(c);
  const mults = lines
    .map((x) => `<li><strong>${x.pct}%</strong> ${x.cat}</li>`)
    .join('');
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
        <p class="skill-tip-special">${c.specialDesc}</p>
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
  return `${c.name}\nSpend odds: ${lines}\nSkill: ${c.specialDesc}\nEarn: credit cards only (0× default)`;
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
  $(`#${id}`)?.classList.add('active');
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
          <p class="special">${c.specialDesc}</p>
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
  if (game.phase === 'ended') {
    renderGameOver();
    return;
  }
  if (game.phase !== 'playing') return;

  const snap = game.snapshot();
  const cur = snap.players[snap.currentPlayerIndex];

  $('#round-label').textContent = `Round ${snap.round} / ${snap.maxRounds}`;
  $('#turn-label').textContent = cur.isBot
    ? `🤖 ${cur.name}'s turn`
    : `${cur.name}'s turn`;
  $('#actions-left').textContent = `${(cur.turn && cur.turn.actionsLeft) || 0} actions left`;

  renderPlayersBar(snap);
  renderMap(snap);
  renderHand(cur, snap);
  renderLog(snap);
  renderPhasePanel(cur, snap);

  // Auto-play bots
  if (cur.isBot && !botRunning) {
    scheduleBotTurn();
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

async function scheduleBotTurn() {
  if (botRunning) return;
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
    for (const line of logs.slice(0, 4)) {
      // brief feedback; full detail in game log
    }
    if (logs.length) {
      toast(`🤖 ${logs[logs.length - 1]}`);
    }
    renderAll();
    await sleep(BOT_STEP_MS);

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
    console.error(e);
    toast(`Bot error: ${e.message}`, true);
    // Try to unstick: end turn if possible
    try {
      if (game.phase === 'playing' && game.currentPlayer.isBot) {
        if (!game.currentPlayer.turn.incomeDone) {
          game.doIncome(game.autoAllocate(game.currentPlayer));
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
    const color = AIRLINES[primary]?.color || '#888';
    const key = [r.a, r.b].sort().join('-');
    const owned = cur.network.includes(key);
    routesHtml += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
      stroke="${color}" stroke-width="${owned ? 5 : 2}"
      stroke-opacity="${owned ? 0.95 : 0.35}"
      stroke-dasharray="${owned ? 'none' : '6 4'}" />`;
  }

  // Cities
  let citiesHtml = '';
  for (const c of Object.values(CITIES)) {
    const x = (c.x / 100) * w;
    const y = (c.y / 100) * h;
    const here = snap.players.filter((p) => p.city === c.id);
    const isCur = cur.city === c.id;
    citiesHtml += `
      <g class="city-node" data-city="${c.id}" style="cursor:pointer">
        <circle cx="${x}" cy="${y}" r="${isCur ? 14 : 10}"
          fill="${isCur ? '#d4a017' : '#1a2744'}"
          stroke="#f0e6d3" stroke-width="2" />
        <text x="${x}" y="${y - 18}" text-anchor="middle" fill="#f0e6d3"
          font-size="11" font-weight="600">${c.id}</text>
        ${here
          .map(
            (p, i) =>
              `<circle cx="${x + 12 + i * 8}" cy="${y + 12}" r="5" fill="${BANKS.chase.color}" stroke="#fff" stroke-width="1">
                <title>${p.name}</title>
              </circle>`
          )
          .join('')}
      </g>
    `;
  }

  // Player pawns with colors
  const pawnColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
  let pawns = '';
  snap.players.forEach((p, i) => {
    const c = CITIES[p.city];
    const x = (c.x / 100) * w + (i % 3) * 6 - 6;
    const y = (c.y / 100) * h + Math.floor(i / 3) * 6;
    pawns += `<circle cx="${x}" cy="${y}" r="6" fill="${pawnColors[i]}" stroke="#fff" stroke-width="1.5">
      <title>${p.name}</title></circle>`;
  });

  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = `
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

function showCityInfo(cityId, cur) {
  const city = CITIES[cityId];
  const routes = ROUTES.filter((r) => r.a === cityId || r.b === cityId);
  const stayed = new Set(cur.stayedHotels || []);
  const panel = $('#city-info');
  panel.innerHTML = `
    <h3>${city.name} (${city.id})</h3>
    <p><strong>Signature hotels</strong> <span class="muted">(1 night each, once per game)</span>:</p>
    <ul>
      ${(city.hotels || [])
        .map((h) => {
          const brand = HOTELS[h.brand] ? HOTELS[h.brand].name : h.brand;
          const done = stayed.has(h.id) ? ' ✓ stayed' : '';
          const cost = Math.floor(
            h.cost * (GAME_CONFIG.hotelCostMultiplier || 1)
          );
          const vp = Math.round((h.vp || 2) * (GAME_CONFIG.hotelVpMultiplier || 1));
          return `<li><strong>${h.name}</strong><br/><span class="muted">${brand} · ${fmt(cost)} pts · ${vp} VP${done}</span></li>`;
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

  // Tickets — open + completed (completed stay visible, marked done)
  const openTickets = cur.tickets || [];
  const doneTickets = cur.completedTickets || [];
  if (!openTickets.length && !doneTickets.length) {
    $('#my-tickets').innerHTML = `<span class="muted">No trip tickets yet</span>`;
  } else {
    $('#my-tickets').innerHTML = [
      ...openTickets.map((t) => {
        const vFrom = cur.visited.includes(t.from);
        const vTo = cur.visited.includes(t.to);
        const progress =
          vFrom && vTo
            ? 'ready'
            : vFrom || vTo
              ? 'half'
              : 'none';
        return `<div class="ticket open" title="Visit both cities to complete">
            <span class="ticket-status" aria-label="Open">○</span>
            <strong>${t.from}${vFrom ? '✓' : ''} → ${t.to}${vTo ? '✓' : ''}</strong>
            <span class="ticket-pts">+${t.points} / −${t.penalty}${
              progress === 'half' ? ' · 1/2' : ''
            }</span>
          </div>`;
      }),
      ...doneTickets.map(
        (t) =>
          `<div class="ticket completed" title="Completed · +${t.points} VP earned">
            <span class="ticket-status" aria-label="Completed">✓</span>
            <strong>${t.from} → ${t.to}</strong>
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

function renderPhasePanel(cur, snap) {
  const panel = $('#phase-panel');
  if (!cur.turn) return;

  // Bot turn — human controls locked
  if (cur.isBot) {
    panel.innerHTML = `
      <h3>🤖 Bot turn</h3>
      <p><strong>${cur.name}</strong> (${cur.character.name}) is playing automatically…</p>
      <p class="muted">Event: ${cur.turn.event ? cur.turn.event.name : '—'}</p>
      <div class="spend-roll-box">
        <div class="spend-roll-label">Lifestyle spend</div>
        <div class="spend-roll-chips">${formatSpendRollHtml(cur.turn.spendRoll)}</div>
      </div>
      <p class="char-tip">Strategy: complete tickets by flying to both cities, transfer points, book hotels for VP, open a second card when useful.</p>
    `;
    return;
  }

  if (!cur.turn.incomeDone) {
    panel.innerHTML = `
      <h3>Phase 2 — Income</h3>
      <p class="char-tip"><em>${cur.character.name}</em> lifestyle roll — categories appear by your spend odds. Earn = spend × <strong>card rate</strong> (0× without a card).</p>
      <div class="spend-roll-box">
        <div class="spend-roll-label">This turn’s spending</div>
        <div class="spend-roll-chips">${formatSpendRollHtml(cur.turn.spendRoll)}</div>
      </div>
      ${
        !cur.cards.length
          ? `<p class="bonus-tag" style="color:var(--danger)!important">No cards held — income will earn 0 pts. Apply for a card after income!</p>`
          : ''
      }
      <div class="income-actions">
        <button type="button" class="btn primary" id="btn-auto-income">Earn points on this spend</button>
        <button type="button" class="btn" id="btn-reroll-spend" ${
          (cur.turn.spendRerollsLeft || 0) <= 0 ? 'disabled' : ''
        }>Re-roll lifestyle (${cur.turn.spendRerollsLeft || 0} left)</button>
        <button type="button" class="btn" id="btn-custom-income">Adjust allocation…</button>
      </div>
    `;
    $('#btn-auto-income').onclick = () => {
      try {
        const p = game.currentPlayer;
        game.doIncome(game.autoAllocate(p));
        renderAll();
      } catch (e) {
        toast(e.message, true);
      }
    };
    $('#btn-reroll-spend').onclick = () => {
      try {
        game.rerollSpend();
        renderAll();
        toast('Lifestyle spend re-rolled');
      } catch (e) {
        toast(e.message, true);
      }
    };
    $('#btn-custom-income').onclick = () => openIncomeModal();
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

  // Actions
  const disabled = cur.turn.actionsLeft <= 0;
  panel.innerHTML = `
    <h3>Phase 3 — Actions <small>(${cur.turn.actionsLeft} left)</small></h3>
    <div class="action-grid">
      <button type="button" class="btn action" data-act="card" ${disabled ? 'disabled' : ''}>💳 Apply for Card</button>
      <button type="button" class="btn action" data-act="transfer" ${disabled ? 'disabled' : ''}>🔄 Transfer Points</button>
      <button type="button" class="btn action" data-act="flight" ${disabled ? 'disabled' : ''}>✈️ Book Flight</button>
      <button type="button" class="btn action" data-act="hotel" ${disabled ? 'disabled' : ''}>🏨 Book Hotel</button>
      <button type="button" class="btn action" data-act="tickets" ${disabled ? 'disabled' : ''}>🎫 Draw Trip Tickets</button>
      <button type="button" class="btn action" data-act="rest" ${disabled ? 'disabled' : ''}>📝 Rest / Plan (+1k)</button>
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
  confirm.onclick = () => {
    try {
      onConfirm();
      closeModal();
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

function openIncomeModal() {
  const p = game.currentPlayer;
  const roll = (p.turn && p.turn.spendRoll) || {};
  // Categories that can appear for this character + any rolled
  const profileCats = Object.keys(p.character.spendProfile || { everything: 1 });
  const cats = [
    ...new Set([
      ...profileCats,
      ...Object.keys(roll),
      'dining',
      'groceries',
      'gas',
      'travel',
      'transit',
      'rent',
      'hotels',
      'flights',
      'everything',
    ]),
  ];
  const rates = cats.map((c) => {
    const r = game.bestEarnRate(p, c);
    return {
      c,
      rate: r.rate,
      card: r.card ? r.card.name : '—',
      rolled: roll[c] || 0,
    };
  });

  openModal(
    'Adjust income allocation',
    `
      <p>Pre-filled from this turn’s lifestyle roll. Total ≤ $${GAME_CONFIG.budgetPerTurn}. Earn = spend × <strong>card</strong> rate (0× without a card).</p>
      ${rates
        .map(
          (x) => `
        <label class="field">
          ${x.c}
          <span class="muted">(${x.rate}× ${x.card}${x.rolled ? ` · rolled $${fmt(x.rolled)}` : ''})</span>
          <input type="number" min="0" max="${GAME_CONFIG.budgetPerTurn}" value="${x.rolled || 0}" data-cat="${x.c}" />
        </label>
      `
        )
        .join('')}
    `,
    () => {
      const alloc = {};
      $$('#modal-body [data-cat]').forEach((inp) => {
        alloc[inp.dataset.cat] = +inp.value || 0;
      });
      // Keep turn roll in sync for display consistency after? income ends anyway
      game.doIncome(alloc);
    }
  );
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
      <p class="muted">Nonstop or <strong>1 stop</strong> (same airline). Visit both ticket cities to complete trips.</p>
      <label class="field" style="margin-bottom:0.5rem">
        <span>Show
          <select id="flight-filter">
            <option value="nonstop">Nonstop only</option>
            <option value="all">All (incl. 1-stop)</option>
            <option value="onestop">1-stop only</option>
          </select>
        </span>
      </label>
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
          ' · Ticket complete: ' +
          res.completedTrips.map((t) => `${t.from}→${t.to} (+${t.points} VP)`).join(', ');
      }
      toast(msg);
    }
  );

  const renderFlightList = () => {
    const filter = ($('#flight-filter') && $('#flight-filter').value) || 'nonstop';
    const filtered = options.filter((opt) => {
      if (filter === 'nonstop') return opt.stops === 0;
      if (filter === 'onestop') return opt.stops === 1;
      return true;
    });
    const list = $('#flight-list');
    if (!filtered.length) {
      list.innerHTML = `<p class="muted">No flights in this filter. Try “All”.</p>`;
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
        const helpsTicket = (p.tickets || []).some(
          (t) => t.from === opt.to || t.to === opt.to
        );
        return `
          <label class="card-option">
            <input type="radio" name="flight" value="${idx}"
              data-to="${opt.to}"
              data-via="${opt.via || ''}"
              data-airlines='${JSON.stringify(opt.airlines)}'
              data-cost="${opt.baseCost}"
              data-stops="${opt.stops}" />
            <div>
              <strong>${path}</strong> (${destName})${helpsTicket ? ' 🎫' : ''}
              <p>${stopLabel} · ${airLabels} · base ${fmt(opt.baseCost)} mi${opt.stops ? ' · 2 segments' : ''}</p>
            </div>
          </label>
        `;
      })
      .join('');
    list.querySelectorAll('input[name=flight]').forEach((r) => {
      r.onchange = syncAirlines;
    });
    const first = list.querySelector('input[name=flight]');
    if (first) {
      first.checked = true;
      syncAirlines();
    }
  };

  const syncAirlines = () => {
    const sel = $('#modal-body input[name=flight]:checked');
    if (!sel) return;
    const airlines = JSON.parse(sel.dataset.airlines);
    let cost = Math.floor(+sel.dataset.cost * flightMult);
    if (p.character.special === 'cheap_flight' && flightsThisTurn === 0) {
      cost = Math.floor(cost * 0.9);
    }
    const segs = +sel.dataset.stops === 1 ? 2 : 1;
    $('#flight-airline').innerHTML = airlines
      .map((a) => {
        const bal = p.airlines[a] || 0;
        const ok = bal >= cost;
        const name = AIRLINES[a] ? AIRLINES[a].name : a;
        return `<option value="${a}" ${ok ? '' : 'disabled'}>${name} (${fmt(bal)} mi)${ok ? '' : ' — short'}</option>`;
      })
      .join('');
    $('#flight-cost').textContent = `Cost this turn: ${fmt(cost)} miles · ${segs} segment${segs > 1 ? 's' : ''} · 1 action`;
  };

  $('#flight-filter').onchange = renderFlightList;
  renderFlightList();
}

function openHotelModal() {
  const p = game.currentPlayer;
  const city = CITIES[p.city];
  const hotels = city.hotels || [];
  const hotelMult =
    ((p.turn && p.turn.hotelMult) || 1) *
    (GAME_CONFIG.hotelCostMultiplier || 1);
  const vpMult = GAME_CONFIG.hotelVpMultiplier || 1;
  const freeNight = p.turn && p.turn.freeNightAvailable;

  openModal(
    `Book 1 night in ${city.name}`,
    `
      <p class="muted">Each property once per game (1 night). Hotel VP is boosted — stays score better than hoarding points.</p>
      <div class="flight-list">
        ${hotels
          .map((h) => {
            const cost = Math.floor(h.cost * hotelMult);
            const vp = Math.round((h.vp || 2) * vpMult);
            const bal = p.hotels[h.brand] || 0;
            const already = p.stayedHotels.has(h.id);
            const brandName = HOTELS[h.brand] ? HOTELS[h.brand].name : h.brand;
            const canPay = freeNight || bal >= cost;
            return `
              <label class="card-option ${already ? 'disabled-opt' : ''}">
                <input type="radio" name="hotel" value="${h.id}"
                  ${already || !canPay ? 'disabled' : ''} />
                <div>
                  <strong>${h.name}</strong>
                  <span class="bank-tag" style="background:${HOTELS[h.brand] ? HOTELS[h.brand].color : '#666'}">${brandName}</span>
                  <p>${fmt(cost)} pts · <strong>${vp} VP</strong> · balance ${fmt(bal)} ${brandName}
                    ${already ? ' · <em>already stayed</em>' : !canPay ? ' · <em>short on points</em>' : ''}</p>
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
      const res = game.bookHotel(sel.value);
      toast(`Stayed at ${res.hotel.name} · +${res.stayVp} VP`);
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
renderSetup();
showScreen('screen-setup');
