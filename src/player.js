export function playVideo(videoId) {
    const playerContainer = document.getElementById('playerContainer');
    const player = document.getElementById('player');
    
    player.innerHTML = `
        <iframe 
            width="560" 
            height="315" 
            src="https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1" 
            title="YouTube video player" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            id="youtubeIframe"
            onload="window.handleIframeLoad()"
            allowfullscreen>
        </iframe>
    `;
    
    playerContainer.classList.remove('hidden');
}

export function initializeYouTubePlayer() {
    // Setup window handler for iframe load
    window.handleIframeLoad = () => {
        const iframe = document.getElementById('youtubeIframe');
        console.log("# iframe loaded")
        
        // Listen for messages from the iframe
        window.addEventListener('message', (event) => {
            if (event.source !== iframe.contentWindow) return;
            console.log("# Message", event.data)
            
            try {
                const data = JSON.parse(event.data);
                if (data.event === 'onStateChange' && data.info === 0) {
                    // Video ended (state 0)
                    handleVideoEnd();
                }
            } catch (e) {
                // Ignore parsing errors from other messages
            }
        });
    };
}

function handleVideoEnd() {
    // Mark current video as watched
    const currentIframe = document.getElementById('youtubeIframe');
    const currentVideoId = new URL(currentIframe.src).pathname.split('/').pop();
    const checkbox = document.querySelector(`[data-video-id="${currentVideoId}"]`);
    if (checkbox && !checkbox.checked) {
        checkbox.click();
    }

    // Find and play next unwatched video
    const allVideos = Array.from(document.querySelectorAll('.video-item'))
        .map(item => ({
            id: item.querySelector('.watch-checkbox').dataset.videoId,
            watched: item.querySelector('.watch-checkbox').checked
        }));

    const currentIndex = allVideos.findIndex(v => v.id === currentVideoId);
    const nextUnwatched = allVideos.slice(currentIndex + 1).find(v => !v.watched);

    if (nextUnwatched) {
        playVideo(nextUnwatched.id);
    }
}