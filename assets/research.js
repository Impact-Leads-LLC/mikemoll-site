// The research call page (/research). Podcast guests pick who they talk to:
// Mike, on a 10-minute Zoom call booked through the CRM (the booking step from
// /assets/booking.js, booking type research-call, no phone field), or the AI
// interviewer. The chosen step opens under the two choices; switching back and
// forth keeps what was typed.
//
// The AI interviewer is a small form here: name, email, two optional boxes,
// then "Start now" or "Pick a time". It posts to the CRM:
//
//   POST https://coaching-crm-tau.vercel.app/api/research/ai
//   { when: 'now'|'later', name, email, wantsUpdates, wantsReport,
//     startsAt (later only: ISO with the visitor's own offset),
//     timeZone (the browser's zone), visitorId (only when /visits.js set one) }
//
// and the CRM answers { ok: true, result: { callUrl } }. "now" goes straight
// to callUrl (www.mikemoll.co/research/call/<token>, which vercel.json
// rewrites to research-call.html, the call screen on this site). "later" shows
// the confirmation here; the link goes out by email. A later time is 08:00 to
// 21:00 in the visitor's own time zone, within the next 14 days, as the CRM
// checks too. Name and email are checked here first. Any error is one plain
// line, and the form stays filled.
//
// ?mock=1 fakes a success without calling the CRM, so the page can be checked
// before the CRM route exists. ?mock=fail fakes a failed request.
(function () {
  var API = 'https://coaching-crm-tau.vercel.app/api/research/ai';
  var CALL_HOSTS = ['https://www.mikemoll.co', 'https://coaching-crm-tau.vercel.app'];
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var DAYS_AHEAD = 14;
  var FIRST_MINUTE = 8 * 60;  // 08:00
  var LAST_MINUTE = 21 * 60;  // 21:00
  var DAY_MS = 24 * 60 * 60 * 1000;

  var mock = null;
  try { mock = new URLSearchParams(location.search).get('mock'); } catch (e) {}

  var choose = document.querySelector('.choose');
  var stepMike = document.getElementById('step-mike');
  var stepAi = document.getElementById('step-ai');
  if (!choose || !stepMike || !stepAi) return;

  function zone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
  }

  // ---- The two choices --------------------------------------------------------
  var mounted = false;

  function mountBooking() {
    if (mounted) return;
    mounted = true;
    var cal = stepMike.querySelector('.cal');
    if (window.MMBooking && window.MMBooking.mount) {
      window.MMBooking.mount(cal, { slug: 'research-call', notes: false, button: 'btn btn-primary', phone: false });
    } else {
      // booking.js did not load: the CRM's own booking page still works.
      var line = document.createElement('p');
      line.className = 'rstatus';
      line.textContent = "The calendar didn't load here. ";
      var link = document.createElement('a');
      link.href = '/book/research-call';
      link.setAttribute('data-booking-external', '');
      link.className = 'tlink';
      link.textContent = 'Open the booking calendar';
      line.appendChild(link);
      cal.appendChild(line);
    }
  }

  // The step opens under the choices. When its start is below the fold (a
  // phone), the page scrolls the chosen option to the top, so the choice and
  // the start of its step are both on screen. The page's own scroll-behavior
  // (none for reduced motion) applies.
  function reveal(step, option) {
    var top = step.getBoundingClientRect().top;
    if (top > window.innerHeight - 200 && option && option.scrollIntoView) option.scrollIntoView({ block: 'start' });
  }

  function show(input, scroll) {
    var who = input.value;
    var step = who === 'mike' ? stepMike : stepAi;
    var other = who === 'mike' ? stepAi : stepMike;
    other.hidden = true;
    step.hidden = false;
    if (who === 'mike') mountBooking();
    if (scroll) reveal(step, input.closest('.opt'));
  }

  choose.addEventListener('change', function (event) {
    var input = event.target;
    if (input && input.name === 'who' && input.checked) show(input, true);
  });
  // A choice kept by the browser (back button, restored form) opens its step.
  var kept = choose.querySelector('input[name="who"]:checked');
  if (kept) show(kept, false);

  // ---- The AI interviewer form --------------------------------------------------
  var form = stepAi.querySelector('form');
  var nameInput = form.elements.name;
  var emailInput = form.elements.email;
  var updatesBox = form.elements.wantsUpdates;
  var reportBox = form.elements.wantsReport;
  var dateInput = form.elements.date;
  var timeInput = form.elements.time;
  var nowButton = form.querySelector('[data-when="now"]');
  var laterButton = form.querySelector('.later [data-when="later"]');
  var pickButton = form.querySelector('[data-pick]');
  var later = form.querySelector('.later');
  var status = form.querySelector('.rstatus');
  var busy = false;
  var uid = 0;

  var here = zone();
  var zoneSlot = form.querySelector('[data-zone]');
  if (zoneSlot && here) zoneSlot.textContent = ' (' + here.replace(/_/g, ' ') + ')';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }

  // The date picker offers today through 14 days ahead, in the visitor's own calendar.
  function setDateRange() {
    var today = new Date();
    dateInput.min = dayKey(today);
    dateInput.max = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + DAYS_AHEAD));
  }
  setDateRange();

  function setLater(open) {
    later.hidden = !open;
    pickButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    // One solid button at a time: with the time picker open, its button is the solid one.
    nowButton.classList.toggle('line', open);
    if (open) setDateRange();
  }

  pickButton.addEventListener('click', function () { setLater(later.hidden); });

  // "2026-11-12" + "15:30" as that moment in the visitor's own time zone.
  function localMoment(day, time) {
    var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || '');
    var t = /^(\d{2}):(\d{2})/.exec(time || '');
    if (!d || !t) return null;
    var date = new Date(+d[1], +d[2] - 1, +d[3], +t[1], +t[2], 0, 0);
    return isNaN(date.getTime()) ? null : { date: date, minute: +t[1] * 60 + +t[2] };
  }

  // ISO 8601 with the visitor's offset: 2026-11-12T15:30:00-05:00
  function isoWithOffset(date) {
    var offset = -date.getTimezoneOffset();
    var sign = offset >= 0 ? '+' : '-';
    var abs = Math.abs(offset);
    return dayKey(date) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':00' +
      sign + pad(Math.floor(abs / 60)) + ':' + pad(abs % 60);
  }

  // "Thursday, November 12 at 3:30 pm", as booking.js writes a time.
  function describe(date) {
    var opts = here ? { timeZone: here } : {};
    var day = new Intl.DateTimeFormat('en-US', Object.assign({ weekday: 'long', month: 'long', day: 'numeric' }, opts)).format(date);
    var time = new Intl.DateTimeFormat('en-US', Object.assign({ hour: 'numeric', minute: '2-digit', hour12: true }, opts)).format(date);
    return day + ' at ' + time.toLowerCase();
  }

  function visitor() {
    var v = window.crmVisitor && window.crmVisitor.id;
    return typeof v === 'string' && UUID.test(v) ? v : null;
  }

  function say(message) { status.textContent = message || ''; }

  function mark(input, message) {
    var wrap = input.closest('.field');
    var note = document.createElement('p');
    note.className = 'err';
    note.id = 'rerr' + (++uid);
    note.textContent = message;
    wrap.setAttribute('data-invalid', '');
    wrap.appendChild(note);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', note.id);
    input.focus();
  }

  function clearMarks() {
    Array.prototype.forEach.call(form.querySelectorAll('[data-invalid]'), function (n) { n.removeAttribute('data-invalid'); });
    Array.prototype.forEach.call(form.querySelectorAll('.err'), function (n) { n.remove(); });
    Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (n) {
      n.removeAttribute('aria-invalid');
      n.removeAttribute('aria-describedby');
    });
  }

  // A marked field loses its mark as soon as it is changed.
  function unmark(event) {
    var input = event.target;
    var wrap = input && input.closest && input.closest('.field[data-invalid]');
    if (!wrap) return;
    wrap.removeAttribute('data-invalid');
    Array.prototype.forEach.call(wrap.querySelectorAll('.err'), function (n) { n.remove(); });
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
  form.addEventListener('input', unmark);
  form.addEventListener('change', unmark);

  function setBusy(on, button, label) {
    busy = on;
    nowButton.disabled = on;
    laterButton.disabled = on;
    pickButton.disabled = on;
    if (on) {
      button.setAttribute('data-label', button.textContent);
      button.textContent = label;
    } else {
      [nowButton, laterButton].forEach(function (b) {
        if (b.hasAttribute('data-label')) { b.textContent = b.getAttribute('data-label'); b.removeAttribute('data-label'); }
      });
    }
  }

  // Only a call page on this site or the CRM is followed.
  function safeCallUrl(value) {
    var url;
    try { url = new URL(String(value || ''), location.href); } catch (e) { return null; }
    var hosts = CALL_HOSTS.concat(location.origin);
    if (hosts.indexOf(url.origin) < 0 || url.pathname.indexOf('/research/call/') !== 0) return null;
    return url.href;
  }

  function send(body) {
    if (mock) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(mock === 'fail'
            ? { status: 500, data: { ok: false, error: 'mock_failure' } }
            : { status: 200, data: { ok: true, result: { callUrl: '/research/call/mock-token' } } });
        }, 700);
      });
    }
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { status: res.status, data: data || {} }; });
    });
  }

  function failLine(data) {
    if (data && data.error === 'rate_limited') return 'Too many tries in a row. Wait a few minutes and try again.';
    if (data && data.error === 'invalid_input') return 'Something in the details was not accepted. Check them and try again.';
    return "That didn't go through. Try again in a minute.";
  }

  function confirmLater(start) {
    var done = document.createElement('div');
    done.className = 'done';
    done.setAttribute('tabindex', '-1');
    var when = document.createElement('p');
    when.className = 'when';
    when.textContent = describe(start);
    var line = document.createElement('p');
    line.textContent = 'Your interview link is in your email.';
    done.append(when, line);
    form.replaceWith(done);
    done.focus({ preventScroll: true });
  }

  function go(when) {
    if (busy) return;
    clearMarks();
    say('');
    var name = nameInput.value.trim();
    var email = emailInput.value.trim();
    if (!name) return void mark(nameInput, 'Add your name.');
    if (!EMAIL.test(email)) return void mark(emailInput, 'Add a working email address.');

    var body = {
      when: when,
      name: name,
      email: email,
      wantsUpdates: updatesBox.checked,
      wantsReport: reportBox.checked
    };
    var start = null;
    if (when === 'later') {
      if (!dateInput.value) return void mark(dateInput, 'Date and time needed.');
      if (!timeInput.value) return void mark(timeInput, 'Date and time needed.');
      var picked = localMoment(dateInput.value, timeInput.value);
      if (!picked) return void mark(dateInput, 'Date and time needed.');
      var now = Date.now();
      if (picked.date.getTime() <= now) return void mark(timeInput, 'That time has passed.');
      if (picked.minute < FIRST_MINUTE || picked.minute > LAST_MINUTE) return void mark(timeInput, '8 a.m. to 9 p.m. only.');
      if (picked.date.getTime() - now > DAYS_AHEAD * DAY_MS) return void mark(dateInput, 'Within the next 14 days only.');
      start = picked.date;
      body.startsAt = isoWithOffset(start);
    }
    if (here) body.timeZone = here;
    var vid = visitor();
    if (vid) body.visitorId = vid;

    var button = when === 'later' ? laterButton : nowButton;
    setBusy(true, button, when === 'later' ? 'Booking...' : 'Starting...');
    send(body).then(function (answer) {
      var data = answer.data || {};
      var target = data.ok && data.result ? safeCallUrl(data.result.callUrl) : null;
      if (!target) {
        setBusy(false);
        say(failLine(data));
        return;
      }
      if (when === 'now') {
        window.location.assign(target);
        return;
      }
      confirmLater(start);
    }).catch(function () {
      setBusy(false);
      say(failLine(null));
    });
  }

  // Back from the call page (the browser's page cache): the buttons work again.
  window.addEventListener('pageshow', function (event) { if (event.persisted && busy) setBusy(false); });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var submitter = event.submitter;
    var when = submitter && submitter.getAttribute('data-when');
    go(when === 'later' || when === 'now' ? when : (later.hidden ? 'now' : 'later'));
  });

  // Enter in a text field picks the step the visitor is on: the time when the
  // time picker is open, otherwise start now.
  form.addEventListener('keydown', function (event) {
    var t = event.target;
    if (event.key !== 'Enter' || !t || t.tagName !== 'INPUT' || t.type === 'checkbox') return;
    event.preventDefault();
    go(later.hidden ? 'now' : 'later');
  });
})();
