import { getWatchedVideos, saveWatchedVideos } from './storage.js';
import { playVideo } from './player.js';

const watchedVideos = getWatchedVideos();
let showingWatched = false;
let allVideos = [];

export function createVideoElement(video) {
    const videoItem = document.createElement('div');
    videoItem.className = `video-item ${watchedVideos.has(video.id) ? 'watched' : ''}`;
    
    videoItem.innerHTML = `
        <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
        <div class="video-info">
            <div class="video-title">${video.title}</div>
            <div class="video-date">${video.publishedAt.toLocaleDateString()}</div>
        </div>
        <input type="checkbox" class="watch-checkbox" 
               data-video-id="${video.id}"
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
        saveWatchedVideos(watchedVideos);
    });

    // Adiciona clique na thumbnail para reproduzir o vídeo
    const thumbnail = videoItem.querySelector('.video-thumbnail');
    thumbnail.addEventListener('click', () => {
        playVideo(video.id);
    });

    return videoItem;
}

export function initializeUI(videos) {
    allVideos = videos;
    
    const markAllButton = document.getElementById('markAllWatched');
    markAllButton.addEventListener('click', markAllAsWatched);
    
    const playFirstButton = document.getElementById('playFirst');
    playFirstButton.addEventListener('click', playFirstUnwatched);
}

function markAllAsWatched() {
    const checkboxes = document.querySelectorAll('.watch-checkbox:not(:checked)');
    checkboxes.forEach(checkbox => {
        checkbox.click();
    });
}

function playFirstUnwatched() {
    const firstUnwatched = allVideos.find(video => !watchedVideos.has(video.id));
    if (firstUnwatched) {
        playVideo(firstUnwatched.id);
    } else {
        alert('Todos os vídeos já foram assistidos!');
    }
}

export function toggleWatchedVideos() {
    showingWatched = !showingWatched;
    const button = document.getElementById('toggleWatched');
    button.textContent = showingWatched ? 'Ocultar Assistidos' : 'Mostrar Assistidos';
    
    document.querySelectorAll('.video-item.watched').forEach(item => {
        item.style.display = showingWatched ? 'flex' : 'none';
    });
}

export function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.container').appendChild(errorDiv);
}