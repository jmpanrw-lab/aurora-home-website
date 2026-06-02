/**
 * db-seed.js — Befüllt die Datenbank aus products.json + scents.json
 * Aufruf: node scripts/db-seed.js
 */
const { getDb } = require('./db');
const path = require('path');
const fs   = require('fs');

const ROOT     = path.join(__dirname, '..');
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/products.json'), 'utf8'));
const scents   = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/scents.json'),   'utf8'));

const db = getDb();

// Resin Tiers
const RESIN_TIERS = [
  { stufe:'01', label:'Mini',       price_from:150,  weeks:'1–3',   description:'Einfarbig, grundiert, lackiert' },
  { stufe:'02', label:'Standard',   price_from:300,  weeks:'3–5',   description:'Mehrfarbig, detaillierte Bemalung' },
  { stufe:'03', label:'Premium',    price_from:700,  weeks:'5–7',   description:'Metallic, Wash-Effekte, Highlights' },
  { stufe:'04', label:'Masterpiece',price_from:1500, weeks:'7–10',  description:'Großformat, komplexe Bemalung, Einzelstück' },
];

const seedAll = db.transaction(() => {
  // Clear existing data
  db.exec('DELETE FROM products; DELETE FROM scents; DELETE FROM resin_tiers; DELETE FROM price_history;');

  // Seed products
  const insertProduct = db.prepare(`
    INSERT INTO products (name, cat, cat_key, price, desc, img, images, badge)
    VALUES (@name, @cat, @cat_key, @price, @desc, @img, @images, @badge)
  `);
  for (const p of products) {
    insertProduct.run({
      name:    p.name,
      cat:     p.cat,
      cat_key: p.catKey,
      price:   parseFloat(p.price.replace(',','.')),
      desc:    p.desc,
      img:     p.img || null,
      images:  JSON.stringify(p.images || []),
      badge:   p.badge || null,
    });
  }

  // Seed scents
  const insertScent = db.prepare(`
    INSERT INTO scents (no, season, name, notes, grad, bs)
    VALUES (@no, @season, @name, @notes, @grad, @bs)
  `);
  for (const s of scents) {
    insertScent.run({
      no:     s.no,
      season: s.season,
      name:   s.name,
      notes:  s.notes,
      grad:   s.grad,
      bs:     s.bs ? 1 : 0,
    });
  }

  // Seed resin tiers
  const insertTier = db.prepare(`
    INSERT INTO resin_tiers (stufe, label, price_from, weeks, description)
    VALUES (@stufe, @label, @price_from, @weeks, @description)
  `);
  for (const t of RESIN_TIERS) insertTier.run(t);

  // Config
  const setConfig = db.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`);
  setConfig.run('shop_name',    'Aurora Home');
  setConfig.run('owner',        'Ildiko Fenyes');
  setConfig.run('email',        'fenyesdesign@outlook.com');
  setConfig.run('location',     'Krefeld, Deutschland');
  setConfig.run('last_seeded',  new Date().toISOString());
  setConfig.run('currency',     'EUR');
  setConfig.run('ship_de',      '4.90');
  setConfig.run('ship_free_at', '60.00');
  setConfig.run('ship_eu',      '9.90');
  setConfig.run('ship_world',   '14.90');

  // Log
  db.prepare(`INSERT INTO changelog (action, entity, details) VALUES (?, ?, ?)`)
    .run('SEED', 'ALL', `Datenbank initialisiert: ${products.length} Produkte, ${scents.length} Düfte, 4 Resin-Stufen`);
});

seedAll();

const pCount = db.prepare('SELECT COUNT(*) as n FROM products').get().n;
const sCount = db.prepare('SELECT COUNT(*) as n FROM scents').get().n;
const tCount = db.prepare('SELECT COUNT(*) as n FROM resin_tiers').get().n;

console.log('✓ Datenbank initialisiert:');
console.log(`  Produkte:     ${pCount}`);
console.log(`  Düfte:        ${sCount}`);
console.log(`  Resin-Stufen: ${tCount}`);
console.log(`  Pfad:         aurora.db`);

db.close();
