/**
 * Background music — bulletproof version
 * Uses absolute URLs from import.meta.url + DOM <audio> element.
 * Kevin MacLeod CC BY 4.0 — assets/music/CREDITS.md
 */

// Resolve paths relative to THIS module file (js/music.js → ../assets/music/...)
function trackUrl(fileName) {
  try {
    return new URL(`../assets/music/${fileName}`, import.meta.url).href;
  } catch (e) {
    // Fallback relative to page
    return `assets/music/${fileName}`;
  }
}

const TRACKS = {
  menu: trackUrl('menu-loop.mp3'),
  play: trackUrl('play-loop.mp3'),
  city: trackUrl('city-loop.mp3'),
  hotel: trackUrl('hotel-loop.mp3'),
};

const STORAGE_KEY = 'points-odyssey-music-muted';

let audioEl = null;
let currentKey = 'menu';
let unlocked = false;
let muted = false; // start unmuted; user can mute

// Migrate: if stuck muted from old bug, still allow one-click start
try {
  muted = localStorage.getItem(STORAGE_KEY) === '1';
} catch (e) {
  muted = false;
}

function getAudio() {
  if (audioEl) return audioEl;
  // Prefer element in page (more reliable in some browsers)
  audioEl = document.getElementById('bg-music');
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = 'bg-music';
    audioEl.setAttribute('playsinline', '');
    audioEl.setAttribute('preload', 'auto');
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);
  }
  audioEl.loop = true;
  audioEl.volume = 0.4;
  audioEl.addEventListener('error', () => {
    const err = audioEl.error;
    const msg =
      (err && err.message) ||
      (err && err.code === 4 ? 'format/source not supported' : 'load error');
    console.error('[music] audio error', msg, 'src=', audioEl.currentSrc || audioEl.src);
    showMusicStatus('Music failed to load — check console', true);
  });
  audioEl.addEventListener('playing', () => {
    showMusicStatus('Music playing', false);
    updateButtons();
  });
  audioEl.addEventListener('pause', () => updateButtons());
  return audioEl;
}

function showMusicStatus(text, isError) {
  // Prefer toast if present
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = text;
    toast.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toast._musicT);
    toast._musicT = setTimeout(() => toast.classList.remove('show'), 2800);
  }
  const status = document.getElementById('music-status');
  if (status) {
    status.textContent = text;
    status.style.color = isError ? 'var(--danger, #e74c3c)' : 'var(--cream-dim, #aaa)';
  }
}

function updateButtons() {
  const a = audioEl;
  const playing = !!(a && !a.paused && !muted && a.currentTime >= 0);
  document.querySelectorAll('[data-music-mute]').forEach((btn) => {
    if (muted) {
      btn.textContent = '🔇 Music off';
      btn.title = 'Turn music on';
    } else if (playing) {
      btn.textContent = '🔊 Music on';
      btn.title = 'Mute music';
    } else {
      btn.textContent = '▶ Play music';
      btn.title = 'Start background music';
    }
  });
}

function loadAndPlay(url) {
  const a = getAudio();
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (ok, err) => {
      if (settled) return;
      settled = true;
      a.removeEventListener('canplay', onCan);
      a.removeEventListener('error', onErr);
      if (ok) resolve();
      else reject(err || new Error('audio load failed'));
    };
    const onCan = () => done(true);
    const onErr = () => done(false, a.error);

    // Only reset src if different
    const same =
      a.src &&
      (a.src === url ||
        decodeURIComponent(a.src).endsWith(url.split('/').pop().split('?')[0]));
    if (!same) {
      a.src = url;
      a.load();
    }
    a.addEventListener('canplay', onCan);
    a.addEventListener('error', onErr);
    if (a.readyState >= 2) {
      done(true);
    }
    // Safety timeout
    setTimeout(() => {
      if (!settled && a.readyState >= 2) done(true);
      else if (!settled) done(false, new Error('timeout loading audio'));
    }, 8000);
  });
}

/**
 * Play a named track. Safe before unlock (stores preference).
 */
export async function playTrack(key, force = false) {
  if (!TRACKS[key]) {
    console.warn('[music] unknown track', key);
    return false;
  }
  currentKey = key;
  if (muted) {
    updateButtons();
    return false;
  }
  if (!unlocked && !force) {
    updateButtons();
    return false;
  }

  const url = TRACKS[key];
  try {
    await loadAndPlay(url);
    const a = getAudio();
    a.loop = true;
    await a.play();
    updateButtons();
    return true;
  } catch (e) {
    console.warn('[music] playTrack failed', key, e);
    showMusicStatus(
      'Could not play music. Click “Play music” again.',
      true
    );
    updateButtons();
    return false;
  }
}

/**
 * Must be called from a click/tap handler.
 */
export async function startMusicFromUserGesture() {
  unlocked = true;
  muted = false;
  try {
    localStorage.setItem(STORAGE_KEY, '0');
  } catch (e) {
    /* ignore */
  }
  const ok = await playTrack(currentKey || 'menu', true);
  if (ok) {
    showMusicStatus('Music on: ' + (currentKey || 'menu'), false);
  }
  return ok;
}

export function stopMusic() {
  if (audioEl) audioEl.pause();
  updateButtons();
}

export function setMuted(value) {
  muted = !!value;
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch (e) {
    /* ignore */
  }
  if (muted) {
    if (audioEl) audioEl.pause();
    showMusicStatus('Music muted', false);
  }
  updateButtons();
}

export async function toggleMute() {
  const a = getAudio();
  const playing = !!(!muted && a && !a.paused);

  if (muted || !playing) {
    // Turn ON
    await startMusicFromUserGesture();
  } else {
    // Turn OFF
    setMuted(true);
  }
  return muted;
}

export function isMuted() {
  return muted;
}

export function initMusicUI() {
  getAudio();
  updateButtons();

  // Explicit Play / Mute buttons
  document.querySelectorAll('[data-music-mute]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await toggleMute();
    });
  });

  // First pointerdown anywhere also starts music (if not muted)
  const unlockOnce = async (e) => {
    // Don't steal from mute button (it handles itself)
    if (e.target && e.target.closest && e.target.closest('[data-music-mute]')) {
      return;
    }
    if (!unlocked && !muted) {
      unlocked = true;
      await playTrack(currentKey || 'menu', true);
    }
    document.removeEventListener('pointerdown', unlockOnce, true);
  };
  document.addEventListener('pointerdown', unlockOnce, true);

  // Warm cache of menu track
  try {
    const a = getAudio();
    a.src = TRACKS.menu;
    a.load();
  } catch (e) {
    console.warn('[music] preload failed', e);
  }

  console.info('[music] tracks ready', TRACKS);
}
