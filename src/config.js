import dotenv from 'dotenv';

dotenv.config();

// Constants
const DEFAULTS = {
  DB_NAME: 'football',
  REQUEST_DELAY_MS: 350,
  REQUEST_TIMEOUT_MS: 30000,
  MAX_RETRIES: 4,
  MAX_PLAYERS_PER_SQUAD: 24,
};

/**
 * Load and validate environment configuration.
 * Exits with helpful error messages if required vars are missing.
 */
export function loadConfig() {
  const errors = [];

  // Required env vars
  const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY?.trim();
  const MONGODB_URI = process.env.MONGODB_URI?.trim();
  const TEAM_IDS_RAW = process.env.TEAM_IDS?.trim();

  if (!SPORTMONKS_API_KEY) {
    errors.push('SPORTMONKS_API_KEY is required. Get your API key from https://sportmonks.com');
  }

  if (!MONGODB_URI) {
    errors.push('MONGODB_URI is required. Get your connection string from MongoDB Atlas.');
  }

  // TEAM_IDS validation - required for ingest, but we allow empty for find-teams helper
  let teamIds = [];
  if (TEAM_IDS_RAW) {
    teamIds = TEAM_IDS_RAW
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)
      .map(id => {
        const num = parseInt(id, 10);
        if (isNaN(num)) {
          errors.push(`Invalid team ID: "${id}" is not a number`);
          return null;
        }
        return num;
      })
      .filter(id => id !== null);
  }

  // Optional env vars
  const DB_NAME = process.env.DB_NAME?.trim() || DEFAULTS.DB_NAME;

  // FIREWORKS_API_KEY is optional and not required for ingestion
  // We don't validate or error on it

  if (errors.length > 0) {
    console.error('\n[CONFIG ERROR] Missing or invalid environment variables:\n');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('\nPlease check your .env file and try again.\n');
    process.exit(1);
  }

  return {
    SPORTMONKS_API_KEY,
    MONGODB_URI,
    DB_NAME,
    TEAM_IDS: teamIds,
    ...DEFAULTS,
  };
}

/**
 * Validate that TEAM_IDS is not empty (for ingest command)
 */
export function requireTeamIds(config) {
  if (!config.TEAM_IDS || config.TEAM_IDS.length === 0) {
    console.error('\n[CONFIG ERROR] TEAM_IDS is empty or not set.\n');
    console.error('  Please set TEAM_IDS in your .env file with comma-separated team IDs.');
    console.error('  Example: TEAM_IDS=18710,18645,18647\n');
    console.error('  Tip: Use "npm run find-teams -- Spain England Brazil" to find team IDs.\n');
    process.exit(1);
  }
}

export { DEFAULTS };
