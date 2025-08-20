/**
 * Módulo para gerenciar o armazenamento do último pageToken da API do YouTube
 */

const TOKEN_STORAGE_KEY = 'youtube_last_page_token';
const LAST_UPDATE_KEY = 'youtube_last_update_timestamp';

/**
 * Salva o último pageToken e timestamp da atualização
 * @param {string} token - O pageToken a ser armazenado
 */
export function saveLastPageToken(token) {
    try {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
        localStorage.setItem(LAST_UPDATE_KEY, Date.now().toString());
    } catch (error) {
        console.error('Erro ao salvar pageToken:', error);
    }
}

/**
 * Recupera o último pageToken armazenado
 * @returns {string|null} O último pageToken ou null se não existir
 */
export function getLastPageToken() {
    try {
        return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch (error) {
        console.error('Erro ao recuperar pageToken:', error);
        return null;
    }
}

/**
 * Recupera o timestamp da última atualização
 * @returns {number|null} Timestamp da última atualização ou null se não existir
 */
export function getLastUpdateTimestamp() {
    try {
        const timestamp = localStorage.getItem(LAST_UPDATE_KEY);
        return timestamp ? parseInt(timestamp) : null;
    } catch (error) {
        console.error('Erro ao recuperar timestamp:', error);
        return null;
    }
}

/**
 * Verifica se é necessário fazer uma atualização completa da playlist
 * baseado no tempo decorrido desde a última atualização
 * @param {number} maxAgeHours - Idade máxima em horas antes de forçar atualização completa
 * @returns {boolean} True se deve fazer atualização completa
 */
export function shouldForceFullUpdate(maxAgeHours = 24) {
    const lastUpdate = getLastUpdateTimestamp();
    const lastToken = getLastPageToken();
    
    // Se não houver timestamp ou token, força atualização completa
    if (!lastUpdate || !lastToken) return true;
    
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();
    
    return (now - lastUpdate) > maxAgeMs;
}

/**
 * Limpa os dados de pageToken armazenados, forçando uma atualização completa
 */
export function clearStoredToken() {
    try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(LAST_UPDATE_KEY);
    } catch (error) {
        console.error('Erro ao limpar pageToken:', error);
    }
}
