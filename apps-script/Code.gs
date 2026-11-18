/**
 * EV Trainee Registration — Apps Script backend (container-bound to the Sheet).
 *
 * The only thing that writes to the spreadsheet. One POST endpoint for both states.
 *
 * Setup (once):
 *   1. Open the Sheet → Extensions → Apps Script, paste this file (and appsscript.json).
 *   2. Run setup() from the editor and approve the permissions. It creates the
 *      Enugu / Bayelsa / All tabs, headers, Status dropdowns, Lagos timezone, and
 *      stores SPREADSHEET_ID + a random FORM_TOKEN in Script Properties
 *      (the token is printed in the execution log — copy it into site/assets/app.js).
 *   3. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
 *   4. Every code change needs Deploy → Manage deployments → Edit → New version.
 *      Saving alone leaves the old code running at the same URL.
 *
 * KEEP FIELDS IN SYNC with site/assets/fields.js.
 */

/* ===================== schema (mirror of site/assets/fields.js) ===================== */

var LGAS = {
  Enugu: ['Aninri', 'Awgu', 'Enugu East', 'Enugu North', 'Enugu South', 'Ezeagu', 'Igbo Etiti', 'Igbo Eze North', 'Igbo Eze South', 'Isi Uzo', 'Nkanu East', 'Nkanu West', 'Nsukka', 'Oji River', 'Udenu', 'Udi', 'Uzo-Uwani'],
  Bayelsa: ['Brass', 'Ekeremor', 'Kolokuma/Opokuma', 'Nembe', 'Ogbia', 'Sagbama', 'Southern Ijaw', 'Yenagoa']
};
var GENDERS = ['Male', 'Female'];
var EDUCATION = ['Primary (FSLC)', 'Secondary (SSCE/WAEC/NECO)', 'Technical/Vocational (NABTEB)', 'OND / NCE', 'HND / Degree', 'Postgraduate'];
var EXPERIENCE = ['None', 'Less than 1 year', '1–3 years', 'More than 3 years'];

var FIELDS = [
  { key: 'full_name',  header: 'Full Name',          type: 'text',     required: true,  max: 120 },
  { key: 'gender',     header: 'Gender',             type: 'select',   required: true,  options: GENDERS },
  { key: 'dob',        header: 'Date of Birth',      type: 'date',     required: true },
  { key: 'nin',        header: 'NIN',                type: 'nin',      required: true,  text: true },
  { key: 'phone',      header: 'Phone',              type: 'tel',      required: true,  text: true },
  { key: 'whatsapp',   header: 'WhatsApp',           type: 'tel',      required: false, text: true },
  { key: 'email',      header: 'Email',              type: 'email',    required: false, max: 120 },
  { key: 'lga',        header: 'LGA',                type: 'select',   required: true,  options: 'LGA' },
  { key: 'address',    header: 'Address',            type: 'text',     required: true,  max: 300 },
  { key: 'education',  header: 'Highest Education',  type: 'select',   required: true,  options: EDUCATION },
  { key: 'experience', header: 'Experience',         type: 'select',   required: false, options: EXPERIENCE },
  { key: 'kin_name',   header: 'Next of Kin Name',   type: 'text',     required: true,  max: 120 },
  { key: 'kin_phone',  header: 'Next of Kin Phone',  type: 'tel',      required: true,  text: true },
  { key: 'consent',    header: 'Consent',            type: 'checkbox', required: true }
];

// state → tab config. The client's "state" value is only ever used as a key here.
var STATES = {
  Enugu:   { tab: 'Enugu',   prefix: 'ENU', fields: FIELDS },
  Bayelsa: { tab: 'Bayelsa', prefix: 'BAY', fields: FIELDS }
};

var META_HEADERS = ['Submission ID', 'Timestamp', 'State', 'Status'];
var STATUS_OPTIONS = ['New', 'Verified', 'Contacted', 'Rejected'];
var PHONE_RE = /^0[789][01]\d{8}$/;
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
var TZ = 'Africa/Lagos';

/* ===================== validation ===================== */

function normalisePhone(raw) {
  var s = String(raw == null ? '' : raw).replace(/[\s\-().]/g, '');
  if (/^\+234\d{10}$/.test(s)) s = '0' + s.slice(4);
  else if (/^234\d{10}$/.test(s)) s = '0' + s.slice(3);
  return s;
}

function validate(state, fields, input) {
  var errors = {}, values = {};
  input = input || {};
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    var v = input[f.key];
    if (f.type === 'checkbox') {
      var on = v === true || v === 'on' || v === 'true' || v === 'Yes';
      if (f.required && !on) errors[f.key] = 'Please tick this box to continue.';
      values[f.key] = on ? 'Yes' : '';
      continue;
    }
    v = String(v == null ? '' : v).trim();
    if (!v) {
      if (f.required) errors[f.key] = 'This field is required.';
      values[f.key] = '';
      continue;
    }
    switch (f.type) {
      case 'tel':
        v = normalisePhone(v);
        if (!PHONE_RE.test(v)) errors[f.key] = 'Enter a valid Nigerian mobile number, e.g. 08012345678.';
        break;
      case 'nin':
        v = v.replace(/\s/g, '');
        if (!/^\d{11}$/.test(v)) errors[f.key] = 'NIN must be exactly 11 digits.';
        break;
      case 'email':
        if (!EMAIL_RE.test(v) || v.length > (f.max || 120)) errors[f.key] = 'Enter a valid email address.';
        break;
      case 'date':
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
        var d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
        if (!d || d.getUTCDate() !== +m[3] || +m[1] < 1940 || d.getTime() > Date.now()) errors[f.key] = 'Enter a valid date of birth.';
        break;
      case 'select':
        var opts = f.options === 'LGA' ? (LGAS[state] || []) : f.options;
        if (opts.indexOf(v) === -1) errors[f.key] = 'Choose one of the listed options.';
        break;
      default:
        if (v.length > (f.max || 200)) errors[f.key] = 'Keep this under ' + (f.max || 200) + ' characters.';
    }
    values[f.key] = v;
  }
  return { ok: Object.keys(errors).length === 0, errors: errors, values: values };
}

/* ===================== HTTP ===================== */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(code, message, extra) {
  var o = { ok: false, error: code, message: message };
  for (var k in extra || {}) o[k] = extra[k];
  return json_(o);
}

function doGet() {
  return json_({ ok: true, service: 'ev-trainee-registration' });
}

function doPost(e) {
  try {
    return handle_(e);
  } catch (err) {
    console.error(err && err.stack || err);
    return fail_('server_error', 'Something went wrong. Nothing was saved.');
  }
}

function handle_(e) {
  // 1. parse
  var body;
  try {
    body = JSON.parse(e && e.postData && e.postData.contents);
  } catch (x) {
    return fail_('server_error', 'Malformed request.');
  }
  if (!body || typeof body !== 'object') return fail_('server_error', 'Malformed request.');

  // 2. token
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('FORM_TOKEN');
  if (!token || body.token !== token) return fail_('bad_token', 'Invalid form token.');

  // 3. state → tab (whitelist only; never used as a tab name directly)
  var cfg = Object.prototype.hasOwnProperty.call(STATES, body.state) ? STATES[body.state] : null;
  if (!cfg) return fail_('unknown_state', 'Unknown state.');

  // honeypot
  if (body.hp) return fail_('validation_failed', 'Submission rejected.');

  // 4. re-validate
  var res = validate(body.state, cfg.fields, body.fields);
  if (!res.ok) return fail_('validation_failed', 'Some answers need checking.', { fields: res.errors });

  // 5. lock
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return fail_('server_error', 'The server is busy. Nothing was saved — please try again.');
  try {
    var ss = openSpreadsheet_(props);
    var sheet = ss.getSheetByName(cfg.tab);
    if (!sheet) return fail_('server_error', 'Registration sheet is not set up.');

    // 6. duplicate phone across BOTH state tabs
    var phone = res.values.phone;
    for (var s in STATES) {
      var other = ss.getSheetByName(STATES[s].tab);
      if (other && columnValues_(other, phoneColumn_(STATES[s])).indexOf(phone) !== -1) {
        return fail_('duplicate_phone', 'A registration already exists for this phone number.');
      }
    }

    // 7. next ID for this tab
    var id = cfg.prefix + '-' + pad_(nextNumber_(sheet, cfg.prefix), 4);

    // 8. append
    var row = [id, new Date(), body.state, 'New'];
    cfg.fields.forEach(function (f) { row.push(cell_(f, res.values[f.key])); });
    sheet.appendRow(row);
    SpreadsheetApp.flush();

    // 9. done
    return json_({ ok: true, submissionId: id });
  } finally {
    lock.releaseLock();
  }
}

/* ===================== helpers ===================== */

function openSpreadsheet_(props) {
  var id = props.getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function phoneColumn_(cfg) {
  for (var i = 0; i < cfg.fields.length; i++) if (cfg.fields[i].key === 'phone') return META_HEADERS.length + i + 1;
  throw new Error('no phone field');
}

function columnValues_(sheet, col) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, col, last - 1, 1).getDisplayValues().map(function (r) { return normalisePhone(r[0]); });
}

// Highest existing ID number + 1, but never less than the data row count + 1.
// Using the max (not just the row count) keeps IDs unique even if a host deletes a row.
function nextNumber_(sheet, prefix) {
  var last = sheet.getLastRow();
  var n = Math.max(0, last - 1);
  if (last >= 2) {
    sheet.getRange(2, 1, last - 1, 1).getDisplayValues().forEach(function (r) {
      var m = new RegExp('^' + prefix + '-(\\d+)$').exec(r[0]);
      if (m && +m[1] > n) n = +m[1];
    });
  }
  return n + 1;
}

function pad_(n, w) {
  var s = String(n);
  while (s.length < w) s = '0' + s;
  return s;
}

// Leading apostrophe forces Sheets to keep the value as text (leading zero kept,
// no number conversion) and neutralises formula injection (=, +, -, @).
function cell_(f, v) {
  if (v === '' || v == null) return '';
  if (f.text || /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

/* ===================== one-time setup ===================== */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();

  ss.setSpreadsheetTimeZone(TZ);
  ss.setSpreadsheetLocale('en_NG');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  if (!props.getProperty('FORM_TOKEN')) props.setProperty('FORM_TOKEN', Utilities.getUuid().replace(/-/g, ''));

  var headerCount = 0;
  Object.keys(STATES).forEach(function (key) {
    var cfg = STATES[key];
    var sh = ss.getSheetByName(cfg.tab) || ss.insertSheet(cfg.tab);
    var headers = META_HEADERS.concat(cfg.fields.map(function (f) { return f.header; }));
    headerCount = Math.max(headerCount, headers.length);
    if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#eef1ec');
    sh.setFrozenRows(1);

    var rows = sh.getMaxRows() - 1;
    sh.getRange(2, 2, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS_OPTIONS, true).setAllowInvalid(false).build();
    sh.getRange(2, 4, rows, 1).setDataValidation(rule);
    // Phone / NIN columns are kept as text by the apostrophe prefix in cell_(),
    // which works whatever the column format and survives the .xlsx export.
    sh.autoResizeColumns(1, headers.length);
  });

  // All: formula only, never written by doPost. Columns A–D always align;
  // E onward align too while both states share one field set.
  var all = ss.getSheetByName('All') || ss.insertSheet('All');
  all.clear();
  var allHeaders = META_HEADERS.concat(FIELDS.map(function (f) { return f.header; }));
  all.getRange(1, 1, 1, allHeaders.length).setValues([allHeaders]).setFontWeight('bold').setBackground('#eef1ec');
  all.setFrozenRows(1);
  var lastCol = columnLetter_(allHeaders.length);
  all.getRange('A2').setFormula('=IFERROR(QUERY({Enugu!A2:' + lastCol + '; Bayelsa!A2:' + lastCol + '}, "select * where Col1 is not null", 0), "")');
  all.getRange(2, 2, all.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  // headline counts, to the right of the data
  var sc = allHeaders.length + 2;
  all.getRange(1, sc, 4, 2).setValues([
    ['Summary', ''],
    ['Enugu registrations', '=COUNTA(Enugu!A2:A)'],
    ['Bayelsa registrations', '=COUNTA(Bayelsa!A2:A)'],
    ['Total', '=COUNTA(Enugu!A2:A)+COUNTA(Bayelsa!A2:A)']
  ]);
  all.getRange(1, sc, 1, 2).setFontWeight('bold');

  // remove the default empty "Sheet1" if present
  var s1 = ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);

  // Protect A–C on the state tabs: only the owner (whom the web app runs as) can
  // edit them. Editors added later (the host) can still work Status and E onward.
  Object.keys(STATES).forEach(function (key) {
    var sh = ss.getSheetByName(STATES[key].tab);
    var existing = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).filter(function (p) { return p.getDescription() === 'System columns A–C'; });
    if (existing.length) return;
    var p = sh.getRange('A:C').protect().setDescription('System columns A–C');
    p.removeEditors(p.getEditors());
    if (p.canDomainEdit()) p.setDomainEdit(false);
  });
  // The All tab is formula-only: protect it entirely.
  if (!all.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) {
    var pa = all.protect().setDescription('Formula tab — do not edit');
    pa.removeEditors(pa.getEditors());
    if (pa.canDomainEdit()) pa.setDomainEdit(false);
  }

  console.log('Setup complete. SPREADSHEET_ID=' + ss.getId());
  console.log('FORM_TOKEN=' + props.getProperty('FORM_TOKEN') + '  ← paste into site/assets/app.js (REG_CONFIG.token)');
}

function columnLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
