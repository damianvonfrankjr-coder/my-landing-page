/* ═══════════════════════════════════════════════════════════════
   Broadcast controller — cycles the forecast panels on a timer,
   keeps the clock and crawl running, refreshes live NWS data, and
   drives the generative jazz.

   Depends on wx-data.js (window.WX) and jazz.js (window.Jazz).
   ═══════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    // Panel rotation. `alert` is spliced in only while one is active.
    const ROTATION = [
        { id: 'intro',     hold: 9000  },
        { id: 'current',   hold: 14000 },
        { id: 'forecast',  hold: 15000 },
        { id: 'alert',     hold: 13000, conditional: true },
        { id: 'logistics', hold: 13000 },
        { id: 'offer',     hold: 12000 },
    ];

    let data = null;
    let order = [];
    let cursor = 0;
    let advanceTimer = null;

    const panels = {};
    document.querySelectorAll('.panel').forEach((el) => {
        panels[el.dataset.panel] = el;
    });

    /* ── Clock ────────────────────────────────────────────────── */

    const timeFmt = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
    });
    const dateFmt = new Intl.DateTimeFormat('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York',
    });

    function tickClock() {
        const now = new Date();
        $('bar-clock').textContent = timeFmt.format(now);
        $('bar-date').textContent = dateFmt.format(now).toUpperCase();
    }

    /* ── Rendering ────────────────────────────────────────────── */

    function renderCurrent(c) {
        if (!c) return;
        $('cur-icon').innerHTML = WX.iconFor(c.text);
        $('cur-temp').innerHTML = `${c.temp}<span>°</span>`;
        $('cur-cond').textContent = c.text;
        $('cur-feels').textContent = `${c.feels}°`;
        $('cur-humidity').textContent = `${c.humidity}%`;
        $('cur-wind').textContent = c.wind ? `${c.windDir} ${c.wind} mph`.trim() : '—';
        $('cur-pressure').textContent = c.pressure ? `${c.pressure} in` : '—';
    }

    function renderForecast(periods) {
        $('fc-row').innerHTML = periods
            .map(
                (p) => `
            <div class="fc-col">
                <div class="fc-day">${p.name.toUpperCase()}</div>
                <div class="fc-ico">${WX.iconFor(p.short)}</div>
                <div class="fc-t">${p.temp}°</div>
                <div class="fc-s">${p.short}</div>
                <div class="fc-w">${p.wind ? `${p.windDir} ${p.wind}`.trim() : '&nbsp;'}</div>
                <div class="fc-p">${p.pop != null ? `${p.pop}% PRECIP` : '&nbsp;'}</div>
            </div>`
            )
            .join('');
    }

    function renderLogistics(status) {
        const el = $('logi-status');
        el.style.setProperty('--status', status.accent);
        $('logi-status').parentElement.style.setProperty('--status', status.accent);
        panels.logistics.style.setProperty('--status', status.accent);
        $('logi-label').textContent = status.short;
        $('logi-copy').textContent = status.copy;
        $('logi-pickup').textContent = status.pickup;
        $('logi-rush').textContent = status.rush;
    }

    function renderAlert(alerts) {
        if (!alerts.length) return;
        const a = alerts[0];
        $('alert-event').textContent = a.event;
        const ends = a.ends ? `until ${timeFmt.format(new Date(a.ends))} ET` : 'in effect';
        $('alert-meta').textContent = `${a.severity} · ${a.urgency} · ${ends}`;
        // NWS descriptions are long and hard-wrapped for teletype; unwrap them,
        // and prefer the fuller body over the one-line headline.
        const clean = (s) => (s || '').replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
        const headline = clean(a.headline);
        const body = clean(a.description);
        let text = body.length > headline.length ? body : headline;
        if (headline && body && !body.startsWith(headline)) text = `${headline} ${body}`.trim();
        $('alert-copy').textContent = text.length > 420 ? `${text.slice(0, 417)}…` : text;
    }

    function renderCrawl(d) {
        const bits = [];
        if (d && d.alerts.length) {
            d.alerts.forEach((a) => bits.push(`⚠ ${a.event.toUpperCase()} IN EFFECT`));
        }
        if (d && d.current) {
            bits.push(`TAMPA ${d.current.temp}° ${d.current.text.toUpperCase()}`);
        }
        if (d) bits.push(d.status.short);
        bits.push('NEW MB2 PARTNERS — YOUR FIRST FIVE CASES ARE ON US');
        bits.push('NO RESTRICTIONS OR LIMITS · FIRST 30 DAYS OF SIGN-UP');
        bits.push('BOOK YOUR ONBOARDING CALL — 448-400-5277');
        bits.push('SPECTRUM KILLIAN DENTAL LAB — TAMPA · ST. PETE · CLEARWATER · BRANDON');
        if (!d) bits.push('LIVE WEATHER FEED UNAVAILABLE — RETRYING');

        const line = bits.join('<span class="sep">◆</span>');
        // Duplicated so the marquee can loop seamlessly at -50%.
        $('crawl-text').innerHTML = `${line}<span class="sep">◆</span>${line}<span class="sep">◆</span>`;
    }

    function renderIntroStrip(d) {
        $('intro-strip').textContent = d && d.usedFallback
            ? 'Live conditions · backup feed'
            : 'Live from the National Weather Service';
    }

    /* ── Rotation ─────────────────────────────────────────────── */

    function buildOrder() {
        const hasAlert = !!(data && data.alerts.length);
        order = ROTATION.filter((p) => !p.conditional || hasAlert);
        // If the board can't show weather at all, keep only the brand panels.
        if (!data) order = order.filter((p) => p.id === 'intro' || p.id === 'offer');
        renderDots();
    }

    function renderDots() {
        $('dots').innerHTML = order.map(() => '<span class="dot"></span>').join('');
    }

    function show(index) {
        if (!order.length) return;
        cursor = (index + order.length) % order.length;
        const entry = order[cursor];

        Object.values(panels).forEach((el) => {
            if (el.classList.contains('on')) {
                el.classList.remove('on');
                el.classList.add('out');
                setTimeout(() => el.classList.remove('out'), 600);
            }
        });

        const el = panels[entry.id];
        if (el) {
            el.classList.remove('out');
            // next frame so the transition actually runs
            requestAnimationFrame(() => el.classList.add('on'));
        }

        $('dots').querySelectorAll('.dot').forEach((d, i) => {
            d.classList.toggle('on', i === cursor);
        });

        clearTimeout(advanceTimer);
        advanceTimer = setTimeout(() => show(cursor + 1), entry.hold);
    }

    const next = () => show(cursor + 1);
    const prev = () => show(cursor - 1);

    /* ── Data ─────────────────────────────────────────────────── */

    async function load() {
        try {
            data = await WX.fetchAll();
            renderCurrent(data.current);
            renderForecast(data.forecast);
            renderLogistics(data.status);
            renderAlert(data.alerts);
        } catch (err) {
            console.warn('[kiosk] weather unavailable', err);
            data = null;
        }
        renderCrawl(data);
        renderIntroStrip(data);

        const hadAlert = order.some((p) => p.id === 'alert');
        const hasAlert = !!(data && data.alerts.length);
        if (hadAlert !== hasAlert || !order.length) {
            buildOrder();
            show(0);
        }
    }

    /* ── Keep the screen awake ────────────────────────────────── */

    let wakeLock = null;
    async function keepAwake() {
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLock.addEventListener('release', () => { wakeLock = null; });
            }
        } catch { /* Safari/iOS or denied — the display still runs */ }
    }
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            if (!wakeLock) keepAwake();
            load();
        }
    });

    /* ── Controls ─────────────────────────────────────────────── */

    let hideTimer = null;
    function flashControls() {
        const c = $('controls');
        c.classList.add('show');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => c.classList.remove('show'), 3200);
    }
    ['mousemove', 'touchstart', 'keydown'].forEach((ev) =>
        document.addEventListener(ev, flashControls, { passive: true })
    );

    function setMusicLabel() {
        $('btn-music-label').textContent = Jazz.isPlaying ? '♪ Music On' : '♪ Music Off';
    }

    $('btn-music').addEventListener('click', async () => {
        if (Jazz.isPlaying) Jazz.stop();
        else await Jazz.start();
        setMusicLabel();
    });

    $('vol').addEventListener('input', (e) => {
        Jazz.setVolume(e.target.value / 100);
    });

    $('btn-next').addEventListener('click', next);
    $('btn-prev').addEventListener('click', prev);

    $('btn-full').addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') next();
        else if (e.key === 'ArrowLeft') prev();
        else if (e.key === 'f') $('btn-full').click();
        else if (e.key === 'm') $('btn-music').click();
    });

    /* ── Boot ─────────────────────────────────────────────────── */

    async function boot() {
        const silent = $('boot-silent').checked;
        $('boot').classList.add('gone');

        if (!silent) {
            try {
                await Jazz.start();
                Jazz.setVolume($('vol').value / 100);
            } catch (err) {
                console.warn('[kiosk] audio blocked', err);
            }
        }
        setMusicLabel();
        keepAwake();
        flashControls();
        show(0);
    }

    $('boot-btn').addEventListener('click', boot);

    /* ── Go ───────────────────────────────────────────────────── */

    tickClock();
    setInterval(tickClock, 1000);

    $('bar-place').textContent = `${WX.CONFIG.regionName.toUpperCase()}, FL`;

    buildOrder();
    renderCrawl(null);
    load();
    setInterval(load, WX.CONFIG.refreshMs);
})();
