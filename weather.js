/* ═══════════════════════════════════════════════════════════════
   Landing-page weather board.

   Data fetching, the courier-status rules and the icon set live in
   wx-data.js (window.WX), shared with the broadcast display.
   This file is rendering only.
   ═══════════════════════════════════════════════════════════════ */

const $ = (id) => document.getElementById(id);

const clockFmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
});

/* ── Rendering ────────────────────────────────────────────────── */

function renderCurrent(c) {
    if (!c) return;
    $('now-temp').innerHTML = `${c.temp}<span class="deg">°</span>`;
    $('now-cond').textContent = c.text;
    $('now-feels').textContent = `${c.feels}°`;
    $('now-humidity').textContent = `${c.humidity}%`;
    $('now-wind').textContent = `${c.wind} mph`;
}

function renderForecast(periods) {
    $('wx-forecast').innerHTML = periods
        .map(
            (p) => `
        <div class="fc-card">
            <div class="fc-name">${p.name}</div>
            <div class="fc-icon">${WX.iconFor(p.short)}</div>
            <div class="fc-temp">${p.temp}°</div>
            <div class="fc-short">${p.short}</div>
            <div class="fc-pop">${p.pop != null ? `${p.pop}% precip` : '&nbsp;'}</div>
        </div>`
        )
        .join('');
}

function renderAlerts(alerts) {
    const el = $('wx-alerts');
    if (!alerts.length) {
        el.hidden = true;
        el.innerHTML = '';
        return;
    }
    el.hidden = false;
    el.innerHTML = alerts
        .map((a) => {
            const ends = a.ends ? `until ${clockFmt.format(new Date(a.ends))} ET` : 'in effect';
            return `
        <div class="alert-card sev-${a.severity}">
            <svg class="alert-icon" width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3.2 L22 20.5 H2 Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
                <path d="M12 9.5 v4.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <circle cx="12" cy="17.2" r="1.05" fill="currentColor"/>
            </svg>
            <div>
                <div class="alert-event">${a.event}</div>
                <div class="alert-meta">${a.severity} · ${a.urgency} · ${ends}</div>
                ${a.headline ? `<div class="alert-headline">${a.headline}</div>` : ''}
            </div>
        </div>`;
        })
        .join('');
}

function renderStatus(status) {
    document.documentElement.style.setProperty('--accent', status.accent);
    document.documentElement.style.setProperty(
        '--accent-soft',
        `color-mix(in srgb, ${status.accent} 15%, transparent)`
    );

    $('status-chip-text').textContent = status.label;
    $('status-copy').textContent = status.copy;
    $('line-pickup').textContent = status.pickup;
    $('line-rush').textContent = status.rush;

    const state = status.level === 'halt' ? 'alert' : 'ok';
    $('wx').dataset.state = state;
    $('status-rail').dataset.state = state;
}

function renderRail(current, alerts, status) {
    const bits = [];
    if (current) bits.push(`${current.temp}° ${current.text}`);
    if (alerts.length) bits.push(`⚠ ${alerts[0].event}`);
    bits.push(status.label);
    $('rail-readout').textContent = bits.join('  ·  ');
    $('rail-stamp').textContent = `Updated ${clockFmt.format(new Date())} ET`;
}

function renderError(err) {
    $('wx').dataset.state = 'error';
    $('status-rail').dataset.state = 'error';
    $('rail-readout').textContent =
        'Live weather feed unavailable — showing the page without it.';
    $('rail-stamp').textContent = '';
    $('status-chip-text').textContent = 'Feed unavailable';
    $('status-copy').textContent =
        "We couldn't reach the National Weather Service just now. Call your account manager at " +
        '448-400-5277 for today\'s courier status, or hit Refresh to try again.';
    $('wx-forecast').innerHTML = '';
    console.warn('[tampa-wx]', err);
}

/* ── Orchestration ────────────────────────────────────────────── */

let inFlight = false;

async function load() {
    if (inFlight) return;
    inFlight = true;
    $('wx').dataset.state = 'loading';

    try {
        const d = await WX.fetchAll();
        renderCurrent(d.current);
        renderForecast(d.forecast);
        renderAlerts(d.alerts);
        renderStatus(d.status);
        renderRail(d.current, d.alerts, d.status);
    } catch (err) {
        renderError(err);
    } finally {
        inFlight = false;
    }
}

$('wx-refresh').addEventListener('click', load);

// Refresh on an interval, and again whenever the tab regains focus after
// sitting idle — a board showing yesterday's storm is worse than none.
setInterval(load, WX.CONFIG.refreshMs);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
});

load();
