// /research/call/<token>: the AI research interview (M42, flow 3), on the
// website. vercel.json rewrites the address to research-call.html and the
// token stays in the path. The page talks to the CRM:
//
//   GET  CRM/api/research/session?token=<token>
//        -> { ok, result: { sessionsLeft } } | 404 (unknown or cancelled link)
//   POST CRM/api/research/session { token, transport: "webrtc" }
//        -> { ok, result: { provider: "cartesia", url, token, ... } }
//
// then joins the LiveKit room Cartesia answers (assets/vendor/livekit-client),
// publishes the microphone and plays the interviewer. The orb is drawn here:
// the interviewer's voice swells it, the guest's microphone moves the ring of
// ticks, and the outer arc fills over the planned 10 minutes. Cartesia sets no
// length limit on a web call, so the page ends it at 13 minutes (the CRM's
// cron cancels anything still running at 15).
//
// ?mock=1 runs the whole screen with made-up voices and no CRM or Cartesia, so
// the design can be checked. ?mock=used shows a used-up link, ?mock=fail a
// failed start.
(function () {
  'use strict';

  var CRM = 'https://coaching-crm-tau.vercel.app';
  var API = CRM + '/api/research/session';
  var PLANNED_MS = 10 * 60000;
  var HARD_STOP_MS = 13 * 60000;

  var root = document.querySelector('[data-call]');
  if (!root) return;
  var el = {
    clock: root.querySelector('[data-clock]'),
    clockText: root.querySelector('[data-clock] span'),
    canvas: root.querySelector('[data-orb]'),
    status: root.querySelector('[data-status]'),
    start: root.querySelector('[data-start]'),
    sound: root.querySelector('[data-sound]'),
    mute: root.querySelector('[data-mute]'),
    end: root.querySelector('[data-end]'),
    problem: root.querySelector('[data-problem]'),
    thanks: root.querySelector('[data-thanks]'),
    announce: root.querySelector('[data-announce]')
  };

  var mock = null;
  try { mock = new URLSearchParams(location.search).get('mock'); } catch (e) {}
  var match = location.pathname.match(/\/research\/call\/([A-Za-z0-9_-]{43})\/?$/);
  var token = match ? match[1] : (mock ? 'mock' : null);

  // Plain fragments for what went wrong (the CRM page's wording).
  var PROBLEMS = {
    microphone: 'Microphone blocked.',
    unavailable: 'Not available right now.',
    used_up: 'No sessions left on this link.',
    failed: 'Could not connect.',
    missing: 'Link not found.'
  };

  var reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // ---------------------------------------------------------------------------
  // The orb
  // ---------------------------------------------------------------------------
  var orb = (function (canvas) {
    var ctx = canvas.getContext('2d');
    var w = 0, h = 0, dpr = 1;
    var TICKS = 72;
    var s = {
      scale: 0.78, target: 0.78,
      ai: 0, aiIn: 0, you: 0, youIn: 0,
      bins: new Float32Array(TICKS), binsIn: new Float32Array(TICKS),
      progress: 0, muted: false, live: false
    };

    function size() {
      var box = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(box.width * dpr));
      h = Math.max(1, Math.round(box.height * dpr));
      canvas.width = w; canvas.height = h;
    }
    size();
    if (window.ResizeObserver) new ResizeObserver(size).observe(canvas);
    else window.addEventListener('resize', size);

    // Fast up, slow down: speech reads as movement, not flicker.
    function ease(current, input, up, down) {
      return current + (input - current) * (input > current ? up : down);
    }

    function blob(cx, cy, r, t, amp) {
      var n = 120;
      ctx.beginPath();
      for (var i = 0; i <= n; i++) {
        var a = (i / n) * Math.PI * 2;
        var wobble = amp * (
          0.55 * Math.sin(3 * a + t * 2.1) +
          0.30 * Math.sin(5 * a - t * 1.7 + 1.3) +
          0.15 * Math.sin(8 * a + t * 3.4 + 0.7));
        var rr = r * (1 + wobble);
        var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    function frame(now) {
      var t = now / 1000;
      s.scale = ease(s.scale, s.target, 0.05, 0.05);
      s.ai = ease(s.ai, s.aiIn, 0.32, 0.07);
      s.you = ease(s.you, s.muted ? 0 : s.youIn, 0.4, 0.09);
      for (var k = 0; k < TICKS; k++) s.bins[k] = ease(s.bins[k], s.binsIn[k], 0.45, 0.12);

      ctx.clearRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2;
      var unit = Math.min(w, h);
      var breathe = reduced ? 0 : 0.025 * Math.sin(t * 1.3);
      var r = unit * 0.25 * s.scale * (1 + breathe + s.ai * (reduced ? 0.06 : 0.14));

      // glow behind the orb, stronger while the interviewer talks
      // (kept inside the canvas, so it never shows a square edge)
      var glowR = Math.min(unit * 0.5, r * (1.9 + s.ai * 0.9));
      var glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, glowR);
      glow.addColorStop(0, 'rgba(56,182,255,' + (0.18 + s.ai * 0.32).toFixed(3) + ')');
      glow.addColorStop(1, 'rgba(56,182,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI * 2); ctx.fill();

      // the guest's ring: 72 ticks, mirrored left and right
      var ringR = r * 1.32 + unit * 0.012;
      var tickMax = unit * 0.075;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, unit * 0.0055);
      for (var i = 0; i < TICKS; i++) {
        var a = (i / TICKS) * Math.PI * 2 - Math.PI / 2;
        var len = unit * 0.006 + tickMax * s.you * (0.35 + 0.65 * s.bins[i]);
        var alpha = s.live ? (s.muted ? 0.14 : 0.26 + s.you * 0.6) : 0.16;
        ctx.strokeStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR);
        ctx.lineTo(cx + Math.cos(a) * (ringR + len), cy + Math.sin(a) * (ringR + len));
        ctx.stroke();
      }

      // time: a hairline circle, and an accent arc over the planned 10 minutes
      var arcR = ringR + tickMax + unit * 0.035;
      ctx.lineWidth = Math.max(1, unit * 0.003);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(cx, cy, arcR, 0, Math.PI * 2); ctx.stroke();
      if (s.progress > 0) {
        ctx.lineWidth = Math.max(2, unit * 0.007);
        ctx.strokeStyle = '#38b6ff';
        ctx.beginPath();
        ctx.arc(cx, cy, arcR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.progress));
        ctx.stroke();
      }

      // the interviewer: a lit sphere whose edge ripples with the voice
      var amp = reduced ? 0 : 0.01 + s.ai * 0.055;
      blob(cx, cy, r, t, amp);
      var fill = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r * 1.15);
      fill.addColorStop(0, '#bfe7ff');
      fill.addColorStop(0.35, '#6cc8ff');
      fill.addColorStop(0.75, '#38b6ff');
      fill.addColorStop(1, '#0874b8');
      ctx.fillStyle = fill;
      ctx.fill();

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return s;
  })(el.canvas);

  // ---------------------------------------------------------------------------
  // Levels: LiveKit's analyser on each audio track, read every frame
  // ---------------------------------------------------------------------------
  function level(volume) {
    // RMS 0..~0.4 for speech; a small gate keeps room noise still.
    return Math.min(1, Math.sqrt(Math.max(0, volume - 0.006)) * 1.9);
  }

  function meter(track) {
    var LK = window.LivekitClient;
    try {
      var m = LK.createAudioAnalyser(track, { fftSize: 256, smoothingTimeConstant: 0.55 });
      var data = new Uint8Array(m.analyser.frequencyBinCount);
      return {
        read: function () { return level(m.calculateVolume()); },
        spectrum: function (out) {
          m.analyser.getByteFrequencyData(data);
          var n = out.length, span = Math.min(48, data.length);
          for (var i = 0; i < n; i++) {
            // 0 at the top of the ring, the highest bin at the bottom, both sides
            var pos = 0.5 - 0.5 * Math.cos((i / n) * Math.PI * 2);
            out[i] = data[Math.min(span - 1, Math.floor(pos * span))] / 255;
          }
        },
        stop: function () { try { m.cleanup(); } catch (e) {} }
      };
    } catch (e) {
      return null;
    }
  }

  var meters = { ai: null, you: null };
  var spoke = 0;
  (function poll(now) {
    if (meters.ai) orb.aiIn = meters.ai.read();
    if (meters.you) {
      orb.youIn = meters.you.read();
      meters.you.spectrum(orb.binsIn);
    }
    if (phase === 'live') {
      if (orb.aiIn > 0.1) spoke = now;
      var text = orb.muted ? 'Muted'
        : !meters.ai ? 'Connecting'
        : now - spoke < 450 ? 'Interviewer speaking'
        : 'Listening';
      if (el.status.textContent !== text) el.status.textContent = text;
    }
    requestAnimationFrame(poll);
  })(0);

  // ---------------------------------------------------------------------------
  // The call
  // ---------------------------------------------------------------------------
  var phase = 'loading';
  var room = null;
  var connected = false;
  var startedAt = 0;
  var clockTimer = null;
  var hardStop = null;
  var players = [];

  function show(node, on) { node.hidden = !on; }

  function setPhase(next) {
    phase = next;
    root.setAttribute('data-phase', next);
    var live = next === 'live';
    show(el.start, next === 'ready' || next === 'starting' || next === 'blocked');
    el.start.disabled = next !== 'ready';
    el.start.setAttribute('aria-busy', next === 'starting' ? 'true' : 'false');
    show(el.mute, live);
    show(el.end, live);
    show(el.clock, live);
    show(el.thanks, next === 'ended');
    if (!live) show(el.sound, false);
    orb.live = live;
    orb.target = live ? 1 : 0.78;
    if (next === 'starting') el.status.textContent = 'Connecting';
    else if (!live) el.status.textContent = '';
    if (next === 'live') el.announce.textContent = 'Connected';
    if (next === 'ended') el.announce.textContent = 'Call ended';
  }

  function problem(key) {
    el.problem.textContent = key ? PROBLEMS[key] || PROBLEMS.failed : '';
    show(el.problem, !!key);
  }

  function tick() {
    var ms = Date.now() - startedAt;
    var sec = Math.floor(ms / 1000);
    el.clockText.textContent = Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
    orb.progress = ms / PLANNED_MS;
  }

  function ended() {
    if (clockTimer) clearInterval(clockTimer);
    if (hardStop) clearTimeout(hardStop);
    clockTimer = hardStop = null;
    if (meters.ai) meters.ai.stop();
    if (meters.you) meters.you.stop();
    meters.ai = meters.you = null;
    orb.aiIn = orb.youIn = 0;
    for (var i = 0; i < players.length; i++) players[i].remove();
    players = [];
    room = null;
    el.mute.setAttribute('aria-pressed', 'false');
    el.mute.textContent = 'Mute';
    orb.muted = false;
    orb.progress = 0;
    if (connected) setPhase('ended');
  }

  function goLive() {
    connected = true;
    startedAt = Date.now();
    tick();
    clockTimer = setInterval(tick, 500);
    hardStop = setTimeout(stop, HARD_STOP_MS);
    setPhase('live');
  }

  function stop() {
    if (mockRun) { mockRun.stop(); return; }
    if (room) room.disconnect();
  }

  function mint() {
    if (mock) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(mock === 'fail' ? { problem: 'failed' } : { client: {} });
        }, 700);
      });
    }
    return fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: token, transport: 'webrtc' })
    }).then(function (response) {
      return response.json().catch(function () { return null; }).then(function (body) {
        if (!response.ok || !body || body.ok !== true) {
          var code = body && body.error;
          return { problem: code === 'session_limit' ? 'used_up'
            : code === 'voice_unavailable' ? 'unavailable'
            : code === 'not_found' || code === 'closed' ? 'missing'
            : 'failed' };
        }
        var r = body.result || {};
        if (r.provider !== 'cartesia' || typeof r.url !== 'string' || typeof r.token !== 'string') {
          return { problem: 'unavailable' };
        }
        return { client: r };
      });
    }, function () { return { problem: 'failed' }; });
  }

  function join(client) {
    var LK = window.LivekitClient;
    if (!LK) return Promise.reject(new Error('livekit_missing'));
    var r = new LK.Room();
    room = r;
    r.on(LK.RoomEvent.TrackSubscribed, function (track) {
      if (track.kind !== LK.Track.Kind.Audio) return;
      var player = track.attach();
      player.hidden = true;
      document.body.appendChild(player);
      players.push(player);
      if (meters.ai) meters.ai.stop();
      meters.ai = meter(track);
    });
    r.on(LK.RoomEvent.TrackUnsubscribed, function (track) {
      var gone = track.detach();
      for (var i = 0; i < gone.length; i++) gone[i].remove();
    });
    // The interviewer hanging up leaves the room empty.
    r.on(LK.RoomEvent.ParticipantDisconnected, function () {
      if (r.remoteParticipants.size === 0) r.disconnect();
    });
    r.on(LK.RoomEvent.Disconnected, ended);
    // Some phones block sound until a tap; offer one.
    r.on(LK.RoomEvent.AudioPlaybackStatusChanged, function () {
      show(el.sound, phase === 'live' && !r.canPlaybackAudio);
    });
    return r.connect(client.url, client.token).then(function () {
      return r.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true
      });
    }).then(function (publication) {
      var mic = publication && publication.audioTrack;
      if (mic) meters.you = meter(mic);
      return r.startAudio().catch(function () {});
    }).then(function () {
      show(el.sound, !r.canPlaybackAudio);
    });
  }

  function start() {
    if (phase !== 'ready') return;
    problem(null);
    setPhase('starting');
    var micCheck = mock ? Promise.resolve() :
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        stream.getTracks().forEach(function (t) { t.stop(); });
      });
    micCheck.then(function () {
      return mint().then(function (minted) {
        if (minted.problem) throw minted.problem;
        if (mock) { mockRun = runMock(); return; }
        return join(minted.client);
      }, function () { throw 'failed'; });
    }, function () { throw 'microphone'; }).then(goLive, function (reason) {
      if (room) { var r = room; room = null; r.disconnect(); }
      ended();
      problem(typeof reason === 'string' ? reason : 'failed');
      setPhase(reason === 'used_up' || reason === 'missing' ? 'blocked' : 'ready');
    });
  }

  el.start.addEventListener('click', start);
  el.end.addEventListener('click', stop);
  el.mute.addEventListener('click', function () {
    var muting = el.mute.getAttribute('aria-pressed') !== 'true';
    el.mute.setAttribute('aria-pressed', muting ? 'true' : 'false');
    el.mute.textContent = muting ? 'Unmute' : 'Mute';
    orb.muted = muting;
    if (room) room.localParticipant.setMicrophoneEnabled(!muting).catch(function () {});
  });
  el.sound.addEventListener('click', function () {
    if (room) room.startAudio().then(function () { show(el.sound, !room.canPlaybackAudio); }, function () {});
  });
  window.addEventListener('pagehide', function () { if (room) room.disconnect(); });

  // ---------------------------------------------------------------------------
  // Opening: does the link still work?
  // ---------------------------------------------------------------------------
  function open() {
    if (!token) { problem('missing'); setPhase('blocked'); return; }
    if (mock) {
      setPhase(mock === 'used' ? 'blocked' : 'ready');
      if (mock === 'used') problem('used_up');
      return;
    }
    fetch(API + '?token=' + encodeURIComponent(token), { headers: { accept: 'application/json' } })
      .then(function (response) {
        if (response.status === 404) { problem('missing'); setPhase('blocked'); return; }
        return response.json().then(function (body) {
          var left = body && body.ok && body.result ? body.result.sessionsLeft : null;
          if (left === 0) { problem('used_up'); setPhase('blocked'); return; }
          setPhase('ready');
        });
      })
      .catch(function () { setPhase('ready'); });
  }

  // ---------------------------------------------------------------------------
  // ?mock=1: made-up voices, taking turns
  // ---------------------------------------------------------------------------
  var mockRun = null;
  function runMock() {
    var t0 = performance.now(), live = true;
    meters.ai = { read: function () {
      var t = (performance.now() - t0) / 1000, turn = t % 12;
      if (turn > 6.5) return 0;
      var words = Math.max(0, Math.sin(t * 7.3) * 0.6 + Math.sin(t * 3.1 + 1) * 0.4);
      return Math.min(1, 0.25 + words * 0.6);
    }, spectrum: function () {}, stop: function () {} };
    meters.you = { read: function () {
      var t = (performance.now() - t0) / 1000, turn = t % 12;
      if (turn < 7 || turn > 11.5) return 0.02;
      return Math.min(1, 0.3 + Math.max(0, Math.sin(t * 6.1) * 0.5 + Math.sin(t * 2.3) * 0.3));
    }, spectrum: function (out) {
      var t = performance.now() / 1000;
      for (var i = 0; i < out.length; i++) {
        var pos = 0.5 - 0.5 * Math.cos((i / out.length) * Math.PI * 2);
        out[i] = Math.max(0, 0.9 - pos * 0.8 + 0.25 * Math.sin(t * 9 + i * 0.7));
      }
    }, stop: function () {} };
    return { stop: function () {
      if (!live) return;
      live = false;
      mockRun = null;
      ended();
    } };
  }

  open();
})();
