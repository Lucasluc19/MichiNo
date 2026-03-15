const API = '';
let currentSongId = null;
let songs = [];
let videos = [];

// Charger les chansons
async function loadSongs() {
  try {
    const res = await fetch(`${API}/api/songs`);
    songs = await res.json();
    renderSongs(songs);
  } catch (err) {
    document.getElementById('songsList').innerHTML = '<div class="empty">❌ Erreur de chargement</div>';
  }
}

// Charger les vidéos
async function loadVideos() {
  try {
    const res = await fetch(`${API}/api/videos`);
    videos = await res.json();
    renderVideos(videos);
  } catch (err) {
    document.getElementById('videosList').innerHTML = '<div class="empty">❌ Erreur de chargement</div>';
  }
}

// Afficher les chansons
function renderSongs(list) {
  const container = document.getElementById('songsList');
  if (list.length === 0) {
    container.innerHTML = '<div class="empty">🎵 Aucune chanson pour le moment</div>';
    return;
  }
  container.innerHTML = list.map(song => `
    <div class="song-card" onclick="playSong('${song._id}', '${song.audioUrl}', '${song.title}', '${song.artist}', '${song.imageUrl}')">
      <img src="${song.imageUrl || 'https://via.placeholder.com/60x60/1a1a2e/gold?text=🎵'}" alt="${song.title}" onerror="this.src='https://via.placeholder.com/60x60/1a1a2e/FFD700?text=🎵'">
      <div class="song-info">
        <div class="song-title">${song.title}</div>
        <div class="song-artist">${song.artist}</div>
        <span class="song-genre">${song.genre}</span>
      </div>
      <div class="song-actions">
        <button class="play-btn" onclick="event.stopPropagation(); playSong('${song._id}', '${song.audioUrl}', '${song.title}', '${song.artist}', '${song.imageUrl}')">
          <i class="fas fa-play"></i>
        </button>
        <div class="dl-count"><i class="fas fa-download"></i><br>${song.downloads}</div>
      </div>
    </div>
  `).join('');
}

// Afficher les vidéos
function renderVideos(list) {
  const container = document.getElementById('videosList');
  if (list.length === 0) {
    container.innerHTML = '<div class="empty">🎬 Aucune vidéo pour le moment</div>';
    return;
  }
  container.innerHTML = list.map(video => `
    <div class="video-card">
      <div class="video-thumb" onclick="playVideo('${video._id}', '${video.videoUrl}', ${video.isYoutube})">
        <img src="${video.thumbnailUrl || 'https://via.placeholder.com/320x180/1a1a2e/gold?text=VIDEO'}" alt="${video.title}" onerror="this.src='https://via.placeholder.com/320x180/1a1a2e/FFD700?text=🎬'">
        <div class="play-overlay"><i class="fas fa-play"></i></div>
      </div>
      <div class="video-info">
        <div class="video-title">${video.title}</div>
        <div class="video-artist">${video.artist}</div>
        <div class="video-views"><i class="fas fa-eye"></i> ${video.views} vues</div>
      </div>
    </div>
  `).join('');
}

// Jouer une chanson
function playSong(id, url, title, artist, image) {
  currentSongId = id;
  const player = document.getElementById('audioPlayer');
  player.src = url;
  player.play();
  document.getElementById('playerTitle').textContent = title;
  document.getElementById('playerArtist').textContent = artist;
  document.getElementById('playerCover').src = image || 'https://via.placeholder.com/60x60/1a1a2e/FFD700?text=🎵';
}

// Télécharger la chanson actuelle
async function downloadCurrent() {
  if (!currentSongId) return alert('Sélectionne une chanson d\'abord !');
  try {
    const res = await fetch(`${API}/api/songs/${currentSongId}/download`, { method: 'POST' });
    const data = await res.json();
    const a = document.createElement('a');
    a.href = data.downloadUrl;
    a.download = 'michino-music.mp3';
    a.click();
  } catch (err) {
    alert('Erreur de téléchargement');
  }
}

// Jouer une vidéo
async function playVideo(id, url, isYoutube) {
  await fetch(`${API}/api/videos/${id}/view`, { method: 'POST' });
  
  const modal = document.getElementById('videoModal');
  const videoEl = document.getElementById('modalVideo');
  
  if (isYoutube) {
    videoEl.innerHTML = `<iframe class="modal-video" src="${url}?autoplay=1" frameborder="0" allowfullscreen></iframe>`;
  } else {
    videoEl.innerHTML = `<video class="modal-video" controls autoplay><source src="${url}"></video>`;
  }
  
  modal.classList.add('active');
}

// Fermer modal vidéo
function closeModal() {
  document.getElementById('videoModal').classList.remove('active');
  document.getElementById('modalVideo').innerHTML = '';
}

// Recherche
async function search() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) { loadSongs(); return; }
  
  const res = await fetch(`${API}/api/songs/search?q=${q}`);
  const results = await res.json();
  renderSongs(results);
  showTab('songs');
}

document.getElementById('searchInput').addEventListener('keypress', e => {
  if (e.key === 'Enter') search();
});

// Tabs
function showTab(tab) {
  document.getElementById('songs-tab').style.display = tab === 'songs' ? 'block' : 'none';
  document.getElementById('videos-tab').style.display = tab === 'videos' ? 'block' : 'none';
  document.querySelectorAll('.tab-btn').forEach((btn, i) => {
    btn.classList.toggle('active', (tab === 'songs' && i === 0) || (tab === 'videos' && i === 1));
  });
  if (tab === 'videos') loadVideos();
}

// Initialisation
loadSongs();
