#!/usr/bin/env node
// Copy only the files the website needs into dist/ (used by Vercel / Netlify / Cloudflare Pages).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
const include = ['index.html', 'guide.html', 'miracle-guide.html', 'assets', 'apps-script', 'docs'];
for (const item of include) {
    const src = path.join(root, item);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}
console.log('dist/ ready:', include.join(', '));
