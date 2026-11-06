// Booking on the site's own pages. The CRM keeps the calendar: this script asks
// it for the open times and questions of one booking type, draws them here,
// and sends the booking back to it. The CRM checks the slot again, finds or
// creates the contact, books the meeting and answers with the address of this
// site's /booked page, which counts the booking for analytics exactly as it
// does for the CRM's own booking page.
//
//   MMBooking.mount(element, {
//     slug: 'coaching-discovery',            // the CRM booking type
//     prefill: { name, email, phone, answers }, // optional, from an earlier form
//     notes: false,                          // hide the closing notes box
//     skip: ['heard_about'],                 // optional questions already asked
//     button: 'btn btn-primary'              // classes for the confirm button
//   });
//
// The closing notes box asks "Anything to prepare?" unless NOTES below gives
// the booking type its own question. The CRM keeps no wording for that box.
//
// Times are shown in the visitor's own time zone. The visitor key from
// /visits.js goes along with the booking, so the pages this browser visited
// become the contact's history. Choosing a time pushes one booking_click to
// Tag Manager, the same event a click on a /book/ link sends. On a referral
// partner page (/partner, served at /p/<code>), the partner's code goes along
// too, once the CRM has confirmed it (window.crmPartner).
//
// If the CRM can't be reached, the step says so and links to the CRM's own
// booking page for the same type, so nobody is left without a way to book.
//
// On a page that loads this script, a click on any /book/<slug> link opens
// the same booking step in a window over the page instead of leaving the
// site. /visits.js has already counted that click as a booking_click, so the
// window does not count it again. A click with a modifier key, or one this
// script can't handle, follows the link as before.
(function () {
  var API = 'https://coaching-crm-tau.vercel.app/api/book/';
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var PHONE = /^\+[0-9]{8,15}$/;
  var SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var NOTES = {
    'podcast-guesting-strategy': { label: 'Do you have any thoughts or concerns about podcast guesting you want to share?', required: true }
  };
  var uid = 0;

  var CSS = [
    '.mmb{--mmb-ink:var(--ink,#0c1a24);--mmb-text:var(--text,#3a4651);--mmb-muted:var(--muted,#5f6b76);',
    '--mmb-line:var(--line,var(--hair,rgba(127,127,127,.35)));--mmb-accent:var(--accent,#38b6ff);',
    '--mmb-on-accent:var(--accent-ink,#0c1a24);--mmb-r:var(--r,0px);display:grid;grid-template-columns:minmax(0,1fr);gap:22px;text-align:left;color:var(--mmb-text);min-width:0}',
    '.mmb>*{min-width:0}',
    '.mmb [hidden]{display:none!important}',
    '.mmb-meta{margin:0;font-size:14px;color:var(--mmb-muted)}',
    '.mmb-label{margin:0 0 10px;font-family:var(--font-head,inherit);font-weight:700;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--mmb-ink)}',
    '.mmb-days{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scrollbar-width:thin}',
    '.mmb-day,.mmb-time{font:inherit;cursor:pointer;background:transparent;color:var(--mmb-ink);border:1px solid var(--mmb-line);border-radius:var(--mmb-r);transition:border-color .15s,background-color .15s}',
    '.mmb-day{flex:none;min-width:76px;padding:10px 12px;display:grid;gap:2px;text-align:center}',
    '.mmb-day b{font-weight:500;font-size:13px;color:var(--mmb-muted)}',
    '.mmb-day span{font-family:var(--font-head,inherit);font-size:15px;font-weight:600}',
    '.mmb-times{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px}',
    '.mmb-time{min-height:46px;padding:10px;font-family:var(--font-head,inherit);font-size:15px;font-weight:600}',
    '.mmb-day:hover,.mmb-time:hover{border-color:var(--mmb-accent)}',
    '.mmb-day[aria-pressed=true],.mmb-time[aria-pressed=true]{background:var(--mmb-accent);border-color:var(--mmb-accent);color:var(--mmb-on-accent)}',
    '.mmb-day[aria-pressed=true] b{color:inherit}',
    '.mmb-day:focus-visible,.mmb-time:focus-visible,.mmb-form :focus-visible{outline:2px solid var(--mmb-accent);outline-offset:2px}',
    '.mmb-form{display:grid;gap:14px;padding-top:22px;border-top:1px solid var(--mmb-line)}',
    '.mmb-picked{margin:0;font-family:var(--font-head,inherit);font-weight:700;color:var(--mmb-ink)}',
    '.mmb-who{margin:0;font-size:15px}',
    '.mmb-who button{font:inherit;background:none;border:0;padding:0;margin-left:6px;color:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer}',
    '.mmb-field{display:grid;gap:6px}',
    '.mmb-field>span{font-size:14px;font-weight:500;color:var(--mmb-ink)}',
    '.mmb-field small{font-size:13px;color:var(--mmb-muted)}',
    '.mmb-field input:not([type=checkbox]),.mmb-field select,.mmb-field textarea{width:100%;box-sizing:border-box;font:inherit;font-size:16px;color:var(--mmb-ink);background:transparent;border:1px solid var(--mmb-line);border-radius:var(--mmb-r);padding:12px 14px}',
    '.mmb-field select option{color:#0c1a24;background:#fff}',
    '.mmb-field textarea{min-height:88px;resize:vertical}',
    '.mmb-check{display:flex;gap:10px;align-items:flex-start;font-size:15px}',
    '.mmb-field[data-invalid] input,.mmb-field[data-invalid] select,.mmb-field[data-invalid] textarea{border-color:#d4513d}',
    '.mmb-error{margin:0;font-size:14px;color:#d4513d}',
    '.mmb-status{margin:0;font-size:15px;color:var(--mmb-ink)}',
    '.mmb-status:empty{display:none}',
    '.mmb-status a{color:inherit;text-decoration:underline;text-underline-offset:3px}',
    '.mmb-submit{justify-self:start}',
    '.mmb-head{display:grid;gap:6px;padding-right:40px}',
    '.mmb-head h2{margin:0;font-family:var(--font-head,inherit);font-size:24px;line-height:1.2;color:var(--mmb-ink)}',
    '.mmb-head p{margin:0;font-size:15px}',
    '.mmb-dialog{position:fixed;inset:0;margin:auto;width:min(640px,calc(100vw - 32px));height:fit-content;max-height:calc(100dvh - 48px);overflow:auto;box-sizing:border-box;padding:32px;',
    'border:1px solid var(--line,var(--hair,rgba(127,127,127,.35)));border-radius:var(--r,0px);background:var(--bg,#fff);color:var(--text,#3a4651)}',
    '.mmb-dialog::backdrop{background:rgba(6,14,20,.62)}',
    '.mmb-close{position:absolute;top:16px;right:16px;width:44px;height:44px;display:grid;place-items:center;background:transparent;border:0;cursor:pointer;color:var(--ink,#0c1a24);border-radius:var(--r,0px)}',
    '.mmb-close:focus-visible{outline:2px solid var(--accent,#38b6ff)}',
    '.mmb-close svg{width:18px;height:18px}',
    '@media (max-width:560px){.mmb-dialog{width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;margin:0;padding:24px 16px calc(24px + env(safe-area-inset-bottom,0px));border:0;border-radius:0}}',
    '@media (max-width:560px){.mmb-submit{justify-self:stretch;width:100%}}'
  ].join('');

  function addStyles() {
    if (document.getElementById('mmb-styles')) return;
    var style = document.createElement('style');
    style.id = 'mmb-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (attrs[key] === null || attrs[key] === undefined || attrs[key] === false) return;
      node.setAttribute(key, attrs[key] === true ? '' : attrs[key]);
    });
    if (text) node.textContent = text;
    return node;
  }

  function visitorZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
  }

  // The visitor's calendar date for an instant, as YYYY-MM-DD.
  function dayKey(date, zone) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }

  function fmt(date, zone, options) {
    return new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: zone }, options)).format(date);
  }

  function timeLabel(date, zone) {
    return fmt(date, zone, { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(/\s/g, ' ');
  }

  // Every open slot, regrouped by the visitor's own calendar days.
  function localDays(days, zone) {
    var byDay = {};
    days.forEach(function (day) {
      (day.slots || []).forEach(function (slot) {
        var start = new Date(slot.startsAt);
        if (isNaN(start.getTime())) return;
        var key = dayKey(start, zone);
        (byDay[key] = byDay[key] || []).push({ startsAt: slot.startsAt, start: start });
      });
    });
    return Object.keys(byDay).sort().map(function (key) {
      var slots = byDay[key].sort(function (a, b) { return a.start - b.start; });
      return { key: key, first: slots[0].start, slots: slots };
    });
  }

  function normalPhone(value) {
    return String(value || '').replace(/[\s().-]/g, '');
  }

  function pushBookingClick(slug) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'booking_click',
      booking_type: slug,
      link_url: location.origin + '/book/' + slug,
      page_path: location.pathname
    });
  }

  function mount(root, options) {
    options = options || {};
    var slug = String(options.slug || root.getAttribute('data-booking') || '');
    if (!SLUG.test(slug)) return;
    addStyles();
    var id = 'mmb' + (++uid);
    var zone = visitorZone();
    var prefill = options.prefill || {};
    var known = EMAIL.test(String(prefill.email || '').trim()) && String(prefill.name || '').trim().length > 0;
    var fallback = '/book/' + slug;
    var state = { days: [], day: null, slot: null, fields: [], answers: {}, clicked: false, busy: false };
    Object.keys(prefill.answers || {}).forEach(function (key) {
      if (prefill.answers[key] !== '' && prefill.answers[key] !== null && prefill.answers[key] !== undefined) state.answers[key] = prefill.answers[key];
    });
    var prefilledKeys = Object.keys(state.answers).concat(options.skip || []);

    root.innerHTML = '';
    var box = el('div', { class: 'mmb' });
    var head = el('div', { class: 'mmb-head', hidden: true });
    var meta = el('p', { class: 'mmb-meta' }, 'Loading open times...');
    var dayWrap = el('div', { hidden: true });
    var dayLabel = el('p', { class: 'mmb-label', id: id + '-days' }, 'Pick a day');
    var dayList = el('div', { class: 'mmb-days', role: 'group', 'aria-labelledby': id + '-days' });
    var timeWrap = el('div', { hidden: true });
    var timeLabelEl = el('p', { class: 'mmb-label', id: id + '-times' }, 'Pick a time');
    var timeList = el('div', { class: 'mmb-times', role: 'group', 'aria-labelledby': id + '-times' });
    var form = el('form', { class: 'mmb-form', hidden: true, novalidate: true });
    var status = el('p', { class: 'mmb-status', role: 'status', 'aria-live': 'polite' });
    dayWrap.append(dayLabel, dayList);
    timeWrap.append(timeLabelEl, timeList);
    box.append(head, meta, dayWrap, timeWrap, form, status);
    root.appendChild(box);

    function say(message, withFallback) {
      status.textContent = message;
      if (withFallback) {
        status.append(' ');
        // Marked external so this script's own /book/ link handler lets it
        // through to the CRM's booking page instead of reopening the window.
        status.appendChild(el('a', { href: fallback, 'data-booking-external': true }, 'Open the booking calendar'));
        status.append('.');
      }
    }

    function load(keepStatus) {
      if (!keepStatus) say('');
      return fetch(API + slug, { headers: { Accept: 'application/json' } })
        .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
        .then(function (answer) {
          if (!answer.ok || !answer.body || !answer.body.ok) throw new Error('unavailable');
          var view = answer.body.result;
          state.fields = Array.isArray(view.intakeFields) ? view.intakeFields : [];
          state.days = localDays(Array.isArray(view.days) ? view.days : [], zone);
          if (options.title && view.type) {
            head.innerHTML = '';
            head.append(el('h2', { id: id + '-title' }, view.type.name));
            if (view.type.description) head.append(el('p', {}, view.type.description));
            head.hidden = false;
            if (options.onTitle) options.onTitle(id + '-title');
          }
          var minutes = view.type && view.type.durationMinutes;
          meta.textContent = (minutes ? minutes + ' minutes · ' : '') + 'times in your time zone (' + zone.replace(/_/g, ' ') + ')';
          if (state.days.length === 0) {
            dayWrap.hidden = true;
            timeWrap.hidden = true;
            form.hidden = true;
            say('No open times right now.', true);
            return;
          }
          var keep = state.days.filter(function (d) { return state.day && d.key === state.day.key; })[0];
          drawDays(keep || state.days[0]);
        })
        .catch(function () {
          meta.textContent = '';
          say("The calendar didn't load here.", true);
        });
    }

    function drawDays(selected) {
      state.day = selected;
      dayList.innerHTML = '';
      state.days.forEach(function (day) {
        var button = el('button', { type: 'button', class: 'mmb-day', 'aria-pressed': day === selected ? 'true' : 'false' });
        button.append(el('b', {}, fmt(day.first, zone, { weekday: 'short' })), el('span', {}, fmt(day.first, zone, { month: 'short', day: 'numeric' })));
        button.addEventListener('click', function () { drawDays(day); });
        dayList.appendChild(button);
      });
      dayWrap.hidden = false;
      drawTimes();
    }

    function drawTimes() {
      timeList.innerHTML = '';
      var stillOpen = state.slot && state.day.slots.some(function (s) { return s.startsAt === state.slot.startsAt; });
      if (!stillOpen) state.slot = null;
      state.day.slots.forEach(function (slot) {
        var pressed = state.slot && state.slot.startsAt === slot.startsAt;
        var button = el('button', { type: 'button', class: 'mmb-time', 'aria-pressed': pressed ? 'true' : 'false' }, timeLabel(slot.start, zone));
        button.addEventListener('click', function () { pick(slot); });
        timeList.appendChild(button);
      });
      timeWrap.hidden = false;
      if (!state.slot) form.hidden = true;
    }

    function pick(slot) {
      state.slot = slot;
      if (!state.clicked) { state.clicked = true; if (options.countClick !== false) pushBookingClick(slug); }
      drawTimes();
      drawForm();
      say('');
      var picked = form.querySelector('.mmb-picked');
      if (picked && picked.scrollIntoView) picked.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function field(key, labelText, control, help) {
      var wrap = el('label', { class: 'mmb-field', 'data-key': key });
      wrap.append(el('span', {}, labelText));
      if (help) wrap.append(el('small', {}, help));
      wrap.append(control);
      return wrap;
    }

    function isShown(f) {
      return !f.showWhen || state.answers[f.showWhen.fieldKey] === f.showWhen.option;
    }

    function answerControl(f) {
      var name = id + '-' + f.key;
      var value = state.answers[f.key];
      var control;
      if (f.fieldType === 'single_select') {
        control = el('select', { name: name, required: f.required });
        control.append(el('option', { value: '' }, 'Choose...'));
        (f.options || []).forEach(function (o) {
          control.append(el('option', { value: o.key, selected: value === o.key }, o.label));
        });
        control.addEventListener('change', function () { setAnswer(f.key, control.value || undefined); drawQuestions(); });
      } else if (f.fieldType === 'multi_select') {
        control = el('div', { role: 'group' });
        (f.options || []).forEach(function (o) {
          var tick = el('input', { type: 'checkbox', value: o.key, checked: Array.isArray(value) && value.indexOf(o.key) >= 0 });
          tick.addEventListener('change', function () {
            var chosen = Array.prototype.filter.call(control.querySelectorAll('input:checked'), function () { return true; }).map(function (i) { return i.value; });
            setAnswer(f.key, chosen.length ? chosen : undefined);
          });
          var line = el('label', { class: 'mmb-check' });
          line.append(tick, document.createTextNode(o.label));
          control.append(line);
        });
      } else if (f.fieldType === 'boolean') {
        control = el('input', { type: 'checkbox', checked: value === true });
        control.addEventListener('change', function () { setAnswer(f.key, control.checked ? true : undefined); });
      } else if (f.fieldType === 'long_text') {
        control = el('textarea', { name: name, rows: '3', maxlength: '5000', required: f.required });
        control.value = typeof value === 'string' ? value : '';
        control.addEventListener('input', function () { setAnswer(f.key, control.value.trim() || undefined); });
      } else {
        var type = { email: 'email', phone: 'tel', number: 'number', date: 'date' }[f.fieldType] || 'text';
        control = el('input', { type: type, name: name, required: f.required, maxlength: type === 'text' ? '5000' : null });
        control.value = value === undefined ? '' : String(value);
        control.addEventListener('input', function () {
          var raw = control.value.trim();
          if (!raw) return setAnswer(f.key, undefined);
          setAnswer(f.key, f.fieldType === 'number' ? Number(raw) : raw);
        });
      }
      return control;
    }

    function setAnswer(key, value) {
      if (value === undefined) delete state.answers[key]; else state.answers[key] = value;
    }

    var questions = el('div', { style: 'display:grid;gap:14px' });

    function drawQuestions() {
      questions.innerHTML = '';
      state.fields.forEach(function (f) {
        if (!isShown(f)) return;
        // A question the visitor already answered on the form before this
        // step is not asked twice. Only an optional one may be skipped.
        if (prefilledKeys.indexOf(f.key) >= 0 && (!f.required || state.answers[f.key] !== undefined)) return;
        var labelText = f.label + (f.required ? '' : ' (optional)');
        var node = f.fieldType === 'boolean'
          ? (function () { var line = el('label', { class: 'mmb-check mmb-field', 'data-key': f.key }); line.append(answerControl(f), document.createTextNode(labelText)); return line; })()
          : field(f.key, labelText, answerControl(f), f.helpText);
        questions.appendChild(node);
      });
    }

    var nameInput, emailInput, phoneInput, notesInput;

    function drawForm() {
      // Already drawn: keep what was typed, and only change the time shown.
      if (form.childNodes.length) {
        form.querySelector('.mmb-picked').textContent = pickedText();
        form.hidden = false;
        return;
      }
      form.innerHTML = '';
      form.append(el('p', { class: 'mmb-picked' }, pickedText()));

      nameInput = el('input', { type: 'text', name: 'name', autocomplete: 'name', maxlength: '120', required: true });
      emailInput = el('input', { type: 'email', name: 'email', autocomplete: 'email', maxlength: '320', required: true });
      phoneInput = el('input', { type: 'tel', name: 'phone', autocomplete: 'tel', placeholder: '+1 416 555 0100' });
      nameInput.value = prefill.name || '';
      emailInput.value = prefill.email || '';
      phoneInput.value = prefill.phone || '';
      var nameField = field('name', 'Name', nameInput);
      var emailField = field('email', 'Email', emailInput);
      if (known) {
        nameField.hidden = true;
        emailField.hidden = true;
        var who = el('p', { class: 'mmb-who' }, 'Booking as ' + prefill.name + ' (' + prefill.email + ').');
        var change = el('button', { type: 'button' }, 'Change');
        change.addEventListener('click', function () { who.hidden = true; nameField.hidden = false; emailField.hidden = false; nameInput.focus(); });
        who.append(change);
        form.append(who);
      }
      form.append(nameField, emailField, field('phone', 'Phone (optional)', phoneInput, 'Include the country code. Used only for reminders about this call.'));
      drawQuestions();
      form.append(questions);
      if (options.notes !== false) {
        var notesAsk = NOTES[slug] || { label: 'Anything to prepare?', required: false };
        notesInput = el('textarea', { name: 'notes', rows: '3', maxlength: '2000', required: notesAsk.required });
        form.append(field('notes', notesAsk.label + (notesAsk.required ? '' : ' (optional)'), notesInput));
      }
      var submit = el('button', { type: 'submit', class: 'mmb-submit ' + (options.button || 'btn btn-primary') }, 'Confirm booking');
      form.append(submit);
      form.hidden = false;
    }

    function pickedText() {
      return fmt(state.slot.start, zone, { weekday: 'long', month: 'long', day: 'numeric' }) + ' at ' + timeLabel(state.slot.start, zone);
    }

    function mark(key, message) {
      var wrap = form.querySelector('[data-key="' + key + '"]');
      if (!wrap) return false;
      wrap.hidden = false;
      wrap.setAttribute('data-invalid', '');
      var note = el('p', { class: 'mmb-error' }, message);
      wrap.appendChild(note);
      var input = wrap.querySelector('input,select,textarea');
      if (input) input.focus();
      return true;
    }

    function clearMarks() {
      Array.prototype.forEach.call(form.querySelectorAll('[data-invalid]'), function (n) { n.removeAttribute('data-invalid'); });
      Array.prototype.forEach.call(form.querySelectorAll('.mmb-error'), function (n) { n.remove(); });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (state.busy || !state.slot) return;
      clearMarks();
      say('');
      var name = nameInput.value.trim();
      var email = emailInput.value.trim();
      var phone = normalPhone(phoneInput.value);
      if (!name) return void mark('name', 'Add your name.');
      if (!EMAIL.test(email)) return void mark('email', 'Add a working email address.');
      if (phone && !PHONE.test(phone)) return void mark('phone', 'Use the full number with the country code, like +1 416 555 0100.');
      var missing = state.fields.filter(function (f) {
        if (!f.required || !isShown(f)) return false;
        var v = state.answers[f.key];
        return v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
      })[0];
      if (missing && mark(missing.key, 'This one is needed.')) return;
      if (notesInput && notesInput.required && !notesInput.value.trim()) return void mark('notes', 'This one is needed.');

      var answers = {};
      state.fields.forEach(function (f) {
        if (isShown(f) && state.answers[f.key] !== undefined) answers[f.key] = state.answers[f.key];
      });
      var notes = notesInput ? notesInput.value.trim() : '';
      var body = {
        startsAt: state.slot.startsAt,
        name: name,
        email: email,
        phone: phone || null,
        notes: notes || null,
        answers: answers,
        visitorId: window.crmVisitor && window.crmVisitor.id ? window.crmVisitor.id : null
      };
      // A partner page (/p/<code>) sets crmPartner once the CRM has confirmed the
      // code. No other page sets it, so their bookings send what they always did.
      if (typeof window.crmPartner === 'string' && window.crmPartner) body.partner = window.crmPartner;
      var submit = form.querySelector('.mmb-submit');
      state.busy = true;
      submit.disabled = true;
      submit.textContent = 'Booking...';
      fetch(API + slug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
        .then(function (answer) {
          var data = answer.data || {};
          if (data.ok && data.result) {
            if (data.result.redirectUrl) {
              say('Booked. Opening your confirmation...');
              window.location.assign(data.result.redirectUrl);
              return;
            }
            box.innerHTML = '';
            box.append(el('p', { class: 'mmb-picked' }, "You're booked for " + pickedText() + '.'), el('p', { class: 'mmb-meta' }, 'The confirmation is on its way to ' + email + '.'));
            return;
          }
          state.busy = false;
          submit.disabled = false;
          submit.textContent = 'Confirm booking';
          if (data.error === 'booking_slot_unavailable') {
            say('That time was just taken. Pick another one.');
            state.slot = null;
            form.hidden = true;
            load(true);
          } else if (data.error === 'booking_answer_rejected' && data.fieldKey && mark(data.fieldKey, 'Check this answer.')) {
            // marked
          } else if (data.error === 'rate_limited') {
            say('Too many tries in a row. Wait a few minutes and try again.');
          } else if (data.error === 'invalid_input') {
            say('Something in the details was not accepted. Check them and try again.');
          } else {
            say("The booking didn't go through.", true);
          }
        })
        .catch(function () {
          state.busy = false;
          submit.disabled = false;
          submit.textContent = 'Confirm booking';
          say("The booking didn't go through.", true);
        });
    });

    load();
  }

  // The booking step in a window over the page. One window is reused.
  var dialog = null;
  var opener = null;

  function open(slug, options) {
    if (!SLUG.test(slug) || typeof HTMLDialogElement !== 'function') return false;
    addStyles();
    if (!dialog) {
      dialog = el('dialog', { class: 'mmb-dialog' });
      var close = el('button', { type: 'button', class: 'mmb-close', 'aria-label': 'Close' });
      close.innerHTML = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14"/></svg>';
      close.addEventListener('click', function () { dialog.close(); });
      dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
      dialog.addEventListener('close', function () {
        document.documentElement.style.overflow = '';
        if (opener && opener.focus) opener.focus();
      });
      dialog.append(close, el('div', { class: 'mmb-dialog-body' }));
      document.body.appendChild(dialog);
    }
    opener = document.activeElement;
    var body = dialog.querySelector('.mmb-dialog-body');
    dialog.removeAttribute('aria-labelledby');
    mount(body, Object.assign({ slug: slug, title: true, onTitle: function (titleId) { dialog.setAttribute('aria-labelledby', titleId); } }, options || {}));
    document.documentElement.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    return true;
  }

  window.MMBooking = { mount: mount, open: open };

  // Same-site /book/<slug> links open the window. visits.js counted the click.
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var node = event.target && event.target.nodeType === 1 ? event.target : event.target && event.target.parentElement;
    var link = node && node.closest ? node.closest('a[href]') : null;
    if (!link || link.hasAttribute('data-booking-external') || (link.target && link.target !== '_self')) return;
    var url;
    try { url = new URL(link.getAttribute('href'), location.href); } catch (e) { return; }
    var match = url.origin === location.origin && url.pathname.match(/^\/book\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
    if (!match) return;
    if (open(match[1], { countClick: false })) event.preventDefault();
  });

  function auto() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-booking]:not([data-booking-manual])'), function (node) { mount(node); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
