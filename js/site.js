(function () {
    'use strict';

    var doc = document.documentElement;
    var lang = doc.lang;
    window.lang = lang; // read by tracker.js
    var isLocal = ['localhost', '127.0.0.1', '[::1]', ''].indexOf(location.hostname) !== -1;
    var reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Links from the previous four-page site
    var LEGACY_HASH = { '#what': '#services', '#why': '#track-record', '#how': '#approach' };
    if (LEGACY_HASH[location.hash]) location.replace(LEGACY_HASH[location.hash]);

    // Header: shadow once scrolled, dark over dark sections, reading progress
    var header = document.querySelector('.header');
    var burger = document.querySelector('.burger');
    var menu = document.getElementById('menu');
    var darkZones = document.querySelectorAll('[data-dark]');
    function onScroll() {
        var max = doc.scrollHeight - innerHeight;
        var line = header.offsetHeight / 2;
        var overDark = Array.prototype.some.call(darkZones, function (zone) {
            var r = zone.getBoundingClientRect();
            return r.top <= line && r.bottom > line;
        });
        header.classList.toggle('is-scrolled', scrollY > 8);
        header.classList.toggle('is-dark', overDark && menu.hidden);
        header.style.setProperty('--p', max > 0 ? Math.min(scrollY / max, 1) : 0);
    }
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    onScroll();

    // Mobile menu
    function setMenu(open) {
        menu.hidden = !open;
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? burger.dataset.close : burger.dataset.open);
        document.body.style.overflow = open ? 'hidden' : '';
        onScroll();
    }
    burger.addEventListener('click', function () { setMenu(menu.hidden); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); burger.focus(); } });
    matchMedia('(min-width: 1101px)').addEventListener('change', function () { setMenu(false); });

    // The language switch keeps the reader on the same section
    var langSwitch = document.querySelector('[data-lang-switch]');
    langSwitch.addEventListener('click', function () {
        if (location.hash) langSwitch.href = langSwitch.href.split('#')[0] + location.hash;
    });

    // Reveal on scroll
    var revealables = document.querySelectorAll('[data-reveal]');
    if ('IntersectionObserver' in window && !reducedMotion) {
        var revealer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                revealer.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
        revealables.forEach(function (el) { revealer.observe(el); });
    } else {
        revealables.forEach(function (el) { el.classList.add('is-in'); });
    }

    // Current section in the nav, and one page-view per section for the analytics funnel
    var navLinks = document.querySelectorAll('.nav a');
    var seen = {};
    if ('IntersectionObserver' in window) {
        var spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var id = entry.target.id;
                navLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + id); });
                if (!seen[id] && window._trackPage) { seen[id] = true; window._trackPage(id, lang); }
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        document.querySelectorAll('[data-track]').forEach(function (s) { spy.observe(s); });
    }
    if (window._trackPage) window._trackPage('home', lang);

    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

    // Selected missions: results fold away on phones
    if (matchMedia('(max-width: 640px)').matches) {
        document.querySelectorAll('.case__more').forEach(function (d) { d.open = false; });
    }

    // Roles: one word rolls up after another, like a reel
    var roles = document.querySelector('.roles');
    if (roles && !reducedMotion) {
        var words = JSON.parse(roles.dataset.roles);
        var slot = roles.querySelector('.roles__word');
        var reel = document.createElement('span');
        reel.className = 'roles__reel';
        words.concat(words[0]).forEach(function (w) {
            var item = document.createElement('span');
            item.textContent = w;
            reel.appendChild(item);
        });
        slot.textContent = '';
        slot.appendChild(reel);
        roles.classList.add('is-rolling');
        var at = 0, inView = true;
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; }).observe(roles);
        }
        setInterval(function () {
            if (!inView || document.hidden) return;
            at++;
            reel.style.transition = '';
            reel.style.transform = 'translateY(' + (-at * 1.4) + 'em)';
            if (at === words.length) {
                // the last item repeats the first: jump back unseen once the roll has ended
                setTimeout(function () {
                    at = 0;
                    reel.style.transition = 'none';
                    reel.style.transform = 'translateY(0)';
                }, 800);
            }
        }, 2200);
    }

    // Mesh behind the name: a sheet of linked dots receding into the distance, in perspective.
    // Every dot keeps its neighbours (it only sways around its own place), and a wave runs through the sheet.
    // Which dots are drawn is settled once from their resting place, so no link appears or vanishes while it moves.
    var net = document.querySelector('.net');
    if (net && net.getContext) {
        var ctx = net.getContext('2d');
        var BLUE = '31, 53, 255';
        var ROWS = 6, COLS = 0;    // columns follow the width: cells of the nearest row are about 46px wide
        var FAR = 0.36;            // size and height of the farthest row relative to the nearest
        var FAR_WIDE = 0.64;       // width of its cells relative to the nearest: closer to 1 = less fanning out sideways
        var FORE_Z = -0.8;         // one extra row stands this many rows in front of the sheet: bigger, lower, one dot every two columns
        var NEAREST = 1 / (1 + FORE_Z / (ROWS - 1) * (1 / FAR - 1));        // its size relative to the front row of the sheet
        var SWAY = 0.16;           // how far a dot wanders from its place, in cells
        var SPEED = 0.55;          // 1 = the wave crosses a cell in about a second
        var w = 0, h = 0, visible = false, started = performance.now();
        var mesh = [], fore = [];
        function build() {
            mesh = [];
            fore = [];
            for (var f = 0; f < COLS; f += 2) {
                fore.push({ col: f, x: f + (Math.random() - 0.5) * 0.9, z: FORE_Z + Math.random() * 0.15, hold: 0.3, phase: Math.random() * Math.PI * 2, pace: 0.5 + Math.random() * 0.7,
                    zig: fore.length % 2 ? 1 : -1 });     // every other front dot sits high, the next one low: the front line is a row of teeth
            }
            for (var r = 0; r < ROWS; r++) {
                mesh.push([]);
                for (var c = 0; c < COLS; c++) {
                    mesh[r].push({
                        x: c + (Math.random() - 0.5) * 0.62,  // home place, off the regular grid: no two cells alike
                        z: r + (Math.random() - 0.5) * 0.62,
                        hold: 1,                              // 1 = moves freely; the extra front row is held, so it stays near the bottom edge
                        phase: Math.random() * Math.PI * 2,
                        pace: 0.5 + Math.random() * 0.7
                    });
                }
            }
        }
        function size() {
            var ratio = Math.min(devicePixelRatio || 1, 2);
            w = net.clientWidth; h = net.clientHeight;
            net.width = w * ratio; net.height = h * ratio;
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            var cols = Math.max(10, Math.round(w / FAR_WIDE / 46) + 1);
            if (cols !== COLS) { COLS = cols; build(); }
            var cell = w / FAR_WIDE / (COLS - 1);             // width of a cell in the nearest row
            mesh.concat([fore]).forEach(function (row) {
                row.forEach(function (dot) {
                    var rest = place(dot, null), reach = cell * SWAY + 6;
                    dot.shown = rest[0] >= reach && rest[0] <= w - reach;
                });
            });
        }
        // sheet coordinates (x across, z away from the viewer) to a place on screen; t === null gives the resting place
        function place(dot, t) {
            var still = t === null;
            var x = dot.x + (still ? 0 : Math.cos(t * dot.pace + dot.phase) * SWAY);
            var z = dot.z + (still ? 0 : Math.sin(t * dot.pace * 0.8 + dot.phase) * SWAY * dot.hold);
            var lift = still ? 0 : dot.zig
                ? dot.zig * (0.5 + 0.5 * Math.sin(t * dot.pace * 1.3 + dot.phase))          // each tooth grows and shrinks on its own rhythm
                : (Math.sin(x * 0.75 + t * 0.9) * Math.cos(z * 0.9 - t * 0.6) + Math.sin(t * dot.pace + dot.phase) * 0.25) * dot.hold;
            var away = z / (ROWS - 1);
            var near = 1 / (1 + away * (1 / FAR - 1));                      // FAR for the farthest row, 1 for the front of the sheet, NEAREST for the extra row
            var wide = 1 / (1 + away * (1 / FAR_WIDE - 1));
            var swing = h * 0.08;                                           // how far the wave lifts a near dot, in px
            var back = 4 + swing * FAR, front = h - 10 - swing * NEAREST;       // the farthest row sits at the top of the zone, the extra front row at its bottom
            return [
                w / 2 + (x / (COLS - 1) - 0.5) * (w / FAR_WIDE) * wide,         // the farthest row spans the band; nearer rows run past its sides
                back + (front - back) * (near - FAR) / (NEAREST - FAR) + lift * swing * near,
                near,
                dot.shown
            ];
        }
        // 0 at the back of the sheet, 1 at the extra front row: the back fades out
        function depth(near) { return (near - FAR) / (NEAREST - FAR); }
        function link(a, b) {
            if (!a[3] || !b[3]) return;
            ctx.strokeStyle = 'rgba(' + BLUE + ',' + (0.03 + depth(Math.min(a[2], b[2])) * 0.34) + ')';
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
        }
        function draw(now) {
            var t = (now - started) / 1000 * SPEED;
            var at = mesh.map(function (row) { return row.map(function (dot) { return place(dot, t); }); });
            var front = fore.map(function (dot) { return place(dot, t); });
            ctx.clearRect(0, 0, w, h);
            ctx.lineWidth = 1;
            for (var r = 0; r < ROWS; r++) {
                for (var c = 0; c < COLS; c++) {
                    if (c + 1 < COLS) link(at[r][c], at[r][c + 1]);
                    if (r + 1 < ROWS) link(at[r][c], at[r + 1][c]);
                    if (c + 1 < COLS && r + 1 < ROWS) {
                        if ((c + r) % 2) link(at[r][c], at[r + 1][c + 1]); else link(at[r][c + 1], at[r + 1][c]);
                    }
                }
            }
            front.forEach(function (p, i) {
                var col = fore[i].col;
                if (i + 1 < front.length) link(p, front[i + 1]);
                [col - 1, col, col + 1].forEach(function (c) { if (c >= 0 && c < COLS) link(p, at[0][c]); });
            });
            at.concat([front]).forEach(function (row) {
                row.forEach(function (p) {
                    if (!p[3]) return;
                    ctx.fillStyle = 'rgba(' + BLUE + ',' + (0.15 + depth(p[2]) * 0.8) + ')';
                    ctx.beginPath();
                    ctx.arc(p[0], p[1], 0.5 + p[2] * p[2] * 2.2, 0, Math.PI * 2);
                    ctx.fill();
                });
            });
            if (visible && !reducedMotion) requestAnimationFrame(draw);
        }
        size();
        addEventListener('resize', function () { size(); if (!visible || reducedMotion) draw(performance.now()); });
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                var was = visible;
                visible = entries[0].isIntersecting;
                if (visible && !was) requestAnimationFrame(draw);
            }).observe(net);
        } else {
            draw(performance.now());
        }
    }

    // "Discuss this" links carry their topic into the form
    var form = document.getElementById('contact-form');
    if (!form) return; // legal pages carry no form
    document.addEventListener('click', function (e) {
        var link = e.target.closest('a[data-topic]');
        if (link) form.elements.topic.value = link.dataset.topic;
    });

    // Contact form
    var status = form.querySelector('.form__status');
    var button = form.querySelector('button[type="submit"]');
    function say(text, state) { status.textContent = text; status.dataset.state = state || ''; }
    function flag(names) {
        form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('is-invalid'); });
        names.forEach(function (name) { form.elements[name].closest('.field').classList.add('is-invalid'); });
        if (names.length) form.elements[names[0]].focus();
    }
    form.addEventListener('input', function (e) {
        var field = e.target.closest('.field');
        if (field) field.classList.remove('is-invalid');
    });
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var v = function (name) { return form.elements[name].value.trim(); };
        var d = form.dataset;

        var missing = ['firstname', 'lastname', 'message'].filter(function (name) { return !v(name); });
        if (missing.length) { flag(missing); return say(d.required, 'error'); }
        if (!v('email') && !v('phone')) { flag(['email', 'phone']); return say(d.either, 'error'); }
        if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) { flag(['email']); return say(d.email, 'error'); }
        flag([]);

        if (isLocal) return say(d.preview, 'ok');

        button.disabled = true;
        say(d.sending);
        try {
            var resp = await fetch(decodeEndpoint(WORKER_ENDPOINT), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: [v('firstname'), v('lastname')].join(' '),
                    email: v('email'),
                    phone: v('phone'),
                    company: v('company'),
                    topic: v('topic'),
                    message: v('message')
                })
            });
            var result = await resp.json();
            if (resp.ok && result.success) { say(d.success, 'ok'); form.reset(); }
            else say(d.failure, 'error');
        } catch (err) {
            say(d.network, 'error');
        }
        button.disabled = false;
    });

})();
