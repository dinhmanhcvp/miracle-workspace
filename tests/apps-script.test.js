// Unit tests for apps-script/Code.gs (run with a fake SpreadsheetApp): node --test tests/apps-script.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBackend } = require('./fake-apps-script');

const T = 'test-token';
const kocRec = (id, name, updatedAt, extra = {}) => ({ id, updatedAt, data: { id, name, rate: 1000, ...extra }, row: { 'Tên': name, 'Contact': '0900000001', 'Giá nhập': 1000 } });

test('rejects requests without the token', () => {
  const b = createBackend({ token: T });
  assert.equal(b.get({ action: 'ping' }).error, 'UNAUTHORIZED');
  assert.equal(b.get({ action: 'ping', token: 'wrong' }).error, 'UNAUTHORIZED');
  assert.equal(b.get({ action: 'ping', token: T }).ok, true);
});

test('push creates the sheet and pull returns the records', () => {
  const b = createBackend({ token: T });
  const res = b.post({ token: T, action: 'push', user: 'An', headers: { kocs: ['Tên', 'Contact', 'Giá nhập'] }, changes: { kocs: [kocRec('k1', 'Demo One', '2026-01-01T00:00:00.000Z')] } });
  assert.deepEqual(res.results.kocs, { accepted: ['k1'], rejected: [] });
  const rows = b.rowsOf('Kho KOC');
  assert.equal(rows.length, 1);
  assert.equal(rows[0]['Tên'], 'Demo One');
  assert.equal(rows[0].updatedBy, 'An');
  const pulled = b.get({ action: 'pull', token: T }).data.kocs;
  assert.equal(pulled.length, 1);
  assert.equal(pulled[0].data.name, 'Demo One');
  assert.equal(pulled[0].row['Contact'], '0900000001');
});

test('newest updatedAt wins', () => {
  const b = createBackend({ token: T });
  const push = (rec) => b.post({ token: T, action: 'push', headers: { kocs: ['Tên'] }, changes: { kocs: [rec] } }).results.kocs;
  push(kocRec('k1', 'v2', '2026-01-02T00:00:00.000Z'));
  assert.deepEqual(push(kocRec('k1', 'old', '2026-01-01T00:00:00.000Z')), { accepted: [], rejected: ['k1'] });
  assert.deepEqual(push(kocRec('k1', 'v3', '2026-01-03T00:00:00.000Z')), { accepted: ['k1'], rejected: [] });
  assert.equal(b.rowsOf('Kho KOC')[0]['Tên'], 'v3');
  assert.equal(b.rowsOf('Kho KOC').length, 1);
});

test('edits and new rows typed in the Sheet are picked up', () => {
  const b = createBackend({ token: T });
  b.post({ token: T, action: 'push', headers: { kocs: ['Tên', 'Contact', 'Giá nhập'] }, changes: { kocs: [kocRec('k1', 'Demo One', '2026-01-01T00:00:00.000Z')] } });
  b.userEdit('Kho KOC', 2, 'Giá nhập', 5000);
  const edited = b.rowsOf('Kho KOC')[0];
  assert.ok(edited.updatedAt > '2026-01-01T00:00:00.000Z', 'onEdit stamps updatedAt');
  assert.equal(edited.updatedBy, 'Google Sheet');
  b.userAppendRow('Kho KOC', { 'Tên': 'Typed In Sheet', 'Giá nhập': 3000 });
  const pulled = b.get({ action: 'pull', token: T }).data.kocs;
  assert.equal(pulled.length, 2);
  const typed = pulled.find(r => r.row['Tên'] === 'Typed In Sheet');
  assert.ok(typed.id && typed.updatedAt, 'server assigns an id to rows typed in the Sheet');
  assert.equal(b.rowsOf('Kho KOC')[1].id, typed.id, 'id written back to the Sheet');
  assert.equal(pulled.find(r => r.id === 'k1').row['Giá nhập'], 5000);
});

test('deletions are kept as tombstones (deleted = TRUE)', () => {
  const b = createBackend({ token: T });
  b.post({ token: T, action: 'push', headers: { blacklist: ['Tên', 'Link'] }, changes: { blacklist: [{ id: 'b1', updatedAt: '2026-01-01T00:00:00.000Z', data: { id: 'b1', name: 'X' }, row: { 'Tên': 'X', 'Link': '' } }] } });
  b.post({ token: T, action: 'push', headers: { blacklist: ['Tên', 'Link'] }, changes: { blacklist: [{ id: 'b1', deleted: true, updatedAt: '2026-01-02T00:00:00.000Z' }] } });
  const row = b.rowsOf('Blacklist')[0];
  assert.equal(row.deleted, true);
  assert.equal(row['Tên'], 'X', 'content kept for the record');
  assert.equal(b.get({ action: 'pull', token: T }).data.blacklist[0].deleted, true);
});
