// Grab our elements
const items = Array.from(document.querySelectorAll('.carousel-item'));
const audio = document.getElementById('carouselAudio');
const trackMeta = document.querySelector('.track-meta');
const progressBar = document.querySelector('.progress-bar');
const progressShell = document.querySelector('.progress-shell');
const volumeBar = document.querySelector('.volume-bar');
const volumePct = document.querySelector('.volume-pct');
const volumeShell = document.querySelector('.volume-shell');
const timeStart = document.querySelector('.time-start');
const timeEnd = document.querySelector('.time-end');

const DEFAULT_DISPLAYED_VOLUME = 0.5;
const ACTUAL_VOLUME_SCALE = 0.5;
const themeToggle = document.getElementById('themeToggle');
let displayedVolume = DEFAULT_DISPLAYED_VOLUME;

audio.volume = DEFAULT_DISPLAYED_VOLUME * ACTUAL_VOLUME_SCALE;
// Prefer IDs but fall back to controls order to avoid breaking when an ID is missing
let prevBtn = document.getElementById('prevBtn');
let nextBtn = document.getElementById('nextBtn');
if (!prevBtn || !nextBtn) {
  const controls = document.querySelectorAll('.controls .carousel-control');
  if (!prevBtn && controls[0]) prevBtn = controls[0];
  if (!nextBtn && controls[1]) nextBtn = controls[1];
}

// Set the starting active item (0-indexed, so 2 is the 3rd item)
let activeIndex = 2; 
// Lock to prevent multiple transitions at once
let isAnimating = false;
let isInitialLoadLocked = true;
const TRANSITION_MS = 1000; // matches CSS transition duration
const INITIAL_LOCK_MS = 1500; // allow the initial load transition to finish before interactions

document.body.classList.add('interaction-locked');

function applyTheme(isDark) {
  document.body.classList.toggle('dark-mode', isDark);

  if (themeToggle) {
    const icon = themeToggle.querySelector('.theme-icon');
    themeToggle.setAttribute('aria-pressed', String(isDark));

    if (icon) {
      icon.src = isDark ? './imgs/sun.svg' : './imgs/moon.svg';
      icon.alt = isDark ? 'Sun icon' : 'Moon icon';
    }
  }
}

function initializeTheme() {
  try {
    const savedTheme = window.localStorage.getItem('music-player-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme ? savedTheme === 'dark' : prefersDark);
  } catch (error) {
    applyTheme(false);
  }
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isDark = !document.body.classList.contains('dark-mode');
    applyTheme(isDark);
    try {
      window.localStorage.setItem('music-player-theme', isDark ? 'dark' : 'light');
    } catch (error) {
      console.warn('Theme preference could not be saved:', error);
    }
  });
}

initializeTheme();

function updateTrackMeta(index) {
  if (!trackMeta) return;

  const item = items[index];
  const title = item?.dataset.title || 'Artist Song';
  const artist = item?.dataset.artist || 'Artist Name';
  trackMeta.textContent = `${title} - ${artist}`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function updateProgressUI() {
  if (!audio || !progressBar || !timeStart || !timeEnd) return;

  const duration = audio.duration || 0;
  const currentTime = audio.currentTime || 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  progressBar.style.width = `${Math.min(progress, 100)}%`;
  timeStart.textContent = formatTime(currentTime);
  timeEnd.textContent = formatTime(duration);
}

function updateVolumeUI() {
  if (!audio || !volumeBar || !volumePct) return;

  const volume = Math.round((displayedVolume || 0) * 100);
  volumeBar.style.width = `${Math.min(Math.max(volume, 0), 100)}%`;
  volumePct.textContent = `${volume}%`;
}

function setVolumeFromUI(fraction) {
  displayedVolume = Math.min(Math.max(fraction, 0), 1);
  audio.volume = displayedVolume * ACTUAL_VOLUME_SCALE;
  updateVolumeUI();
}

function playTrackForIndex(index) {
  if (!audio) return;

  const item = items[index];
  const trackSrc = item?.dataset.audio;

  if (!trackSrc) return;

  audio.pause();
  audio.src = trackSrc;
  audio.currentTime = 0;
  audio.load();

  const playPromise = audio.play();
  if (playPromise) {
    playPromise.catch((error) => {
      console.warn('Audio playback was blocked:', error);
    });
  }

  updateTrackMeta(index);
  updateProgressUI();
  updatePlayPauseIcons();
}

function updatePlayPauseIcons() {
  items.forEach((item, index) => {
    const icon = item.querySelector('.play-pause-icon');
    if (!icon) return;
    const isPlayingActive = audio && !audio.paused && index === activeIndex;
    icon.src = isPlayingActive ? '/imgs/pause.png' : '/imgs/play.png';
    icon.alt = isPlayingActive ? 'Pause icon' : 'Play icon';
  });
}

function pauseCurrentTrack() {
  if (!audio) return;
  audio.pause();
  updatePlayPauseIcons();
}

function getNormalizedAudioUrl(src) {
  if (!src) return '';
  try {
    return new URL(src, window.location.href).href;
  } catch (error) {
    return src;
  }
}

function togglePlayPauseForIndex(index) {
  const item = items[index];
  if (!item || !audio) return;
  const trackSrc = item.dataset.audio;
  const normalizedTrackSrc = getNormalizedAudioUrl(trackSrc);
  const currentTrackSrc = getNormalizedAudioUrl(audio.currentSrc || audio.src);
  const isSameTrack = normalizedTrackSrc && currentTrackSrc && normalizedTrackSrc === currentTrackSrc;

  if (isSameTrack) {
    if (audio.paused) {
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch((error) => {
          console.warn('Audio playback was blocked:', error);
        });
      }
    } else {
      pauseCurrentTrack();
    }
    updatePlayPauseIcons();
    return;
  }

  goToIndex(index, { playAudio: false });
  playTrackForIndex(index);
}

function updateCarousel() {
  items.forEach((item, index) => {
    // Determine how far this item is from the active item in a circular loop
    let offset = index - activeIndex;
    if (offset > items.length / 2) {
      offset -= items.length;
    } else if (offset < -items.length / 2) {
      offset += items.length;
    }
    const absOffset = Math.abs(offset);

    // Calculate our 3D math:
    // 1. Sideways movement (Translate X)
    const translateX = offset * 300; 
    
    // 2. Depth push (Translate Z) - inactive items get pushed back
    const translateZ = -absOffset * 100;
    
    // 3. Shrinkage (Scale) - inactive items get smaller
    const scale = Math.max(1 - (absOffset * 0.2), 0.5);
    
    // 4. Layering (Z-Index) - active item must be on top
    const zIndex = 10 - absOffset;
    
    // 5. Shading (Filter) - active is white, others turn gray (like your image)
    const brightness = 1 - (absOffset * 0.25);

    // Apply the math to the CSS
    item.style.transform = `translateX(${translateX}px) translateZ(${translateZ}px) scale(${scale})`;
    item.style.zIndex = zIndex;
    item.style.filter = `brightness(${brightness})`;
    
    // Optional: Hide items that are too far away
    if (absOffset > 2) {
      item.style.opacity = 0;
    } else {
      item.style.opacity = 1;
    }
  });
}

const CAROUSEL_ENTRANCE_DELAY_MS = 500;
const UI_REVEAL_DELAY_MS = 1500;

let hasRevealedUI = false;
let hasStartedCarouselEntrance = false;

function applyInitialCarouselState() {
  items.forEach((item) => {
    item.classList.add('is-initial');
    item.style.transform = 'translateX(0px) translateZ(0px) scale(1)';
    item.style.zIndex = '10';
    item.style.filter = 'brightness(1)';
    item.style.opacity = '1';
  });
}

function startCarouselEntrance() {
  if (hasStartedCarouselEntrance) return;
  hasStartedCarouselEntrance = true;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      items.forEach((item) => item.classList.remove('is-initial'));
      updateCarousel();
    });
  });
}

function revealPageSequence() {
  if (hasRevealedUI) return;
  hasRevealedUI = true;

  applyInitialCarouselState();

  window.setTimeout(() => {
    document.body.classList.remove('preload');
  }, 50);

  window.setTimeout(() => {
    startCarouselEntrance();
  }, CAROUSEL_ENTRANCE_DELAY_MS);

  window.setTimeout(() => {
    if (volumeBar) {
      volumeBar.classList.add('animate-in');
    }
    updateVolumeUI();
    window.setTimeout(() => {
      if (volumeBar) {
        volumeBar.classList.remove('animate-in');
      }
    }, 450);
    document.body.classList.add('ui-visible');
    unlockInitialInteractions();
  }, UI_REVEAL_DELAY_MS);
}

// Initial render
playTrackForIndex(activeIndex);

if (document.readyState === 'complete') {
  revealPageSequence();
} else {
  window.addEventListener('load', revealPageSequence, { once: true });
}

window.addEventListener('pageshow', () => {
  revealPageSequence();
});

function unlockInitialInteractions() {
  isInitialLoadLocked = false;
  document.body.classList.remove('interaction-locked');
}

function getWrappedIndex(index) {
  return ((index % items.length) + items.length) % items.length;
}

function goToIndex(nextIndex, { playAudio = true } = {}) {
  if (isInitialLoadLocked || isAnimating) return;

  const wrappedIndex = getWrappedIndex(nextIndex);
  if (wrappedIndex === activeIndex) {
    if (playAudio) playTrackForIndex(activeIndex);
    return;
  }

  isAnimating = true;
  activeIndex = wrappedIndex;
  updateCarousel();
  if (playAudio) playTrackForIndex(activeIndex);
  setTimeout(() => { isAnimating = false; }, TRANSITION_MS);
}

items.forEach((item, index) => {
  item.addEventListener('click', () => {
    if (index === activeIndex) {
      togglePlayPauseForIndex(index);
    } else {
      goToIndex(index);
    }
  });
});

// Button Listeners
if (nextBtn) {
  nextBtn.addEventListener('click', () => {
    goToIndex(activeIndex + 1);
  });
} else {
  console.warn('Next button not found');
}

if (prevBtn) {
  prevBtn.addEventListener('click', () => {
    goToIndex(activeIndex - 1);
  });
} else {
  console.warn('Prev button not found');
}

// Grab the container
const carouselContainer = document.querySelector('.carousel-container');

function getPointerFraction(container, pointerEvent) {
  const rect = container.getBoundingClientRect();
  return Math.min(Math.max((pointerEvent.clientX - rect.left) / rect.width, 0), 1);
}

function startDrag(container, onMove) {
  const moveHandler = (event) => {
    onMove(getPointerFraction(container, event));
  };

  const upHandler = () => {
    document.removeEventListener('pointermove', moveHandler);
    document.removeEventListener('pointerup', upHandler);
    document.removeEventListener('pointercancel', upHandler);
  };

  container.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    container.setPointerCapture(event.pointerId);
    onMove(getPointerFraction(container, event));
    document.addEventListener('pointermove', moveHandler);
    document.addEventListener('pointerup', upHandler);
    document.addEventListener('pointercancel', upHandler);
  });
}

if (volumeShell) {
  startDrag(volumeShell, (fraction) => {
    if (!audio) return;
    setVolumeFromUI(fraction);
  });
}

if (progressShell) {
  startDrag(progressShell, (fraction) => {
    if (!audio || !audio.duration) return;
    audio.currentTime = fraction * audio.duration;
    updateProgressUI();
  });
}

// Track wheel swipe force for carousel navigation
let scrollAccumulator = 0; 
const scrollThreshold = 400; // Increase this number to require MORE force, decrease for less

carouselContainer.addEventListener('wheel', (event) => {
  event.preventDefault();

  if (isInitialLoadLocked || isAnimating) return;

  // Add the current scroll movement to our total tally
  scrollAccumulator += event.deltaY;

  // Check if the accumulated scroll DOWN force passed the threshold
  if (scrollAccumulator >= scrollThreshold) {
    goToIndex(activeIndex + 1);
    scrollAccumulator = 0;
  } 
  // Check if the accumulated scroll UP force passed the threshold
  else if (scrollAccumulator <= -scrollThreshold) {
    goToIndex(activeIndex - 1);
    scrollAccumulator = 0;
  }
}, { passive: false });

document.addEventListener('keydown', (event) => {
  if (!isInitialLoadLocked) return;

  if (['ArrowLeft', 'ArrowRight', ' ', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
  }
});

audio.addEventListener('timeupdate', updateProgressUI);
audio.addEventListener('loadedmetadata', updateProgressUI);
audio.addEventListener('volumechange', updateVolumeUI);
audio.addEventListener('ended', () => {
  goToIndex(activeIndex + 1);
});

// --- Detroit time & weather widget integration ---
const detroitTimeEl = document.querySelector('.info-text .time');
const detroitTempEl = document.querySelector('.info-text .temp');
const detroitTzEl = document.querySelector('.info-text .tz');

function updateDetroitTime() {
  if (!detroitTimeEl || !detroitTzEl) return;
  const now = new Date();
  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Detroit',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(now);

  // Get short zone name like "EDT" or "EST"
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Detroit', timeZoneName: 'short' }).formatToParts(now);
  const zoneName = (parts.find(p => p.type === 'timeZoneName') || {}).value || 'ET';

  // Compute UTC offset for the zone (e.g. -4)
  const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Detroit' }));
  const offsetMinutes = (utc.getTime() - tzDate.getTime()) / 60000;
  const offsetHours = -offsetMinutes / 60;
  const offsetText = `UTC${offsetHours >= 0 ? '+' : ''}${offsetHours}`;

  detroitTimeEl.textContent = timeStr;
  detroitTzEl.textContent = `${zoneName} (${offsetText})`;
}

async function fetchDetroitWeather() {
  if (!detroitTempEl) return;
  try {
    // Open-Meteo (no API key) — Detroit coordinates
    const resp = await fetch('https://api.open-meteo.com/v1/forecast?latitude=42.3314&longitude=-83.0458&current_weather=true&temperature_unit=fahrenheit');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const temp = data?.current_weather?.temperature;
    if (typeof temp === 'number') {
      detroitTempEl.textContent = `${Math.round(temp)}°F`;
    }
  } catch (err) {
    console.warn('Failed to fetch Detroit weather:', err);
  }
}

// Start updates
updateDetroitTime();
setInterval(updateDetroitTime, 1000);
fetchDetroitWeather();
setInterval(fetchDetroitWeather, 10 * 60 * 1000); // refresh every 10 minutes

