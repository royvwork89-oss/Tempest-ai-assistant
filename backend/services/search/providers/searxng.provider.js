// backend/services/search/providers/searxng.provider.js
const MAX_RESULTS = 5;
const TIMEOUT_MS  = 8000;

async function search(query, config) {
  const baseUrl = (config.url || 'http://localhost:8081').replace(/\/$/, '');
  const url     = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=auto`;

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });

    if (!res.ok) throw new Error(`SearXNG respondió HTTP ${res.status}`);

    const data = await res.json();

    return (data.results || [])
      .slice(0, MAX_RESULTS)
      .map(r => ({
        title:   r.title   || '(sin título)',
        url:     r.url     || '',
        snippet: r.content || r.snippet || ''
      }));

  } finally {
    clearTimeout(timer);
  }
}

async function testConnection(config) {
  try {
    const results = await search('test', config);
    return { ok: true, count: results.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { search, testConnection };