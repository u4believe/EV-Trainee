// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEnv } from './gas-mock.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const front = (() => {
  const ctx = {}; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(here, '..', 'site', 'assets', 'fields.js'), 'utf8'), ctx);
  return ctx.EVReg;
})();

const TOKEN = 'secret-token';
const valid = (over = {}) => ({
  full_name: 'Okafor Chinedu', gender: 'Male', dob: '1999-04-12', nin: '12345678901',
  phone: '08012345678', whatsapp: '', email: 'c@example.com', lga: 'Nsukka',
  address: '12 Zik Avenue', education: 'OND / NCE', experience: 'None',
  kin_name: 'Okafor Ada', kin_phone: '07031234567', consent: true, ...over,
});
const req = (state, fields, extra = {}) => ({ state, fields, token: TOKEN, hp: '', ...extra });
const META = 4; // A–D
const rows = (env, tab) => env.sheets[tab].rows.slice(1); // data rows, header excluded
const col = (env, key) => META + env.ctx.FIELDS.findIndex(f => f.key === key);

test('front-end and backend schemas agree', () => {
  const env = makeEnv();
  const b = env.ctx.FIELDS.map(f => [f.key, f.header, f.type, f.required]);
  const f = front.FIELDS.map(f => [f.key, f.header, f.type, f.required]);
  assert.deepEqual(JSON.parse(JSON.stringify(b)), JSON.parse(JSON.stringify(f)));
  assert.deepEqual(JSON.parse(JSON.stringify(env.ctx.LGAS)), JSON.parse(JSON.stringify(front.LGAS)));
  for (const s of ['Enugu', 'Bayelsa']) {
    for (const input of [valid(), valid({ phone: '+234 801 234 5678' }), valid({ nin: '123' }), valid({ consent: false }), valid({ dob: '2999-01-01' }), valid({ lga: 'Yenagoa' }), {}]) {
      const a = JSON.parse(JSON.stringify(front.validate(s, input)));
      const z = JSON.parse(JSON.stringify(env.ctx.validate(s, env.ctx.FIELDS, input)));
      assert.deepEqual(a, z, `mismatch for ${s} ${JSON.stringify(input)}`);
    }
  }
});

test('1. valid Enugu registration → Enugu tab only, ENU-0001, State Enugu, Status New', () => {
  const env = makeEnv();
  const r = env.post(req('Enugu', valid()));
  assert.deepEqual(r, { ok: true, submissionId: 'ENU-0001' });
  assert.equal(rows(env,'Enugu').length, 1);
  assert.equal(rows(env,'Bayelsa').length, 0);
  assert.equal(rows(env,'All').length, 0, 'backend never writes All');
  const row = rows(env,'Enugu')[0];
  assert.equal(row[0], 'ENU-0001');
  assert.equal(Object.prototype.toString.call(row[1]), '[object Date]', 'timestamp is server-side Date');
  assert.equal(row[2], 'Enugu');
  assert.equal(row[3], 'New');
  assert.equal(row.length, META + env.ctx.FIELDS.length);
});

test('2. valid Bayelsa registration → BAY-0001', () => {
  const env = makeEnv();
  const r = env.post(req('Bayelsa', valid({ lga: 'Yenagoa' })));
  assert.deepEqual(r, { ok: true, submissionId: 'BAY-0001' });
  assert.equal(rows(env,'Bayelsa')[0][2], 'Bayelsa');
  assert.equal(rows(env,'Enugu').length, 0);
});

test('LGA must belong to the chosen state', () => {
  const env = makeEnv();
  const r = env.post(req('Bayelsa', valid({ lga: 'Nsukka' })));
  assert.equal(r.error, 'validation_failed');
  assert.ok(r.fields.lga);
});

test('4. required fields empty → validation_failed with per-field errors, nothing written', () => {
  const env = makeEnv();
  const r = env.post(req('Enugu', { phone: '' }));
  assert.equal(r.ok, false);
  assert.equal(r.error, 'validation_failed');
  for (const k of ['full_name', 'gender', 'dob', 'nin', 'phone', 'lga', 'address', 'education', 'kin_name', 'kin_phone', 'consent']) assert.ok(r.fields[k], k);
  assert.equal(r.fields.email, undefined, 'optional fields not flagged');
  assert.equal(rows(env,'Enugu').length, 0);
});

test('5. +2348012345678 stored as text 08012345678', () => {
  const env = makeEnv();
  env.post(req('Enugu', valid({ phone: '+234 801-234-5678' })));
  const cell = rows(env,'Enugu')[0][col(env, 'phone')];
  assert.deepEqual(cell, { v: '08012345678', text: true });
  assert.deepEqual(rows(env,'Enugu')[0][col(env, 'nin')], { v: '12345678901', text: true });
});

test('6. same phone, same state → duplicate_phone, no second row', () => {
  const env = makeEnv();
  env.post(req('Enugu', valid()));
  const r = env.post(req('Enugu', valid({ phone: '2348012345678', full_name: 'Someone Else' })));
  assert.equal(r.error, 'duplicate_phone');
  assert.equal(rows(env,'Enugu').length, 1);
});

test('7. same phone, other state → also duplicate (cross-tab)', () => {
  const env = makeEnv();
  env.post(req('Enugu', valid()));
  const r = env.post(req('Bayelsa', valid({ lga: 'Ogbia' })));
  assert.equal(r.error, 'duplicate_phone');
  assert.equal(rows(env,'Bayelsa').length, 0);
});

test('9. back-to-back submissions get distinct sequential IDs', () => {
  const env = makeEnv();
  const ids = ['08011111111', '08022222222', '09033333333'].map(p => env.post(req('Enugu', valid({ phone: p }))).submissionId);
  assert.deepEqual(ids, ['ENU-0001', 'ENU-0002', 'ENU-0003']);
  assert.equal(env.post(req('Bayelsa', valid({ phone: '07044444444', lga: 'Brass' }))).submissionId, 'BAY-0001');
});

test('IDs stay unique if a row is deleted by hand', () => {
  const env = makeEnv();
  ['08011111111', '08022222222', '08033333333'].forEach(p => env.post(req('Enugu', valid({ phone: p }))));
  env.sheets.Enugu.rows.splice(2, 1); // host deletes ENU-0002
  assert.equal(env.post(req('Enugu', valid({ phone: '08044444444' }))).submissionId, 'ENU-0004');
});

test('lock not acquired → server_error, nothing written', () => {
  const env = makeEnv({ lockFails: true });
  assert.equal(env.post(req('Enugu', valid())).error, 'server_error');
  assert.equal(rows(env,'Enugu').length, 0);
});

test('10. wrong token → bad_token', () => {
  const env = makeEnv();
  assert.equal(env.post(req('Enugu', valid(), { token: 'nope' })).error, 'bad_token');
  assert.equal(env.post({ state: 'Enugu', fields: valid() }).error, 'bad_token');
  assert.equal(rows(env,'Enugu').length, 0);
});

test('11. unexpected state → unknown_state, no new tab', () => {
  const env = makeEnv();
  for (const s of ['Lagos', 'All', 'enugu', '__proto__', 'constructor', '', null]) {
    assert.equal(env.post(req(s, valid())).error, 'unknown_state', String(s));
  }
  assert.deepEqual(Object.keys(env.sheets).sort(), ['All', 'Bayelsa', 'Enugu']);
});

test('12. honeypot filled → rejected, nothing written', () => {
  const env = makeEnv();
  const r = env.post(req('Enugu', valid(), { hp: 'http://spam' }));
  assert.equal(r.ok, false);
  assert.equal(rows(env,'Enugu').length, 0);
});

test('malformed JSON → server_error', () => {
  const env = makeEnv();
  assert.equal(env.post('{not json').error, 'server_error');
  assert.equal(env.post('null').error, 'server_error');
});

test('formula injection is neutralised', () => {
  const env = makeEnv();
  env.post(req('Enugu', valid({ address: '=IMPORTXML("http://x")' })));
  assert.deepEqual(rows(env,'Enugu')[0][col(env, 'address')], { v: '=IMPORTXML("http://x")', text: true });
});

test('phone normalisation edge cases', () => {
  const n = front.normalisePhone;
  assert.equal(n('+2348012345678'), '08012345678');
  assert.equal(n('234 801 234 5678'), '08012345678');
  assert.equal(n('(0801) 234-5678'), '08012345678');
  assert.ok(front.PHONE_RE.test('09012345678'));
  assert.ok(!front.PHONE_RE.test('06012345678'));
  assert.ok(!front.PHONE_RE.test('0801234567'));
});
