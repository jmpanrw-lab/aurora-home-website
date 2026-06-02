/**
 * sync.js — Synct data/products.json + data/scents.json → index.html
 * Aufruf: node scripts/sync.js
 */
const fs   = require('fs');
const path = require('path');

const ROOT     = path.join(__dirname, '..');
const HTML     = path.join(ROOT, 'index.html');
const PRODUCTS = path.join(ROOT, 'data', 'products.json');
const SCENTS   = path.join(ROOT, 'data', 'scents.json');

const products = JSON.parse(fs.readFileSync(PRODUCTS, 'utf8'));
const scents   = JSON.parse(fs.readFileSync(SCENTS,   'utf8'));

let html = fs.readFileSync(HTML, 'utf8');

// Ersetze PRODUCTS-Array
const pStr = 'const PRODUCTS = ' + JSON.stringify(products, null, 2) + ';';
html = html.replace(/const PRODUCTS = \[[\s\S]*?\];/, pStr);

// Ersetze SCENTS-Array
const sStr = 'const SCENTS = ' + JSON.stringify(scents, null, 2) + ';';
html = html.replace(/const SCENTS = \[[\s\S]*?\];/, sStr);

fs.writeFileSync(HTML, html, 'utf8');
console.log('✓ index.html aktualisiert');
console.log('  Produkte:', products.length);
console.log('  Düfte:   ', scents.length);
