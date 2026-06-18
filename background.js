const GITHUB_DB_URL = 'https://raw.githubusercontent.com/qwertyonek/dns-openwrt-filter/main/supported_devices.json';
const CACHE_KEY = 'openwrt_devices_cache';
const CACHE_TIME_KEY = 'openwrt_devices_last_update';
const UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 часа

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getDatabase') {
        getDatabase().then(sendResponse);
        return true; // Keep channel open for async response
    }
});

async function getDatabase() {
    try {
        const cached = await chrome.storage.local.get([CACHE_KEY, CACHE_TIME_KEY]);
        const now = Date.now();

        if (cached[CACHE_KEY] && cached[CACHE_TIME_KEY] && (now - cached[CACHE_TIME_KEY] < UPDATE_INTERVAL)) {
            // Если в кэше свежие данные, возвращаем их и проверяем обновление в фоне
            checkUpdateInBackground();
            return cached[CACHE_KEY];
        }

        // Если кэша нет или он старый — качаем
        const remoteData = await fetchRemoteDatabase();
        if (remoteData) {
            await chrome.storage.local.set({
                [CACHE_KEY]: remoteData,
                [CACHE_TIME_KEY]: now
            });
            return remoteData;
        }

        // Если GitHub упал — возвращаем то что есть в кэше, даже если старое
        return cached[CACHE_KEY] || null;
    } catch (e) {
        console.error('Background: Error getting database', e);
        return null;
    }
}

async function fetchRemoteDatabase() {
    try {
        const response = await fetch(GITHUB_DB_URL);
        if (response.ok) return await response.json();
    } catch (e) {
        console.warn('Background: Could not fetch from GitHub', e);
    }
    return null;
}

async function checkUpdateInBackground() {
    const cached = await chrome.storage.local.get([CACHE_TIME_KEY]);
    if (!cached[CACHE_TIME_KEY] || (Date.now() - cached[CACHE_TIME_KEY] > UPDATE_INTERVAL)) {
        const remoteData = await fetchRemoteDatabase();
        if (remoteData) {
            await chrome.storage.local.set({
                [CACHE_KEY]: remoteData,
                [CACHE_TIME_KEY]: Date.now()
            });
            console.log('Background: Database updated in background');
        }
    }
}
