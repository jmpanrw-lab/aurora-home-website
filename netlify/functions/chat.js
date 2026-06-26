/**
 * Netlify Function: Aurora Chat
 * POST /.netlify/functions/chat
 * Body: { messages: [{role, content}] }
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'no_key', message: 'API key not configured' })
    };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { messages = [] } = body;

  const SYSTEM = `Du bist Aurora — die digitale Assistentin von Aurora Home, einem Studio in Deutschland für handgefertigte 3D-gedruckte Wohndeko, Premium Wax Melts und Custom Resin Figuren. Geführt von Ildiko Fenyes aus Krefeld.

DEINE ROLLE: Besucher beraten, Fragen beantworten, bei Bestellungen und individuellen Wünschen weiterhelfen.
TON: warm aber premium, immer auf Du, Deutsch. Bei Englisch kurz auf Englisch antworten.
STIL: 2–4 Sätze. Keine Aufzählungen außer wenn nötig. Keine Emojis. Klar und persönlich.

KOLLEKTION (handgefertigt in Deutschland, Lieferzeit 4–6 Werktage):
• Bucket Lampe 42,90 € — Schreibtischlampe mit Ablage-Tray, portabel
• Bonsai Spiel 32,90 € — Balancier-Tischspiel und Deko
• Budsy Pillenbaum 27,90 € — Wöchentlicher Pillenspender (Mo–So)
• Eve Vase 24,90 € — Selbstbewässernde Vase mit S-Profil
• Flora Chess 79,90 € — Vollständiges Blumen-Schachset
• Little Jewel 34,90 € — Schmuckkästchen als Pflanze
• Solana Pflanzer 44,90 € — Selbstbewässernder Pflanzer, BESTSELLER
• Spiky Ladehalter 24,90 € — MagSafe Kaktus-Ladehalter
• Spiky Mini 22,90 € — Apple Watch Ladestation im Kaktus
• Aloe Gießkanne 32,90 € — Gießkanne mit Wechsel-Aufsatz
• Eclipse Lampe 54,90 € — Tischlampe mit Lampenschirm, BESTSELLER
• Gelato Ladestation 37,90 € — iPhone MagSafe + Apple Watch Combo
• Nori Katzenhaus 89,90 € — Katzenhaus + Couchtisch in einem

WAX MELTS: 12 Düfte, 7,90 € / Tüte (6 Stück), 100% Sojawachs. Probier-Set: 3 Düfte 19,90 €.
GASTGESCHENKE AUS WACHS: Aurora und Mary wurden eingeladen, Dekoration und duftende Gastgeschenke für Hochzeiten zu gestalten. Mary ("Waxmelts Mutti") gießt Duftkerzen, Wax Melts und kleine Wachskunstwerke in kleinen Chargen. Auf der Website ist ein echter Hochzeitsauftrag als sichtbare Bildreferenz aus der PDF eingebunden, ohne Personenfoto, mit Verpackung, Blüten, Tags und Tischwirkung. Beispiele: herzförmige Kerze mit Duft ab 3,20 €, herzförmige Wax-Melts am Spieß ab 4,20 €, Gänseblume mit Duft ab 3,20 €, Soja Wax Kerze mit Rose ab 8,00 €. Personalisierung mit Namen, Datum, Etiketten, Schleifen, Geschenkboxen und Farben wie Rosé, Salbei, Elfenbein oder Wunschfarben. Premium-Duftnoten: One in Million, Baccaret Red, Flower Bomb, Cherry Blossom, Nummer Five, Vanilla, Midnight Phantom. Anfragen und Abstimmung ausschließlich per E-Mail.

CUSTOM RESIN: Stufe 01 ab 150 €, Stufe 02 ab 300 €, Stufe 03 ab 700 €, Stufe 04 ab 1.500 €. 50% Anzahlung vorab.

VERSAND: 4,90 € Deutschland — gratis ab 60 € · EU 9,90 € · Weltweit 14,90 €
ZAHLUNG: PayPal (Käuferschutz) oder Banküberweisung. Zahlung nach Bestätigung.

REGELN:
- Für konkrete Bestellungen und Anfragen: auf das Kontaktformular im Shop hinweisen
- Wenn du etwas nicht weißt: ehrlich sagen und auf den Chat im Shop verweisen
- Kein Verkaufsdruck — kleine Werkstatt nach Feierabend
- Widerrufsrecht: NICHT bei individuell gefertigten Waren (3D-Farbvarianten, Custom Resin)`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: SYSTEM,
        messages: messages.slice(-6)  // nur letzte 6 Nachrichten für Kontext
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', response.status, err);
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'api_error', status: response.status })
      };
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || '';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply })
    };

  } catch(e) {
    console.error('Chat function error:', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'internal', message: e.message })
    };
  }
};
