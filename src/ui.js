import { getWatchedVideos, saveWatchedVideos } from './storage.js';
import { playVideo } from './player.js';
import { exportarDados, importarDados } from './utils.js';

let watchedVideos = new Set();
let showingWatched = false;
let allVideos = [];

// Inicializa os vídeos assistidos de forma assíncrona
async function initializeWatchedVideos() {
    watchedVideos = await getWatchedVideos();
    return watchedVideos;
}

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
    checkbox.addEventListener('change', async () => {
        if (checkbox.checked) {
            watchedVideos.add(video.id);
            videoItem.classList.add('watched');
        } else {
            watchedVideos.delete(video.id);
            videoItem.classList.remove('watched');
        }
        await saveWatchedVideos(watchedVideos);
    });

    // Adiciona clique na thumbnail para reproduzir o vídeo
    const thumbnail = videoItem.querySelector('.video-thumbnail');
    thumbnail.addEventListener('click', () => {
        playVideo(video.id);
    });

    return videoItem;
}

export async function initializeUI(videos) {
    allVideos = videos;
    
    // Inicializa os vídeos assistidos
    await initializeWatchedVideos();
    
    // Atualiza a interface com os vídeos assistidos
    updateWatchedVideosUI();
    
    const markAllButton = document.getElementById('markAllWatched');
    markAllButton.addEventListener('click', markAllAsWatched);
    
    const playFirstButton = document.getElementById('playFirst');
    playFirstButton.addEventListener('click', playFirstUnwatched);
    
    // Adiciona eventos para exportação e importação de dados
    setupDataManagementUI();
}

// Configura a interface para gerenciamento de dados (exportação/importação)
function setupDataManagementUI() {
    const exportButton = document.getElementById('exportData');
    const importButton = document.getElementById('importData');
    const importFile = document.getElementById('importFile');
    
    exportButton.addEventListener('click', async () => {
        try {
            exportButton.disabled = true;
            exportButton.textContent = 'Exportando...';
            
            await exportarDados();
            
            showNotification('Dados exportados com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao exportar dados:', error);
            showNotification('Erro ao exportar dados', 'error');
        } finally {
            exportButton.disabled = false;
            exportButton.textContent = 'Exportar Dados';
        }
    });
    
    importButton.addEventListener('click', () => {
        importFile.click();
    });
    
    importFile.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            importButton.disabled = true;
            importButton.textContent = 'Importando...';
            
            const count = await importarDados(file);
            
            // Recarregar os vídeos assistidos
            watchedVideos = await getWatchedVideos();
            updateWatchedVideosUI();
            
            showNotification(`${count} registros importados com sucesso!`, 'success');
        } catch (error) {
            console.error('Erro ao importar dados:', error);
            showNotification('Erro ao importar dados: ' + error.message, 'error');
        } finally {
            importButton.disabled = false;
            importButton.textContent = 'Importar Dados';
            importFile.value = ''; // Limpa o input para permitir selecionar o mesmo arquivo novamente
        }
    });
}

// Exibe uma notificação na interface
export function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.querySelector('.container').appendChild(notification);
    
    // Remove a notificação após a duração especificada
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, duration);
}

// Atualiza a interface com base nos vídeos assistidos
function updateWatchedVideosUI() {
    document.querySelectorAll('.video-item').forEach(item => {
        const checkbox = item.querySelector('.watch-checkbox');
        const videoId = checkbox.dataset.videoId;
        
        if (watchedVideos.has(videoId)) {
            item.classList.add('watched');
            checkbox.checked = true;
        } else {
            item.classList.remove('watched');
            checkbox.checked = false;
        }
        
        // Aplica a visibilidade conforme o estado atual
        if (item.classList.contains('watched')) {
            item.style.display = showingWatched ? 'flex' : 'none';
        }
    });
}

async function markAllAsWatched() {
    const checkboxes = document.querySelectorAll('.watch-checkbox:not(:checked)');
    
    // Coleta todos os IDs de vídeos não assistidos
    const unwatchedIds = Array.from(checkboxes).map(checkbox => checkbox.dataset.videoId);
    
    // Adiciona todos os IDs ao conjunto de vídeos assistidos
    unwatchedIds.forEach(id => watchedVideos.add(id));
    
    // Salva no IndexedDB
    await saveWatchedVideos(watchedVideos);
    
    // Atualiza a interface
    updateWatchedVideosUI();
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