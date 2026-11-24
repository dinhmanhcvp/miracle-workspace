// In-memory stand-in for Google Sheets + Apps Script services, running the real apps-script/Code.gs.
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createBackend({ token = 'test-token' } = {}) {
  const sheets = {};
  const props = { SYNC_TOKEN: token };

  const makeSheet = (name) => {
    const sh = { name, data: [] };
    const cell = (r, c) => (sh.data[r - 1] && sh.data[r - 1][c - 1] !== undefined ? sh.data[r - 1][c - 1] : '');
    const rangeApi = (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => cell(r + i, c + j))),
      setValues: (vals) => { vals.forEach((row, i) => row.forEach((v, j) => { sh.data[r + i - 1] = sh.data[r + i - 1] || []; sh.data[r + i - 1][c + j - 1] = v; })); return rangeApi(r, c, nr, nc); },
      setNumberFormat: () => rangeApi(r, c, nr, nc),
      getSheet: () => api, getRow: () => r, getColumn: () => c, getNumRows: () => nr, getNumColumns: () => nc,
    });
    const nonEmpty = (row) => (row || []).some(v => v !== '' && v !== null && v !== undefined);
    const api = {
      getName: () => name,
      getRange: rangeApi,
      getLastRow: () => { for (let i = sh.data.length; i > 0; i--) if (nonEmpty(sh.data[i - 1])) return i; return 0; },
      getLastColumn: () => Math.max(0, ...sh.data.map(r => { let n = 0; (r || []).forEach((v, j) => { if (v !== '' && v !== undefined) n = j + 1; }); return n; })),
      getMaxRows: () => 1000,
      setFrozenRows: () => {}, hideColumns: () => {},
    };
    sh.api = api;
    return sh;
  };

  const ss = {
    getName: () => 'Team KOC Database',
    getSheetByName: (n) => (sheets[n] ? sheets[n].api : null),
    insertSheet: (n) => { sheets[n] = makeSheet(n); return sheets[n].api; },
  };
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: { createTextOutput: (t) => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } }), MimeType: { JSON: 'application/json' } },
    Utilities: { getUuid: () => crypto.randomUUID() },
    Logger: { log: () => {} },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'), context);

  const rowsOf = (sheetName) => {
    const sh = sheets[sheetName];
    if (!sh) return [];
    const [head, ...rest] = sh.data;
    return rest.filter(r => r && r.some(v => v !== '' && v !== undefined)).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] === undefined ? '' : r[i]])));
  };
  return {
    context, sheets, props, rowsOf,
    get: (params) => JSON.parse(context.doGet({ parameter: params }).getContent()),
    post: (body) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(body) } }).getContent()),
    /** Handle a raw HTTP request (used by Playwright routes). */
    http: (method, url, postData) => {
      const out = method === 'GET'
        ? context.doGet({ parameter: Object.fromEntries(new URL(url).searchParams) })
        : context.doPost({ postData: { contents: postData || '' } });
      return out.getContent();
    },
    /** Simulate a person typing into the Sheet (runs the onEdit simple trigger). */
    userEdit: (sheetName, row, header, value) => {
      const sh = sheets[sheetName];
      const col = sh.data[0].indexOf(header) + 1;
      sh.api.getRange(row, col).setValues([[value]]);
      context.onEdit({ range: sh.api.getRange(row, col) });
    },
    userAppendRow: (sheetName, obj) => {
      const sh = sheets[sheetName];
      const r = sh.api.getLastRow() + 1;
      sh.api.getRange(r, 1, 1, sh.data[0].length).setValues([sh.data[0].map(h => (h in obj ? obj[h] : ''))]);
      return r;
    },
  };
}

module.exports = { createBackend };
