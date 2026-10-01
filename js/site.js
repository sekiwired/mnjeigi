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
        var at = 0;
        setInterval(function () {
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

    // Flat lattice of diamonds behind the name: a few linked dots, barely moving
    var wave = document.querySelector('.wave');
    if (wave && wave.getContext) {
        var ctx = wave.getContext('2d');
        var COLS = 9, ROWS = 5, BLUE = '31, 53, 255';
        var w = 0, h = 0, visible = false, started = performance.now();
        function size() {
            var ratio = Math.min(devicePixelRatio || 1, 2);
            w = wave.clientWidth; h = wave.clientHeight;
            wave.width = w * ratio; wave.height = h * ratio;
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        }
        function point(c, r, t) {
            var depth = r / (ROWS - 1);                       // 0 far, 1 near
            var step = w * 1.1 / (COLS - 1) * (0.72 + depth * 0.45);
            var x = w * 0.46 + (c - (COLS - 1) / 2 + (r % 2 ? 0.5 : 0)) * step;   // odd rows sit half a step over: diamonds
            var y = h * (0.52 + depth * 0.16);                // rows close together: a flat sheet seen from the side
            var lift = Math.sin(c * 0.7 + r * 0.5 + t * 0.45);
            return [x, y + lift * h * 0.006 * (0.6 + depth), depth];
        }
        function draw(now) {
            var t = (now - started) / 1000;
            var grid = [];
            ctx.clearRect(0, 0, w, h);
            for (var r = 0; r < ROWS; r++) {
                grid.push([]);
                for (var c = 0; c < COLS; c++) grid[r].push(point(c, r, t));
            }
            ctx.lineWidth = 1;
            for (r = 0; r < ROWS; r++) {
                for (c = 0; c < COLS; c++) {
                    var p = grid[r][c], alpha = 0.12 + p[2] * 0.22;
                    ctx.strokeStyle = 'rgba(' + BLUE + ',' + alpha + ')';
                    ctx.beginPath();
                    if (r + 1 < ROWS) {
                        var left = r % 2 ? c : c - 1, right = left + 1;
                        if (left >= 0) { ctx.moveTo(p[0], p[1]); ctx.lineTo(grid[r + 1][left][0], grid[r + 1][left][1]); }
                        if (right < COLS) { ctx.moveTo(p[0], p[1]); ctx.lineTo(grid[r + 1][right][0], grid[r + 1][right][1]); }
                    }
                    ctx.stroke();
                    ctx.fillStyle = 'rgba(' + BLUE + ',' + (0.25 + p[2] * 0.6) + ')';
                    ctx.beginPath();
                    ctx.arc(p[0], p[1], 1.4 + p[2] * 1.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            if (visible && !reducedMotion) requestAnimationFrame(draw);
        }
        size();
        addEventListener('resize', function () { size(); if (!visible || reducedMotion) draw(performance.now()); });
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                var was = visible;
                visible = entries[0].isIntersecting;
                if (visible && !was) requestAnimationFrame(draw);
            }).observe(wave);
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
