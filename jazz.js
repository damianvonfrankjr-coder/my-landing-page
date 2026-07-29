/* ═══════════════════════════════════════════════════════════════
   Generative smooth jazz — Web Audio, no samples, no dependencies.

   Original music generated live in the browser: Rhodes-style FM
   electric piano comping, walking upright bass, brushed kit, and a
   sparse lead over ii–V–I changes. It never loops identically, so it
   can run on a lobby screen all day without becoming a 30-second
   earworm.

   Exposes: window.Jazz — init() / start() / stop() / setVolume()
   ═══════════════════════════════════════════════════════════════ */

(function (global) {
    'use strict';

    let ctx = null;
    let master = null, reverbSend = null;
    let playing = false;
    let timer = null;

    const TEMPO = 92;                 // BPM — lounge tempo
    const SWING = 0.34;               // 0 = straight, .33 ≈ triplet swing
    const LOOKAHEAD_MS = 25;
    const SCHEDULE_AHEAD = 0.18;      // seconds

    let nextNoteTime = 0;
    let step = 0;                     // running eighth-note counter

    /* ── Harmony ──────────────────────────────────────────────── */

    const SHAPES = {
        maj7: [0, 4, 7, 11, 14],
        m7:   [0, 3, 7, 10, 14],
        dom7: [0, 4, 7, 10, 14],
        m7b5: [0, 3, 6, 10, 14],
    };

    // Each progression is 8 bars; entries are [rootMidi, shape] or a pair
    // of two chords sharing the bar.
    const PROGRESSIONS = [
        // F major — I vi ii V
        [[65, 'maj7'], [62, 'm7'], [67, 'm7'], [60, 'dom7'],
         [65, 'maj7'], [[69, 'm7'], [62, 'dom7']], [67, 'm7'], [60, 'dom7']],
        // Bb major
        [[70, 'maj7'], [67, 'm7'], [72, 'm7'], [65, 'dom7'],
         [70, 'maj7'], [[62, 'm7'], [67, 'dom7']], [72, 'm7'], [65, 'dom7']],
        // C major, with a minor turn
        [[60, 'maj7'], [69, 'm7'], [62, 'm7'], [67, 'dom7'],
         [60, 'maj7'], [[64, 'm7b5'], [69, 'dom7']], [62, 'm7'], [67, 'dom7']],
        // Eb major — warmer section
        [[63, 'maj7'], [60, 'm7'], [65, 'm7'], [58, 'dom7'],
         [63, 'maj7'], [[67, 'm7'], [60, 'dom7']], [65, 'm7'], [58, 'dom7']],
    ];

    let progIndex = 0;
    let bar = 0;

    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = (arr) => arr[(Math.random() * arr.length) | 0];

    function chordAt(barIdx) {
        const prog = PROGRESSIONS[progIndex];
        const cell = prog[barIdx % 8];
        // A bar holding two chords splits at the halfway point.
        if (Array.isArray(cell[0])) return cell;
        return [cell, cell];
    }

    /* ── Instruments ──────────────────────────────────────────── */

    // FM electric piano — a decaying modulator gives the tine attack.
    function rhodes(t, midi, dur, gain) {
        const f = mtof(midi);
        const car = ctx.createOscillator();
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        const amp = ctx.createGain();
        const tone = ctx.createBiquadFilter();

        car.type = 'sine';
        car.frequency.value = f;
        mod.type = 'sine';
        mod.frequency.value = f * 2.0;

        modGain.gain.setValueAtTime(f * 2.6, t);
        modGain.gain.exponentialRampToValueAtTime(f * 0.04, t + 0.42);

        tone.type = 'lowpass';
        tone.frequency.value = 2600;
        tone.Q.value = 0.4;

        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.exponentialRampToValueAtTime(gain, t + 0.014);
        amp.gain.exponentialRampToValueAtTime(gain * 0.28, t + 0.5);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        mod.connect(modGain).connect(car.frequency);
        car.connect(tone).connect(amp);
        amp.connect(master);
        amp.connect(reverbSend);

        mod.start(t); car.start(t);
        mod.stop(t + dur + 0.05); car.stop(t + dur + 0.05);
    }

    // Upright-ish bass: triangle through a low filter, short bloom.
    function bass(t, midi, dur) {
        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const amp = ctx.createGain();
        const lp = ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.value = mtof(midi);
        sub.type = 'sine';
        sub.frequency.value = mtof(midi - 12);

        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1400, t);
        lp.frequency.exponentialRampToValueAtTime(420, t + dur * 0.8);

        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.exponentialRampToValueAtTime(0.30, t + 0.03);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        const subAmp = ctx.createGain();
        subAmp.gain.value = 0.5;

        osc.connect(lp);
        sub.connect(subAmp).connect(lp);
        lp.connect(amp).connect(master);

        osc.start(t); sub.start(t);
        osc.stop(t + dur + 0.05); sub.stop(t + dur + 0.05);
    }

    let noiseBuf = null;
    function noise() {
        if (!noiseBuf) {
            const len = ctx.sampleRate * 2;
            noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;
        return src;
    }

    // Brushed snare — soft filtered noise, the backbone of the lounge feel.
    function brush(t, gain = 0.05, dur = 0.16) {
        const src = noise();
        const bp = ctx.createBiquadFilter();
        const amp = ctx.createGain();
        bp.type = 'bandpass';
        bp.frequency.value = 2400;
        bp.Q.value = 0.7;
        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(bp).connect(amp).connect(master);
        amp.connect(reverbSend);
        src.start(t); src.stop(t + dur + 0.05);
    }

    function ride(t, gain = 0.022) {
        const src = noise();
        const hp = ctx.createBiquadFilter();
        const amp = ctx.createGain();
        hp.type = 'highpass';
        hp.frequency.value = 7000;
        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.exponentialRampToValueAtTime(gain, t + 0.006);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
        src.connect(hp).connect(amp).connect(master);
        amp.connect(reverbSend);
        src.start(t); src.stop(t + 0.16);
    }

    function kick(t, gain = 0.30) {
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(115, t);
        osc.frequency.exponentialRampToValueAtTime(44, t + 0.11);
        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
        osc.connect(amp).connect(master);
        osc.start(t); osc.stop(t + 0.3);
    }

    // Sparse lead — filtered saw with vibrato, stands in for a soft sax.
    function lead(t, midi, dur) {
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        const amp = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.value = mtof(midi);
        lfo.type = 'sine';
        lfo.frequency.value = 5.2;
        lfoGain.gain.setValueAtTime(0, t);
        lfoGain.gain.linearRampToValueAtTime(mtof(midi) * 0.008, t + dur * 0.5);

        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(900, t);
        lp.frequency.linearRampToValueAtTime(2000, t + 0.18);
        lp.Q.value = 3.5;

        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.exponentialRampToValueAtTime(0.075, t + 0.09);
        amp.gain.setValueAtTime(0.075, t + dur * 0.6);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        lfo.connect(lfoGain).connect(osc.frequency);
        osc.connect(lp).connect(amp).connect(master);
        amp.connect(reverbSend);

        lfo.start(t); osc.start(t);
        lfo.stop(t + dur + 0.05); osc.stop(t + dur + 0.05);
    }

    /* ── Arrangement ──────────────────────────────────────────── */

    const spb = () => 60 / TEMPO;

    function voicing(root, shape) {
        // Rootless-ish: 3rd, 5th, 7th, 9th, floated into a comfy register.
        const iv = SHAPES[shape];
        return [iv[1], iv[2], iv[3], iv[4]].map((semi) => {
            let n = root + semi;
            while (n < 60) n += 12;
            while (n > 79) n -= 12;
            return n;
        });
    }

    function scheduleStep(s, t) {
        const beatInBar = (s % 8) / 2;         // 0..3.5 in eighths
        const barIdx = Math.floor(s / 8);
        const isDownbeat = s % 8 === 0;

        if (isDownbeat) {
            bar = barIdx;
            if (bar % 8 === 0 && bar > 0) {
                // New section — occasionally change key.
                if (Math.random() < 0.75) progIndex = (progIndex + 1) % PROGRESSIONS.length;
            }
        }

        const [c1, c2] = chordAt(bar);
        const chord = beatInBar < 2 ? c1 : c2;
        const [root, shape] = chord;

        // ── Comping: land on beat 1 and the "and" of 2, jazz-style
        if (s % 8 === 0 || s % 8 === 5) {
            const notes = voicing(root, shape);
            const vel = s % 8 === 0 ? 0.085 : 0.062;
            notes.forEach((n, i) => {
                // tiny roll so it reads as hands, not a chord stab
                rhodes(t + i * 0.008, n, rand(1.1, 1.7), vel * rand(0.85, 1.15));
            });
        }

        // ── Walking bass on every beat
        if (s % 2 === 0) {
            const iv = SHAPES[shape];
            let n;
            if (beatInBar === 0) n = root - 12;
            else if (beatInBar === 1) n = root - 12 + iv[2];
            else if (beatInBar === 2) n = root - 12 + iv[1];
            else {
                // approach the next bar's root by a half step
                const nextRoot = chordAt(bar + (beatInBar >= 2 ? 1 : 0))[0][0];
                n = nextRoot - 12 + (Math.random() < 0.5 ? -1 : 1);
            }
            bass(t, n, spb() * 0.92);
        }

        // ── Kit
        if (s % 8 === 0) kick(t, 0.26);
        if (s % 8 === 6 && Math.random() < 0.35) kick(t, 0.16);
        if (s % 4 === 2) brush(t, 0.055);                 // 2 and 4
        ride(t, s % 2 === 0 ? 0.020 : 0.013);             // swung eighths

        // ── Lead: sparse phrases, roughly every other bar
        if (s % 8 === 0 && Math.random() < 0.42) {
            const iv = SHAPES[shape];
            const pool = [iv[1], iv[2], iv[3], iv[4], iv[4] + 3].map((x) => root + x + 12);
            let time = t + rand(0, 0.3);
            const notesInPhrase = 2 + ((Math.random() * 3) | 0);
            for (let i = 0; i < notesInPhrase; i++) {
                const dur = pick([0.42, 0.55, 0.8, 1.1]);
                lead(time, pick(pool), dur);
                time += dur + rand(0.05, 0.3);
            }
        }
    }

    function scheduler() {
        while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
            // swing: push the off-eighths late
            const swingOffset = step % 2 === 1 ? spb() * 0.5 * SWING : 0;
            scheduleStep(step, nextNoteTime + swingOffset);
            nextNoteTime += spb() * 0.5;
            step++;
        }
    }

    /* ── Reverb ───────────────────────────────────────────────── */

    function buildReverb(seconds = 2.4, decay = 2.6) {
        const rate = ctx.sampleRate;
        const len = Math.floor(rate * seconds);
        const buf = ctx.createBuffer(2, len, rate);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < len; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
            }
        }
        const conv = ctx.createConvolver();
        conv.buffer = buf;
        return conv;
    }

    /* ── Public API ───────────────────────────────────────────── */

    function init() {
        if (ctx) return;
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();

        master = ctx.createGain();
        master.gain.value = 0.55;

        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -20;
        comp.ratio.value = 3;
        comp.attack.value = 0.006;
        comp.release.value = 0.22;

        const conv = buildReverb();
        reverbSend = ctx.createGain();
        reverbSend.gain.value = 0.30;
        reverbSend.connect(conv).connect(comp);

        master.connect(comp).connect(ctx.destination);
    }

    async function start() {
        init();
        if (!ctx || playing) return;
        if (ctx.state === 'suspended') await ctx.resume();
        playing = true;
        step = 0;
        bar = 0;
        progIndex = (Math.random() * PROGRESSIONS.length) | 0;
        nextNoteTime = ctx.currentTime + 0.12;
        timer = setInterval(scheduler, LOOKAHEAD_MS);
    }

    function stop() {
        playing = false;
        if (timer) { clearInterval(timer); timer = null; }
        if (master) {
            const t = ctx.currentTime;
            master.gain.cancelScheduledValues(t);
            master.gain.setValueAtTime(master.gain.value, t);
            master.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
            setTimeout(() => { if (!playing && master) master.gain.value = volume; }, 700);
        }
    }

    let volume = 0.55;
    function setVolume(v) {
        volume = Math.max(0, Math.min(1, v));
        if (master && playing) {
            master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
        } else if (master) {
            master.gain.value = volume;
        }
    }

    global.Jazz = {
        init, start, stop, setVolume,
        get isPlaying() { return playing; },
        get volume() { return volume; },
    };
})(window);
