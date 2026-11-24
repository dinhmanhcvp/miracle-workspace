#!/usr/bin/env node
// Copy third-party browser libraries from node_modules into assets/vendor (run after `npm install`).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'assets', 'vendor');
fs.mkdirSync(out, { recursive: true });
const files = [
    ['marked/marked.min.js', 'marked.min.js', 'marked/LICENSE.md', 'marked (MIT)'],
    ['dompurify/dist/purify.min.js', 'purify.min.js', 'dompurify/LICENSE', 'DOMPurify (Apache-2.0 / MPL-2.0)'],
    ['xlsx/dist/xlsx.full.min.js', 'xlsx.full.min.js', 'xlsx/LICENSE', 'SheetJS Community Edition (Apache-2.0)'],
];
let notice = 'Third-party libraries bundled in this folder:\n\n';
for (const [src, dest, lic, name] of files) {
    const from = require.resolve(src, { paths: [root] });
    fs.copyFileSync(from, path.join(out, dest));
    const pkg = JSON.parse(fs.readFileSync(require.resolve(src.split('/')[0] + '/package.json', { paths: [root] }), 'utf8'));
    notice += `- ${dest}: ${name}, version ${pkg.version}\n`;
    try { notice += '\n' + fs.readFileSync(require.resolve(lic, { paths: [root] }), 'utf8').trim() + '\n\n---\n\n'; } catch (e) { }
    console.log('vendored', dest, pkg.version);
}
fs.writeFileSync(path.join(out, 'THIRD_PARTY_LICENSES.txt'), notice);
