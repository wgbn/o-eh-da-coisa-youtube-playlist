import { PLAYLIST_ID, API_KEY } from './config.js';
import { mockVideos } from './mockData.js';

// Eventos personalizados para comunicação com a UI
const proxyEvent = new CustomEvent('proxyUsed', { detail: { message: 'Usando proxy para acessar a API do YouTube' } });
const proxySuccessEvent = new CustomEvent('proxySuccess', { detail: { message: 'Conexão estabelecida com sucesso via proxy' } });

// Lista de proxies CORS alternativos
const CORS_PROXIES = [
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

export async function fetchPlaylistVideos() {
    if (!API_KEY || API_KEY === 'SUA_CHAVE_API_AQUI') {
        throw new Error('Por favor, configure sua chave de API do YouTube no arquivo config.js');
    }

    try {
        let allVideos = [];
        let nextPageToken = '';
        
        do {
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
                // Tratamento especial para erro 403 (Forbidden)
                if (response.status === 403) {
                    console.error('Erro 403: Acesso negado à API do YouTube');
                    throw new Error('A chave de API do YouTube foi rejeitada. Verifique se a chave é válida e tem as permissões corretas.');
                }
                
                try {
                    const error = await response.json();
                    throw new Error(error.error?.message || `Erro ${response.status} ao acessar a API do YouTube`);
                } catch (jsonError) {
                    // Se não conseguir ler o JSON da resposta de erro
                    throw new Error(`Erro ${response.status} ao acessar a API do YouTube: ${response.statusText}`);
                }
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
            
            allVideos = [...allVideos, ...data.items];
            nextPageToken = data.nextPageToken;
        } while (nextPageToken);

        return allVideos
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
    } catch (error) {
        console.error(`Erro na API do YouTube: ${error.message}`);
        console.log('Usando dados de demonstração devido ao erro na API');
        document.dispatchEvent(new CustomEvent('usandoDadosDemonstracao', { 
            detail: { message: 'Usando dados de demonstração devido a um erro na API do YouTube' } 
        }));
        return mockVideos;
    }
}