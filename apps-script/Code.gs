/**
 * KOC Booking Workspace – Google Sheets sync backend (Google Apps Script).
 *
 * Paste this file into Extensions › Apps Script of the team's Google Sheet,
 * run `setup` once, then Deploy › New deployment › Web app
 * (Execute as: Me, Who has access: Anyone). See docs/google-sheets-setup.md.
 *
 * The tool sends records with an `id`, `updatedAt` (ISO time) and the
 * human-readable columns; the newest `updatedAt` wins. Editing a cell in the
 * Sheet stamps `updatedAt`, so edits made directly in the Sheet are synced back.
 * Rows typed directly into the Sheet (no id yet) get an id on the next sync.
 * To delete a row for everyone, set column "deleted" to TRUE (or delete it in the tool).
 */

var SHEET_NAMES = { kocs: 'Kho KOC', blacklist: 'Blacklist', pnl: 'Kho PNL', reports: 'Báo cáo tuần', config: 'Cấu hình' };
var META_HEAD = ['id'];
var META_TAIL = ['updatedAt', 'updatedBy', 'deleted', '_data'];
var MAX_CELL = 45000;

function setup() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('SYNC_TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
    props.setProperty('SYNC_TOKEN', token);
  }
  Logger.log('Mã bí mật (token) để nhập vào tool: ' + token);
  return token;
}

function doGet(e) { return handle_((e && e.parameter) || {}); }

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { body = {}; }
  return handle_(body);
}

function handle_(req) {
  var token = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  if (!token || String(req.token || '') !== token) return json_({ ok: false, error: 'UNAUTHORIZED' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    if (req.action === 'ping') return json_({ ok: true, sheet: ss.getName(), time: nowIso_() });
    if (req.action === 'pull') {
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try { return json_({ ok: true, time: nowIso_(), data: pullAll_(ss) }); } finally { lock.releaseLock(); }
    }
    if (req.action === 'push') {
      var lock2 = LockService.getScriptLock();
      lock2.waitLock(20000);
      try { return json_({ ok: true, time: nowIso_(), results: pushAll_(ss, req.changes || {}, req.headers || {}, String(req.user || ''), req.textHeaders || {}) }); } finally { lock2.releaseLock(); }
    }
    return json_({ ok: false, error: 'UNKNOWN_ACTION' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function nowIso_() { return new Date().toISOString(); }

function iso_(v) {
  if (v instanceof Date) return v.toISOString();
  return v === null || v === undefined ? '' : String(v);
}

/** Get (or create) the sheet of a collection and make sure all display headers exist. Returns { sheet, headers }. */
function sheetFor_(ss, coll, displayHeaders, create, textHeaders) {
  var name = SHEET_NAMES[coll];
  if (!name) throw new Error('Unknown collection ' + coll);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    if (!create) return null;
    sheet = ss.insertSheet(name);
    var headers = META_HEAD.concat(displayHeaders || [], META_TAIL);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    var tsCol = headers.indexOf('updatedAt') + 1;
    sheet.getRange(1, tsCol, 1000, 1).setNumberFormat('@');
    sheet.hideColumns(headers.indexOf('_data') + 1);
  }
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var current = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var missing = (displayHeaders || []).concat(META_HEAD, META_TAIL).filter(function (h) { return current.indexOf(h) === -1; });
  if (missing.length) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
    current = current.concat(missing);
  }
  // keep phone numbers (leading 0), age ranges, links... as plain text
  (textHeaders || []).forEach(function (h) {
    var col = current.indexOf(h) + 1;
    if (col) sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  });
  return { sheet: sheet, headers: current };
}

function readRows_(sheet, headers) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var values = sheet.getRange(2, 1, last - 1, headers.length).getValues();
  return values.map(function (r, i) {
    var obj = {};
    headers.forEach(function (h, j) { obj[h] = r[j]; });
    return { rowIndex: i + 2, obj: obj };
  });
}

function isBlankRow_(obj, headers) {
  return headers.every(function (h) { return obj[h] === '' || obj[h] === null || obj[h] === false; });
}

function pullAll_(ss) {
  var out = {};
  Object.keys(SHEET_NAMES).forEach(function (coll) {
    var s = sheetFor_(ss, coll, [], false);
    if (!s) { out[coll] = []; return; }
    var idCol = s.headers.indexOf('id') + 1;
    var tsCol = s.headers.indexOf('updatedAt') + 1;
    var display = s.headers.filter(function (h) { return META_HEAD.indexOf(h) === -1 && META_TAIL.indexOf(h) === -1; });
    out[coll] = [];
    readRows_(s.sheet, s.headers).forEach(function (r) {
      if (isBlankRow_(r.obj, display)) return;
      var id = String(r.obj.id || '');
      var updatedAt = iso_(r.obj.updatedAt);
      if (!id) {
        // a row typed directly into the Sheet: give it an id so every client can track it
        id = 's' + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
        updatedAt = nowIso_();
        s.sheet.getRange(r.rowIndex, idCol, 1, 1).setValues([[id]]);
        s.sheet.getRange(r.rowIndex, tsCol, 1, 1).setValues([[updatedAt]]);
      }
      var data = null;
      try { data = r.obj._data ? JSON.parse(r.obj._data) : null; } catch (e) { data = null; }
      var row = {};
      display.forEach(function (h) { row[h] = r.obj[h] instanceof Date ? r.obj[h].toISOString() : r.obj[h]; });
      out[coll].push({
        id: id, updatedAt: updatedAt, updatedBy: String(r.obj.updatedBy || ''),
        deleted: r.obj.deleted === true || String(r.obj.deleted).toUpperCase() === 'TRUE',
        data: data, row: row,
      });
    });
  });
  return out;
}

function pushAll_(ss, changes, headersByColl, user, textHeadersByColl) {
  var results = {};
  Object.keys(changes).forEach(function (coll) {
    if (!SHEET_NAMES[coll]) return;
    var s = sheetFor_(ss, coll, headersByColl[coll] || [], true, (textHeadersByColl || {})[coll]);
    var rows = readRows_(s.sheet, s.headers);
    var index = {};
    rows.forEach(function (r) { if (r.obj.id) index[String(r.obj.id)] = r; });
    var accepted = [], rejected = [], appends = [];
    (changes[coll] || []).forEach(function (rec) {
      if (!rec || !rec.id) return;
      var existing = index[String(rec.id)];
      if (existing && iso_(existing.obj.updatedAt) > String(rec.updatedAt || '')) { rejected.push(rec.id); return; }
      var dataStr = JSON.stringify(rec.data || {});
      if (dataStr.length > MAX_CELL) dataStr = JSON.stringify({ _truncated: true });
      var values = s.headers.map(function (h) {
        if (h === 'id') return rec.id;
        if (h === 'updatedAt') return String(rec.updatedAt || nowIso_());
        if (h === 'updatedBy') return user || rec.updatedBy || '';
        if (h === 'deleted') return rec.deleted ? true : '';
        if (h === '_data') return rec.deleted ? (existing ? existing.obj._data : '') : dataStr;
        if (rec.deleted && existing) return existing.obj[h];
        var v = rec.row ? rec.row[h] : '';
        return v === undefined || v === null ? '' : v;
      });
      if (existing) s.sheet.getRange(existing.rowIndex, 1, 1, values.length).setValues([values]);
      else appends.push(values);
      accepted.push(rec.id);
    });
    if (appends.length) s.sheet.getRange(s.sheet.getLastRow() + 1, 1, appends.length, s.headers.length).setValues(appends);
    results[coll] = { accepted: accepted, rejected: rejected };
  });
  return results;
}

/** Simple trigger: stamp updatedAt when someone edits a data cell directly in the Sheet. */
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var name = sheet.getName();
  var known = Object.keys(SHEET_NAMES).some(function (k) { return SHEET_NAMES[k] === name; });
  if (!known || e.range.getRow() < 2) return;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var tsCol = headers.indexOf('updatedAt') + 1;
  var byCol = headers.indexOf('updatedBy') + 1;
  if (!tsCol) return;
  var firstCol = e.range.getColumn(), lastCol = firstCol + e.range.getNumColumns() - 1;
  if (firstCol === tsCol && lastCol === tsCol) return;
  var n = e.range.getNumRows();
  var stamp = nowIso_();
  var ts = [], by = [];
  for (var i = 0; i < n; i++) { ts.push([stamp]); by.push(['Google Sheet']); }
  sheet.getRange(e.range.getRow(), tsCol, n, 1).setValues(ts);
  if (byCol) sheet.getRange(e.range.getRow(), byCol, n, 1).setValues(by);
}
