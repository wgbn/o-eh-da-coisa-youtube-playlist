import { fetchPlaylistVideos } from './api.js';
import { createVideoElement, toggleWatchedVideos, showError, initializeUI, showNotification } from './ui.js';
import { initializeYouTubePlayer } from './player.js';

// Adiciona listeners para eventos de proxy, dados de demonstração e token armazenado
function setupEventListeners() {
    document.addEventListener('proxyUsed', (event) => {
        showNotification(event.detail.message, 'info');
    });
    
    document.addEventListener('proxySuccess', (event) => {
        showNotification(event.detail.message, 'success');
    });
    
    // Evento de dados de demonstração removido
    
    document.addEventListener('usandoTokenArmazenado', (event) => {
        showNotification(event.detail.message, 'info');
    });
    
    document.addEventListener('novosVideosCarregados', (event) => {
        showNotification(event.detail.message, 'success', 5000);
    });
    
    document.addEventListener('usandoCache', (event) => {
        showNotification(event.detail.message, 'info', 4000);
    });
    
    document.addEventListener('limitePaginasAtingido', (event) => {
        showNotification(event.detail.message, 'warning', 8000);
    });
    
    document.addEventListener('carregandoPlaylistCompleta', (event) => {
        showNotification(event.detail.message, 'info', 10000);
    });
    
    document.addEventListener('progressoCarregamento', (event) => {
        showNotification(event.detail.message, 'info', 5000);
    });
    
    document.addEventListener('erroAPI', (event) => {
        // Exibe notificação de erro com duração mais longa
        showNotification(event.detail.message, 'error', 10000);
    });
}

async function initializeApp(forceFullUpdate = false) {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    
    // Configura os listeners de eventos
    setupEventListeners();

    try {
        setTimeout(() => initializeYouTubePlayer(), 3000);
        const result = await fetchPlaylistVideos(forceFullUpdate);
        const videos = Array.isArray(result) ? result : result.videos;
        const videoList = document.getElementById('videoList');
        
        if (videos && videos.length > 0) {
            videos.forEach(video => {
                videoList.appendChild(createVideoElement(video));
            });
        } else {
            // Não exibe nada se não houver vídeos
            console.log('Nenhum vídeo disponível para exibir');
        }

        // Inicializa a UI de forma assíncrona para carregar os vídeos assistidos do IndexedDB
        await initializeUI(videos);
        document.getElementById('toggleWatched').addEventListener('click', toggleWatchedVideos);
        
        // Adiciona evento para o botão de atualização completa da playlist
        document.getElementById('refreshPlaylist').addEventListener('click', handleRefreshPlaylist);
    } catch (error) {
        // Analisa o erro para fornecer informações mais detalhadas
        const errorOptions = analisarErro(error);
        showError(error.message, errorOptions);
    } finally {
        loading.style.display = 'none';
    }
}

/**
 * Manipula o clique no botão de atualização completa da playlist
 */
async function handleRefreshPlaylist() {
    const refreshButton = document.getElementById('refreshPlaylist');
    const originalText = refreshButton.textContent;
    
    try {
        // Desabilita o botão durante a atualização
        refreshButton.disabled = true;
        refreshButton.textContent = 'Atualizando...';
        
        // Limpa a lista de vídeos atual
        const videoList = document.getElementById('videoList');
        videoList.innerHTML = '';
        
        // Mostra o indicador de carregamento
        const loading = document.getElementById('loading');
        loading.style.display = 'block';
        
        // Força uma atualização completa da playlist
        showNotification('Iniciando atualização completa da playlist...', 'info');
        
        // Recarrega a aplicação com atualização forçada
        const result = await fetchPlaylistVideos(true);
        const videos = Array.isArray(result) ? result : result.videos;
        
        // Recria a lista de vídeos
        if (videos && videos.length > 0) {
            videos.forEach(video => {
                videoList.appendChild(createVideoElement(video));
            });
        } else {
            // Não exibe nada se não houver vídeos
            console.log('Nenhum vídeo disponível para exibir');
            showNotification('Nenhum vídeo disponível para exibir', 'warning');
        }
        
        // Exibe informação sobre o número total de vídeos carregados
        if (!Array.isArray(result) && result.newVideosCount) {
            showNotification(`Total de ${videos.length} vídeos carregados na playlist`, 'info');
        }
        
        // Reinicializa a UI
        await initializeUI(videos);
        
        showNotification('Playlist atualizada com sucesso!', 'success');
    } catch (error) {
        const errorOptions = analisarErro(error);
        showError(`Erro ao atualizar playlist: ${error.message}`, errorOptions);
    } finally {
        // Restaura o botão
        refreshButton.disabled = false;
        refreshButton.textContent = originalText;
        
        // Esconde o indicador de carregamento
        document.getElementById('loading').style.display = 'none';
    }
}

/**
 * Analisa o erro para fornecer informações mais detalhadas
 * @param {Error} error - O objeto de erro
 * @returns {Object} Opções para a função showError
 */
function analisarErro(error) {
    const options = {};
    
    // Verifica se é um erro de API do YouTube
    if (error.message.includes('API do YouTube')) {
        options.tipo = 'API YouTube';
        
        if (error.message.includes('403')) {
            options.codigo = 403;
            options.solucao = 'Verifique se sua chave de API está correta e tem permissões adequadas.';
        } else if (error.message.includes('404')) {
            options.codigo = 404;
            options.solucao = 'Verifique se o ID da playlist está correto.';
        } else if (error.message.includes('429')) {
            options.codigo = 429;
            options.solucao = 'Aguarde alguns minutos e tente novamente. A API do YouTube tem limites de requisições.';
        }
    }
    // Verifica se é um erro de rede
    else if (error.message.includes('Failed to fetch') || error.message.includes('Network Error')) {
        options.tipo = 'Conexão';
        options.solucao = 'Verifique sua conexão com a internet e tente novamente.';
    }
    // Verifica se é um erro de cache
    else if (error.message.includes('cache')) {
        options.tipo = 'Cache';
        options.solucao = 'Tente limpar o cache do navegador e recarregar a página.';
    }
    // Verifica se é um erro de configuração
    else if (error.message.includes('chave de API')) {
        options.tipo = 'Configuração';
        options.solucao = 'Configure sua chave de API do YouTube no arquivo config.js.';
    }
    
    return options;
}

initializeApp();