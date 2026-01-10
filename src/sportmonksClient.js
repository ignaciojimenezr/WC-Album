/**
 * Sportmonks Football API Client
 *
 * API Base: https://api.sportmonks.com/v3/football
 * Auth: api_token query parameter
 *
 * Includes rate limiting, retries with exponential backoff, and in-memory caching.
 */

const API_BASE = 'https://api.sportmonks.com/v3/football';

// In-memory caches to minimize API calls
const cache = {
  teams: new Map(),      // teamId -> team data
  players: new Map(),    // playerId -> player data
  countries: new Map(),  // countryId -> country data
};

// Rate limiting state
let lastRequestTime = 0;
let totalApiCalls = 0;

/**
 * Create a Sportmonks API client instance
 */
export function createClient(config) {
  const { SPORTMONKS_API_KEY, REQUEST_DELAY_MS, REQUEST_TIMEOUT_MS, MAX_RETRIES } = config;

  /**
   * Wait to respect rate limits (minimum delay between requests)
   */
  async function waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < REQUEST_DELAY_MS) {
      const waitTime = REQUEST_DELAY_MS - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();
  }

  /**
   * Make an API request with retry logic
   */
  async function apiRequest(endpoint, params = {}) {
    const url = new URL(`${API_BASE}${endpoint}`);
    url.searchParams.set('api_token', SPORTMONKS_API_KEY);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    }

    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await waitForRateLimit();
      totalApiCalls++;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          },
        });

        clearTimeout(timeoutId);

        // Handle rate limiting (429)
        if (response.status === 429) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.log(`[RATE LIMIT] 429 received. Waiting ${backoffMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        // Handle server errors (5xx)
        if (response.status >= 500) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.log(`[SERVER ERROR] ${response.status}. Waiting ${backoffMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        // Handle client errors (4xx except 429)
        if (response.status >= 400) {
          const errorText = await response.text();
          throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data;

      } catch (error) {
        lastError = error;

        // Handle timeout/abort
        if (error.name === 'AbortError') {
          console.log(`[TIMEOUT] Request timed out. Attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
          continue;
        }

        // Network errors - retry with backoff
        if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.message.includes('fetch')) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.log(`[NETWORK ERROR] ${error.message}. Waiting ${backoffMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        // Other errors - don't retry
        throw error;
      }
    }

    throw new Error(`Max retries exceeded. Last error: ${lastError?.message}`);
  }

  /**
   * Get team squad by team ID
   *
   * Endpoint: GET /squads/teams/{teamId}
   * Response shape: { data: [{ id, player_id, team_id, position_id, jersey_number, ... }] }
   * With include=player: each squad entry has a nested `player` object
   */
  async function getTeamSquad(teamId) {
    console.log(`[API] Fetching squad for team ${teamId}...`);
    const response = await apiRequest(`/squads/teams/${teamId}`, {
      include: 'player',
    });
    return response.data || [];
  }

  /**
   * Get player by ID
   *
   * Endpoint: GET /players/{playerId}
   * Response shape: { data: { id, firstname, lastname, common_name, display_name, image_path, nationality_id, ... } }
   * With include=nationality,teams: includes nationality object and teams array
   */
  async function getPlayer(playerId) {
    // Check cache first
    if (cache.players.has(playerId)) {
      return cache.players.get(playerId);
    }

    console.log(`[API] Fetching player ${playerId}...`);
    const response = await apiRequest(`/players/${playerId}`, {
      include: 'nationality,teams',
    });

    const player = response.data;
    if (player) {
      cache.players.set(playerId, player);
    }
    return player;
  }

  /**
   * Get team by ID
   *
   * Endpoint: GET /teams/{teamId}
   * Response shape: { data: { id, name, type, image_path, country_id, ... } }
   * With include=country: includes country object
   */
  async function getTeam(teamId) {
    // Check cache first
    if (cache.teams.has(teamId)) {
      return cache.teams.get(teamId);
    }

    console.log(`[API] Fetching team ${teamId}...`);
    const response = await apiRequest(`/teams/${teamId}`, {
      include: 'country',
    });

    const team = response.data;
    if (team) {
      cache.teams.set(teamId, team);
    }
    return team;
  }

  /**
   * Get country by ID
   *
   * Endpoint: GET /countries/{countryId}
   * Response shape: { data: { id, name, official_name, fifa_name, iso2, iso3, ... } }
   */
  async function getCountry(countryId) {
    if (!countryId) return null;

    // Check cache first
    if (cache.countries.has(countryId)) {
      return cache.countries.get(countryId);
    }

    console.log(`[API] Fetching country ${countryId}...`);
    const response = await apiRequest(`/countries/${countryId}`);

    const country = response.data;
    if (country) {
      cache.countries.set(countryId, country);
    }
    return country;
  }

  /**
   * Search teams by name
   *
   * Endpoint: GET /teams/search/{name}
   * Response shape: { data: [{ id, name, type, country_id, ... }] }
   * Returns all teams matching the search query
   */
  async function searchTeam(name) {
    console.log(`[API] Searching for team "${name}"...`);
    const response = await apiRequest(`/teams/search/${encodeURIComponent(name)}`, {
      include: 'country',
    });
    return response.data || [];
  }

  /**
   * Get total API calls made
   */
  function getApiCallCount() {
    return totalApiCalls;
  }

  /**
   * Reset API call counter
   */
  function resetApiCallCount() {
    totalApiCalls = 0;
  }

  /**
   * Clear all caches
   */
  function clearCache() {
    cache.teams.clear();
    cache.players.clear();
    cache.countries.clear();
  }

  return {
    getTeamSquad,
    getPlayer,
    getTeam,
    getCountry,
    searchTeam,
    getApiCallCount,
    resetApiCallCount,
    clearCache,
    cache,
  };
}
