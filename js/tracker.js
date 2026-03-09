(function() {
    var sid = sessionStorage.getItem('_asid');
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('_asid', sid); }

    function endpoint() {
        if (!ANALYTICS_ENDPOINT || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return null;
        return decodeEndpoint(ANALYTICS_ENDPOINT);
    }

    window._trackPage = function(page, lang) {
        var ep = endpoint();
        if (!ep) return;
        try {
            navigator.sendBeacon(ep + '/track', JSON.stringify({
                sid: sid, page: String(page), ts: Date.now(),
                lang: lang || null, ref: document.referrer
            }));
        } catch(e) {}
    };

    window._trackCard = function(topic, eventType, durationMs) {
        var ep = endpoint();
        if (!ep) return;
        try {
            navigator.sendBeacon(ep + '/card', JSON.stringify({
                sid: sid, topic: topic, event_type: eventType,
                duration_ms: durationMs || null, ts: Date.now(),
                lang: typeof lang !== 'undefined' ? lang : null
            }));
        } catch(e) {}
    };

    // Offer card hover tracking (delegated, since cards are loaded dynamically)
    var hoverStart = {};
    document.addEventListener('mouseenter', function(e) {
        var card = e.target.closest && e.target.closest('.offer-card[data-topic]');
        if (card) hoverStart[card.dataset.topic] = Date.now();
    }, true);
    document.addEventListener('mouseleave', function(e) {
        var card = e.target.closest && e.target.closest('.offer-card[data-topic]');
        if (card && hoverStart[card.dataset.topic]) {
            var dur = Date.now() - hoverStart[card.dataset.topic];
            if (dur > 500) _trackCard(card.dataset.topic, 'hover', dur);
            delete hoverStart[card.dataset.topic];
        }
    }, true);

    // Offer card click tracking (delegated)
    document.addEventListener('click', function(e) {
        var card = e.target.closest && e.target.closest('.offer-card[data-topic]');
        if (card) _trackCard(card.dataset.topic, 'click', null);
    }, true);
})();
