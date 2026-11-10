// Shared form handler. Any <form data-lead="FORM_ID"> posts its named fields
// to /api/lead as JSON, then swaps in a success message on success.
// Optional attributes: data-success (message), data-success-note (second line),
// data-redirect (go there instead of showing a message), data-sending (button
// label while the request is in flight).
//
// After a successful submission the form fires a cancelable, bubbling
// 'lead:success' event carrying the form id and the name, email and phone it
// was given. A page that wants to carry on from there (the consulting page's
// booking step does) calls preventDefault(), and the redirect and success
// message are skipped.
//
// Also pushes GA4 events to dataLayer (picked up by a GTM GA4 Event tag) —
// generate_lead on success, lead_form_error on failure. GA4's own Enhanced
// Measurement already sees clicks/scroll/generic form_submit, but it can't
// know whether OUR fetch to /api/lead actually succeeded. A submission the
// server caught as a bot comes back as a success with stored: false; the
// visitor sees the same page either way, but it is not counted as a lead.
// generate_lead also carries the CRM's id for the lead (event_id) when
// /api/lead passes one back, so the same lead reported from the CRM's side
// can be matched to this one.
//
// generate_lead also carries user_data for Google Ads enhanced conversions:
// the form's email address, hashed in this browser (SHA-256, lowercase hex)
// the way Google expects. Only the hash goes to dataLayer, never the address
// itself. The phone number is never sent, hashed or not: the privacy policy
// promises mobile numbers are not shared for marketing. If hashing is
// unavailable or fails, user_data is left out; it never costs or holds up the
// lead.
(function () {
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function pushEvent(name, formId, eventId, userData) {
    var event = {
      event: name,
      form_id: formId || '',
      page_path: window.location.pathname,
    };
    if (eventId) event.event_id = eventId;
    if (userData) event.user_data = userData;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);
  }

  function sha256(value) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then(function (buffer) {
      return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
        return ('0' + byte.toString(16)).slice(-2);
      }).join('');
    });
  }

  // Google's normalisation: trimmed and lower-cased, and for Gmail addresses
  // without the dots before the @. Anything that is not an address gives ''.
  function normalEmail(value) {
    var email = String(value || '').trim().toLowerCase();
    if (!EMAIL.test(email)) return '';
    var parts = email.split('@');
    if (parts[1] === 'gmail.com' || parts[1] === 'googlemail.com') parts[0] = parts[0].replace(/\./g, '');
    return parts[0] + '@' + parts[1];
  }

  // Resolves to user_data holding the email hash, or to null when there is
  // none. It never rejects.
  async function hashedUserData(data) {
    try {
      if (!window.crypto || !crypto.subtle || !window.TextEncoder) return null;
      var email = normalEmail(data.email);
      return email ? { sha256_email_address: await sha256(email) } : null;
    } catch (e) {
      return null;
    }
  }

  // Honeypot: a field real users never see or fill in, since it's named to
  // look plausible to bots but hidden from sighted users and screen readers.
  // Bots that auto-fill every field trip it; server rejects if it's non-empty.
  function addHoneypot(form) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;';
    wrap.setAttribute('aria-hidden', 'true');
    var input = document.createElement('input');
    input.type = 'text';
    input.name = 'website_url';
    input.tabIndex = -1;
    input.autocomplete = 'off';
    wrap.appendChild(input);
    form.appendChild(wrap);
    form.dataset.renderedAt = String(Date.now());
  }

  function wire(form) {
    addHoneypot(form);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]') || form.querySelector('button');
      var orig = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = form.getAttribute('data-sending') || 'Sending...'; }
      var data = Object.fromEntries(new FormData(form).entries());
      data.formId = form.getAttribute('data-lead');
      data.renderedAt = form.dataset.renderedAt;
      // The page the form was filled in on, without its query string or hash.
      data.sourceUrl = location.origin + location.pathname;
      // Set by /visits.js: the CRM attaches this browser's page visits, and the
      // campaign it landed with, to the contact the form creates.
      if (window.crmVisitor) {
        data.visitorId = window.crmVisitor.id;
        data.utm = window.crmVisitor.utm;
      }
      // Hashed while the request is in flight, so it is ready by the time the
      // answer comes back.
      var hashing = hashedUserData(data);
      try {
        var res = await fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('bad status ' + res.status);
        var result = null;
        try { result = await res.json(); } catch (e) {}
        if (!(result && result.stored === false)) {
          var eventId = result && typeof result.eventId === 'string' && UUID.test(result.eventId) ? result.eventId : '';
          pushEvent('generate_lead', data.formId, eventId, await hashing);
        }
        var next = new CustomEvent('lead:success', {
          bubbles: true,
          cancelable: true,
          detail: {
            formId: data.formId,
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            heardAbout: data.heard_about || ''
          }
        });
        if (!form.dispatchEvent(next)) return;
        var redirect = form.getAttribute('data-redirect');
        if (redirect) { window.location.href = redirect; return; }
        var msg = form.getAttribute('data-success') || "You're in.";
        var note = form.getAttribute('data-success-note') || '';
        form.innerHTML =
          '<p style="font-family:var(--display);font-weight:600;font-size:1.15rem;color:var(--accent);margin:6px 0">' + msg + '</p>' +
          (note ? '<p style="color:var(--muted);margin:0">' + note + '</p>' : '');
      } catch (err) {
        pushEvent('lead_form_error', data.formId);
        if (btn) { btn.disabled = false; btn.textContent = orig; }
        alert('Something went wrong. Please try again.');
      }
    });
  }
  document.querySelectorAll('form[data-lead]').forEach(wire);
})();
