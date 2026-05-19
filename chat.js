// netlify/functions/chat.js
// Aurora Home — Anthropic API Proxy
// API-Key setzen unter: Netlify → Site Configuration → Environment Variables
// Variable: ANTHROPIC_API_KEY  Wert: sk-ant-...

export async function handler(event) {

  const CORS = {
    'Access-Control-Allow-Origin': 'https://aurora-home.store',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { messages } = JSON.parse(event.body || '{}');

    if (!messages || !Array.isArray(messages)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'messages fehlt' }) };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return {
        statusCode: response.status,
        headers: CORS,
        body: JSON.stringify({ error: 'API-Fehler' }),
      };
    }

    const data = await response.json();
    const reply = data?.content?.[0]?.text ?? '';

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ reply }),
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Interner Fehler' }),
    };
  }
}
