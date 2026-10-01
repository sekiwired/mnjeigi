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

    // Network behind the name: dots drift on their own and stay inside a horizontal band,
    // and a line appears between two dots whenever they come close
    var net = document.querySelector('.net');
    if (net && net.getContext) {
        var ctx = net.getContext('2d');
        var BLUE = '31, 53, 255';
        var LINK = 120;            // px: two dots closer than this are linked
        var w = 0, h = 0, dots = [], visible = false, last = 0;
        function size() {
            var ratio = Math.min(devicePixelRatio || 1, 2);
            w = net.clientWidth; h = net.clientHeight;
            net.width = w * ratio; net.height = h * ratio;
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            var count = Math.round(Math.max(26, Math.min(64, w * h / 2600)));
            dots = [];
            for (var i = 0; i < count; i++) {
                var angle = Math.random() * Math.PI * 2, speed = 9 + Math.random() * 17;   // px per second
                dots.push({
                    x: Math.random() * w, y: Math.random() * h,
                    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.6,
                    r: 1.2 + Math.random() * 2.1
                });
            }
        }
        function draw(now) {
            var dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            ctx.clearRect(0, 0, w, h);
            dots.forEach(function (d) {
                d.x += d.vx * dt; d.y += d.vy * dt;
                if (d.x < d.r || d.x > w - d.r) { d.vx = -d.vx; d.x = Math.max(d.r, Math.min(w - d.r, d.x)); }
                if (d.y < d.r || d.y > h - d.r) { d.vy = -d.vy; d.y = Math.max(d.r, Math.min(h - d.r, d.y)); }
            });
            ctx.lineWidth = 1;
            for (var a = 0; a < dots.length; a++) {
                for (var b = a + 1; b < dots.length; b++) {
                    var dx = dots[a].x - dots[b].x, dy = dots[a].y - dots[b].y;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > LINK) continue;
                    ctx.strokeStyle = 'rgba(' + BLUE + ',' + ((1 - dist / LINK) * 0.42) + ')';
                    ctx.beginPath();
                    ctx.moveTo(dots[a].x, dots[a].y);
                    ctx.lineTo(dots[b].x, dots[b].y);
                    ctx.stroke();
                }
            }
            dots.forEach(function (d) {
                ctx.fillStyle = 'rgba(' + BLUE + ', 0.8)';
                ctx.beginPath();
                ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
                ctx.fill();
            });
            if (visible && !reducedMotion) requestAnimationFrame(draw);
        }
        size();
        addEventListener('resize', function () { size(); if (!visible || reducedMotion) draw(performance.now()); });
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                var was = visible;
                visible = entries[0].isIntersecting;
                if (visible && !was) { last = performance.now(); requestAnimationFrame(draw); }
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
