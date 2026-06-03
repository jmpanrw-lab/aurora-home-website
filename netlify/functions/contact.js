// netlify/functions/contact.js
// Handles: bestellung | wax-anfrage | resin-anfrage
// Env vars needed: OUTLOOK_EMAIL, OUTLOOK_PASSWORD

const nodemailer = require('nodemailer');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function makeTransport() {
  return nodemailer.createTransport({
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.OUTLOOK_EMAIL,
      pass: process.env.OUTLOOK_PASSWORD,
    },
    tls: { ciphers: 'SSLv3' },
  });
}

// ── E-Mail Templates ──────────────────────────────────────────

function mailBestellung(d) {
  const kundeSubject = `Deine Aurora Home Bestellung ${d.bestellnr} ✨`;
  const kundeHtml = `
<div style="font-family:sans-serif;max-width:600px;color:#1a1a2e">
  <h2 style="color:#c8906a">Danke für deine Bestellung! ✨</h2>
  <p>Hallo ${d.vorname},</p>
  <p>ich habe deine Bestellung erhalten und melde mich innerhalb von <strong>48 Stunden</strong> mit einer Bestätigung.</p>

  <div style="background:#f9f5ff;border-left:3px solid #c8906a;padding:16px;margin:20px 0">
    <strong>Bestellnummer: ${d.bestellnr}</strong><br>
    <pre style="font-size:13px;margin-top:8px">${d.bestelldetails}</pre>
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
    <pre style="font-size:13px">${d.bestelldetails}</pre>
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
  <p>vielen Dank für deine Custom Resin Anfrage! Ich schaue mir das genau an und melde mich innerhalb von <strong>48 Stunden</strong> mit einem persönlichen Angebot.</p>
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
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { type } = data;
  if (!type) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'type fehlt' }) };
  }

  let mailData;
  if (type === 'bestellung')    mailData = mailBestellung(data);
  else if (type === 'wax-anfrage')  mailData = mailWax(data);
  else if (type === 'resin-anfrage') mailData = mailResin(data);
  else {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unbekannter type: ${type}` }) };
  }

  const { kundeSubject, kundeHtml, shopSubject, shopHtml } = mailData;
  const shopEmail = process.env.OUTLOOK_EMAIL;

  try {
    const transport = makeTransport();

    // Kunden-E-Mail
    await transport.sendMail({
      from: `"Aurora Home" <${shopEmail}>`,
      to: data.email,
      subject: kundeSubject,
      html: kundeHtml,
    });

    // Shop-Benachrichtigung
    await transport.sendMail({
      from: `"Aurora Home" <${shopEmail}>`,
      to: shopEmail,
      subject: shopSubject,
      html: shopHtml,
    });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        success: true,
        orderId: data.bestellnr || null,
        type,
      }),
    };
  } catch (err) {
    console.error('Mailer error:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'E-Mail konnte nicht gesendet werden', detail: err.message }),
    };
  }
};
