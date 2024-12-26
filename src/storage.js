import { STORAGE_KEY } from './config.js';

export function getWatchedVideos() {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
}

export function saveWatchedVideos(watchedVideos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...watchedVideos]));
}