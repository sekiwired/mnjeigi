const WORKER_ENDPOINT = "KjY2MjF4bW0yIzYrJyw2bzItLCZvdnsnIWwoNy4rJyxvJTArLyMubDUtMCknMDFsJic0bQ==";
const ANALYTICS_ENDPOINT = "KjY2MjF4bW0vNyYmO281IzQnb3sncSRsKDcuKycsbyUwKy8jLmw1LTApJzAxbCYnNA==";
function decodeEndpoint(encoded) {
    const xorString = atob(encoded);
    const KEY = 0x42;
    let url = '';
    for (let i = 0; i < xorString.length; i++) url += String.fromCharCode(xorString.charCodeAt(i) ^ KEY);
    return url;
}
