/*
 * Field schema + validation shared by both registration pages.
 *
 * The backend (apps-script/Code.gs) carries an identical copy of FIELDS and
 * the rules below — Apps Script cannot import this file. If you change a field
 * here, change it there too (tests/backend.test.mjs checks they agree).
 *
 * Column order in the sheet = order of FIELDS, starting at column E.
 * Never reorder or remove once data has been collected.
 */
(function (root) {
  'use strict';

  var LGAS = {
    Enugu: ['Aninri', 'Awgu', 'Enugu East', 'Enugu North', 'Enugu South', 'Ezeagu', 'Igbo Etiti', 'Igbo Eze North', 'Igbo Eze South', 'Isi Uzo', 'Nkanu East', 'Nkanu West', 'Nsukka', 'Oji River', 'Udenu', 'Udi', 'Uzo-Uwani'],
    Bayelsa: ['Brass', 'Ekeremor', 'Kolokuma/Opokuma', 'Nembe', 'Ogbia', 'Sagbama', 'Southern Ijaw', 'Yenagoa']
  };

  var GENDERS = ['Male', 'Female'];
  var EDUCATION = ['Primary (FSLC)', 'Secondary (SSCE/WAEC/NECO)', 'Technical/Vocational (NABTEB)', 'OND / NCE', 'HND / Degree', 'Postgraduate'];
  var EXPERIENCE = ['None', 'Less than 1 year', '1–3 years', 'More than 3 years'];

  // key, label, sheet header, type, required, extra
  var FIELDS = [
    { key: 'full_name',  label: 'Full name (Surname first)', header: 'Full Name', type: 'text', required: true, max: 120, section: 1, autocomplete: 'name' },
    { key: 'gender',     label: 'Gender', header: 'Gender', type: 'select', required: true, options: GENDERS, section: 1, half: true },
    { key: 'dob',        label: 'Date of birth', header: 'Date of Birth', type: 'date', required: true, section: 1, half: true },
    { key: 'nin',        label: 'NIN (11 digits)', header: 'NIN', type: 'nin', required: true, section: 1, text: true },
    { key: 'phone',      label: 'Phone number', header: 'Phone', type: 'tel', required: true, section: 2, half: true, text: true, autocomplete: 'tel' },
    { key: 'whatsapp',   label: 'WhatsApp number', header: 'WhatsApp', type: 'tel', required: false, section: 2, half: true, text: true, placeholder: 'If different' },
    { key: 'email',      label: 'Email', header: 'Email', type: 'email', required: false, max: 120, section: 2, autocomplete: 'email' },
    { key: 'lga',        label: 'LGA of origin', header: 'LGA', type: 'select', required: true, options: 'LGA', section: 2 },
    { key: 'address',    label: 'Residential address', header: 'Address', type: 'text', required: true, max: 300, section: 2, autocomplete: 'street-address' },
    { key: 'education',  label: 'Highest education', header: 'Highest Education', type: 'select', required: true, options: EDUCATION, section: 3 },
    { key: 'experience', label: 'Any mechanic, electrical or auto experience?', header: 'Experience', type: 'select', required: false, options: EXPERIENCE, section: 3 },
    { key: 'kin_name',   label: 'Full name', header: 'Next of Kin Name', type: 'text', required: true, max: 120, section: 4, half: true },
    { key: 'kin_phone',  label: 'Phone number', header: 'Next of Kin Phone', type: 'tel', required: true, section: 4, half: true, text: true },
    { key: 'consent',    label: 'I confirm the information above is correct and I will bring my National Identity Card (NIN) for enrolment.', header: 'Consent', type: 'checkbox', required: true, section: 5 }
  ];

  var SECTIONS = { 1: 'Personal details', 2: 'Contact & location', 3: 'Background', 4: 'Next of kin' };

  var PHONE_RE = /^0[789][01]\d{8}$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function normalisePhone(raw) {
    var s = String(raw == null ? '' : raw).replace(/[\s\-().]/g, '');
    if (/^\+234\d{10}$/.test(s)) s = '0' + s.slice(4);
    else if (/^234\d{10}$/.test(s)) s = '0' + s.slice(3);
    return s;
  }

  function optionsFor(field, state) {
    return field.options === 'LGA' ? (LGAS[state] || []) : field.options;
  }

  /**
   * Validate + normalise. Returns { ok, errors: {key: message}, values: {key: cleaned} }.
   */
  function validate(state, input) {
    var errors = {}, values = {};
    input = input || {};
    for (var i = 0; i < FIELDS.length; i++) {
      var f = FIELDS[i];
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
          if (optionsFor(f, state).indexOf(v) === -1) errors[f.key] = 'Choose one of the listed options.';
          break;
        default:
          if (v.length > (f.max || 200)) errors[f.key] = 'Keep this under ' + (f.max || 200) + ' characters.';
      }
      values[f.key] = v;
    }
    return { ok: Object.keys(errors).length === 0, errors: errors, values: values };
  }

  root.EVReg = {
    STATES: ['Enugu', 'Bayelsa'],
    LGAS: LGAS, FIELDS: FIELDS, SECTIONS: SECTIONS,
    PHONE_RE: PHONE_RE, normalisePhone: normalisePhone, optionsFor: optionsFor, validate: validate
  };
})(typeof window !== 'undefined' ? window : globalThis);
