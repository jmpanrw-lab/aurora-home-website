// netlify/functions/contact.js
// Handles: bestellung | wax-anfrage | resin-anfrage
// E-Mail-Versand über Resend (https://resend.com).
//
// Benötigte Env-Variablen (Netlify → Site settings → Environment):
//   RESEND_API_KEY   (Pflicht)   – API-Key aus dem Resend-Dashboard
//   RESEND_FROM      (optional)  – Absender, Domain muss in Resend verifiziert sein
//                                  Default: "Aurora Home <noreply@aurora-home.store>"
//   ADMIN_EMAIL      (optional)  – Shop-Postfach, das Benachrichtigungen erhält
//                                  Default: "fenyesdesign@outlook.com"
//   ALLOWED_ORIGINS  (optional)  – kommagetrennte Liste erlaubter Origins (CSRF-Schutz)

const RESEND_API_KEY  = process.env.RESEND_API_KEY;
// TEMPORÄR: onboarding@resend.dev funktioniert ohne Domain-Verifizierung,
// liefert aber nur an die Resend-Account-Inhaber-Adresse. Sobald
// aurora-home.store (DKIM) verifiziert ist → zurück auf noreply@aurora-home.store.
const FROM_EMAIL      = process.env.RESEND_FROM || 'Aurora Home <onboarding@resend.dev>';
const ADMIN_EMAIL     = process.env.ADMIN_EMAIL || 'fenyesdesign@outlook.com';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS
  || 'https://aurora-home.store,https://www.aurora-home.store,https://aurora-home.netlify.app'
).split(',').map(s => s.trim()).filter(Boolean);

const SEC_HEADERS = {
  'Content-Type':           'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options':        'DENY',
  'Referrer-Policy':        'strict-origin-when-cross-origin',
};

// ── In-Memory Rate Limiter (5 Requests / 60 s pro IP) ─────────
const rateMap = new Map();
const RATE_LIMIT  = 5;
const RATE_WINDOW = 60_000;
function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateMap.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// ── HTML-Encoding (XSS-Schutz in E-Mails) ─────────────────────
function he(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ── Eingabe-Bereinigung ───────────────────────────────────────
function sanitize(val, maxLen = 300) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\r\n]{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen);
}

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// ── Resend-Versand ────────────────────────────────────────────
async function sendEmail({ to, subject, html, replyTo }) {
  const payload = { from: FROM_EMAIL, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const raw = await res.text();
    console.error('[contact] Resend-Fehler:', res.status, raw.slice(0, 300));
    throw new Error(`resend_${res.status}`);
  }
}

// ── E-Mail-Templates ──────────────────────────────────────────
// d enthält bereits sanitisierte UND HTML-encodete Werte.

function mailBestellung(d) {
  const kundeSubject = `Deine Aurora Home Bestellung ${d.bestellnr} ✨`;
  const kundeHtml = `
<div style="font-family:sans-serif;max-width:600px;color:#1a1a2e">
  <h2 style="color:#c8906a">Danke für deine Bestellung! ✨</h2>
  <p>Hallo ${d.vorname},</p>
  <p>ich habe deine Bestellung erhalten und melde mich in Kürze mit einer Bestätigung. Versand erfolgt in 4–6 Werktagen inkl. DHL-Tracking.</p>
  <div style="background:#f9f5ff;border-left:3px solid #c8906a;padding:16px;margin:20px 0">
    <strong>Bestellnummer: ${d.bestellnr}</strong><br>
    <pre style="font-size:13px;margin-top:8px;white-space:pre-wrap">${d.bestelldetails}</pre>
  </div>
  <p><strong>Lieferadresse:</strong><br>${d.vorname} ${d.nachname}<br>${d.strasse}<br>${d.plz} ${d.stadt}<br>${d.land}</p>
  ${d.farbe ? `<p><strong>Wunschfarbe:</strong> ${d.farbe}</p>` : ''}
  ${d.nachricht ? `<p><strong>Nachricht:</strong> ${d.nachricht}</p>` : ''}
  <p style="margin-top:24px">Liebe Grüße,<br><strong>Ildiko</strong><br>
  <a href="https://aurora-home.store" style="color:#c8906a">Aurora Home</a></p>
</div>`;

  const shopSubject = `🛍️ Neue Bestellung ${d.bestellnr} von ${d.vorname} ${d.nachname}`;
  const shopHtml = `
<div style="font-family:sans-serif;max-width:600px">
  <h2>🛍️ Neue Bestellung eingegangen</h2>
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:6px;font-weight:bold">Bestellnr.</td><td style="padding:6px">${d.bestellnr}</td></tr>
    <tr><td style="padding:6px;font-weight:bold">Kunde</td><td style="padding:6px">${d.vorname} ${d.nachname}</td></tr>
    <tr><td style="padding:6px;font-weight:bold">E-Mail</td><td style="padding:6px"><a href="mailto:${d.email}">${d.email}</a></td></tr>
    <tr><td style="padding:6px;font-weight:bold">Adresse</td><td style="padding:6px">${d.strasse}, ${d.plz} ${d.stadt}, ${d.land}</td></tr>
    <tr><td style="padding:6px;font-weight:bold">Farbe</td><td style="padding:6px">${d.farbe || '—'}</td></tr>
    <tr><td style="padding:6px;font-weight:bold">Zahlungsart</td><td style="padding:6px">${d.zahlungsart || '—'}</td></tr>
    <tr><td style="padding:6px;font-weight:bold">Nachricht</td><td style="padding:6px">${d.nachricht || '—'}</td></tr>
  </table>
  <div style="background:#f0f0f0;padding:12px;margin-top:16px;border-radius:4px">
    <strong>Bestelldetails:</strong>
    <pre style="font-size:13px;white-space:pre-wrap">${d.bestelldetails}</pre>
  </div>
</div>`;

  return { kundeSubject, kundeHtml, shopSubject, shopHtml };
}

function mailWax(d) {
  const kundeSubject = 'Deine Wax Melt Anfrage bei Aurora Home ✨';
  const kundeHtml = `
<div style="font-family:sans-serif;max-width:600px;color:#1a1a2e">
  <h2 style="color:#c8906a">Deine Wax Melt Anfrage 🕯️</h2>
  <p>Hallo ${d.vorname},</p>
  <p>ich habe deine Anfrage erhalten! Ich melde mich innerhalb von <strong>48 Stunden</strong> mit einem Angebot und Zahlungslink.</p>
  <div style="background:#f9f5ff;border-left:3px solid #c8906a;padding:16px;margin:20px 0">
    <strong>Gewünschte Düfte:</strong><br>${d.duefte}<br><br>
    <strong>Lieferadresse:</strong><br>${d.adresse}
  </div>
  <p>Liebe Grüße,<br><strong>Ildiko</strong><br>
  <a href="https://aurora-home.store" style="color:#c8906a">Aurora Home</a></p>
</div>`;

  const shopSubject = `🕯️ Neue Wax-Anfrage von ${d.vorname} ${d.nachname}`;
  const shopHtml = `
<div style="font-family:sans-serif;max-width:600px">
  <h2>🕯️ Neue Wax Melt Anfrage</h2>
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:6px;font-weight:bold">Name</td><td style="padding:6px">${d.vorname} ${d.nachname}</td></tr>
    <tr><td style="padding:6px;font-weight:bold">E-Mail</td><td style="padding:6px"><a href="mailto:${d.email}">${d.email}</a></td></tr>
    <tr><td style="padding:6px;font-weight:bold">Düfte</td><td style="padding:6px">${d.duefte}</td></tr>
    <tr><td style="padding:6px;font-weight:bold">Adresse</td><td style="padding:6px">${d.adresse}</td></tr>
  </table>
</div>`;

  return { kundeSubject, kundeHtml, shopSubject, shopHtml };
}

function mailResin(d) {
  const kundeSubject = 'Deine Custom Resin Anfrage bei Aurora Home ✨';
  const kundeHtml = `
<div style="font-family:sans-serif;max-width:600px;color:#1a1a2e">
  <h2 style="color:#9b7fd4">Deine Resin Anfrage 🎨</h2>
  <p>Hallo ${d.vorname},</p>
  <p>vielen Dank für deine Custom Resin Anfrage! Ich schaue mir das genau an und melde mich innerhalb von <strong>48 Stunden</strong> mit einem persönlichen Angebot. Erst nach deiner Bestätigung wird eine Anzahlung (50&nbsp;%) fällig.</p>
  <div style="background:#f9f5ff;border-left:3px solid #9b7fd4;padding:16px;margin:20px 0">
    <strong>Stufe:</strong> ${d.stufe}<br><br>
    <strong>Beschreibung:</strong><br>${d.beschreibung}
  </div>
  <p>Liebe Grüße,<br><strong>Ildiko</strong><br>
  <a href="https://aurora-home.store" style="color:#c8906a">Aurora Home</a></p>
</div>`;

  const shopSubject = `🎨 Neue Resin-Anfrage von ${d.vorname} ${d.nachname}`;
  const shopHtml = `
<div style="font-family:sans-serif;max-width:600px">
  <h2>🎨 Neue Custom Resin Anfrage</h2>
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:6px;font-weight:bold">Name</td><td style="padding:6px">${d.vorname} ${d.nachname}</td></tr>
    <tr><td style="padding:6px;font-weight:bold">E-Mail</td><td style="padding:6px"><a href="mailto:${d.email}">${d.email}</a></td></tr>
    <tr><td style="padding:6px;font-weight:bold">Stufe</td><td style="padding:6px">${d.stufe}</td></tr>
    <tr><td style="padding:6px;font-weight:bold">Beschreibung</td><td style="padding:6px">${d.beschreibung}</td></tr>
  </table>
</div>`;

  return { kundeSubject, kundeHtml, shopSubject, shopHtml };
}

// ── Handler ───────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: SEC_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: SEC_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // Origin-Check (CSRF)
  const origin = event.headers.origin || event.headers.referer || '';
  const originOk = ALLOWED_ORIGINS.some(o => origin.startsWith(o)) || /^https:\/\/[a-z0-9-]+\.netlify\.app/.test(origin);
  if (!originOk) {
    console.warn('[contact] Unerlaubter Origin:', origin);
    return { statusCode: 403, headers: SEC_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // Rate Limiting
  const clientIp = (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
                || event.headers['x-nf-client-connection-ip'] || 'unknown';
  if (isRateLimited(clientIp)) {
    return { statusCode: 429, headers: { ...SEC_HEADERS, 'Retry-After': '60' }, body: JSON.stringify({ error: 'Zu viele Anfragen. Bitte warte eine Minute.' }) };
  }

  // Konfigurationscheck
  if (!RESEND_API_KEY) {
    console.error('[contact] RESEND_API_KEY fehlt');
    return { statusCode: 500, headers: SEC_HEADERS, body: JSON.stringify({ error: 'E-Mail nicht konfiguriert (RESEND_API_KEY fehlt).' }) };
  }

  // Body-Größe
  if (event.body && event.body.length > 20_000) {
    return { statusCode: 413, headers: SEC_HEADERS, body: JSON.stringify({ error: 'Anfrage zu groß' }) };
  }

  let raw;
  try { raw = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: SEC_HEADERS, body: JSON.stringify({ error: 'Ungültiges Format' }) }; }

  const type = raw.type;
  const VALID_TYPES = ['bestellung', 'wax-anfrage', 'resin-anfrage'];
  if (!VALID_TYPES.includes(type)) {
    return { statusCode: 400, headers: SEC_HEADERS, body: JSON.stringify({ error: 'Unbekannter Formulartyp' }) };
  }

  // Gemeinsame Felder
  const email = sanitize(raw.email, 254);
  if (!EMAIL_RE.test(email)) {
    return { statusCode: 400, headers: SEC_HEADERS, body: JSON.stringify({ error: 'Ungültige E-Mail-Adresse' }) };
  }

  // Sanitisierte + encodete Daten je Typ aufbauen
  let d, mailData;

  if (type === 'bestellung') {
    const f = {
      vorname:        sanitize(raw.vorname, 80),
      nachname:       sanitize(raw.nachname, 80),
      strasse:        sanitize(raw.strasse, 120),
      plz:            sanitize(raw.plz, 10),
      stadt:          sanitize(raw.stadt, 80),
      land:           sanitize(raw.land, 10),
      bestelldetails: sanitize(raw.bestelldetails, 2000),
      farbe:          sanitize(raw.farbe, 80),
      nachricht:      sanitize(raw.nachricht, 500),
      zahlungsart:    sanitize(raw.zahlungsart, 30),
      bestellnr:      sanitize(raw.bestellnr, 30),
    };
    if (!f.vorname || !f.nachname || !f.strasse || !f.plz || !f.stadt || !f.bestellnr) {
      return { statusCode: 400, headers: SEC_HEADERS, body: JSON.stringify({ error: 'Pflichtfelder fehlen oder ungültig' }) };
    }
    if (f.zahlungsart && !['PayPal', 'Banküberweisung'].includes(f.zahlungsart)) {
      return { statusCode: 400, headers: SEC_HEADERS, body: JSON.stringify({ error: 'Ungültige Zahlungsart' }) };
    }
    d = { email, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, he(v)])) };
    mailData = mailBestellung(d);

  } else if (type === 'wax-anfrage') {
    const f = {
      vorname:  sanitize(raw.vorname, 80),
      nachname: sanitize(raw.nachname, 80),
      duefte:   sanitize(raw.duefte, 500),
      adresse:  sanitize(raw.adresse, 200),
    };
    if (!f.vorname || !f.nachname || !f.duefte || !f.adresse) {
      return { statusCode: 400, headers: SEC_HEADERS, body: JSON.stringify({ error: 'Pflichtfelder fehlen oder ungültig' }) };
    }
    d = { email, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, he(v)])) };
    mailData = mailWax(d);

  } else { // resin-anfrage
    const f = {
      vorname:      sanitize(raw.vorname, 80),
      nachname:     sanitize(raw.nachname, 80),
      stufe:        sanitize(raw.stufe, 50),
      beschreibung: sanitize(raw.beschreibung, 1000),
    };
    if (!f.vorname || !f.nachname || !f.stufe) {
      return { statusCode: 400, headers: SEC_HEADERS, body: JSON.stringify({ error: 'Pflichtfelder fehlen oder ungültig' }) };
    }
    if (!['Basis', 'Standard', 'Premium', 'Meisterwerk'].includes(f.stufe)) {
      return { statusCode: 400, headers: SEC_HEADERS, body: JSON.stringify({ error: 'Ungültige Qualitätsstufe' }) };
    }
    d = { email, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, he(v)])) };
    mailData = mailResin(d);
  }

  const { kundeSubject, kundeHtml, shopSubject, shopHtml } = mailData;

  // 1) Shop-Benachrichtigung (geschäftskritisch — Fehler hier ist fatal)
  try {
    await sendEmail({ to: ADMIN_EMAIL, subject: shopSubject, html: shopHtml, replyTo: email });
  } catch (err) {
    console.error('[contact] Shop-Mail fehlgeschlagen:', err.message);
    return { statusCode: 502, headers: SEC_HEADERS, body: JSON.stringify({ error: 'E-Mail konnte nicht gesendet werden. Bitte erneut versuchen.' }) };
  }

  // 2) Kundenbestätigung (nicht-fatal — Bestellung ist bereits erfasst)
  try {
    await sendEmail({ to: email, subject: kundeSubject, html: kundeHtml, replyTo: ADMIN_EMAIL });
  } catch (err) {
    console.error('[contact] Kunden-Mail fehlgeschlagen (Bestellung trotzdem erfasst):', err.message);
  }

  return {
    statusCode: 200,
    headers: SEC_HEADERS,
    body: JSON.stringify({ success: true, ok: true, orderId: d.bestellnr || null, type }),
  };
};
