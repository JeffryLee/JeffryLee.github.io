/**
 * Points Odyssey — UI controller
 */

import { Game, CREDIT_CARDS, CHARACTERS, CITIES, ROUTES, TRANSFERS, ACHIEVEMENTS, GAME_CONFIG } from './game.js';
import { BANKS, HOTELS, AIRLINES, getRoute } from './data.js';

const game = new Game();
let setupSelections = [];

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

function fmt(n) {
  return Math.round(n).toLocaleString();
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
    return `
      <button type="button" class="char-card ${taken ? 'taken' : ''}" data-id="${c.id}" ${taken ? 'disabled' : ''}>
        <img src="${c.image}" alt="${c.name}" />
        <div class="char-info">
          <h3>${c.name}</h3>
          <p>${c.blurb}</p>
          <p class="special">${c.specialDesc}</p>
          <p class="home">Home: ${CITIES[c.homeCity]?.name || c.homeCity}</p>
        </div>
      </button>
    `;
  }).join('');

  grid.onclick = (e) => {
    const btn = e.target.closest('.char-card');
    if (!btn || btn.disabled) return;
    const id = btn.dataset.id;
    if (setupSelections.length >= GAME_CONFIG.maxPlayers) {
      toast('Max 6 players', true);
      return;
    }
    const name =
      prompt(
        `Name for ${CHARACTERS.find((c) => c.id === id).name}?`,
        `Player ${setupSelections.length + 1}`
      ) || `Player ${setupSelections.length + 1}`;
    setupSelections.push({ characterId: id, name });
    renderLobby();
    renderSetup();
  };

  renderLobby();
}

function renderLobby() {
  const list = $('#lobby-list');
  list.innerHTML = setupSelections
    .map(
      (s, i) => {
        const c = CHARACTERS.find((x) => x.id === s.characterId);
        return `<li>
          <img src="${c.image}" alt="" />
          <span><strong>${s.name}</strong> — ${c.name}</span>
          <button type="button" data-i="${i}" class="remove-p">✕</button>
        </li>`;
      }
    )
    .join('');

  list.onclick = (e) => {
    if (e.target.classList.contains('remove-p')) {
      setupSelections.splice(+e.target.dataset.i, 1);
      renderLobby();
      renderSetup();
    }
  };

  const startBtn = $('#start-game');
  startBtn.disabled = setupSelections.length < GAME_CONFIG.minPlayers;
  startBtn.textContent =
    setupSelections.length < GAME_CONFIG.minPlayers
      ? `Need ${GAME_CONFIG.minPlayers}+ players (${setupSelections.length})`
      : `Start Game (${setupSelections.length} players)`;
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
  $('#turn-label').textContent = `${cur.name}'s turn`;
  $('#actions-left').textContent = `${cur.turn?.actionsLeft ?? 0} actions left`;

  renderPlayersBar(snap);
  renderMap(snap);
  renderHand(cur, snap);
  renderLog(snap);
  renderPhasePanel(cur, snap);
}

function renderPlayersBar(snap) {
  const bar = $('#players-bar');
  bar.innerHTML = snap.players
    .map((p, i) => {
      const active = i === snap.currentPlayerIndex ? 'active' : '';
      return `
        <div class="p-chip ${active}" title="${p.character.name}">
          <img src="${p.character.image}" alt="" />
          <div>
            <strong>${p.name}</strong>
            <span>${p.vp} VP · ${p.city}</span>
          </div>
        </div>
      `;
    })
    .join('');
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
  const panel = $('#city-info');
  panel.innerHTML = `
    <h3>${city.name} (${city.id})</h3>
    <p><strong>Hotels:</strong></p>
    <ul>
      ${Object.entries(city.hotels)
        .map(
          ([b, cost]) =>
            `<li>${HOTELS[b]?.name || b}: ${fmt(cost)}/night · ${city.hotelVp[b]} VP</li>`
        )
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

  // Tickets
  $('#my-tickets').innerHTML = cur.tickets.length
    ? cur.tickets
        .map(
          (t) =>
            `<div class="ticket">
              <strong>${t.from} → ${t.to}</strong>
              <span>+${t.points} / −${t.penalty}</span>
            </div>`
        )
        .join('')
    : `<span class="muted">No open trip tickets</span>`;

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

  if (!cur.turn.incomeDone) {
    panel.innerHTML = `
      <h3>Phase 2 — Income</h3>
      <p>Allocate your $${fmt(GAME_CONFIG.budgetPerTurn)} budget. Character multipliers apply automatically.</p>
      <p class="char-tip"><em>${cur.character.name}:</em> ${cur.character.specialDesc}</p>
      <div class="income-actions">
        <button type="button" class="btn primary" id="btn-auto-income">Auto-spend (recommended)</button>
        <button type="button" class="btn" id="btn-custom-income">Custom allocation…</button>
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
  const cats = Object.keys(game.currentPlayer.character.multipliers || {}).filter(
    (k) => k !== 'everything'
  );
  if (!cats.length) cats.push('everything');

  openModal(
    'Custom income allocation',
    `
      <p>Total must be ≤ $${GAME_CONFIG.budgetPerTurn}</p>
      ${cats
        .map(
          (c) => `
        <label class="field">
          ${c}
          <input type="number" min="0" max="${GAME_CONFIG.budgetPerTurn}" value="${Math.floor(GAME_CONFIG.budgetPerTurn / cats.length)}" data-cat="${c}" />
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
  const options = ROUTES.filter((r) => r.a === from || r.b === from);

  openModal(
    `Book flight from ${from}`,
    `
      <div class="flight-list">
        ${options
          .map((r) => {
            const dest = r.a === from ? r.b : r.a;
            return `
              <label class="card-option">
                <input type="radio" name="flight" value="${dest}" data-airlines='${JSON.stringify(r.airlines)}' data-cost="${r.cost}" />
                <div>
                  <strong>${from} → ${dest}</strong> (${CITIES[dest].name})
                  <p>Airlines: ${r.airlines.map((a) => AIRLINES[a].name).join(', ')} · base ${fmt(r.cost)} mi</p>
                </div>
              </label>
            `;
          })
          .join('')}
      </div>
      <label class="field">Pay with airline
        <select id="flight-airline"></select>
      </label>
      <p id="flight-cost" class="muted"></p>
    `,
    () => {
      const sel = $('#modal-body input[name=flight]:checked');
      if (!sel) throw new Error('Select a destination');
      const airline = $('#flight-airline').value;
      game.bookFlight(sel.value, airline);
      toast(`Landed in ${sel.value}!`);
    }
  );

  const syncAirlines = () => {
    const sel = $('#modal-body input[name=flight]:checked');
    if (!sel) return;
    const airlines = JSON.parse(sel.dataset.airlines);
    let cost = Math.floor(+sel.dataset.cost * (p.turn?.flightMult || 1));
    if (p.character.special === 'cheap_flight' && (p.turn?.flightsThisTurn || 0) === 0) {
      cost = Math.floor(cost * 0.9);
    }
    $('#flight-airline').innerHTML = airlines
      .map((a) => {
        const bal = p.airlines[a] || 0;
        const ok = bal >= cost;
        return `<option value="${a}" ${ok ? '' : 'disabled'}>${AIRLINES[a].name} (${fmt(bal)} mi)${ok ? '' : ' — short'}</option>`;
      })
      .join('');
    $('#flight-cost').textContent = `Cost this turn: ${fmt(cost)} miles`;
  };

  $$('#modal-body input[name=flight]').forEach((r) => {
    r.onchange = syncAirlines;
  });
  // select first
  const first = $('#modal-body input[name=flight]');
  if (first) {
    first.checked = true;
    syncAirlines();
  }
}

function openHotelModal() {
  const p = game.currentPlayer;
  const city = CITIES[p.city];
  const brands = Object.keys(city.hotels);

  openModal(
    `Book hotel in ${city.name}`,
    `
      <div class="flight-list">
        ${brands
          .map((b) => {
            let cost = Math.floor(city.hotels[b] * (p.turn?.hotelMult || 1));
            const bal = p.hotels[b] || 0;
            return `
              <label class="card-option">
                <input type="radio" name="hotel" value="${b}" data-cost="${cost}" />
                <div>
                  <strong>${HOTELS[b].name}</strong>
                  <p>${fmt(cost)}/night · ${city.hotelVp[b]} VP/night · you have ${fmt(bal)}</p>
                </div>
              </label>
            `;
          })
          .join('')}
      </div>
      <label class="field">Nights (1–3)
        <input type="number" id="hotel-nights" min="1" max="3" value="1" />
      </label>
      ${p.turn?.freeNightAvailable ? '<p class="bonus-tag">Free Night Certificate active!</p>' : ''}
    `,
    () => {
      const sel = $('#modal-body input[name=hotel]:checked');
      if (!sel) throw new Error('Select a hotel brand');
      const nights = +$('#hotel-nights').value || 1;
      const res = game.bookHotel(sel.value, nights);
      toast(`+${res.stayVp} VP from stay`);
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
      game.startGame(setupSelections);
      showScreen('screen-game');
      renderAll();
      toast(`Round 1 — ${game.currentPlayer.name} starts`);
    } catch (e) {
      toast(e.message, true);
    }
  };

  // Quick demo: 3 random players
  $('#btn-quick-demo')?.addEventListener('click', () => {
    const picks = [...CHARACTERS].sort(() => Math.random() - 0.5).slice(0, 3);
    setupSelections = picks.map((c, i) => ({
      characterId: c.id,
      name: ['Alex', 'Blake', 'Casey'][i],
    }));
    game.startGame(setupSelections);
    showScreen('screen-game');
    renderAll();
    toast('Quick demo: 3 players dealt');
  });
}

// Init
wireNav();
renderSetup();
showScreen('screen-setup');
