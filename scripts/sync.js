/**
 * sync.js — Synct data/products.json + data/scents.json → index.html
 * Aufruf: node scripts/sync.js
 *
 * Sicherheit: Validiert JSON, erstellt Backup vor Überschreiben.
 */
const fs   = require('fs');
const path = require('path');

const ROOT     = path.join(__dirname, '..');
const HTML     = path.join(ROOT, 'index.html');
const PRODUCTS = path.join(ROOT, 'data', 'products.json');
const SCENTS   = path.join(ROOT, 'data', 'scents.json');
const BACKUP   = path.join(ROOT, 'index.html.bak');

// ── Validierung ───────────────────────────────────────────────
function validateProducts(arr) {
  if (!Array.isArray(arr)) throw new Error('products.json: kein Array');
  if (arr.length === 0)    throw new Error('products.json: leer — Sync abgebrochen');
  const required = ['name', 'cat', 'catKey', 'price', 'img'];
  arr.forEach((p, i) => {
    required.forEach(f => {
      if (!p[f]) throw new Error(`Produkt[${i}] (${p.name||'?'}) fehlt Pflichtfeld: "${f}"`);
    });
    if (isNaN(parseFloat(p.price?.replace(',', '.')))) {
      throw new Error(`Produkt[${i}] (${p.name}): ungültiger Preis: "${p.price}"`);
    }
  });
}

function validateScents(arr) {
  if (!Array.isArray(arr)) throw new Error('scents.json: kein Array');
  if (arr.length === 0)    throw new Error('scents.json: leer — Sync abgebrochen');
  arr.forEach((s, i) => {
    ['no', 'name', 'grad'].forEach(f => {
      if (!s[f]) throw new Error(`Duft[${i}] fehlt Pflichtfeld: "${f}"`);
    });
  });
}

// ── Ausführung ────────────────────────────────────────────────
let products, scents;

try {
  products = JSON.parse(fs.readFileSync(PRODUCTS, 'utf8'));
} catch (e) {
  console.error('❌ products.json Parse-Fehler:', e.message);
  process.exit(1);
}

try {
  scents = JSON.parse(fs.readFileSync(SCENTS, 'utf8'));
} catch (e) {
  console.error('❌ scents.json Parse-Fehler:', e.message);
  process.exit(1);
}

try {
  validateProducts(products);
  validateScents(scents);
} catch (e) {
  console.error('❌ Validierungsfehler:', e.message);
  console.error('   index.html wurde NICHT verändert.');
  process.exit(1);
}

// Backup erstellen
fs.copyFileSync(HTML, BACKUP);
console.log('✓ Backup erstellt: index.html.bak');

let html = fs.readFileSync(HTML, 'utf8');

// PRODUCTS-Array ersetzen
const pStr = 'const PRODUCTS = ' + JSON.stringify(products, null, 2) + ';';
if (!html.includes('const PRODUCTS = [')) {
  console.error('❌ PRODUCTS-Array nicht in index.html gefunden — Abbruch.');
  fs.copyFileSync(BACKUP, HTML); // Backup wiederherstellen
  process.exit(1);
}
html = html.replace(/const PRODUCTS = \[[\s\S]*?\];/, pStr);

// SCENTS-Array ersetzen
const sStr = 'const SCENTS = ' + JSON.stringify(scents, null, 2) + ';';
if (!html.includes('const SCENTS = [')) {
  console.error('❌ SCENTS-Array nicht in index.html gefunden — Abbruch.');
  fs.copyFileSync(BACKUP, HTML);
  process.exit(1);
}
html = html.replace(/const SCENTS = \[[\s\S]*?\];/, sStr);

fs.writeFileSync(HTML, html, 'utf8');

console.log('✅ index.html erfolgreich aktualisiert');
console.log('   Produkte:', products.length);
console.log('   Düfte:   ', scents.length);
console.log('');
console.log('   Rollback falls nötig: copy index.html.bak index.html');
