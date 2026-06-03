/**
 * seo_patch.js — einmalig ausführen: node scripts/seo_patch.js
 * Patcht index.html für GEO/SGE-Optimierung
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');

let c = fs.readFileSync(HTML, 'utf8');

// ── 1. Static Schema: aurora-home.de ─────────────────────────
c = c.replace(
  /"@id": "https:\/\/jmpanrw-lab\.github\.io\/aurora-home-website\/#org"/g,
  '"@id": "https://aurora-home.de/#org"'
);
c = c.replace(
  /"url": "https:\/\/jmpanrw-lab\.github\.io\/aurora-home-website\/"/g,
  '"url": "https://aurora-home.de/"'
);
c = c.replace(
  /"@id": "https:\/\/jmpanrw-lab\.github\.io\/aurora-home-website\/#website"/g,
  '"@id": "https://aurora-home.de/#website"'
);
c = c.replace(
  /"publisher": \{ "@id": "https:\/\/jmpanrw-lab\.github\.io\/aurora-home-website\/#org" \}/g,
  '"publisher": { "@id": "https://aurora-home.de/#org" }'
);
console.log('✓ Static schema URLs updated');

// ── 2. Product Schema: SITE-URL + Material + Vegan + FAQ ─────
c = c.replace(
  'const SITE = "https://jmpanrw-lab.github.io/aurora-home-website/";',
  'const SITE = "https://aurora-home.de/";'
);

// Erweitere das Product-Objekt im Schema um material, additionalProperty, shippingDetails
const OLD_OFFERS = `        "offers": {
          "@type": "Offer",
          "url": SITE + "#produkt-" + slug(p.name),
          "priceCurrency": "EUR",
          "price": p.price.replace(",", "."),
          "availability": "https://schema.org/MadeToOrder",
          "itemCondition": "https://schema.org/NewCondition",
          "seller": { "@id": SITE + "#org" }
        }`;

const NEW_OFFERS = `        "material": p.material || "PLA-Filament, handlackiert",
        "countryOfOrigin": { "@type": "Country", "name": "DE" },
        "additionalProperty": [
          { "@type": "PropertyValue", "name": "Herstellungsart", "value": "Handgefertigt auf Anfrage" },
          { "@type": "PropertyValue", "name": "Tierfrei", "value": "Vegan" },
          { "@type": "PropertyValue", "name": "Herkunft", "value": "Made in Germany — Krefeld" }
        ],
        "offers": {
          "@type": "Offer",
          "url": SITE + "#produkt-" + slug(p.name),
          "priceCurrency": "EUR",
          "price": p.price.replace(",", "."),
          "priceValidUntil": new Date(Date.now() + 90*24*60*60*1000).toISOString().slice(0,10),
          "availability": (p.stock > 0 ? "https://schema.org/InStock" : p.stock === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/MadeToOrder"),
          "itemCondition": "https://schema.org/NewCondition",
          "seller": { "@id": SITE + "#org" }
        }`;

if (c.includes(OLD_OFFERS)) {
  c = c.replace(OLD_OFFERS, NEW_OFFERS);
  console.log('✓ Product schema enhanced');
} else {
  console.warn('✗ Product offers block not found');
}

// FAQ-Schema injizieren — füge nach dem ItemList-Block ein
const FAQ_INJECT = `
  // FAQPage-Schema aus Produkt-FAQ-Feldern
  const allFaqs = PRODUCTS.flatMap(p => p.faq || []);
  if(allFaqs.length){
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": allFaqs.map(f => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a }
      }))
    };
    const faqTag = document.createElement("script");
    faqTag.type = "application/ld+json";
    faqTag.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(faqTag);
  }
`;

const AFTER_ITEMLIST = `  const tag = document.createElement("script");
  tag.type = "application/ld+json";
  tag.textContent = JSON.stringify(itemList);
  document.head.appendChild(tag);
})();`;

if (c.includes(AFTER_ITEMLIST)) {
  c = c.replace(AFTER_ITEMLIST, FAQ_INJECT + '\n' + AFTER_ITEMLIST);
  console.log('✓ FAQPage schema injected');
} else {
  console.warn('✗ ItemList end block not found');
}

// ── 3. Alt-Texte ─────────────────────────────────────────────
c = c.replace(
  'const img=p.img?`<img src="${p.img}" alt="${p.name}" loading="lazy">`:',
  'const img=p.img?`<img src="${p.img}" alt="${p.altText||p.name}" loading="lazy">`:',
);
console.log('✓ renderProducts alt text');

c = c.replace(
  '`<img src="${src}" alt="Bild ${i+1}" loading="lazy">`',
  '`<img src="${src}" alt="${(p.altText||p.name) + \' — Ansicht \' + (i+1)}" loading="lazy">`'
);
console.log('✓ Modal alt texts');

c = c.replace(
  '<img src="assets/eclipse-1.jpg" alt="Eclipse Lampe" loading="lazy">',
  '<img src="assets/eclipse-1.jpg" alt="Eclipse Tischlampe mit rundem Lampenschirm — mattschwarz lackiertes PLA, Quiet Luxury Schreibtisch-Statement" loading="lazy">'
);
c = c.replace(
  '<img src="assets/solana-pflanzer.jpg" alt="Solana Pflanzer" loading="lazy">',
  '<img src="assets/solana-pflanzer.jpg" alt="Solana selbstbewässernder Pflanzer im Ring-Design — cremeweiß matt, biophiles Quiet Luxury Wohnzimmer-Accessoire" loading="lazy">'
);
console.log('✓ Bestseller alt texts');

// ── 4. LCP-Optimierung: preconnect + fetchpriority Hero ──────
if (!c.includes('preconnect" href="https://unpkg.com"')) {
  c = c.replace(
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://unpkg.com">\n<link rel="preconnect" href="https://fonts.googleapis.com">'
  );
  console.log('✓ unpkg preconnect added');
}

// Hero-Canvas: fetchpriority am Wrapper für schnelleres Rendering
c = c.replace(
  '<div class="hero-3d-wrap" id="hero3d">',
  '<div class="hero-3d-wrap" id="hero3d" fetchpriority="high">'
);
console.log('✓ Hero fetchpriority set');

// Three.js-Script auf defer setzen um Main Thread nicht zu blockieren
c = c.replace(
  '<script type="module">',
  '<script type="module" defer>'
);
console.log('✓ Three.js module deferred');

// ── Sync: products.json neu einlesen (altText + material + faq) ──
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
const pStr = 'const PRODUCTS = ' + JSON.stringify(products, null, 2) + ';';
c = c.replace(/const PRODUCTS = \[[\s\S]*?\];/, pStr);
console.log('✓ PRODUCTS array synced (' + products.length + ' Produkte)');

fs.writeFileSync(HTML, c, 'utf8');
console.log('\n✅ Fertig — alle SEO-Patches angewendet');
