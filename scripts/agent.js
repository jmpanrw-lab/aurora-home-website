#!/usr/bin/env node
/**
 * agent.js — Aurora Home Shop Agent
 *
 * Verwendung:
 *   node scripts/agent.js                    → Komplett-Übersicht
 *   node scripts/agent.js status             → Shop-Status
 *   node scripts/agent.js products           → Alle Produkte
 *   node scripts/agent.js product <name>     → Produkt-Detail
 *   node scripts/agent.js scents             → Alle Düfte
 *   node scripts/agent.js resin              → Resin-Stufen
 *   node scripts/agent.js add-product <json> → Produkt hinzufügen
 *   node scripts/agent.js update-price <name> <preis> → Preis ändern
 *   node scripts/agent.js remove-product <name>       → Produkt deaktivieren
 *   node scripts/agent.js tasks              → Offene Aufgaben
 *   node scripts/agent.js add-task <title>   → Aufgabe hinzufügen
 *   node scripts/agent.js done-task <id>     → Aufgabe abschließen
 *   node scripts/agent.js changelog [n]      → Letzte Änderungen (default 20)
 *   node scripts/agent.js sync               → DB → JSON → HTML → Git push
 *   node scripts/agent.js check              → Shop-Qualität prüfen
 */

const { getDb } = require('./db');
const path  = require('path');
const fs    = require('fs');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const db   = getDb();

// ── Farben / Formatting ───────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  gold:   '\x1b[33m',
  green:  '\x1b[32m',
  lilac:  '\x1b[35m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  dim:    '\x1b[2m',
  white:  '\x1b[37m',
};
const b  = s => C.bold + s + C.reset;
const g  = s => C.gold + s + C.reset;
const gr = s => C.green + s + C.reset;
const li = s => C.lilac + s + C.reset;
const d  = s => C.dim + s + C.reset;
const r  = s => C.red + s + C.reset;

function fmt(n) { return parseFloat(n).toFixed(2).replace('.', ',') + ' €'; }
function now()  { return new Date().toLocaleString('de-DE'); }
function line(char = '─', len = 60) { return char.repeat(len); }

// ── Log to DB ─────────────────────────────────────────────
function log(action, entity, details, id = null) {
  db.prepare('INSERT INTO changelog (action, entity, entity_id, details) VALUES (?, ?, ?, ?)')
    .run(action, entity, id, details);
}

// ═══════════════════════════════════════════════════════════
// COMMANDS
// ═══════════════════════════════════════════════════════════

function cmdStatus() {
  const products  = db.prepare('SELECT * FROM products WHERE active=1').all();
  const scents    = db.prepare('SELECT COUNT(*) as n FROM scents').get().n;
  const tasks     = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE status='open'").get().n;
  const lastLog   = db.prepare('SELECT * FROM changelog ORDER BY id DESC LIMIT 1').get();
  const config    = Object.fromEntries(
    db.prepare('SELECT key, value FROM config').all().map(r => [r.key, r.value])
  );
  const avgPrice  = db.prepare('SELECT AVG(price) as avg FROM products WHERE active=1').get().avg;
  const minPrice  = db.prepare('SELECT MIN(price) as m FROM products WHERE active=1').get().m;
  const maxPrice  = db.prepare('SELECT MAX(price) as m FROM products WHERE active=1').get().m;

  console.log('\n' + g('═'.repeat(60)));
  console.log(g('  AURORA HOME — SHOP AGENT') + d('  ' + now()));
  console.log(g('═'.repeat(60)));
  console.log();
  console.log(b('  SHOP-ÜBERSICHT'));
  console.log(d('  ' + line()));
  console.log(`  Betreiberin:    ${b(config.owner || 'Ildiko Fenyes')}`);
  console.log(`  Standort:       ${config.location}`);
  console.log(`  Kontakt:        ${config.email}`);
  console.log();
  console.log(b('  KATALOG'));
  console.log(d('  ' + line()));
  console.log(`  Produkte aktiv: ${gr(products.length)}`);
  console.log(`  Wax-Düfte:      ${gr(scents)}`);
  console.log(`  Ø Preis:        ${g(fmt(avgPrice))}`);
  console.log(`  Preisspanne:    ${fmt(minPrice)} – ${fmt(maxPrice)}`);
  console.log();
  console.log(b('  VERSAND'));
  console.log(d('  ' + line()));
  console.log(`  Deutschland:    ${g(fmt(config.ship_de))} (gratis ab ${fmt(config.ship_free_at)})`);
  console.log(`  EU:             ${fmt(config.ship_eu)}`);
  console.log(`  Weltweit:       ${fmt(config.ship_world)}`);
  console.log();
  console.log(b('  STATUS'));
  console.log(d('  ' + line()));
  console.log(`  Offene Aufgaben: ${tasks > 0 ? r(tasks) : gr(tasks)}`);
  console.log(`  Letzte Änderung: ${d(lastLog ? lastLog.timestamp + ' — ' + lastLog.action + ' ' + lastLog.entity : 'keine')}`);
  console.log();

  // Kategorien
  const cats = db.prepare('SELECT cat_key, COUNT(*) as n FROM products WHERE active=1 GROUP BY cat_key').all();
  console.log(b('  KATEGORIEN'));
  console.log(d('  ' + line()));
  for (const c of cats) {
    console.log(`  ${c.cat_key.padEnd(18)} ${c.n} Produkt${c.n > 1 ? 'e' : ''}`);
  }
  console.log();
}

function cmdProducts() {
  const products = db.prepare('SELECT * FROM products WHERE active=1 ORDER BY id').all();
  console.log('\n' + b(g('  AURORA HOME — PRODUKTE')) + d(' (' + products.length + ')'));
  console.log(d('  ' + line()));
  console.log(d('  #  ' + 'Name'.padEnd(24) + 'Preis'.padEnd(10) + 'Kategorie'.padEnd(18) + 'Badge'));
  console.log(d('  ' + line()));
  for (const p of products) {
    const badge = p.badge ? ` [${p.badge}]` : '';
    const imgs  = JSON.parse(p.images || '[]').length;
    console.log(
      `  ${String(p.id).padEnd(3)}` +
      `${b(p.name).padEnd(33)} ` +
      `${g(fmt(p.price)).padEnd(18)} ` +
      `${d(p.cat_key.padEnd(18))} ` +
      `${badge ? li(badge) : ''}` +
      d(` ${imgs} Bild${imgs!==1?'er':''}`)
    );
  }
  console.log();
}

function cmdProduct(name) {
  const p = db.prepare('SELECT * FROM products WHERE name LIKE ? AND active=1').get('%' + name + '%');
  if (!p) return console.log(r(`  Produkt "${name}" nicht gefunden.`));
  const images = JSON.parse(p.images || '[]');
  const history = db.prepare('SELECT * FROM price_history WHERE product_id=? ORDER BY changed_at DESC LIMIT 5').all(p.id);

  console.log('\n' + b(g(`  ${p.name.toUpperCase()}`)));
  console.log(d('  ' + line()));
  console.log(`  ID:          ${p.id}`);
  console.log(`  Kategorie:   ${p.cat} (${p.cat_key})`);
  console.log(`  Preis:       ${g(fmt(p.price))}`);
  console.log(`  Badge:       ${p.badge || '—'}`);
  console.log(`  Beschreibung: ${d(p.desc?.substring(0, 80) + '...')}`);
  console.log(`  Bilder:      ${images.length} Datei${images.length!==1?'en':''}`);
  console.log(`  Erstellt:    ${d(p.created_at)}`);
  console.log(`  Aktualisiert: ${d(p.updated_at)}`);
  if (history.length) {
    console.log(`\n  ${b('Preishistorie:')}`);
    for (const h of history) {
      console.log(`  ${d(h.changed_at)}  ${fmt(h.old_price)} → ${g(fmt(h.new_price))} ${h.reason ? d('(' + h.reason + ')') : ''}`);
    }
  }
  console.log();
}

function cmdScents() {
  const scents = db.prepare('SELECT * FROM scents ORDER BY no').all();
  console.log('\n' + b(g('  AURORA HOME — WAX MELTS')) + d(' (' + scents.length + ' Düfte · 7,90 €)'));
  console.log(d('  ' + line()));
  for (const s of scents) {
    const bs = s.bs ? li(' ★ Bestseller') : '';
    console.log(`  N°${s.no}  ${b(s.name).padEnd(38)} ${d(s.season.padEnd(12))} ${d(s.notes)}${bs}`);
  }
  console.log();
}

function cmdResin() {
  const tiers = db.prepare('SELECT * FROM resin_tiers ORDER BY id').all();
  console.log('\n' + b(li('  AURORA HOME — CUSTOM RESIN')));
  console.log(d('  ' + line()));
  for (const t of tiers) {
    console.log(`  Stufe ${t.stufe} ${b(t.label).padEnd(20)} ab ${g(fmt(t.price_from)).padEnd(18)} ${d(t.weeks + ' Wochen')}`);
    console.log(`         ${d(t.description)}`);
    console.log();
  }
}

function cmdAddProduct(jsonStr) {
  let data;
  try { data = JSON.parse(jsonStr); }
  catch(e) { return console.log(r('  Ungültiges JSON: ' + e.message)); }

  const required = ['name', 'cat', 'catKey', 'price', 'desc', 'img'];
  for (const f of required) {
    if (!data[f]) return console.log(r(`  Pflichtfeld fehlt: ${f}`));
  }

  const price = parseFloat(data.price.replace(',', '.'));
  const id = db.prepare(`
    INSERT INTO products (name, cat, cat_key, price, desc, img, images, badge)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.name, data.cat, data.catKey, price, data.desc, data.img,
          JSON.stringify(data.images || [data.img]), data.badge || null).lastInsertRowid;

  log('ADD', 'product', `Neues Produkt: ${data.name} (${fmt(price)})`, id);
  syncToJson();
  console.log(gr(`  ✓ Produkt "${data.name}" hinzugefügt (ID ${id})`));
}

function cmdUpdatePrice(name, newPrice) {
  const p = db.prepare('SELECT * FROM products WHERE name LIKE ? AND active=1').get('%' + name + '%');
  if (!p) return console.log(r(`  Produkt "${name}" nicht gefunden.`));

  const price = parseFloat(String(newPrice).replace(',', '.'));
  if (isNaN(price)) return console.log(r('  Ungültiger Preis: ' + newPrice));

  db.prepare('INSERT INTO price_history (product_id, old_price, new_price) VALUES (?,?,?)').run(p.id, p.price, price);
  db.prepare('UPDATE products SET price=? WHERE id=?').run(price, p.id);
  log('UPDATE_PRICE', 'product', `${p.name}: ${fmt(p.price)} → ${fmt(price)}`, p.id);
  syncToJson();
  console.log(gr(`  ✓ Preis aktualisiert: ${p.name}: ${fmt(p.price)} → ${g(fmt(price))}`));
}

function cmdRemoveProduct(name) {
  const p = db.prepare('SELECT * FROM products WHERE name LIKE ? AND active=1').get('%' + name + '%');
  if (!p) return console.log(r(`  Produkt "${name}" nicht gefunden.`));
  db.prepare('UPDATE products SET active=0 WHERE id=?').run(p.id);
  log('REMOVE', 'product', `Produkt deaktiviert: ${p.name}`, p.id);
  syncToJson();
  console.log(gr(`  ✓ Produkt "${p.name}" deaktiviert`));
}

function cmdTasks() {
  const open   = db.prepare("SELECT * FROM tasks WHERE status='open' ORDER BY priority DESC, id").all();
  const closed = db.prepare("SELECT * FROM tasks WHERE status='done' ORDER BY closed_at DESC LIMIT 5").all();

  console.log('\n' + b(g('  AURORA HOME — AUFGABEN')));
  console.log(d('  ' + line()));
  if (!open.length) {
    console.log(gr('  ✓ Keine offenen Aufgaben'));
  } else {
    console.log(b('  OFFEN:'));
    for (const t of open) {
      const prio = t.priority === 'high' ? r('[!]') : t.priority === 'low' ? d('[.]') : g('[-]');
      console.log(`  ${prio} #${t.id} ${b(t.title)} ${d(t.created_at)}`);
      if (t.description) console.log(`      ${d(t.description)}`);
    }
  }
  if (closed.length) {
    console.log('\n' + b('  KÜRZLICH ERLEDIGT:'));
    for (const t of closed) {
      console.log(`  ${gr('✓')} #${t.id} ${d(t.title)}`);
    }
  }
  console.log();
}

function cmdAddTask(title, priority = 'normal') {
  const id = db.prepare('INSERT INTO tasks (title, priority) VALUES (?,?)').run(title, priority).lastInsertRowid;
  log('ADD_TASK', 'task', title, id);
  console.log(gr(`  ✓ Aufgabe #${id} hinzugefügt: "${title}"`));
}

function cmdDoneTask(id) {
  const t = db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
  if (!t) return console.log(r(`  Aufgabe #${id} nicht gefunden.`));
  db.prepare("UPDATE tasks SET status='done', closed_at=datetime('now','localtime') WHERE id=?").run(id);
  log('DONE_TASK', 'task', `Erledigt: ${t.title}`, id);
  console.log(gr(`  ✓ Aufgabe #${id} abgeschlossen: "${t.title}"`));
}

function cmdChangelog(n = 20) {
  const rows = db.prepare('SELECT * FROM changelog ORDER BY id DESC LIMIT ?').all(parseInt(n));
  console.log('\n' + b(g('  AURORA HOME — CHANGELOG')) + d(` (letzte ${n})`));
  console.log(d('  ' + line()));
  for (const row of rows) {
    const action = row.action === 'ADD' ? gr(row.action.padEnd(14))
                 : row.action === 'REMOVE' ? r(row.action.padEnd(14))
                 : row.action.startsWith('UPDATE') ? g(row.action.padEnd(14))
                 : d(row.action.padEnd(14));
    console.log(`  ${d(row.timestamp)}  ${action} ${b(row.entity || '')} ${d(row.details || '')}`);
  }
  console.log();
}

function cmdCheck() {
  const products = db.prepare('SELECT * FROM products WHERE active=1').all();
  const issues   = [];
  const warns    = [];

  console.log('\n' + b(g('  AURORA HOME — QUALITÄTSPRÜFUNG')));
  console.log(d('  ' + line()));

  for (const p of products) {
    const images = JSON.parse(p.images || '[]');
    const imgPath = path.join(ROOT, p.img || '');

    // Check: Bild vorhanden?
    if (!p.img || !fs.existsSync(imgPath)) {
      issues.push(`Hauptbild fehlt: ${p.name} (${p.img})`);
    }
    // Check: Mindestens 2 Bilder?
    if (images.length < 2) {
      warns.push(`Nur ${images.length} Bild(er): ${p.name}`);
    }
    // Check: Beschreibung zu kurz?
    if ((p.desc || '').length < 50) {
      warns.push(`Beschreibung zu kurz: ${p.name}`);
    }
    // Check: Preis unter 20€?
    if (p.price < 20) {
      warns.push(`Preis sehr niedrig: ${p.name} (${fmt(p.price)})`);
    }
  }

  if (!issues.length && !warns.length) {
    console.log(gr('  ✓ Alles in Ordnung! Shop ist in gutem Zustand.'));
  } else {
    if (issues.length) {
      console.log(b(r('  FEHLER:')));
      issues.forEach(i => console.log(r('  ✗ ') + i));
    }
    if (warns.length) {
      console.log('\n' + b(g('  WARNUNGEN:')));
      warns.forEach(w => console.log(g('  ⚠ ') + w));
    }
  }

  // Summary
  const withGallery = products.filter(p => JSON.parse(p.images||'[]').length >= 3).length;
  const withBadge   = products.filter(p => p.badge).length;
  console.log('\n' + b('  STATISTIKEN'));
  console.log(`  Produkte mit Galerie (3+):  ${withGallery}/${products.length}`);
  console.log(`  Produkte mit Badge:         ${withBadge}/${products.length}`);
  console.log(`  Ø Bildanzahl:               ${(products.reduce((s,p) => s + JSON.parse(p.images||'[]').length, 0) / products.length).toFixed(1)}`);
  console.log();
}

function cmdSync() {
  console.log('\n' + b(g('  AURORA HOME — SYNC')));
  console.log(d('  ' + line()));

  syncToJson();
  console.log(gr('  ✓ DB → products.json'));

  execSync('node scripts/sync.js', { cwd: ROOT, stdio: 'inherit' });
  console.log(gr('  ✓ products.json → index.html'));

  try {
    execSync('git add -A && git diff --staged --quiet || git commit -m "Agent: automatischer Sync"', { cwd: ROOT, shell: true, stdio: 'inherit' });
    execSync('git push origin main', { cwd: ROOT, stdio: 'inherit' });
    console.log(gr('  ✓ Git Push → GitHub'));
    log('SYNC', 'ALL', 'Vollständiger Sync: DB → JSON → HTML → GitHub');
  } catch(e) {
    console.log(d('  ~ Keine Änderungen zum Committen.'));
  }
  console.log();
}

// ── Hilfsfunktion: DB → products.json ────────────────────
function syncToJson() {
  const products = db.prepare('SELECT * FROM products WHERE active=1 ORDER BY id').all();
  const json = products.map(p => {
    const obj = {
      name:   p.name,
      cat:    p.cat,
      catKey: p.cat_key,
      price:  p.price.toFixed(2).replace('.', ','),
      desc:   p.desc,
      img:    p.img,
      images: JSON.parse(p.images || '[]'),
    };
    if (p.badge) obj.badge = p.badge;
    return obj;
  });
  fs.writeFileSync(path.join(ROOT, 'data/products.json'), JSON.stringify(json, null, 2), 'utf8');
}

// ═══════════════════════════════════════════════════════════
// MAIN — Command Router
// ═══════════════════════════════════════════════════════════
const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'status':
  case undefined:      cmdStatus();                   break;
  case 'products':     cmdProducts();                 break;
  case 'product':      cmdProduct(args[0]);           break;
  case 'scents':       cmdScents();                   break;
  case 'resin':        cmdResin();                    break;
  case 'add-product':  cmdAddProduct(args[0]);        break;
  case 'update-price': cmdUpdatePrice(args[0], args[1]); break;
  case 'remove-product': cmdRemoveProduct(args[0]);   break;
  case 'tasks':        cmdTasks();                    break;
  case 'add-task':     cmdAddTask(args.join(' '), args[1]); break;
  case 'done-task':    cmdDoneTask(args[0]);          break;
  case 'changelog':    cmdChangelog(args[0]);         break;
  case 'sync':         cmdSync();                     break;
  case 'check':        cmdCheck();                    break;
  default:
    console.log(r(`  Unbekannter Befehl: ${cmd}`));
    console.log(d('  Hilfe: node scripts/agent.js (ohne Argumente)'));
}

db.close();
