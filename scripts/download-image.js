/**
 * download-image.js — Lädt ein Produktbild herunter und speichert es in assets/
 * Aufruf: node scripts/download-image.js <url> <dateiname>
 * Beispiel: node scripts/download-image.js https://example.com/bild.jpg mein-produkt.jpg
 */
const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');

const [,, url, filename] = process.argv;

if (!url || !filename) {
  console.error('Aufruf: node scripts/download-image.js <url> <dateiname.jpg>');
  process.exit(1);
}

const outPath = path.join(__dirname, '..', 'assets', filename);
const file    = fs.createWriteStream(outPath);
const client  = url.startsWith('https') ? https : http;

client.get(url, res => {
  if (res.statusCode === 301 || res.statusCode === 302) {
    // Redirect folgen
    const redirect = require(res.headers.location.startsWith('https') ? 'https' : 'http');
    redirect.get(res.headers.location, r2 => {
      r2.pipe(file);
      file.on('finish', () => {
        const size = Math.round(fs.statSync(outPath).size / 1024);
        console.log('✓ Gespeichert:', outPath, '(' + size + ' KB)');
      });
    });
    return;
  }
  res.pipe(file);
  file.on('finish', () => {
    const size = Math.round(fs.statSync(outPath).size / 1024);
    console.log('✓ Gespeichert:', outPath, '(' + size + ' KB)');
  });
}).on('error', err => {
  fs.unlink(outPath, () => {});
  console.error('Fehler:', err.message);
  process.exit(1);
});
