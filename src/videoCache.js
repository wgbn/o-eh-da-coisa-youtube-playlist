/**
 * Módulo para gerenciar o cache local dos vídeos da playlist usando IndexedDB
 */

// Configurações do banco de dados
const DB_NAME = 'youtubePlaylistDB';
const DB_VERSION = 2; // Incrementado para criar nova estrutura
const VIDEO_CACHE_STORE = 'videoCache';
const CACHE_TIMESTAMP_KEY = 'youtube_videos_cache_timestamp';
const MAX_CACHE_AGE_HOURS = 24; // Tempo máximo de validade do cache em horas

// Chaves de fallback para localStorage (caso o IndexedDB falhe)
const VIDEOS_CACHE_KEY = 'youtube_videos_cache';

/**
 * Verifica se o banco de dados precisa ser deletado e recriado
 * @returns {Promise<boolean>} True se o banco foi deletado
 */
async function checkAndDeleteDatabase() {
    return new Promise((resolve) => {
        // Primeiro, tenta abrir o banco com a versão atual para verificar a estrutura
        const checkRequest = indexedDB.open(DB_NAME);
        
        checkRequest.onsuccess = (event) => {
            const db = event.target.result;
            const currentVersion = db.version;
            db.close();
            
            // Se a versão atual for menor que a versão necessária, deleta o banco
            if (currentVersion < DB_VERSION) {
                console.log(`Versão do banco (${currentVersion}) é menor que a necessária (${DB_VERSION}). Deletando banco...`);
                const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
                
                deleteRequest.onsuccess = () => {
                    console.log('Banco de dados deletado com sucesso para atualização');
                    resolve(true);
                };
                
                deleteRequest.onerror = (event) => {
                    console.error('Erro ao deletar banco de dados:', event.target.error);
                    resolve(false);
                };
            } else {
                console.log(`Versão do banco (${currentVersion}) é compatível com a necessária (${DB_VERSION})`);
                resolve(false);
            }
        };
        
        checkRequest.onerror = () => {
            console.log('Erro ao verificar banco de dados, provavelmente não existe');
            resolve(false);
        };
    });
}

/**
 * Inicializa o banco de dados para o cache de vídeos
 * @returns {Promise<IDBDatabase>} Instância do banco de dados
 */
async function initVideoCacheDB() {
    try {
        // Verifica se o banco precisa ser deletado e recriado
        await checkAndDeleteDatabase();
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Cria object store para vídeos se não existir
                if (!db.objectStoreNames.contains(VIDEO_CACHE_STORE)) {
                    db.createObjectStore(VIDEO_CACHE_STORE, { keyPath: 'id' });
                    console.log('Object store para cache de vídeos criado');
                }
                
                // Cria object store para vídeos assistidos se não existir
                if (!db.objectStoreNames.contains('watchedVideos')) {
                    db.createObjectStore('watchedVideos', { keyPath: 'id' });
                    console.log('Object store para vídeos assistidos criado');
                }
            };
            
            request.onsuccess = (event) => {
                console.log('Banco de dados IndexedDB aberto com sucesso');
                resolve(event.target.result);
            };
            
            request.onerror = (event) => {
                console.error('Erro ao abrir banco de dados IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error('Erro ao inicializar banco de dados:', error);
        throw error;
    }
}

/**
 * Salva os vídeos no IndexedDB
 * @param {Array} videos - Lista de vídeos para armazenar em cache
 * @returns {Promise<void>}
 */
export async function saveVideosToCache(videos) {
    try {
        const db = await initVideoCacheDB();
        const transaction = db.transaction([VIDEO_CACHE_STORE], 'readwrite');
        const store = transaction.objectStore(VIDEO_CACHE_STORE);
        
        // Limpa o store antes de adicionar novos vídeos
        store.clear();
        
        // Adiciona ou atualiza cada vídeo individualmente
        videos.forEach(video => {
            store.put(video); // Usa put em vez de add para evitar erro de chave duplicada
        });
        
        // Armazena o timestamp
        localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        
        console.log(`${videos.length} vídeos salvos no cache IndexedDB`);
        
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => {
                console.error('Erro na transação IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error('Erro ao salvar vídeos no cache IndexedDB:', error);
        
        // Fallback para localStorage em caso de erro
        try {
            localStorage.setItem(VIDEOS_CACHE_KEY, JSON.stringify(videos));
            localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
            console.log(`Fallback: ${videos.length} vídeos salvos no localStorage`);
        } catch (localStorageError) {
            console.error('Erro no fallback para localStorage:', localStorageError);
        }
    }
}

/**
 * Recupera os vídeos do cache IndexedDB
 * @returns {Promise<Array|null>} Lista de vídeos ou null se o cache estiver vazio ou expirado
 */
export async function getVideosFromCache() {
    try {
        // Verifica se o cache está expirado
        const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
        if (!timestamp) {
            console.log('Nenhum timestamp de cache encontrado');
            return null;
        }
        
        const cacheAge = Date.now() - parseInt(timestamp);
        const maxCacheAgeMs = MAX_CACHE_AGE_HOURS * 60 * 60 * 1000;
        
        if (cacheAge > maxCacheAgeMs) {
            console.log('Cache de vídeos expirado');
            return null;
        }
        
        const db = await initVideoCacheDB();
        const transaction = db.transaction([VIDEO_CACHE_STORE], 'readonly');
        const store = transaction.objectStore(VIDEO_CACHE_STORE);
        const request = store.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const videos = event.target.result;
                
                if (!videos || videos.length === 0) {
                    console.log('Nenhum vídeo encontrado no cache IndexedDB');
                    resolve(null);
                    return;
                }
                
                // Converte as strings de data de volta para objetos Date
                const videosComDatasCorrigidas = videos.map(video => {
                    try {
                        return {
                            ...video,
                            publishedAt: new Date(video.publishedAt)
                        };
                    } catch (error) {
                        console.warn(`Erro ao converter data para o vídeo ${video.id}: ${error.message}`);
                        return {
                            ...video,
                            publishedAt: new Date()
                        };
                    }
                });
                
                console.log(`${videos.length} vídeos recuperados do cache IndexedDB (idade: ${getCacheAge() || 0} horas)`);
                resolve(videosComDatasCorrigidas);
            };
            
            request.onerror = (event) => {
                console.error('Erro ao recuperar vídeos do cache IndexedDB:', event.target.error);
                
                // Tenta fallback para localStorage
                try {
                    const cachedVideos = localStorage.getItem(VIDEOS_CACHE_KEY);
                    if (!cachedVideos) {
                        console.log('Nenhum vídeo encontrado no fallback localStorage');
                        resolve(null);
                        return;
                    }
                    
                    const videos = JSON.parse(cachedVideos);
                    const videosComDatasCorrigidas = videos.map(video => ({
                        ...video,
                        publishedAt: new Date(video.publishedAt)
                    }));
                    
                    console.log(`Fallback: ${videos.length} vídeos recuperados do localStorage`);
                    resolve(videosComDatasCorrigidas);
                } catch (localStorageError) {
                    console.error('Erro no fallback para localStorage:', localStorageError);
                    resolve(null);
                }
            };
        });
    } catch (error) {
        console.error('Erro ao recuperar vídeos do cache:', error);
        return null;
    }
}

/**
 * Limpa o cache de vídeos
 * @returns {Promise<void>}
 */
export async function clearVideosCache() {
    try {
        const db = await initVideoCacheDB();
        const transaction = db.transaction([VIDEO_CACHE_STORE], 'readwrite');
        const store = transaction.objectStore(VIDEO_CACHE_STORE);
        
        store.clear();
        localStorage.removeItem(CACHE_TIMESTAMP_KEY);
        localStorage.removeItem(VIDEOS_CACHE_KEY); // Remove também do localStorage
        
        console.log('Cache de vídeos limpo');
        
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        });
    } catch (error) {
        console.error('Erro ao limpar cache de vídeos:', error);
        
        // Tenta limpar o localStorage como fallback
        try {
            localStorage.removeItem(VIDEOS_CACHE_KEY);
            localStorage.removeItem(CACHE_TIMESTAMP_KEY);
        } catch (localStorageError) {
            console.error('Erro ao limpar cache do localStorage:', localStorageError);
        }
    }
}

/**
 * Verifica se o cache está disponível e válido
 * @returns {Promise<boolean>} True se o cache estiver disponível e válido
 */
export async function isCacheValid() {
    try {
        const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
        if (!timestamp) return false;
        
        const cacheAge = Date.now() - parseInt(timestamp);
        const maxCacheAgeMs = MAX_CACHE_AGE_HOURS * 60 * 60 * 1000;
        
        if (cacheAge > maxCacheAgeMs) return false;
        
        // Verifica se há vídeos no IndexedDB
        const db = await initVideoCacheDB();
        const transaction = db.transaction([VIDEO_CACHE_STORE], 'readonly');
        const store = transaction.objectStore(VIDEO_CACHE_STORE);
        const countRequest = store.count();
        
        return new Promise((resolve) => {
            countRequest.onsuccess = () => {
                const count = countRequest.result;
                resolve(count > 0);
            };
            
            countRequest.onerror = () => {
                // Verifica o fallback no localStorage
                try {
                    const cachedVideos = localStorage.getItem(VIDEOS_CACHE_KEY);
                    resolve(!!cachedVideos);
                } catch (error) {
                    resolve(false);
                }
            };
        });
    } catch (error) {
        console.error('Erro ao verificar validade do cache:', error);
        return false;
    }
}

/**
 * Retorna a idade do cache em horas
 * @returns {number|null} Idade do cache em horas ou null se não houver cache
 */
export function getCacheAge() {
    try {
        const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
        if (!timestamp) return null;
        
        const cacheAgeMs = Date.now() - parseInt(timestamp);
        return Math.round(cacheAgeMs / (60 * 60 * 1000) * 10) / 10; // Arredonda para 1 casa decimal
    } catch (error) {
        console.error('Erro ao calcular idade do cache:', error);
        return null;
    }
}
