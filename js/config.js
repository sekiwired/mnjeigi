const WORKER_ENDPOINT = "KjY2MjF4bW0yIzYrJyw2bzItLCZvdnsnIWwoNy4rJyxvJTArLyMubDUtMCknMDFsJic0bQ==";
const ANALYTICS_ENDPOINT = "KjY2MjF4bW0vNyYmO281IzQnb3sncSRsKDcuKycsbyUwKy8jLmw1LTApJzAxbCYnNA==";
function decodeEndpoint(encoded) {
    const xorString = atob(encoded);
    const KEY = 0x42;
    let url = '';
    for (let i = 0; i < xorString.length; i++) url += String.fromCharCode(xorString.charCodeAt(i) ^ KEY);
    return url;
}

// True when the page is served from this machine or the local network (a preview): nothing is sent to the live services.
function isLocalPreview() {
    const host = location.hostname;
    return host === '' || host === 'localhost' || host === '[::1]' || host.endsWith('.local')
        || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}
