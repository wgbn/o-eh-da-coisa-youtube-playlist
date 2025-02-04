import { fetchPlaylistVideos } from './api.js';
import { createVideoElement, toggleWatchedVideos, showError, initializeUI } from './ui.js';
import { initializeYouTubePlayer } from './player.js';

async function initializeApp() {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';

    try {
        setTimeout(() => initializeYouTubePlayer(), 3000);
        const videos = await fetchPlaylistVideos();
        const videoList = document.getElementById('videoList');
        
        videos.forEach(video => {
            videoList.appendChild(createVideoElement(video));
        });

        initializeUI(videos);
        document.getElementById('toggleWatched').addEventListener('click', toggleWatchedVideos);
    } catch (error) {
        showError(error.message);
    } finally {
        loading.style.display = 'none';
    }
}

initializeApp();