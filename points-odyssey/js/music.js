/**
 * Background music for Points Odyssey
 *
 * Critical: audio.play() must run in the same user-gesture call stack
 * (not after await). Browsers block play() after async gaps.
 *
 * Kevin MacLeod CC BY 4.0 — assets/music/CREDITS.md
 */

function trackUrl(fileName) {
  try {
    return new URL(`../assets/music/${fileName}`, import.meta.url).href;
  } catch (e) {
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
let muted = false;

try {
  muted = localStorage.getItem(STORAGE_KEY) === '1';
} catch (e) {
  muted = false;
}

function getAudio() {
  if (audioEl) return audioEl;
  audioEl = document.getElementById('bg-music');
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = 'bg-music';
    audioEl.setAttribute('playsinline', '');
    audioEl.preload = 'auto';
    document.body.appendChild(audioEl);
  }
  audioEl.loop = true;
  audioEl.volume = 0.4;
  audioEl.addEventListener('error', () => {
    console.error('[music] error', audioEl.error, audioEl.src);
    status('Music failed to load. Is the server running from points-odyssey/?', true);
  });
  audioEl.addEventListener('playing', () => {
    status('Music playing', false);
    updateButtons();
  });
  audioEl.addEventListener('pause', updateButtons);
  return audioEl;
}

function status(text, isError) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = text;
    toast.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toast._mt);
    toast._mt = setTimeout(() => toast.classList.remove('show'), 3000);
  }
  const el = document.getElementById('music-status');
  if (el) {
    el.textContent = text;
    el.style.color = isError ? '#e74c3c' : '';
  }
}

function updateButtons() {
  const a = audioEl;
  const playing = !!(a && !a.paused && !muted);
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

function setSrcIfNeeded(key) {
  const a = getAudio();
  const url = TRACKS[key] || TRACKS.menu;
  const name = url.split('/').pop().split('?')[0];
  if (!a.src || !decodeURIComponent(a.src).includes(name)) {
    a.src = url;
  }
  a.loop = true;
  return a;
}

/**
 * Switch track. If already unlocked & not muted, start playback.
 * Does NOT await — keeps gesture chain when called from click.
 */
export function playTrack(key) {
  if (!TRACKS[key]) key = 'menu';
  currentKey = key;
  if (muted || !unlocked) {
    updateButtons();
    return;
  }
  const a = setSrcIfNeeded(key);
  // fire-and-forget play (may work if already unlocked)
  const p = a.play();
  if (p && p.catch) {
    p.catch((err) => console.warn('[music] play deferred:', err && err.message));
  }
  updateButtons();
}

/**
 * MUST be called directly from a click handler (no await before this).
 * Starts music in the same user-gesture turn.
 */
export function startMusicFromClick() {
  unlocked = true;
  muted = false;
  try {
    localStorage.setItem(STORAGE_KEY, '0');
  } catch (e) {
    /* ignore */
  }

  const key = currentKey || 'menu';
  const a = setSrcIfNeeded(key);

  // Synchronous play() in click stack — required by Chrome/Safari
  const playPromise = a.play();
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise
      .then(() => {
        status('Music on', false);
        updateButtons();
      })
      .catch((err) => {
        // Retry once when data is ready (still sometimes works after load)
        console.warn('[music] immediate play failed, retry on canplay', err);
        const retry = () => {
          a.play()
            .then(() => {
              status('Music on', false);
              updateButtons();
            })
            .catch((e2) => {
              console.error('[music] retry failed', e2);
              status(
                'Blocked by browser. Click ▶ Play music again.',
                true
              );
              unlocked = false;
              updateButtons();
            });
        };
        if (a.readyState >= 2) retry();
        else a.addEventListener('canplay', retry, { once: true });
        a.load();
      });
  }
  updateButtons();
}

export function stopMusic() {
  if (audioEl) audioEl.pause();
  updateButtons();
}

export function setMuted(on) {
  muted = !!on;
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch (e) {
    /* ignore */
  }
  if (muted && audioEl) {
    audioEl.pause();
    status('Music muted', false);
  }
  updateButtons();
}

/** Click handler: play if off, mute if on */
export function toggleMute() {
  const a = getAudio();
  const playing = !!(unlocked && !muted && a && !a.paused);
  if (playing) {
    setMuted(true);
  } else {
    // Start / resume in this click gesture
    startMusicFromClick();
  }
}

export function isMuted() {
  return muted;
}

export function initMusicUI() {
  getAudio();
  updateButtons();

  document.querySelectorAll('[data-music-mute]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMute();
    });
  });

  // First click anywhere (except we still handle mute button separately)
  const unlockOnce = (e) => {
    if (e.target && e.target.closest && e.target.closest('[data-music-mute]')) {
      return;
    }
    if (!unlocked && !muted) {
      startMusicFromClick();
    }
    document.removeEventListener('pointerdown', unlockOnce, true);
  };
  document.addEventListener('pointerdown', unlockOnce, true);

  // Preload menu (does not play)
  try {
    const a = getAudio();
    a.src = TRACKS.menu;
    a.load();
  } catch (e) {
    console.warn('[music] preload', e);
  }

  console.info('[music] ready', {
    menu: TRACKS.menu,
    muted,
  });
}
