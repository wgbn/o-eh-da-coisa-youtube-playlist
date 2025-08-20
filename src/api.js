import { PLAYLIST_ID, API_KEY } from './config.js';
import { getLastPageToken, saveLastPageToken, shouldForceFullUpdate, clearStoredToken } from './tokenStorage.js';
import { saveVideosToCache, getVideosFromCache, clearVideosCache, isCacheValid, getCacheAge } from './videoCache.js';

// Eventos personalizados para comunicação com a UI
const proxyEvent = new CustomEvent('proxyUsed', { detail: { message: 'Usando proxy para acessar a API do YouTube' } });
const proxySuccessEvent = new CustomEvent('proxySuccess', { detail: { message: 'Conexão estabelecida com sucesso via proxy' } });

// Lista de proxies CORS alternativos
const CORS_PROXIES = [
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

/**
 * Busca vídeos da playlist do YouTube
 * @param {boolean} forceFullUpdate - Se true, força atualização completa ignorando pageToken armazenado
 * @param {boolean} useCache - Se true, tenta usar o cache local antes de consultar a API
 * @returns {Promise<{videos: Array, newVideosCount: number}>} Lista de vídeos da playlist e contagem de novos vídeos
 */
export async function fetchPlaylistVideos(forceFullUpdate = false, useCache = true) {
    if (!API_KEY || API_KEY === 'SUA_CHAVE_API_AQUI') {
        throw new Error('Por favor, configure sua chave de API do YouTube no arquivo config.js');
    }

    try {
        // Verifica se pode usar o cache
        if (useCache && !forceFullUpdate) {
            // Tenta recuperar vídeos do cache primeiro
            const isCacheValido = await isCacheValid();
            if (isCacheValido) {
                const cachedVideos = await getVideosFromCache();
                if (cachedVideos) {
                    console.log(`Usando ${cachedVideos.length} vídeos do cache local`);
                    // Verificação adicional para garantir que os dados do cache são válidos
                    const videosValidos = cachedVideos.filter(video => 
                        video && video.id && video.title && video.thumbnail && video.publishedAt instanceof Date);
                        
                    if (videosValidos.length !== cachedVideos.length) {
                        console.warn(`${cachedVideos.length - videosValidos.length} vídeos no cache tinham formato inválido e foram filtrados`);
                    }
                    
                    const cacheAge = getCacheAge();
                    document.dispatchEvent(new CustomEvent('usandoCache', { 
                        detail: { 
                            message: `Usando vídeos em cache (${cacheAge}h atrás)`,
                            count: videosValidos.length
                        } 
                    }));
                    return { videos: videosValidos, newVideosCount: 0 };
                }
            }
        }
        
        // Se forçar atualização completa, limpa o cache
        if (forceFullUpdate) {
            await clearVideosCache();
        }
        let allVideos = [];
        let isUsingStoredToken = false;
        let newVideosCount = 0;
        
        // Determina se deve usar o pageToken armazenado ou começar do início
        let nextPageToken = '';
        let lastUsedToken = ''; // Armazena o último token usado para detectar loops
        let pageCount = 0; // Contador de páginas carregadas
        const MAX_PAGES = 100; // Aumentado para 100 para permitir carregar playlists grandes (até 50.000 vídeos)
        
        // Verifica se deve fazer uma atualização completa
        const deveAtualizarTudo = forceFullUpdate || shouldForceFullUpdate();
        
        // Se for uma janela incognito ou não houver cache, força atualização completa
        const cacheDisponivel = await getVideosFromCache();
        const ehPrimeiroCarregamento = !cacheDisponivel || cacheDisponivel.length === 0;
        
        if (ehPrimeiroCarregamento) {
            console.log('Primeiro carregamento ou cache vazio. Carregando playlist completa...');
            clearStoredToken();
            document.dispatchEvent(new CustomEvent('carregandoPlaylistCompleta', { 
                detail: { message: 'Carregando playlist completa. Isso pode levar algum tempo...' } 
            }));
        } else if (!deveAtualizarTudo) {
            const storedToken = getLastPageToken();
            if (storedToken) {
                console.log('Usando pageToken armazenado:', storedToken);
                nextPageToken = storedToken;
                isUsingStoredToken = true;
                
                // Disparar evento informando que está usando token armazenado
                document.dispatchEvent(new CustomEvent('usandoTokenArmazenado', { 
                    detail: { message: 'Buscando apenas novos vídeos da playlist' } 
                }));
            }
        } else if (forceFullUpdate) {
            // Se forçar atualização completa, limpa o token armazenado
            clearStoredToken();
            console.log('Forçando atualização completa da playlist');
        }
        
        do {
            // Verifica se atingiu o limite máximo de páginas
            if (pageCount >= MAX_PAGES) {
                console.warn(`Limite máximo de ${MAX_PAGES} páginas atingido. Interrompendo para evitar possível loop.`);
                document.dispatchEvent(new CustomEvent('limitePaginasAtingido', { 
                    detail: { message: `Limite de ${MAX_PAGES} páginas atingido. Alguns vídeos podem não ter sido carregados.` } 
                }));
                break;
            }
            
            pageCount++;
            // Verificação de segurança para evitar loops infinitos
            if (nextPageToken === lastUsedToken && nextPageToken !== '') {
                console.warn('Possível loop infinito detectado! Mesmo pageToken recebido duas vezes consecutivas.');
                clearStoredToken();
                break;
            }
            
            lastUsedToken = nextPageToken;
            const apiUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=500&playlistId=${PLAYLIST_ID}&key=${API_KEY}&pageToken=${nextPageToken}`;
            
            // Tenta primeiro sem proxy
            let response;
            let success = false;
            let lastError;
            
            try {
                response = await fetch(apiUrl);
                if (response.ok) {
                    success = true;
                }
            } catch (error) {
                console.log('Erro na requisição direta:', error);
                lastError = error;
            }
            
            // Se a requisição direta falhar, tenta com os proxies
            if (!success) {
                console.log('Tentando com proxies CORS...');
                // Dispara evento para notificar a UI que estamos usando proxy
                document.dispatchEvent(proxyEvent);
                
                for (const proxyFn of CORS_PROXIES) {
                    try {
                        const proxiedUrl = proxyFn(apiUrl);
                        console.log(`Tentando proxy: ${proxiedUrl}`);
                        response = await fetch(proxiedUrl);
                        
                        if (response.ok) {
                            success = true;
                            console.log('Proxy funcionou com sucesso!');
                            // Dispara evento para notificar a UI que o proxy funcionou
                            document.dispatchEvent(proxySuccessEvent);
                            break;
                        }
                    } catch (error) {
                        console.log('Erro com proxy:', error);
                        lastError = error;
                    }
                }
            }
            
            if (!success) {
                throw lastError || new Error('Todos os métodos de acesso à API falharam');
            }
            
            if (!response.ok) {
                if (response.status === 403) {
                    console.error('Erro 403: Acesso negado à API do YouTube');
                    lastError = new Error('Acesso negado à API do YouTube (erro 403)');
                    document.dispatchEvent(new CustomEvent('erroAPI', { 
                        detail: { 
                            message: 'Acesso negado à API do YouTube. Verifique sua chave de API.', 
                            code: 403,
                            tipo: 'acesso_negado'
                        } 
                    }));
                } else if (response.status === 404) {
                    console.error('Erro 404: Playlist não encontrada');
                    lastError = new Error('Playlist não encontrada (erro 404)');
                    document.dispatchEvent(new CustomEvent('erroAPI', { 
                        detail: { 
                            message: 'Playlist não encontrada. Verifique o ID da playlist.', 
                            code: 404,
                            tipo: 'nao_encontrado'
                        } 
                    }));
                } else if (response.status === 429) {
                    console.error('Erro 429: Limite de requisições excedido');
                    lastError = new Error('Limite de requisições excedido (erro 429)');
                    document.dispatchEvent(new CustomEvent('erroAPI', { 
                        detail: { 
                            message: 'Limite de requisições à API excedido. Tente novamente mais tarde.', 
                            code: 429,
                            tipo: 'limite_excedido'
                        } 
                    }));
                } else {
                    console.error(`Erro na API do YouTube: ${response.status}`);
                    lastError = new Error(`Erro na API do YouTube: ${response.status}`);
                    document.dispatchEvent(new CustomEvent('erroAPI', { 
                        detail: { 
                            message: `Erro ${response.status} ao acessar a API do YouTube.`, 
                            code: response.status,
                            tipo: 'erro_generico'
                        } 
                    }));
                }
                throw lastError;
            }

            const data = await response.json();
            
            // Verificar se a resposta contém um erro
            if (data.error) {
                throw new Error(`Erro da API: ${data.error.message || 'Erro desconhecido'}`);
            }
            
            // Verificar se items existe e é um array
            if (!data.items || !Array.isArray(data.items)) {
                console.error('Resposta da API sem items válidos:', data);
                // Se não houver items, tratamos como uma lista vazia
                data.items = [];
            }
            
            // Conta os novos vídeos carregados nesta página
            if (isUsingStoredToken || newVideosCount > 0) {
                newVideosCount += data.items.length;
            }
            
            console.log(`Página ${pageCount}/${MAX_PAGES} carregada: ${data.items.length} vídeos (total: ${allVideos.length + data.items.length})`);            
            
            // Notificar progresso a cada 5 páginas ou quando for a primeira página
            if (pageCount === 1 || pageCount % 5 === 0) {
                document.dispatchEvent(new CustomEvent('progressoCarregamento', { 
                    detail: { 
                        message: `Carregando vídeos: ${allVideos.length + data.items.length} vídeos até agora (página ${pageCount})`, 
                        count: allVideos.length + data.items.length,
                        page: pageCount
                    } 
                }));
            }
            
            allVideos = [...allVideos, ...data.items];
            // Armazena o próximo pageToken para uso futuro
            if (data.nextPageToken) {
                console.log(`Novo pageToken recebido: ${data.nextPageToken}`);
                nextPageToken = data.nextPageToken;
                saveLastPageToken(nextPageToken);
            } else {
                // Se não há mais páginas, limpa o token armazenado e encerra o loop
                console.log('Fim da playlist alcançado. Limpando token e encerrando loop.');
                clearStoredToken();
                nextPageToken = ''; // Importante: zera o token para sair do loop
            }
        } while (nextPageToken);

        const videos = allVideos
            .filter(item => {
                // Filtra vídeos excluídos ou privados
                return item.snippet && 
                       item.snippet.thumbnails && 
                       item.snippet.thumbnails.medium;
            })
            .map(item => ({
                id: item.snippet.resourceId.videoId,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails.medium.url,
                publishedAt: new Date(item.snippet.publishedAt),
            }))
            .sort((a, b) => a.publishedAt - b.publishedAt);
            
        // Se estiver usando token armazenado e houver novos vídeos, notifica o usuário
        if (isUsingStoredToken && newVideosCount > 0) {
            document.dispatchEvent(new CustomEvent('novosVideosCarregados', { 
                detail: { 
                    message: `${newVideosCount} novos vídeos foram adicionados à playlist`, 
                    count: newVideosCount 
                } 
            }));
        }
        
        // Salva os vídeos no cache local
        await saveVideosToCache(videos);
        
        return { videos, newVideosCount };
    } catch (error) {
        console.error(`Erro na API do YouTube: ${error.message}`);
        document.dispatchEvent(new CustomEvent('erroAPI', { 
            detail: { message: 'Erro ao carregar vídeos da API do YouTube: ' + error.message } 
        }));
        return { videos: [], newVideosCount: 0 };
    }
}