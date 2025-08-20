import { STORAGE_KEY } from './config.js';

const DB_NAME = 'youtubePlaylistDB';
const STORE_NAME = 'watchedVideos';

/**
 * Limpa dados antigos do IndexedDB com base em um limite de idade
 * @param {number} maxAgeDays - Idade máxima em dias para manter os dados
 * @returns {Promise<number>} - Número de registros removidos
 */
export async function limparDadosAntigos(maxAgeDays = 365) {
    return new Promise((resolve, reject) => {
        console.log(`Iniciando limpeza de dados com mais de ${maxAgeDays} dias...`);
        
        const request = indexedDB.open(DB_NAME);
        
        request.onerror = (event) => {
            console.error('Erro ao abrir o banco de dados para limpeza:', event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            
            // Verificar se temos metadados com timestamps
            if (!db.objectStoreNames.contains('metadados')) {
                console.log('Não há metadados com timestamps para limpar dados antigos');
                resolve(0);
                return;
            }
            
            const transaction = db.transaction(['metadados', STORE_NAME], 'readwrite');
            const metadataStore = transaction.objectStore('metadados');
            const videosStore = transaction.objectStore(STORE_NAME);
            
            const dataLimite = new Date();
            dataLimite.setDate(dataLimite.getDate() - maxAgeDays);
            
            const request = metadataStore.index('timestamp').openCursor(IDBKeyRange.upperBound(dataLimite));
            let contadorRemovidos = 0;
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    // Remover o vídeo do store principal
                    videosStore.delete(cursor.value.videoId);
                    
                    // Remover o metadado
                    metadataStore.delete(cursor.value.id);
                    
                    contadorRemovidos++;
                    cursor.continue();
                }
            };
            
            transaction.oncomplete = () => {
                console.log(`Limpeza concluída: ${contadorRemovidos} registros antigos removidos`);
                resolve(contadorRemovidos);
            };
            
            transaction.onerror = (event) => {
                console.error('Erro durante a limpeza de dados:', event.target.error);
                reject(event.target.error);
            };
        };
    });
}

/**
 * Exporta todos os dados do IndexedDB para um arquivo JSON
 * @returns {Promise<Object>} - Objeto com os dados exportados
 */
export async function exportarDados() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME);
        
        request.onerror = (event) => {
            console.error('Erro ao abrir o banco de dados para exportação:', event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const dados = {
                    videos: request.result,
                    dataExportacao: new Date().toISOString(),
                    versao: '1.0'
                };
                
                const dadosJSON = JSON.stringify(dados);
                const blob = new Blob([dadosJSON], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                // Criar link para download
                const a = document.createElement('a');
                a.href = url;
                a.download = `youtube-playlist-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                
                // Limpar
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
                
                resolve(dados);
            };
            
            request.onerror = (event) => {
                console.error('Erro ao exportar dados:', event.target.error);
                reject(event.target.error);
            };
        };
    });
}

/**
 * Importa dados de um arquivo JSON para o IndexedDB
 * @param {File} arquivo - Arquivo JSON com os dados a serem importados
 * @returns {Promise<number>} - Número de registros importados
 */
export async function importarDados(arquivo) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        
        leitor.onload = async (evento) => {
            try {
                const dados = JSON.parse(evento.target.result);
                
                if (!dados.videos || !Array.isArray(dados.videos)) {
                    reject(new Error('Formato de arquivo inválido'));
                    return;
                }
                
                const request = indexedDB.open(DB_NAME);
                
                request.onerror = (event) => {
                    console.error('Erro ao abrir o banco de dados para importação:', event.target.error);
                    reject(event.target.error);
                };
                
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    const transaction = db.transaction(STORE_NAME, 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);
                    
                    let contadorImportados = 0;
                    
                    dados.videos.forEach(video => {
                        const request = store.put(video);
                        request.onsuccess = () => {
                            contadorImportados++;
                        };
                    });
                    
                    transaction.oncomplete = () => {
                        console.log(`Importação concluída: ${contadorImportados} registros importados`);
                        resolve(contadorImportados);
                    };
                    
                    transaction.onerror = (event) => {
                        console.error('Erro durante a importação de dados:', event.target.error);
                        reject(event.target.error);
                    };
                };
            } catch (erro) {
                console.error('Erro ao processar o arquivo:', erro);
                reject(erro);
            }
        };
        
        leitor.onerror = (erro) => {
            console.error('Erro ao ler o arquivo:', erro);
            reject(erro);
        };
        
        leitor.readAsText(arquivo);
    });
}
