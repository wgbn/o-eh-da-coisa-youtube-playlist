let player = null;

export function initializeYouTubePlayer() {
    try {
        player = new YT.Player('player', {
            height: '360',
            width: '640',
            playerVars: {
                'playsinline': 1,
                'autoplay': 1,
                'enablejsapi': 1
            },
            events: {
                'onStateChange': onPlayerStateChange
            }
        });
    } catch(e) {
        console.log("# ERR Player", e.message)
    }
}

export function playVideo(videoId) {
    const playerContainer = document.getElementById('playerContainer');
    playerContainer.classList.remove('hidden');
    console.log("# player", player)
    
    if (player && player.loadVideoById) {
        player.loadVideoById(videoId);
    } else {
        // If player isn't ready yet, retry in 1 second
        // initializeYouTubePlayer()
        setTimeout(() => playVideo(videoId), 1000);
    }
}

function onPlayerStateChange(event) {
    // When video ends (state 0), mark as watched and play next
    if (event.data === 0) {
        const videoId = player.getVideoData().video_id;
        const checkbox = document.querySelector(`[data-video-id="${videoId}"]`);
        if (checkbox && !checkbox.checked) {
            checkbox.click();
        }
        playNextUnwatched(videoId);
    }
}

function playNextUnwatched(currentVideoId) {
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