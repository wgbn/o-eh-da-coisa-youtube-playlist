import { fetchPlaylistVideos } from './api.js';
import { createVideoElement, toggleWatchedVideos, showError, initializeUI, showNotification } from './ui.js';
import { initializeYouTubePlayer } from './player.js';

// Adiciona listeners para eventos de proxy e dados de demonstração
function setupEventListeners() {
    document.addEventListener('proxyUsed', (event) => {
        showNotification(event.detail.message, 'info');
    });
    
    document.addEventListener('proxySuccess', (event) => {
        showNotification(event.detail.message, 'success');
    });
    
    document.addEventListener('usandoDadosDemonstracao', (event) => {
        showNotification(event.detail.message, 'info', 6000);
    });
}

async function initializeApp() {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    
    // Configura os listeners de eventos
    setupEventListeners();

    try {
        setTimeout(() => initializeYouTubePlayer(), 3000);
        const videos = await fetchPlaylistVideos();
        const videoList = document.getElementById('videoList');
        
        videos.forEach(video => {
            videoList.appendChild(createVideoElement(video));
        });

        // Inicializa a UI de forma assíncrona para carregar os vídeos assistidos do IndexedDB
        await initializeUI(videos);
        document.getElementById('toggleWatched').addEventListener('click', toggleWatchedVideos);
    } catch (error) {
        showError(error.message);
    } finally {
        loading.style.display = 'none';
    }
}

initializeApp();