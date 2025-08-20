const PLAYLIST_ID = 'PL5DFl3pSRD__6vNCPZXtStCzWsNpy15sW';
const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const STORAGE_KEY = 'watchedVideos';

let showingWatched = false;
const watchedVideos = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));

async function fetchPlaylistVideos() {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    
    try {
        let allVideos = [];
        let nextPageToken = '';
        
        do {
            const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${PLAYLIST_ID}&key=${API_KEY}&pageToken=${nextPageToken}`);
            const data = await response.json();
            
            allVideos = [...allVideos, ...data.items];
            nextPageToken = data.nextPageToken;
        } while (nextPageToken);

        return allVideos
            .map(item => ({
                id: item.snippet.resourceId.videoId,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails.medium.url,
                publishedAt: new Date(item.snippet.publishedAt),
            }))
            .sort((a, b) => a.publishedAt - b.publishedAt);
    } catch (error) {
        console.error('Erro ao carregar a playlist:', error);
        return [];
    } finally {
        loading.style.display = 'none';
    }
}

function createVideoElement(video) {
    const videoItem = document.createElement('div');
    videoItem.className = `video-item ${watchedVideos.has(video.id) ? 'watched' : ''}`;
    
    videoItem.innerHTML = `
        <img src="${video.thumbnail}" alt="${video.title}">
        <div class="video-info">
            <div class="video-title">${video.title}</div>
            <div class="video-date">${video.publishedAt.toLocaleDateString()}</div>
        </div>
        <input type="checkbox" class="watch-checkbox" 
               ${watchedVideos.has(video.id) ? 'checked' : ''}>
    `;

    const checkbox = videoItem.querySelector('.watch-checkbox');
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            watchedVideos.add(video.id);
            videoItem.classList.add('watched');
        } else {
            watchedVideos.delete(video.id);
            videoItem.classList.remove('watched');
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...watchedVideos]));
    });

    return videoItem;
}

function toggleWatchedVideos() {
    showingWatched = !showingWatched;
    const button = document.getElementById('toggleWatched');
    button.textContent = showingWatched ? 'Ocultar Assistidos' : 'Mostrar Assistidos';
    
    document.querySelectorAll('.video-item.watched').forEach(item => {
        item.style.display = showingWatched ? 'flex' : 'none';
    });
}

async function initializeApp() {
    const videos = await fetchPlaylistVideos();
    const videoList = document.getElementById('videoList');
    
    videos.forEach(video => {
        videoList.appendChild(createVideoElement(video));
    });

    document.getElementById('toggleWatched').addEventListener('click', toggleWatchedVideos);
}

initializeApp();
