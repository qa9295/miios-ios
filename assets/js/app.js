const clock = document.getElementById('clock');
const audio = document.getElementById('jaxAudio');
const toast = document.getElementById('toast');
const appWindow = document.getElementById('appWindow');
const windowTitle = document.getElementById('windowTitle');
const windowContent = document.getElementById('windowContent');
let activeStream = null;
let toastTimer = null;
let musicFiles = [];
let musicUrls = [];
let musicIndex = -1;
const musicAudio = new Audio();
musicAudio.preload = 'metadata';
musicAudio.volume = 0.8;



function showToast(message, duration = 2200) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

function openWindow(name, html) {
  stopCamera();
  windowTitle.textContent = name;
  windowContent.innerHTML = html;
  appWindow.classList.add('open');
  appWindow.setAttribute('aria-hidden', 'false');
}

function closeWindow() {
  stopCamera();
  appWindow.classList.remove('open');
  appWindow.setAttribute('aria-hidden', 'true');
  windowContent.innerHTML = '';
}
document.getElementById('closeWindow').addEventListener('click', closeWindow);

function stopCamera() {
  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }
}

const DB_NAME = 'MiiOSGallery';
const STORE_NAME = 'photos';
function openGalleryDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, {keyPath:'id', autoIncrement:true});
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function savePhoto(blob) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add({blob, created:Date.now()});
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
async function getPhotos() {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result.reverse()); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
async function deletePhoto(id) {
  const db = await openGalleryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(Number(id));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function launchCamera() {
  openWindow('Camera', `
    <video class="camera-video" id="cameraVideo" autoplay playsinline></video>
    <p class="hint" id="cameraHint">Allow camera access when your browser asks.</p>
    <div class="camera-actions">
      <button class="panel-button" id="takePhoto" disabled>Take photo</button>
      <button class="panel-button" id="startCamera">Start camera</button>
    </div>
    <canvas id="photoCanvas" hidden></canvas>
  `);
  const start = async () => {
    try {
      stopCamera();
      activeStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}, audio:false});
      const video = document.getElementById('cameraVideo');
      video.srcObject = activeStream;
      document.getElementById('takePhoto').disabled = false;
      document.getElementById('cameraHint').textContent = 'Camera is ready. Your photos are saved in this browser.';
    } catch (err) {
      document.getElementById('cameraHint').textContent =
        'Camera unavailable. Use HTTPS or localhost and allow camera permission.';
    }
  };
  document.getElementById('startCamera').addEventListener('click', start);
  document.getElementById('takePhoto').addEventListener('click', () => {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('photoCanvas');
    if (!video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(async blob => {
      try {
        await savePhoto(blob);
        showToast('Photo saved to Gallery!');
      } catch (err) {
        showToast('Could not save this photo.');
      }
    }, 'image/jpeg', .9);
  });
  start();
}

async function launchGallery() {
  openWindow('Gallery', '<p class="hint">Your saved MiiOS photos appear here.</p><div id="galleryContent"></div>');
  const target = document.getElementById('galleryContent');
  try {
    const photos = await getPhotos();
    if (!photos.length) {
      target.innerHTML = '<div class="empty-gallery">No photos yet.<br>Take one with Camera!</div>';
      return;
    }
    target.innerHTML = '<div class="gallery-grid">' + photos.map(photo => `
      <div class="photo-card">
        <img src="${URL.createObjectURL(photo.blob)}" alt="Saved photo">
        <button data-delete="${photo.id}">Delete</button>
      </div>`).join('') + '</div>';
    target.querySelectorAll('[data-delete]').forEach(button => {
      button.addEventListener('click', async () => {
        await deletePhoto(button.dataset.delete);
        launchGallery();
      });
    });
  } catch (err) {
    target.innerHTML = '<div class="empty-gallery">Gallery storage is unavailable in this browser.</div>';
  }
}


// Basic Settings — preferences are stored locally in this browser.
const SETTINGS_KEY = 'miiosBasicSettings';
const defaultSettings = { volume: 0.8, clock24: false, theme: 'pastel' };
let miiosSettings = {...defaultSettings};

function loadMiiOSSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    miiosSettings = {...defaultSettings, ...saved};
  } catch (error) {
    miiosSettings = {...defaultSettings};
  }
  if (!['pastel', 'dark', 'mint'].includes(miiosSettings.theme)) miiosSettings.theme = 'pastel';
  miiosSettings.volume = Math.max(0, Math.min(1, Number(miiosSettings.volume)));
  miiosSettings.clock24 = Boolean(miiosSettings.clock24);
  audio.volume = miiosSettings.volume;
  musicAudio.volume = miiosSettings.volume;
  document.documentElement.dataset.theme = miiosSettings.theme;
  updateClock();
}

function updateClock() {
  clock.textContent = new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !miiosSettings.clock24
  }).format(new Date());
}
loadMiiOSSettings();
setInterval(updateClock, 15000);

function persistMiiOSSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(miiosSettings));
    audio.volume = miiosSettings.volume;
    musicAudio.volume = miiosSettings.volume;
    document.documentElement.dataset.theme = miiosSettings.theme;
    updateClock();
    showToast('Settings saved!');
  } catch (error) {
    showToast('Could not save settings in this browser.');
  }
}

function launchSettings() {
  openWindow('Settings', `
    <section class="settings-section">
      <h3>Appearance</h3>
      <p class="hint">Choose a MiiOS colour theme.</p>
      <div class="theme-options">
        <label class="theme-option">
          <input type="radio" name="miiosTheme" value="pastel">
          <span class="theme-preview pastel-preview"></span>
          <b>Pastel</b>
        </label>
        <label class="theme-option">
          <input type="radio" name="miiosTheme" value="dark">
          <span class="theme-preview dark-preview"></span>
          <b>Dark</b>
        </label>
        <label class="theme-option">
          <input type="radio" name="miiosTheme" value="mint">
          <span class="theme-preview mint-preview"></span>
          <b>Mint</b>
        </label>
      </div>
    </section>

    <section class="settings-section">
      <h3>Sound</h3>
      <div class="setting-row">
        <label for="miiosVolume">Jax audio volume</label>
        <strong id="miiosVolumeValue">${Math.round(miiosSettings.volume * 100)}%</strong>
      </div>
      <input class="settings-range" id="miiosVolume" type="range" min="0" max="100" value="${Math.round(miiosSettings.volume * 100)}">
    </section>

    <section class="settings-section">
      <h3>Clock</h3>
      <label class="toggle-row">
        <span>Use 24-hour clock</span>
        <input id="miiosClock24" type="checkbox" ${miiosSettings.clock24 ? 'checked' : ''}>
      </label>
    </section>

    <div class="settings-actions">
      <button class="panel-button" id="miiosSaveSettings">Save settings</button>
      <button class="secondary-button" id="miiosResetSettings">Restore defaults</button>
    </div>
    <p class="hint settings-note">Your preferences are saved in this browser.</p>
  `);

  document.querySelectorAll('input[name="miiosTheme"]').forEach(input => {
    input.checked = input.value === miiosSettings.theme;
    input.addEventListener('change', () => {
      if (input.checked) {
        miiosSettings.theme = input.value;
        document.documentElement.dataset.theme = input.value;
      }
    });
  });

  const volumeInput = document.getElementById('miiosVolume');
  const volumeLabel = document.getElementById('miiosVolumeValue');
  volumeInput.addEventListener('input', () => {
    miiosSettings.volume = Number(volumeInput.value) / 100;
    volumeLabel.textContent = `${volumeInput.value}%`;
    audio.volume = miiosSettings.volume;
  });

  document.getElementById('miiosClock24').addEventListener('change', event => {
    miiosSettings.clock24 = event.target.checked;
    updateClock();
  });

  document.getElementById('miiosSaveSettings').addEventListener('click', persistMiiOSSettings);
  document.getElementById('miiosResetSettings').addEventListener('click', () => {
    miiosSettings = {...defaultSettings};
    audio.volume = miiosSettings.volume;
    musicAudio.volume = miiosSettings.volume;
    document.documentElement.dataset.theme = miiosSettings.theme;
    launchSettings();
    showToast('Defaults restored. Press Save settings to keep them.');
  });
}


function formatMusicTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function ensureMusicDock() {
  let dock = document.getElementById('musicMiniDock');
  if (!dock) {
    dock = document.createElement('div');
    dock.id = 'musicMiniDock';
    dock.innerHTML = `<span class="music-dock-note">♫</span><span id="musicDockTitle">Nothing playing</span><button id="musicDockToggle" aria-label="Play or pause">▶</button>`;
    document.querySelector('.device').appendChild(dock);
    document.getElementById('musicDockToggle').addEventListener('click', async () => {
      if (!musicAudio.src) return launchMusic();
      if (musicAudio.paused) { try { await musicAudio.play(); } catch(e) { showToast('Tap Play in Music to start audio.'); } }
      else musicAudio.pause();
      updateMusicDock();
    });
  }
  return dock;
}

function updateMusicDock() {
  const dock = ensureMusicDock();
  const title = document.getElementById('musicDockTitle');
  const toggle = document.getElementById('musicDockToggle');
  const hasTrack = musicIndex >= 0 && musicFiles[musicIndex];
  dock.classList.toggle('visible', Boolean(hasTrack));
  if (hasTrack) title.textContent = musicFiles[musicIndex].name.replace(/\.[^.]+$/, '');
  toggle.textContent = musicAudio.paused ? '▶' : 'Ⅱ';
  toggle.setAttribute('aria-label', musicAudio.paused ? 'Play' : 'Pause');
}

function setMusicTrack(index, autoplay = false) {
  if (!musicFiles.length) return;
  musicIndex = (index + musicFiles.length) % musicFiles.length;
  musicAudio.src = musicUrls[musicIndex];
  musicAudio.load();
  updateMusicDock();
  const title = document.getElementById('musicTrackTitle');
  if (title) title.textContent = musicFiles[musicIndex].name;
  const art = document.getElementById('musicArtwork');
  if (art) art.textContent = '♫';
  if (autoplay) musicAudio.play().catch(() => showToast('Press Play to start this track.'));
}

function renderMusicPlaylist() {
  const list = document.getElementById('musicPlaylist');
  if (!list) return;
  if (!musicFiles.length) {
    list.innerHTML = '<p class="hint">Your playlist is empty. Import some MP3, WAV, OGG or M4A files!</p>';
    return;
  }
  list.innerHTML = musicFiles.map((file, i) => `<button class="music-track ${i === musicIndex ? 'selected' : ''}" data-track="${i}"><span>♪</span><span>${file.name.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</span></button>`).join('');
  list.querySelectorAll('[data-track]').forEach(button => button.addEventListener('click', () => setMusicTrack(Number(button.dataset.track), true)));
}

function launchMusic() {
  openWindow('Music', `
    <div class="music-player">
      <div class="music-art" id="musicArtwork">♫</div>
      <p class="hint music-now-label">NOW PLAYING</p>
      <strong class="music-track-title" id="musicTrackTitle">Choose a song</strong>
      <div class="music-progress-row"><span id="musicElapsed">0:00</span><input id="musicSeek" type="range" min="0" max="1000" value="0"><span id="musicDuration">0:00</span></div>
      <div class="music-controls">
        <button class="music-control" id="musicPrevious" aria-label="Previous">⏮</button>
        <button class="music-control main" id="musicPlay" aria-label="Play">▶</button>
        <button class="music-control" id="musicNext" aria-label="Next">⏭</button>
      </div>
      <label class="music-volume">Volume <input id="musicVolume" type="range" min="0" max="100" value="80"></label>
      <label class="panel-button music-import">＋ Import music<input id="musicFiles" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" multiple hidden></label>
    </div>
    <div class="music-list-heading"><strong>Playlist</strong><span id="musicCount">0 songs</span></div>
    <div id="musicPlaylist" class="music-playlist"></div>
    <p class="hint">Music keeps playing when you close this window and return to HOME. Playback lasts while this MiiOS page stays open.</p>
  `);
  ensureMusicDock();
  renderMusicPlaylist();
  if (musicIndex >= 0 && musicFiles[musicIndex]) document.getElementById('musicTrackTitle').textContent = musicFiles[musicIndex].name;
  document.getElementById('musicCount').textContent = `${musicFiles.length} song${musicFiles.length === 1 ? '' : 's'}`;
  const play = document.getElementById('musicPlay');
  const sync = () => {
    play.textContent = musicAudio.paused ? '▶' : 'Ⅱ';
    play.setAttribute('aria-label', musicAudio.paused ? 'Play' : 'Pause');
    document.getElementById('musicElapsed').textContent = formatMusicTime(musicAudio.currentTime);
    document.getElementById('musicDuration').textContent = formatMusicTime(musicAudio.duration);
    document.getElementById('musicSeek').value = Number.isFinite(musicAudio.duration) && musicAudio.duration ? musicAudio.currentTime / musicAudio.duration * 1000 : 0;
    updateMusicDock();
  };
  play.addEventListener('click', async () => {
    if (!musicFiles.length) { document.getElementById('musicFiles').click(); return; }
    if (musicAudio.paused) {
      if (!musicAudio.src) setMusicTrack(musicIndex < 0 ? 0 : musicIndex);
      try { await musicAudio.play(); } catch(e) { showToast('Could not play this audio file.'); }
    } else musicAudio.pause();
    sync();
  });
  document.getElementById('musicPrevious').addEventListener('click', () => setMusicTrack(musicIndex - 1, true));
  document.getElementById('musicNext').addEventListener('click', () => setMusicTrack(musicIndex + 1, true));
  document.getElementById('musicFiles').addEventListener('change', event => {
    const added = Array.from(event.target.files || []).filter(file => file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name));
    if (!added.length) return;
    musicFiles.push(...added);
    musicUrls.push(...added.map(file => URL.createObjectURL(file)));
    if (musicIndex < 0) setMusicTrack(0);
    document.getElementById('musicCount').textContent = `${musicFiles.length} songs`;
    renderMusicPlaylist();
    showToast(`${added.length} song${added.length === 1 ? '' : 's'} added!`);
    event.target.value = '';
  });
  document.getElementById('musicVolume').addEventListener('input', event => { musicAudio.volume = Number(event.target.value) / 100; });
  document.getElementById('musicSeek').addEventListener('input', event => {
    if (Number.isFinite(musicAudio.duration)) musicAudio.currentTime = Number(event.target.value) / 1000 * musicAudio.duration;
  });
  musicAudio.ontimeupdate = sync;
  musicAudio.onloadedmetadata = sync;
  musicAudio.onplay = sync;
  musicAudio.onpause = sync;
  musicAudio.onended = () => { if (musicIndex < musicFiles.length - 1) setMusicTrack(musicIndex + 1, true); else sync(); };
  sync();
}

document.querySelectorAll('.app').forEach(button => {
  button.addEventListener('click', () => {
    const name = button.dataset.app;
    if (name === 'Camera') return launchCamera();
    if (name === 'Gallery') return launchGallery();
    if (name === 'Settings') return launchSettings();
    if (name === 'Music') return launchMusic();
    const messages = {
      'Mii Plaza':'Your Mii Plaza is coming soon!',
      'Games':'Your games are coming soon!',
    };
    openWindow(name, `<div class="empty-gallery">${messages[name] || name}</div>`);
  });
});

document.getElementById('secret').addEventListener('click', async () => {
  toast.textContent = 'Caine, is this one of your NPCs, or is this a new sucker?';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  try {
    audio.currentTime = 0;
    await audio.play();
  } catch (error) {
    showToast('Jax’s audio could not play. Check the audio file and browser permissions.', 3500);
  }
});

audio.addEventListener('ended', () => toast.classList.remove('show'));
window.addEventListener('beforeunload', () => { stopCamera(); musicUrls.forEach(url => URL.revokeObjectURL(url)); });
ensureMusicDock();
