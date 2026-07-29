/* ═══════════════════════════════════════════════════════════════
   Tampa Bay live weather + case logistics board

   Sources (both public, CORS-enabled, no API key required):
     • api.weather.gov  — official National Weather Service forecast
                          and active alerts. Authoritative, public domain.
     • api.open-meteo.com — live current conditions, and a forecast
                          fallback if the NWS endpoint is unavailable.
   ═══════════════════════════════════════════════════════════════ */

const CONFIG = {
    // Downtown Tampa. Change these two numbers to point the board at
    // another location — the NWS grid is resolved automatically.
    lat: 27.9506,
    lon: -82.4572,
    placeName: 'Tampa',

    // NWS forecast grid for downtown Tampa (office TBW).
    // Resolved from https://api.weather.gov/points/27.9506,-82.4572
    // If you change lat/lon above, either update this or delete it —
    // when it is null the grid is looked up live at page load.
    grid: { office: 'TBW', x: 71, y: 98 },

    refreshMs: 10 * 60 * 1000,   // 10 minutes
    forecastPeriods: 5,
};

/* ── Small helpers ────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);

async function getJSON(url, { timeout = 12000 } = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
        const res = await fetch(url, {
            signal: ctl.signal,
            headers: { Accept: 'application/geo+json, application/json' },
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

const clockFmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
});

/* ── Weather icons ────────────────────────────────────────────── */

function iconFor(text = '') {
    const t = text.toLowerCase();
    const stroke = 'stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"';
    const sun   = `<circle cx="12" cy="12" r="4.4" ${stroke}/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" ${stroke}/>`;
    const cloud = `<path d="M7 18.5h10a3.75 3.75 0 0 0 .3-7.5 5.5 5.5 0 0 0-10.5-1.2A3.9 3.9 0 0 0 7 18.5z" ${stroke}/>`;
    const rain  = `${cloud}<path d="M8.5 20.5l-.9 2M12 20.5l-.9 2M15.5 20.5l-.9 2" ${stroke}/>`;
    const storm = `${cloud}<path d="M12.8 19.4l-2.4 3.4h2.6l-1.6 2.6" ${stroke} stroke-width="1.5"/>`;
    const partly = `<circle cx="8.6" cy="8.6" r="3.1" ${stroke}/><path d="M8.6 2.8v1.6M2.8 8.6h1.6M4.5 4.5l1.1 1.1M12.7 4.5l-1.1 1.1" ${stroke}/><path d="M9 19.5h8a3.2 3.2 0 0 0 .25-6.4 4.7 4.7 0 0 0-8.95-1A3.35 3.35 0 0 0 9 19.5z" ${stroke}/>`;
    const fog   = `${cloud}<path d="M5.5 21h13M7.5 23.5h9" ${stroke}/>`;

    let body = partly;
    if (/thunder|t-storm|tstorm|lightning/.test(t)) body = storm;
    else if (/rain|shower|drizzle|precip/.test(t)) body = rain;
    else if (/fog|haze|mist|smoke/.test(t)) body = fog;
    else if (/(mostly|partly)\s+(sunny|clear)|partly cloudy/.test(t)) body = partly;
    else if (/cloud|overcast/.test(t)) body = cloud;
    else if (/sunny|clear|fair|hot/.test(t)) body = sun;

    return `<svg width="27" height="27" viewBox="0 0 24 26" aria-hidden="true">${body}</svg>`;
}

/* ── Open-Meteo WMO code → text (fallback path) ──────────────── */

const WMO = {
    0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Rime Fog', 51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
    61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
    71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
    80: 'Light Showers', 81: 'Showers', 82: 'Violent Showers',
    95: 'Thunderstorms', 96: 'Thunderstorms with Hail', 99: 'Severe Thunderstorms',
};

/* ── Data fetching ────────────────────────────────────────────── */

async function resolveGrid() {
    if (CONFIG.grid) return CONFIG.grid;
    const pt = await getJSON(`https://api.weather.gov/points/${CONFIG.lat},${CONFIG.lon}`);
    const p = pt.properties;
    return { office: p.gridId, x: p.gridX, y: p.gridY };
}

async function fetchNwsForecast() {
    const g = await resolveGrid();
    const data = await getJSON(
        `https://api.weather.gov/gridpoints/${g.office}/${g.x},${g.y}/forecast`
    );
    return data.properties.periods.slice(0, CONFIG.forecastPeriods).map((p) => ({
        name: p.name,
        temp: p.temperature,
        unit: p.temperatureUnit,
        short: p.shortForecast,
        pop: p.probabilityOfPrecipitation?.value ?? null,
        wind: p.windSpeed,
        isDay: p.isDaytime,
    }));
}

async function fetchAlerts() {
    const data = await getJSON(
        `https://api.weather.gov/alerts/active?point=${CONFIG.lat},${CONFIG.lon}`
    );
    return (data.features || []).map((f) => ({
        event: f.properties.event,
        severity: (f.properties.severity || 'unknown').toLowerCase(),
        urgency: f.properties.urgency,
        headline: f.properties.headline,
        ends: f.properties.ends || f.properties.expires,
    }));
}

async function fetchCurrent() {
    const url =
        'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}` +
        '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m' +
        '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York';
    const d = await getJSON(url);
    const c = d.current;
    return {
        temp: Math.round(c.temperature_2m),
        feels: Math.round(c.apparent_temperature),
        humidity: Math.round(c.relative_humidity_2m),
        wind: Math.round(c.wind_speed_10m),
        text: WMO[c.weather_code] ?? 'Current conditions',
    };
}

// Used only if api.weather.gov is unreachable.
async function fetchOpenMeteoForecast() {
    const url =
        'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}` +
        '&daily=weather_code,temperature_2m_max,precipitation_probability_max' +
        '&temperature_unit=fahrenheit&timezone=America%2FNew_York' +
        `&forecast_days=${CONFIG.forecastPeriods}`;
    const d = await getJSON(url);
    const fmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/New_York' });
    return d.daily.time.map((iso, i) => ({
        name: i === 0 ? 'Today' : fmt.format(new Date(`${iso}T12:00:00`)),
        temp: Math.round(d.daily.temperature_2m_max[i]),
        unit: 'F',
        short: WMO[d.daily.weather_code[i]] ?? '—',
        pop: d.daily.precipitation_probability_max[i],
        isDay: true,
    }));
}

/* ── Courier status logic ─────────────────────────────────────── */

const HALTING = /hurricane|tornado|tropical storm warning|storm surge warning|flash flood warning|extreme wind/i;
const CAUTION = /watch|advisory|flood|wind|thunderstorm|heat|rip current|special weather/i;

function deriveStatus(alerts, forecast, current) {
    const worst = alerts.find((a) => HALTING.test(a.event) || ['extreme', 'severe'].includes(a.severity));
    if (worst) {
        return {
            level: 'halt',
            label: 'Courier routes suspended',
            accent: '#ff4e4e',
            copy: `The National Weather Service has an active ${worst.event} for the Tampa Bay area. ` +
                  'Courier pickup and delivery are paused until the advisory clears. Cases already in ' +
                  'the lab stay in production, and your account manager will call you directly with an ETA.',
            pickup: 'Paused',
            rush: 'Unavailable',
        };
    }

    const caution = alerts.find((a) => CAUTION.test(a.event));
    const stormy = forecast.some((p) => p.pop != null && p.pop >= 60);
    const windy = current && current.wind >= 25;

    if (caution || windy) {
        const reason = caution ? caution.event : 'sustained winds across the bay';
        return {
            level: 'watch',
            label: 'Monitoring conditions',
            accent: '#ffb347',
            copy: `An active ${reason} may slow afternoon routes across the bay. Pickups are running, ` +
                  'but build in extra time on anything seating tomorrow. Digital case intake is unaffected.',
            pickup: 'Running · possible delays',
            rush: 'Case-by-case',
        };
    }

    if (stormy) {
        return {
            level: 'normal',
            label: 'All routes normal',
            accent: '#4fd1c5',
            copy: 'Routes are running on schedule. Typical Gulf Coast afternoon storms are in the ' +
                  'forecast, so morning pickups are the safest window for anything time-sensitive.',
            pickup: 'On schedule',
            rush: 'Available · book by 10a',
        };
    }

    return {
        level: 'normal',
        label: 'All routes normal',
        accent: '#4fd1c5',
        copy: 'Clear conditions across Tampa Bay. Courier pickup and delivery are running on ' +
              'schedule for Tampa, St. Petersburg, Clearwater and Brandon.',
        pickup: 'On schedule',
        rush: 'Available',
    };
}

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
    const el = $('wx-forecast');
    el.innerHTML = periods
        .map(
            (p) => `
        <div class="fc-card">
            <div class="fc-name">${p.name}</div>
            <div class="fc-icon">${iconFor(p.short)}</div>
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
            const ends = a.ends
                ? `until ${clockFmt.format(new Date(a.ends))} ET`
                : 'in effect';
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
        // Each source settles independently so one outage can't blank the board.
        const [fcRes, alRes, curRes] = await Promise.allSettled([
            fetchNwsForecast(),
            fetchAlerts(),
            fetchCurrent(),
        ]);

        let forecast = fcRes.status === 'fulfilled' ? fcRes.value : null;
        if (!forecast) {
            console.warn('[tampa-wx] NWS forecast unavailable, falling back to Open-Meteo', fcRes.reason);
            forecast = await fetchOpenMeteoForecast();
        }

        const alerts = alRes.status === 'fulfilled' ? alRes.value : [];
        const current = curRes.status === 'fulfilled' ? curRes.value : null;

        if (!forecast.length && !current) throw new Error('no weather data available');

        const status = deriveStatus(alerts, forecast, current);

        renderCurrent(current);
        renderForecast(forecast);
        renderAlerts(alerts);
        renderStatus(status);
        renderRail(current, alerts, status);
    } catch (err) {
        renderError(err);
    } finally {
        inFlight = false;
    }
}

$('wx-refresh').addEventListener('click', load);

// Refresh on an interval, and again whenever the tab regains focus after
// sitting idle — a board showing yesterday's storm is worse than none.
setInterval(load, CONFIG.refreshMs);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
});

load();
