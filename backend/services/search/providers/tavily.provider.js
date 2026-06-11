// backend/services/search/providers/tavily.provider.js
const MAX_RESULTS = 5;
const TIMEOUT_MS  = 10000;

async function search(query, config) {
  const apiKey = config.apiKey || process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('Tavily API key no configurada');

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:       apiKey,
        query,
        search_depth:  'basic',
        max_results:   MAX_RESULTS,
        include_answer: true
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Tavily HTTP ${res.status}: ${err}`);
    }

    const data = await res.json();
    const results = (data.results || []).map(r => ({
      title:   r.title   || '(sin título)',
      url:     r.url     || '',
      snippet: (r.content || '').slice(0, 800)
    }));

    // Tavily puede incluir una respuesta directa sintetizada
    if (data.answer) {
      results.unshift({
        title:   'Respuesta directa',
        url:     '',
        snippet: data.answer
      });
    }

    return results;
  } finally {
    clearTimeout(timer);
  }
}

async function testConnection(config) {
  try {
    const results = await search('inteligencia artificial', config);
    return { ok: true, count: results.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { search, testConnection };