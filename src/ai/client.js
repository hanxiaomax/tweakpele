/** OpenAI-compatible chat completions, called straight from the browser.
 *  The key goes only to `{baseUrl}/chat/completions`; nothing is logged. */

export function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

const redact = (text, secret) => (secret ? String(text).split(secret).join('•••') : String(text));

const NETWORK_HINT = 'Request failed (network or CORS). The browser could not reach the API — '
  + 'official APIs often block direct browser calls; set a custom base URL whose server allows CORS.';

export async function chatCompletions({ baseUrl, apiKey, model, messages, signal }) {
  let res;
  try {
    res = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages }),
      signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw new Error(NETWORK_HINT);
  }
  if (!res.ok) {
    let detail = '';
    try { detail = redact((await res.text()).slice(0, 300), apiKey); } catch (_) { /* body unreadable */ }
    throw new Error(`HTTP ${res.status} ${res.statusText || ''}`.trim() + (detail ? ` — ${detail}` : ''));
  }
  let data;
  try { data = await res.json(); } catch (_) { throw new Error('The API returned invalid JSON.'); }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Unexpected API response shape.');
  return content;
}
