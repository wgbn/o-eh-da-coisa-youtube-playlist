import { getWatchedVideos, saveWatchedVideos } from './storage.js';
import { playVideo } from './player.js';
import { exportarDados, importarDados } from './utils.js';

let watchedVideos = new Set();
let showingWatched = false;
let allVideos = [];

/**
 * Formata uma data para exibição, com tratamento de erro
 * @param {Date|string} data - Data a ser formatada
 * @returns {string} Data formatada ou texto alternativo em caso de erro
 */
function formatarData(data) {
    try {
        // Verifica se é um objeto Date válido
        if (data instanceof Date && !isNaN(data)) {
            return data.toLocaleDateString();
        }
        
        // Tenta converter para Date se for uma string
        if (typeof data === 'string') {
            const dataObj = new Date(data);
            if (!isNaN(dataObj)) {
                return dataObj.toLocaleDateString();
            }
        }
        
        // Fallback para casos de erro
        return 'Data não disponível';
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return 'Data não disponível';
    }
}

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
            <div class="video-date">${formatarData(video.publishedAt)}</div>
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

/**
 * Exibe uma mensagem de erro na interface com opção de fechar
 * @param {string} message - Mensagem de erro
 * @param {Object} options - Opções adicionais
 * @param {string} options.tipo - Tipo de erro (api, cache, rede, etc)
 * @param {number} options.codigo - Código de erro, se aplicável
 * @param {string} options.solucao - Sugestão de solução, se disponível
 */
export function showError(message, options = {}) {
    // Remove qualquer erro existente
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    
    // Cria o conteúdo do erro com título e botão de fechar
    let errorContent = `
        <div class="error-header">
            <h3>Erro${options.codigo ? ` (${options.codigo})` : ''}</h3>
            <button class="close-error">×</button>
        </div>
        <div class="error-body">
            <p>${message}</p>
    `;
    
    // Adiciona informações adicionais se disponíveis
    if (options.tipo) {
        errorContent += `<p class="error-type">Tipo: ${options.tipo}</p>`;
    }
    
    if (options.solucao) {
        errorContent += `<p class="error-solution"><strong>Solução sugerida:</strong> ${options.solucao}</p>`;
    }
    
    errorContent += '</div>';
    errorDiv.innerHTML = errorContent;
    
    document.querySelector('.container').appendChild(errorDiv);
    
    // Adiciona evento para fechar o erro
    errorDiv.querySelector('.close-error').addEventListener('click', () => {
        errorDiv.classList.add('fade-out');
        setTimeout(() => errorDiv.remove(), 500);
    });
    
    // Adiciona classe para animação de entrada
    setTimeout(() => errorDiv.classList.add('show'), 10);
}