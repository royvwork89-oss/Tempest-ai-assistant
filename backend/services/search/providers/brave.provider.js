// backend/services/search/providers/brave.provider.js
// STUB — pendiente de implementación

async function search(query, config) {
  // TODO v2.6.x:
  // GET https://api.search.brave.com/res/v1/web/search?q={query}
  // Headers: { 'Accept': 'application/json', 'X-Subscription-Token': config.apiKey }
  throw new Error('Brave Search API no implementada aún');
}

async function testConnection(config) {
  return { ok: false, error: 'Brave Search API no implementada aún' };
}

module.exports = { search, testConnection };