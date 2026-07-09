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
let currentTrack = null;
let unlocked = false;
let muted = localStorage.getItem(STORAGE_KEY) === '1';

function ensureAudio() {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.volume = 0.28;
    audio.preload = 'auto';
  }
  return audio;
}

function updateMuteButtons() {
  document.querySelectorAll('[data-music-mute]').forEach((btn) => {
    btn.textContent = muted ? '🔇 Music' : '🔊 Music';
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.title = muted ? 'Unmute music' : 'Mute music';
  });
}

/** Call once on first user gesture (click) so browsers allow playback */
export function unlockMusic() {
  if (unlocked) return;
  unlocked = true;
  ensureAudio();
  // Try start current track if any desired
  if (currentTrack && !muted) {
    playTrack(currentTrack, true);
  }
}

export function playTrack(key, force = false) {
  if (!TRACKS[key]) return;
  if (currentTrack === key && !force && audio && !audio.paused) return;
  currentTrack = key;
  if (muted || !unlocked) return;
  const a = ensureAudio();
  const src = TRACKS[key];
  // Compare path end so absolute URLs still match
  const needsLoad = !a.src || !decodeURIComponent(a.src).includes(src.split('/').pop());
  if (needsLoad || force) {
    a.src = src;
  }
  a.loop = true;
  const p = a.play();
  if (p && typeof p.catch === 'function') {
    p.catch(() => {
      /* autoplay blocked until next gesture */
    });
  }
}

export function stopMusic() {
  if (audio) {
    audio.pause();
  }
}

export function setMuted(value) {
  muted = !!value;
  localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  if (muted) {
    if (audio) audio.pause();
  } else if (currentTrack && unlocked) {
    playTrack(currentTrack, true);
  }
  updateMuteButtons();
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

export function isMuted() {
  return muted;
}

export function initMusicUI() {
  updateMuteButtons();
  document.querySelectorAll('[data-music-mute]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      unlockMusic();
      toggleMute();
    });
  });
  // Unlock on first interaction anywhere
  const unlock = () => {
    unlockMusic();
    document.removeEventListener('click', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('click', unlock);
  document.addEventListener('keydown', unlock);
}
