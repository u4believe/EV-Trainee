// Minimal in-memory stand-ins for the Apps Script services Code.gs uses.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const CODE_PATH = path.join(here, '..', 'apps-script', 'Code.gs');

class Range {
  constructor(sheet, row, col, nrows, ncols) { Object.assign(this, { sheet, row, col, nrows, ncols }); }
  getDisplayValues() {
    const out = [];
    for (let r = 0; r < this.nrows; r++) {
      const line = [];
      for (let c = 0; c < this.ncols; c++) {
        const cell = (this.sheet.rows[this.row - 1 + r] || [])[this.col - 1 + c];
        line.push(cell == null ? '' : Object.prototype.toString.call(cell) === '[object Date]' ? cell.toISOString() : String(cell.v ?? cell));
      }
      out.push(line);
    }
    return out;
  }
}

class Sheet {
  constructor(name) { this.name = name; this.rows = []; }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getRange(row, col, nrows = 1, ncols = 1) { return new Range(this, row, col, nrows, ncols); }
  appendRow(values) {
    // Emulate Sheets input parsing: leading apostrophe → stored as text, apostrophe hidden.
    // Unprefixed numeric strings become numbers (losing leading zeros) — what the spec warns about.
    this.rows.push(values.map(v => {
      if (typeof v === 'string' && v.startsWith("'")) return { v: v.slice(1), text: true };
      if (typeof v === 'string' && /^\d+$/.test(v)) return { v: Number(v), text: false };
      return v;
    }));
  }
}

export function makeEnv({ token = 'secret-token', tabs = ['Enugu', 'Bayelsa', 'All'], lockFails = false } = {}) {
  const sheets = Object.fromEntries(tabs.map(t => [t, new Sheet(t)]));
  // setup() writes a header row on every tab before any data arrives
  for (const t of tabs) sheets[t].rows.push(['Submission ID', 'Timestamp', 'State', 'Status']);
  const props = { FORM_TOKEN: token, SPREADSHEET_ID: 'ss1' };
  const ss = {
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => (sheets[n] = new Sheet(n)),
  };
  const ctx = {
    console,
    SpreadsheetApp: { openById: () => ss, getActiveSpreadsheet: () => ss, flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => !lockFails, waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: s => ({ body: s, setMimeType() { return this; } }),
    },
    Utilities: { getUuid: () => 'uuid' },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(CODE_PATH, 'utf8'), ctx, { filename: 'Code.gs' });
  const post = obj => JSON.parse(ctx.doPost({ postData: { contents: typeof obj === 'string' ? obj : JSON.stringify(obj) } }).body);
  return { ctx, sheets, props, post };
}
