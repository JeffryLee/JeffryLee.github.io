/**
 * Background music for Points Odyssey
 *
 * Default: ON. Browsers block silent autoplay, so the first real user
 * gesture (click/tap/key) starts playback. Pause stops it; Play resumes.
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

// v2: previous key could stick "paused" after a UI bug; fresh default is ON
const STORAGE_KEY = 'points-odyssey-music-paused-v2';

let audioEl = null;
let currentKey = 'menu';
/** Browser autoplay unlocked via a user gesture */
let unlocked = false;
/** User explicitly paused — do not auto-start */
let pausedByUser = false;
let gestureBound = false;

try {
  pausedByUser = localStorage.getItem(STORAGE_KEY) === '1';
} catch (e) {
  pausedByUser = false;
}

function getAudio() {
  if (audioEl) return audioEl;
  audioEl = document.getElementById('bg-music');
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = 'bg-music';
    document.body.appendChild(audioEl);
  }
  audioEl.loop = true;
  audioEl.volume = 0.45;
  audioEl.preload = 'auto';
  audioEl.setAttribute('playsinline', '');
  audioEl.setAttribute('webkit-playsinline', '');

  audioEl.addEventListener('error', () => {
    const code = audioEl.error && audioEl.error.code;
    console.error('[music] media error', code, audioEl.src);
    setStatus('Music file failed to load', true);
  });
  audioEl.addEventListener('playing', () => {
    setStatus('Music playing', false);
    updateButtons();
  });
  audioEl.addEventListener('pause', () => updateButtons());
  return audioEl;
}

function setStatus(text, isError) {
  const el = document.getElementById('music-status');
  if (el) {
    el.textContent = text;
    el.style.color = isError ? '#e74c3c' : '';
  }
}

function isPlaying() {
  const a = audioEl;
  return !!(a && !a.paused && !a.ended && a.currentTime >= 0 && unlocked);
}

function rememberPaused(on) {
  pausedByUser = !!on;
  try {
    localStorage.setItem(STORAGE_KEY, pausedByUser ? '1' : '0');
  } catch (e) {
    /* ignore */
  }
}

function updateButtons() {
  const playing = isPlaying();
  document.querySelectorAll('[data-music-mute]').forEach((btn) => {
    if (playing) {
      btn.textContent = '⏸ Pause';
      btn.title = 'Pause music';
    } else {
      btn.textContent = '▶ Play';
      btn.title = 'Play music';
    }
  });
}

function setSrcIfNeeded(key) {
  const a = getAudio();
  const url = TRACKS[key] || TRACKS.menu;
  const name = (url.split('/').pop() || '').split('?')[0];
  const cur = decodeURIComponent(a.currentSrc || a.src || '');
  if (!cur || !cur.includes(name)) {
    a.src = url;
  }
  a.loop = true;
  return a;
}

/**
 * Begin playback. Safe to call from any user-gesture handler.
 * Must not await anything before a.play().
 */
export function startMusicFromClick() {
  unlocked = true;
  rememberPaused(false);

  const key = currentKey || 'menu';
  const a = setSrcIfNeeded(key);

  // Synchronous play() in the gesture stack
  let playPromise;
  try {
    playPromise = a.play();
  } catch (err) {
    console.warn('[music] play() threw', err);
    setStatus('Click ▶ Play to start music', true);
    updateButtons();
    return;
  }

  if (playPromise && typeof playPromise.then === 'function') {
    playPromise
      .then(() => {
        setStatus('Music playing', false);
        updateButtons();
      })
      .catch((err) => {
        const name = (err && err.name) || '';
        console.warn('[music] play rejected:', name, err && err.message);

        // If still loading, retry once when enough data is ready (no load() —
        // reload can abort the element and drop the gesture privilege).
        if (a.readyState < 2) {
          const onReady = () => {
            a.play()
              .then(() => {
                setStatus('Music playing', false);
                updateButtons();
              })
              .catch((e2) => {
                console.error('[music] retry failed', e2);
                unlocked = false;
                setStatus('Click ▶ Play to start music', true);
                updateButtons();
              });
          };
          a.addEventListener('canplay', onReady, { once: true });
          return;
        }

        unlocked = false;
        setStatus('Click ▶ Play to start music', true);
        updateButtons();
      });
  }

  updateButtons();
}

/** Switch ambient track (menu / play / city / hotel). */
export function playTrack(key) {
  if (!TRACKS[key]) key = 'menu';
  currentKey = key;
  if (pausedByUser || !unlocked) {
    updateButtons();
    return;
  }
  const a = setSrcIfNeeded(key);
  const p = a.play();
  if (p && p.catch) {
    p.catch((err) => console.warn('[music] track switch deferred:', err && err.message));
  }
  updateButtons();
}

export function stopMusic() {
  if (audioEl) audioEl.pause();
  updateButtons();
}

export function pauseMusic() {
  rememberPaused(true);
  if (audioEl) audioEl.pause();
  setStatus('Music paused', false);
  updateButtons();
}

export function setMuted(on) {
  if (on) pauseMusic();
  else startMusicFromClick();
}

/**
 * Pause if currently playing; otherwise start/resume.
 * (Do not treat "wanted on but silent" as pause — that blocked all audio.)
 */
export function toggleMute() {
  if (isPlaying()) {
    pauseMusic();
  } else {
    startMusicFromClick();
  }
}

export function isMuted() {
  return pausedByUser;
}

/** Call from any UI click so music starts with that gesture. */
export function ensureMusic() {
  if (!pausedByUser && !isPlaying()) {
    startMusicFromClick();
  }
}

function onFirstGesture(e) {
  if (pausedByUser) return;
  if (isPlaying()) return;
  // Music control has its own handler (also starts/pauses)
  if (e.target && e.target.closest && e.target.closest('[data-music-mute]')) {
    return;
  }
  startMusicFromClick();
}

function bindGestureUnlock() {
  if (gestureBound) return;
  gestureBound = true;
  // Capture phase so we run before other handlers stop propagation
  const opts = { capture: true, passive: true };
  document.addEventListener('pointerdown', onFirstGesture, opts);
  document.addEventListener('keydown', onFirstGesture, opts);
  document.addEventListener('touchstart', onFirstGesture, opts);
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

  bindGestureUnlock();

  // Preload menu bed
  try {
    const a = getAudio();
    a.src = TRACKS.menu;
    a.load();
  } catch (e) {
    console.warn('[music] preload', e);
  }

  // Attempt autoplay (usually blocked; succeeds on some browsers with prior engagement)
  if (!pausedByUser) {
    setStatus('Click anywhere to start music', false);
    const a = setSrcIfNeeded('menu');
    const p = a.play();
    if (p && p.then) {
      p.then(() => {
        unlocked = true;
        setStatus('Music playing', false);
        updateButtons();
      }).catch(() => {
        // Expected — wait for gesture
        setStatus('Click anywhere to start music', false);
        updateButtons();
      });
    }
  } else {
    setStatus('Music paused', false);
  }

  console.info('[music] ready', { menu: TRACKS.menu, pausedByUser });
}
