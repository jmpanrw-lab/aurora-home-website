/**
 * etsy-auth.js — Etsy OAuth 2.0 mit PKCE
 * Aufruf: node scripts/etsy-auth.js
 *
 * Startet lokalen Server auf Port 3333, öffnet Browser für Autorisierung,
 * fängt Callback ab und speichert Token in etsy-token.json
 */
const http     = require('http');
const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');
const { execSync } = require('child_process');

const ROOT       = path.join(__dirname, '..');
const CONFIG     = path.join(ROOT, 'etsy-config.json');
const TOKEN_FILE = path.join(ROOT, 'etsy-token.json');

// Lade Config
if (!fs.existsSync(CONFIG)) {
  console.error('\n  ✗ etsy-config.json fehlt!\n');
  console.log('  Erstelle die Datei mit:');
  console.log('  { "api_key": "DEIN_ETSY_API_KEY", "shop_id": "DEINE_SHOP_ID" }\n');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));

const REDIRECT_URI  = 'http://localhost:3333/callback';
const SCOPES        = 'listings_w listings_r shops_r transactions_r';

// PKCE
function base64url(buf) {
  return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
const verifier  = base64url(crypto.randomBytes(32));
const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
const state     = base64url(crypto.randomBytes(16));

const authUrl = new URL('https://www.etsy.com/oauth/connect');
authUrl.searchParams.set('response_type',          'code');
authUrl.searchParams.set('client_id',              config.api_key);
authUrl.searchParams.set('redirect_uri',           REDIRECT_URI);
authUrl.searchParams.set('scope',                  SCOPES);
authUrl.searchParams.set('state',                  state);
authUrl.searchParams.set('code_challenge',         challenge);
authUrl.searchParams.set('code_challenge_method',  'S256');

console.log('\n  Aurora Home — Etsy OAuth');
console.log('  ─────────────────────────────────────────────');
console.log('\n  Öffne diesen Link im Browser:\n');
console.log('  ' + authUrl.toString());
console.log('\n  Warte auf Autorisierung...\n');

// Öffne Browser automatisch
try {
  if (process.platform === 'win32') execSync('start "" "' + authUrl.toString() + '"', { stdio:'ignore' });
} catch(e) {}

// Lokaler Callback-Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3333');
  if (url.pathname !== '/callback') return;

  const code      = url.searchParams.get('code');
  const cbState   = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    res.writeHead(400, { 'Content-Type': 'text/html;charset=utf-8' });
    res.end('<h1>Fehler: ' + errorParam + '</h1><p>Bitte versuche es erneut.</p>');
    server.close();
    process.exit(1);
  }

  if (cbState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html;charset=utf-8' });
    res.end('<h1>State mismatch — möglicher CSRF</h1>');
    server.close();
    process.exit(1);
  }

  // Token Exchange
  try {
    const tokenRes = await fetch('https://api.etsy.com/v3/public/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     config.api_key,
        redirect_uri:  REDIRECT_URI,
        code,
        code_verifier: verifier,
      }).toString()
    });

    if (!tokenRes.ok) {
      const e = await tokenRes.text();
      throw new Error('Token exchange failed: ' + e);
    }

    const token = await tokenRes.json();
    token.obtained_at = Date.now();
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2));

    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
    res.end(`
      <html><head><meta charset="UTF-8"></head><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0a0914;color:#f4f0ff">
        <h1 style="color:#c8906a">✓ Etsy verbunden!</h1>
        <p>Du kannst dieses Fenster schließen und zum Terminal zurückkehren.</p>
      </body></html>
    `);

    console.log('  ✓ Token erhalten und gespeichert → etsy-token.json');
    console.log('  ✓ Läuft ab in: ' + Math.round(token.expires_in / 3600) + ' Stunden\n');

    server.close();
    process.exit(0);

  } catch(e) {
    res.writeHead(500, { 'Content-Type': 'text/html;charset=utf-8' });
    res.end('<h1>Fehler: ' + e.message + '</h1>');
    console.error('  ✗ Fehler:', e.message);
    server.close();
    process.exit(1);
  }
});

server.listen(3333, () => {
  console.log('  Server läuft auf http://localhost:3333 — warte auf Etsy Callback...\n');
});
