/* ==========================================================================
 * CONFIG — the only place to edit after deploying the Apps Script.
 * The token is visible to anyone who views page source: it is a speed bump
 * against drive-by posts, not authentication.
 * ========================================================================== */
var REG_CONFIG = {
  endpoint: 'https://script.google.com/macros/s/AKfycbzgudP9iEpdKOfjFbcbSGy8QJYxQDGclpq62u2v9_Q46kMwpyqOoMZgc06mTDBHVbke/exec',            // Apps Script web app URL, ends in /exec
  token: '042bce7454dd4cf9979aebe24ab4bb39',               // must equal FORM_TOKEN in Script Properties
  timeoutMs: 30000,
  states: {
    Enugu: {
      prefix: 'ENU',
      contact: 'Engr. Dominic Usi on 0906 849 9185 or Ernest on 0703 663 3867',
      dataController: 'Enugu State Ministry of Energy and Mineral Resources'
    },
    Bayelsa: {
      prefix: 'BAY',
      contact: '',         // add a phone number / name for corrections
      dataController: 'Bayelsa State Government Youth Empowerment Scheme'
    }
  }
};

(function () {
  'use strict';
  var R = window.EVReg;
  var body = document.body;
  var STATE = body.getAttribute('data-state');
  if (!STATE || !R) return;           // landing page: nothing to wire up
  var cfg = REG_CONFIG.states[STATE];

  var info = document.getElementById('info');
  var formWrap = document.getElementById('form-wrap');
  var doneWrap = document.getElementById('done-wrap');

  /* ---------- build the form from the shared schema ---------- */

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (attrs[k] == null || attrs[k] === false) continue;
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'className') n.className = attrs[k];
      else n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  function control(f) {
    var id = 'f-' + f.key;
    var common = { id: id, name: f.key, 'aria-describedby': id + '-err' };
    if (f.required) common['aria-required'] = 'true';
    if (f.type === 'select') {
      var opts = [el('option', { value: '', text: f.key === 'lga' ? 'Select LGA' : 'Select' })];
      R.optionsFor(f, STATE).forEach(function (o) { opts.push(el('option', { value: o, text: o })); });
      return el('select', common, opts);
    }
    var a = Object.assign({}, common, { autocomplete: f.autocomplete || 'off' });
    if (f.type === 'tel') Object.assign(a, { type: 'tel', inputmode: 'numeric', maxlength: 18, placeholder: f.placeholder || '080…' });
    else if (f.type === 'nin') Object.assign(a, { type: 'text', inputmode: 'numeric', maxlength: 11, placeholder: '00000000000', className: 'mono' });
    else if (f.type === 'date') Object.assign(a, { type: 'date', max: new Date().toISOString().slice(0, 10), min: '1940-01-01' });
    else if (f.type === 'email') Object.assign(a, { type: 'email', maxlength: f.max });
    else Object.assign(a, { type: 'text', maxlength: f.max });
    return el('input', a);
  }

  function fieldRow(f) {
    var err = el('p', { className: 'field-err', id: 'f-' + f.key + '-err', 'aria-live': 'polite' });
    if (f.type === 'checkbox') {
      return el('div', { className: 'field field-check', 'data-field': f.key }, [
        el('label', { className: 'check' }, [
          el('input', { type: 'checkbox', id: 'f-' + f.key, name: f.key, 'aria-describedby': 'f-' + f.key + '-err', 'aria-required': 'true' }),
          el('span', {}, [f.label + ' ', el('span', { className: 'req', 'aria-hidden': 'true', text: '*' })])
        ]),
        err
      ]);
    }
    var label = f.key === 'lga' ? 'LGA of origin (' + STATE + ')' : f.label;
    return el('div', { className: 'field' + (f.half ? ' half' : ''), 'data-field': f.key }, [
      el('label', { 'for': 'f-' + f.key }, [label, f.required ? el('span', { className: 'req', 'aria-hidden': 'true', text: ' *' }) : null]),
      control(f),
      err
    ]);
  }

  var form = document.getElementById('reg-form');
  var fieldsHost = document.getElementById('fields');
  var sections = {};
  Object.keys(R.SECTIONS).forEach(function (n) {
    var fs = el('fieldset', { className: 'card' }, [el('legend', { text: ('0' + n) + ' · ' + R.SECTIONS[n] })]);
    sections[n] = { fs: fs, grid: el('div', { className: 'grid' }) };
    fs.appendChild(sections[n].grid);
    fieldsHost.appendChild(fs);
  });
  R.FIELDS.forEach(function (f) {
    if (sections[f.section]) sections[f.section].grid.appendChild(fieldRow(f));
    else fieldsHost.appendChild(fieldRow(f));
  });
  document.getElementById('privacy-controller').textContent = cfg.dataController;

  /* ---------- open / close form (same route) ---------- */

  function show(which) {
    info.hidden = which !== 'info';
    formWrap.hidden = which !== 'form';
    doneWrap.hidden = which !== 'done';
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-open-form]').forEach(function (b) {
    b.addEventListener('click', function () { show('form'); var first = form.querySelector('input,select'); if (first) first.focus({ preventScroll: true }); });
  });
  document.getElementById('close-form').addEventListener('click', function () { show('info'); });

  // "Change state" only for trainees who came through the state chooser (landing
  // page sets this flag). Anyone arriving on a state's own link sees only that state.
  try {
    if (sessionStorage.getItem('ev_from_chooser') === '1') document.getElementById('change-state').hidden = false;
  } catch (x) { /* storage blocked: keep it hidden */ }
  if (location.hash === '#register') show('form');

  /* ---------- errors ---------- */

  var banner = document.getElementById('form-banner');
  var submitBtn = document.getElementById('submit-btn');

  function clearErrors() {
    form.querySelectorAll('.field.has-err').forEach(function (n) { n.classList.remove('has-err'); });
    form.querySelectorAll('.field-err').forEach(function (n) { n.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach(function (n) { n.removeAttribute('aria-invalid'); });
    banner.hidden = true; banner.innerHTML = '';
  }

  function showFieldErrors(errors) {
    var first = null;
    R.FIELDS.forEach(function (f) {
      if (!errors[f.key]) return;
      var row = form.querySelector('[data-field="' + f.key + '"]');
      var input = document.getElementById('f-' + f.key);
      row.classList.add('has-err');
      input.setAttribute('aria-invalid', 'true');
      document.getElementById('f-' + f.key + '-err').textContent = errors[f.key];
      if (!first) first = input;
    });
    if (first) { first.focus(); first.scrollIntoView({ block: 'center' }); }
  }

  function showBanner(kind, title, text, withRetry) {
    banner.className = 'banner banner-' + kind;
    banner.innerHTML = '';
    banner.appendChild(el('strong', { text: title }));
    if (text) banner.appendChild(el('p', { text: text }));
    if (withRetry) {
      var retry = el('button', { type: 'button', className: 'btn-retry', text: 'Try again' });
      retry.addEventListener('click', function () { form.requestSubmit ? form.requestSubmit() : submit(); });
      banner.appendChild(retry);
    }
    banner.hidden = false;
    banner.focus();
  }

  function contactLine() {
    return cfg.contact ? 'If your details need changing, contact ' + cfg.contact + '.' : 'If your details need changing, please contact the programme organisers.';
  }

  /* ---------- submit ---------- */

  var inFlight = false;

  function collect() {
    var data = {};
    R.FIELDS.forEach(function (f) {
      var n = form.elements[f.key];
      data[f.key] = f.type === 'checkbox' ? n.checked : n.value;
    });
    return data;
  }

  function setBusy(b) {
    inFlight = b;
    submitBtn.disabled = b;
    submitBtn.textContent = b ? 'Submitting…' : 'Submit registration';
    form.setAttribute('aria-busy', b ? 'true' : 'false');
  }

  function submit(e) {
    if (e) e.preventDefault();
    if (inFlight) return;
    clearErrors();

    var raw = collect();
    var res = R.validate(STATE, raw);
    if (!res.ok) { showFieldErrors(res.errors); return; }

    if (!REG_CONFIG.endpoint) {
      showBanner('error', 'Registration is not open yet.', 'This form has not been connected to the registration sheet. Nothing was saved.', false);
      return;
    }

    setBusy(true);
    var payload = JSON.stringify({
      state: STATE,
      fields: res.values,
      hp: form.elements.website ? form.elements.website.value : '',
      token: REG_CONFIG.token
    });
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, REG_CONFIG.timeoutMs);

    fetch(REG_CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload,
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        var out;
        try { out = JSON.parse(txt); } catch (x) { throw new Error('bad_response'); }
        handle(out, res.values);
      })
      .catch(function () {
        showBanner('error', 'We couldn’t reach the server. Nothing was saved.',
          'Check your connection, then tap “Try again”. Your answers are still filled in.', true);
      })
      .then(function () { clearTimeout(timer); setBusy(false); });
  }

  function handle(out, values) {
    if (out && out.ok) {
      document.getElementById('done-name').textContent = values.full_name;
      document.getElementById('done-id').textContent = out.submissionId;
      form.reset();
      show('done');
      document.getElementById('done-title').focus();
      return;
    }
    switch (out && out.error) {
      case 'validation_failed':
        if (out.fields && Object.keys(out.fields).length) showFieldErrors(out.fields);
        else showBanner('error', 'Some answers need checking.', out.message || 'Please review the form and try again.', false);
        break;
      case 'duplicate_phone':
        showFieldErrors({ phone: 'This phone number is already registered.' });
        showBanner('warn', 'A registration already exists for this phone number.', contactLine(), false);
        break;
      case 'unknown_state':
      case 'bad_token':
        showBanner('error', 'This registration link is misconfigured. Nothing was saved.', 'Please let the programme organisers know' + (cfg.contact ? ': ' + cfg.contact + '.' : '.'), false);
        break;
      default:
        showBanner('error', 'Something went wrong on our side. Nothing was saved.', 'Please tap “Try again” in a moment. Your answers are still filled in.', true);
    }
  }

  form.addEventListener('submit', submit);
})();
