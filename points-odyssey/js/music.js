/**
 * Background music for Points Odyssey
 * Tracks: Kevin MacLeod (CC BY 4.0) — see assets/music/CREDITS.md
 */

const TRACKS = {
  menu: 'assets/music/menu-loop.mp3', // Lobby Time
  play: 'assets/music/play-loop.mp3', // Airport Lounge
  city: 'assets/music/city-loop.mp3', // George Street Shuffle
  hotel: 'assets/music/hotel-loop.mp3', // Casa Bossa Nova
};

const STORAGE_KEY = 'points-odyssey-music-muted';

let audio = null;
let currentTrack = null; // key: menu | play | city | hotel
let unlocked = false;
let muted = localStorage.getItem(STORAGE_KEY) === '1';
let desiredTrack = 'menu';

function ensureAudio() {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.volume = 0.35;
    audio.preload = 'auto';
    audio.addEventListener('error', () => {
      console.warn(
        '[music] failed to load',
        audio.src,
        audio.error && audio.error.message
      );
    });
  }
  return audio;
}

function updateMuteButtons() {
  const playing = !!(audio && !audio.paused && !muted);
  document.querySelectorAll('[data-music-mute]').forEach((btn) => {
    if (muted) {
      btn.textContent = '🔇 Music off';
      btn.title = 'Turn music on';
    } else if (playing) {
      btn.textContent = '🔊 Music on';
      btn.title = 'Mute music';
    } else {
      btn.textContent = '🔊 Music';
      btn.title = 'Play music (click)';
    }
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  });
}

function tryPlay() {
  if (!audio || muted || !unlocked) return;
  const p = audio.play();
  if (p && typeof p.catch === 'function') {
    p.catch((err) => {
      console.warn('[music] play() blocked or failed:', err && err.message);
      unlocked = false; // require another gesture
    });
  }
  // update labels shortly after play state changes
  setTimeout(updateMuteButtons, 100);
}

/**
 * Unlock audio on a user gesture, then start desired track.
 */
export function unlockMusic() {
  unlocked = true;
  ensureAudio();
  const key = currentTrack || desiredTrack || 'menu';
  playTrack(key, true);
}

/**
 * Select and play a track key. Safe to call before unlock (remembers choice).
 */
export function playTrack(key, force = false) {
  if (!TRACKS[key]) {
    console.warn('[music] unknown track', key);
    return;
  }
  desiredTrack = key;
  currentTrack = key;

  if (muted) {
    updateMuteButtons();
    return;
  }
  if (!unlocked) {
    // Wait for user click — browsers block autoplay
    updateMuteButtons();
    return;
  }

  const a = ensureAudio();
  const file = TRACKS[key];
  const fileName = file.split('/').pop();
  const already =
    a.src && decodeURIComponent(a.src).includes(fileName) && !force;

  if (!already) {
    a.pause();
    a.src = file;
    a.load();
    // Wait until enough data, then play
    const onReady = () => {
      a.removeEventListener('canplay', onReady);
      a.removeEventListener('canplaythrough', onReady);
      tryPlay();
    };
    a.addEventListener('canplay', onReady);
    a.addEventListener('canplaythrough', onReady);
    // Fallback if already cached
    if (a.readyState >= 2) {
      tryPlay();
    }
  } else {
    tryPlay();
  }
  updateMuteButtons();
}

export function stopMusic() {
  if (audio) {
    audio.pause();
  }
  updateMuteButtons();
}

export function setMuted(value) {
  muted = !!value;
  localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  if (muted) {
    if (audio) audio.pause();
  } else {
    unlocked = true;
    playTrack(currentTrack || desiredTrack || 'menu', true);
  }
  updateMuteButtons();
}

/**
 * Toggle: if muted or not playing → turn ON; if playing → mute OFF.
 */
export function toggleMute() {
  const playing = !!(audio && !audio.paused && !muted);
  if (muted || !playing) {
    setMuted(false);
  } else {
    setMuted(true);
  }
  return muted;
}

export function isMuted() {
  return muted;
}

export function initMusicUI() {
  // Clear a stuck "muted" flag from earlier buggy builds only if never played —
  // keep user preference; just make the button do the right thing.
  updateMuteButtons();

  document.querySelectorAll('[data-music-mute]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Always treat as user gesture → unlock + toggle intelligently
      unlocked = true;
      toggleMute();
    });
  });

  // Any first click/key unlocks and starts menu (if not muted)
  const unlockOnce = () => {
    if (!unlocked) {
      unlockMusic();
    }
    document.removeEventListener('pointerdown', unlockOnce, true);
    document.removeEventListener('keydown', unlockOnce, true);
  };
  document.addEventListener('pointerdown', unlockOnce, true);
  document.addEventListener('keydown', unlockOnce, true);

  // Preload menu track so first play is faster
  try {
    const pre = ensureAudio();
    if (!muted) {
      pre.src = TRACKS.menu;
      pre.load();
    }
  } catch (e) {
    /* ignore */
  }
}
