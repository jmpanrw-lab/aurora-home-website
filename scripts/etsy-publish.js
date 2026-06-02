/**
 * etsy-publish.js — Erstellt Etsy-Listings aus Aurora Home Produkten
 * Aufruf: node scripts/etsy-publish.js [--dry-run] [--product "Name"]
 *
 * --dry-run    → Zeigt was erstellt würde, ohne Etsy anzusprechen
 * --product    → Nur ein bestimmtes Produkt publizieren
 */
const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const CONFIG     = path.join(ROOT, 'etsy-config.json');
const TOKEN_FILE = path.join(ROOT, 'etsy-token.json');
const PRODUCTS   = path.join(ROOT, 'data/products.json');
const LOG_FILE   = path.join(ROOT, 'etsy-listings.json');

const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SINGLE  = args.includes('--product') ? args[args.indexOf('--product') + 1] : null;

// ── Etsy Taxonomy IDs (Kategorien) ─────────────────────────
const TAXONOMY = {
  'lampe':              69,   // Home & Living > Lighting > Lamps
  'lampe bestseller':   69,
  'pflanze':            68,   // Home & Living > Plants & Edibles > Planters & Pots
  'pflanze bestseller': 68,
  'aufbewahrung':       694,  // Home & Living > Storage & Organization > Boxes & Bins
  'gadget':             1080, // Electronics & Accessories > Phone Cases & Covers
  'spiel':              177,  // Toys & Games > Games > Board Games
  'deko':               67,   // Home & Living > Home Décor
  'default':            67,
};

const TAGS_BY_CAT = {
  'lampe':        ['3d gedruckt', 'tischlampe', 'handgefertigt', 'wohndeko', 'unikat', 'designer lampe', 'schreibtischlampe', 'made in germany'],
  'pflanze':      ['3d gedruckt', 'pflanzer', 'selbstbewässernd', 'handgefertigt', 'wohndeko', 'sukkulenten', 'zimmerpflanze', 'made in germany'],
  'aufbewahrung': ['3d gedruckt', 'aufbewahrung', 'handgefertigt', 'organizer', 'wohndeko', 'unikat', 'made in germany', 'geschenk'],
  'gadget':       ['3d gedruckt', 'magsafe', 'apple', 'ladestation', 'iphone', 'handgefertigt', 'kaktus', 'made in germany'],
  'spiel':        ['3d gedruckt', 'tischspiel', 'handgefertigt', 'geschenk', 'deko', 'unikat', 'made in germany', 'schach'],
  'deko':         ['3d gedruckt', 'katze', 'katzenhaus', 'wohndeko', 'couchtisch', 'handgefertigt', 'made in germany', 'haustier'],
  'default':      ['3d gedruckt', 'handgefertigt', 'unikat', 'wohndeko', 'made in germany', 'aurora home', 'designerstück'],
};

const MATERIALS = ['PLA Kunststoff', 'Acrylfarbe', 'Grundierung', 'Handarbeit'];

// ── Helpers ───────────────────────────────────────────────
function loadConfig() {
  if (!fs.existsSync(CONFIG)) throw new Error('etsy-config.json fehlt — erstelle sie zuerst');
  return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
}

function loadToken() {
  if (!fs.existsSync(TOKEN_FILE)) throw new Error('etsy-token.json fehlt — führe zuerst etsy-auth.js aus');
  const token = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  const age = (Date.now() - token.obtained_at) / 1000;
  if (age > token.expires_in - 300) throw new Error('Token abgelaufen — führe etsy-auth.js erneut aus');
  return token;
}

function etsyPrice(eurPrice) {
  // Etsy erwartet den Preis in der kleinsten Einheit (Cent für EUR)
  return Math.round(parseFloat(String(eurPrice).replace(',','.')) * 100);
}

function buildDescription(p) {
  const lines = [
    p.name.toUpperCase() + ' von Aurora Home',
    '',
    p.desc,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '✦ Handgefertigt in Deutschland',
    '✦ 3D-gedruckt, geschliffen und lackiert',
    '✦ Wunschfarbe auf Anfrage möglich',
    '✦ Lieferzeit: 4–6 Werktage',
    '✦ DHL-Versand mit Sendungsverfolgung',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    'MATERIAL: PLA-Kunststoff, Acrylfarbe, Grundierung',
    'Minimale Druckspuren und Schleiflinien sind Teil des handgefertigten Charakters.',
    '',
    'WIDERRUFSRECHT: Bei individuell gewählter Farbe kein Widerruf nach Produktionsbeginn.',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'Aurora Home · Ildiko Fenyes · Krefeld, Deutschland',
  ];
  return lines.join('\n');
}

async function etsy(token, config, method, endpoint, body = null) {
  const url = 'https://api.etsy.com/v3/application' + endpoint;
  const opts = {
    method,
    headers: {
      'Authorization': 'Bearer ' + token.access_token,
      'x-api-key':     config.api_key,
    }
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = new URLSearchParams(body).toString();
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { data = { _raw: text }; }
  if (!res.ok) throw new Error(`Etsy API ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function uploadImage(token, config, shopId, listingId, imgPath) {
  const fullPath = path.join(ROOT, imgPath);
  if (!fs.existsSync(fullPath)) { console.log('    ⚠ Bild nicht gefunden:', imgPath); return null; }

  const imgData = fs.readFileSync(fullPath);
  const b64     = imgData.toString('base64');
  const mimeType = imgPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  try {
    const res = await fetch(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token.access_token,
        'x-api-key':     config.api_key,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        image:     b64,
        rank:      '1',
        overwrite: 'false',
      }).toString()
    });
    if (!res.ok) { const e = await res.text(); console.log('    ⚠ Bild-Upload Fehler:', e.substring(0, 100)); return null; }
    const d = await res.json();
    return d.listing_image_id;
  } catch(e) {
    console.log('    ⚠ Bild-Upload Exception:', e.message);
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────
(async () => {
  console.log('\n' + '═'.repeat(60));
  console.log('  Aurora Home → Etsy' + (DRY_RUN ? ' (DRY RUN)' : ''));
  console.log('═'.repeat(60) + '\n');

  const products = JSON.parse(fs.readFileSync(PRODUCTS, 'utf8'));
  const config   = loadConfig();

  let token, shopId, shippingProfileId;

  if (!DRY_RUN) {
    token  = loadToken();
    shopId = config.shop_id;

    // Lade Versandprofile
    console.log('  Lade Versandprofile...');
    const profiles = await etsy(token, config, 'GET', `/shops/${shopId}/shipping-profiles`);
    if (!profiles.results?.length) throw new Error('Keine Versandprofile gefunden — erstelle erst eines in deinem Etsy-Shop');
    shippingProfileId = profiles.results[0].shipping_profile_id;
    console.log(`  ✓ Versandprofil: ${profiles.results[0].title} (${shippingProfileId})\n`);
  }

  // Lade bestehende Listings-Log
  const log = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : {};

  const toPublish = SINGLE ? products.filter(p => p.name.toLowerCase().includes(SINGLE.toLowerCase())) : products;
  console.log(`  Produkte zu verarbeiten: ${toPublish.length}\n`);

  for (const p of toPublish) {
    const catKey    = p.catKey?.split(' ')[0] || 'default';
    const taxonomyId = TAXONOMY[p.catKey] || TAXONOMY[catKey] || TAXONOMY.default;
    const tags       = [...(TAGS_BY_CAT[catKey] || TAGS_BY_CAT.default), p.name.toLowerCase()].slice(0, 13);
    const images     = p.images || (p.img ? [p.img] : []);
    const price      = etsyPrice(p.price);
    const desc       = buildDescription(p);

    console.log(`  → ${p.name} (${p.price} €)`);

    if (DRY_RUN) {
      console.log(`    Taxonomy:    ${taxonomyId}`);
      console.log(`    Tags:        ${tags.join(', ')}`);
      console.log(`    Preis:       ${price} Cent`);
      console.log(`    Bilder:      ${images.length}`);
      console.log('');
      continue;
    }

    // Bereits publiziert?
    if (log[p.name]?.listing_id) {
      console.log(`    ⟳ Bereits auf Etsy (ID: ${log[p.name].listing_id}) — übersprungen`);
      console.log('');
      continue;
    }

    try {
      // 1. Draft Listing erstellen
      const listing = await etsy(token, config, 'POST', `/shops/${shopId}/listings`, {
        quantity:             '10',
        title:                p.name + ' — Handgefertigte 3D-Deko aus Deutschland',
        description:          desc,
        price:                (price / 100).toFixed(2),
        who_made:             'i_did',
        when_made:            'made_to_order',
        taxonomy_id:          String(taxonomyId),
        shipping_profile_id:  String(shippingProfileId),
        tags:                 tags,
        materials:            MATERIALS,
        is_personalizable:    'true',
        personalization_instructions: 'Wunschfarbe angeben (optional)',
      });

      const listingId = listing.listing_id;
      console.log(`    ✓ Listing erstellt: ${listingId}`);

      // 2. Bilder hochladen
      let uploadedImages = 0;
      for (let i = 0; i < Math.min(images.length, 10); i++) {
        await new Promise(r => setTimeout(r, 500)); // Rate limiting
        const imgId = await uploadImage(token, config, shopId, listingId, images[i]);
        if (imgId) { uploadedImages++; console.log(`    ✓ Bild ${i+1} hochgeladen`); }
      }

      // 3. In Log speichern
      log[p.name] = { listing_id: listingId, url: `https://www.etsy.com/listing/${listingId}`, published_at: new Date().toISOString(), images_uploaded: uploadedImages };
      fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));

      console.log(`    ✓ ${uploadedImages}/${images.length} Bilder hochgeladen`);
      console.log(`    ✓ URL: https://www.etsy.com/listing/${listingId}`);
      await new Promise(r => setTimeout(r, 1000)); // Rate limiting

    } catch(e) {
      console.log(`    ✗ Fehler: ${e.message}`);
    }
    console.log('');
  }

  console.log('═'.repeat(60));
  console.log('  Fertig!');
  if (!DRY_RUN) {
    const count = Object.keys(log).length;
    console.log(`  ${count} Listings gespeichert in etsy-listings.json`);
    console.log(`  Etsy Shop: https://www.etsy.com/shop/${config.shop_name || 'AuroraHomeFenyes'}`);
    console.log('  ⚠ Listings sind als DRAFT gespeichert — in Etsy Shop Manager aktivieren!');
  }
  console.log('═'.repeat(60) + '\n');
})().catch(e => { console.error('\n  ✗ Fehler:', e.message); process.exit(1); });
