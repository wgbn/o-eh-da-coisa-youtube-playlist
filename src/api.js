import { PLAYLIST_ID, API_KEY } from './config.js';

export async function fetchPlaylistVideos() {
    if (!API_KEY || API_KEY === 'SUA_CHAVE_API_AQUI') {
        throw new Error('Por favor, configure sua chave de API do YouTube no arquivo config.js');
    }

    try {
        let allVideos = [];
        let nextPageToken = '';
        
        do {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=500&playlistId=${PLAYLIST_ID}&key=${API_KEY}&pageToken=${nextPageToken}`
            );
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error.message || 'Erro ao acessar a API do YouTube');
            }

            const data = await response.json();
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
        throw new Error(`Erro na API do YouTube: ${error.message}`);
    }
}