import { STORAGE_KEY } from './config.js';

const DB_NAME = 'youtubePlaylistDB';
const DB_VERSION = 2; // Atualizado para corresponder à versão no videoCache.js
const STORE_NAME = 'watchedVideos';

// Inicializa o banco de dados IndexedDB
async function initDB() {
    return new Promise((resolve, reject) => {
        console.log('Inicializando IndexedDB...');
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
            console.error('Erro ao abrir o banco de dados:', event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            console.log('IndexedDB inicializado com sucesso');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            console.log('Atualizando estrutura do IndexedDB...');
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                console.log(`Criando object store '${STORE_NAME}'`);
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
            // Migrar dados do localStorage se existirem
            migrateFromLocalStorage(db);
        };
        
        request.onblocked = (event) => {
            console.warn('Conexão com IndexedDB bloqueada. Feche outras abas com esta aplicação.');
        };
    });
}

// Migra dados do localStorage para o IndexedDB
function migrateFromLocalStorage(db) {
    console.log('Verificando dados no localStorage para migração...');
    const localData = localStorage.getItem(STORAGE_KEY);
    
    if (localData) {
        try {
            const videoIds = JSON.parse(localData);
            console.log(`Encontrados ${videoIds.length} vídeos assistidos no localStorage para migração`);
            
            if (videoIds.length > 0) {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                let countAdded = 0;
                videoIds.forEach(id => {
                    const request = store.put({ id });
                    request.onsuccess = () => {
                        countAdded++;
                    };
                });
                
                transaction.oncomplete = () => {
                    console.log(`Migração concluída: ${countAdded} de ${videoIds.length} IDs migrados para IndexedDB`);
                    // Criar backup antes de remover
                    localStorage.setItem(`${STORAGE_KEY}_backup`, localData);
                    // Remover dados do localStorage após migração bem-sucedida
                    localStorage.removeItem(STORAGE_KEY);
                    console.log('Dados removidos do localStorage após migração bem-sucedida');
                };
                
                transaction.onerror = (event) => {
                    console.error('Erro durante a transação de migração:', event.target.error);
                };
            }
        } catch (error) {
            console.error('Erro na migração de dados:', error);
        }
    } else {
        console.log('Nenhum dado encontrado no localStorage para migração');
    }
}

// Obtém todos os vídeos assistidos do IndexedDB
export async function getWatchedVideos() {
    try {
        console.log('Obtendo vídeos assistidos do IndexedDB...');
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const videoObjects = request.result;
                const watchedVideos = new Set(videoObjects.map(video => video.id));
                console.log(`Recuperados ${watchedVideos.size} vídeos assistidos do IndexedDB`);
                resolve(watchedVideos);
            };
            
            request.onerror = (event) => {
                console.error('Erro ao obter vídeos assistidos do IndexedDB:', event.target.error);
                // Verificar backup primeiro
                const backupData = localStorage.getItem(`${STORAGE_KEY}_backup`);
                if (backupData) {
                    console.log('Usando dados de backup do localStorage');
                    const fallbackData = new Set(JSON.parse(backupData));
                    resolve(fallbackData);
                    return;
                }
                // Fallback para localStorage em caso de erro
                const localData = localStorage.getItem(STORAGE_KEY);
                if (localData) {
                    console.log('Usando dados do localStorage como fallback');
                    const fallbackData = new Set(JSON.parse(localData));
                    resolve(fallbackData);
                } else {
                    console.log('Nenhum dado encontrado no localStorage, retornando conjunto vazio');
                    resolve(new Set());
                }
            };
        });
    } catch (error) {
        console.error('Erro ao acessar o banco de dados:', error);
        // Verificar backup primeiro
        const backupData = localStorage.getItem(`${STORAGE_KEY}_backup`);
        if (backupData) {
            console.log('Usando dados de backup do localStorage devido a erro');
            return new Set(JSON.parse(backupData));
        }
        // Fallback para localStorage em caso de erro
        const localData = localStorage.getItem(STORAGE_KEY);
        if (localData) {
            console.log('Usando dados do localStorage como fallback devido a erro');
            return new Set(JSON.parse(localData));
        }
        console.log('Nenhum dado encontrado para fallback, retornando conjunto vazio');
        return new Set();
    }
}

// Salva um conjunto de vídeos assistidos no IndexedDB
export async function saveWatchedVideos(watchedVideos) {
    try {
        console.log(`Salvando ${watchedVideos.size} vídeos assistidos no IndexedDB...`);
        const db = await initDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Limpa o armazenamento atual
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {
            console.log('Object store limpo com sucesso, adicionando novos IDs...');
            // Adiciona os novos IDs
            const videoIds = [...watchedVideos];
            let countAdded = 0;
            
            videoIds.forEach(id => {
                const request = store.put({ id });
                request.onsuccess = () => {
                    countAdded++;
                };
            });
        };
        
        transaction.oncomplete = () => {
            console.log(`Vídeos assistidos salvos com sucesso no IndexedDB (${watchedVideos.size} IDs)`);
            // Criar backup no localStorage também
            localStorage.setItem(`${STORAGE_KEY}_backup`, JSON.stringify([...watchedVideos]));
        };
        
        transaction.onerror = (event) => {
            console.error('Erro ao salvar vídeos assistidos no IndexedDB:', event.target.error);
            // Fallback para localStorage em caso de erro
            console.log('Usando localStorage como fallback para salvar os dados');
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...watchedVideos]));
        };
        
        return new Promise((resolve) => {
            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = () => {
                resolve(); // Resolve mesmo com erro, já que temos fallback
            };
        });
    } catch (error) {
        console.error('Erro ao acessar o banco de dados para salvar:', error);
        // Fallback para localStorage em caso de erro
        console.log('Usando localStorage como fallback devido a erro ao acessar o banco');
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...watchedVideos]));
    }
}