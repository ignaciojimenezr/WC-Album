/**
 * Football Data Ingestion Pipeline
 *
 * Fetches squad data from Sportmonks API and persists to MongoDB Atlas.
 *
 * Usage: npm run ingest
 */

import { loadConfig, requireTeamIds } from './config.js';
import { createClient } from './sportmonksClient.js';
import * as db from './db.js';

/**
 * Extract the best display name from a player object
 * Sportmonks provides: display_name, common_name, firstname + lastname
 */
function getPlayerName(player) {
  if (!player) return null;
  return player.display_name || player.common_name ||
    [player.firstname, player.lastname].filter(Boolean).join(' ') || null;
}

/**
 * Extract country info from a country object (from API response)
 * Returns: { id, name, code }
 */
function extractCountryInfo(country) {
  if (!country) {
    return { id: null, name: null, code: null };
  }
  return {
    id: country.id || null,
    name: country.name || country.official_name || null,
    code: country.iso2 || country.fifa_name || null,
  };
}

/**
 * Find the current club from player's teams array
 * Looks for a team with type "domestic" or "club" that is currently active
 */
function findCurrentClub(teams) {
  if (!teams || !Array.isArray(teams)) {
    return null;
  }

  // Teams array may have pivot data with contract dates
  // Look for domestic/club teams, prefer ones without end date
  const clubTeams = teams.filter(t =>
    t.type === 'domestic' || t.type === 'club' || !t.type
  );

  // Sort by most recent, prefer active contracts
  const sorted = clubTeams.sort((a, b) => {
    // If one has no end date (active), prefer it
    const aActive = !a.pivot?.end || new Date(a.pivot.end) > new Date();
    const bActive = !b.pivot?.end || new Date(b.pivot.end) > new Date();
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    // Otherwise sort by start date descending
    const aStart = a.pivot?.start ? new Date(a.pivot.start) : new Date(0);
    const bStart = b.pivot?.start ? new Date(b.pivot.start) : new Date(0);
    return bStart - aStart;
  });

  return sorted[0] || null;
}

/**
 * Process a single team's squad
 */
async function processTeamSquad(client, teamId, config) {
  const stats = { playersUpserted: 0, errors: [] };

  try {
    // 1. Fetch squad with player includes
    const squadEntries = await client.getTeamSquad(teamId);

    if (!squadEntries || squadEntries.length === 0) {
      console.log(`[WARN] No squad data found for team ${teamId}`);
      return stats;
    }

    // 2. Fetch/get the team itself for team document
    const team = await client.getTeam(teamId);

    if (team) {
      // Extract country info from included country object
      const countryInfo = extractCountryInfo(team.country);

      await db.upsertTeam({
        providerId: team.id,
        name: team.name,
        type: team.type || null,
        country: countryInfo,
        image_path: team.image_path || null,
      });

      // Also cache country in DB if we have it
      if (team.country && team.country.id) {
        await db.upsertCountry({
          providerId: team.country.id,
          name: team.country.name,
          code: team.country.iso2 || team.country.fifa_name || null,
        });
      }
    }

    // 3. Process players (max 24)
    const playerIds = [];
    const maxPlayers = Math.min(squadEntries.length, config.MAX_PLAYERS_PER_SQUAD);

    for (let i = 0; i < maxPlayers; i++) {
      const entry = squadEntries[i];
      const playerId = entry.player_id;

      if (!playerId) {
        console.log(`[WARN] Squad entry missing player_id`);
        continue;
      }

      try {
        // Player data might be included in squad response
        let player = entry.player;

        // If player data is not included or incomplete, fetch it
        if (!player || !player.nationality_id) {
          player = await client.getPlayer(playerId);
        }

        if (!player) {
          console.log(`[WARN] Could not fetch player ${playerId}`);
          continue;
        }

        // Get nationality info
        let nationalityInfo = { id: null, name: null, code: null };
        if (player.nationality) {
          nationalityInfo = extractCountryInfo(player.nationality);
        } else if (player.nationality_id) {
          // Fetch nationality country if not included
          const natCountry = await client.getCountry(player.nationality_id);
          nationalityInfo = extractCountryInfo(natCountry);
        }

        // Get current club info
        let currentClubInfo = { id: null, name: null };
        let currentClubCountryInfo = { id: null, name: null, code: null };

        // For national team squads, player's current club is likely different from the team we're fetching
        // Look in player's teams array for their club team
        if (player.teams && Array.isArray(player.teams)) {
          const currentClub = findCurrentClub(player.teams);
          if (currentClub) {
            currentClubInfo = {
              id: currentClub.id || null,
              name: currentClub.name || null,
            };

            // Get club's country
            if (currentClub.country) {
              currentClubCountryInfo = extractCountryInfo(currentClub.country);
            } else if (currentClub.country_id) {
              const clubCountry = await client.getCountry(currentClub.country_id);
              currentClubCountryInfo = extractCountryInfo(clubCountry);
            }
          }
        }

        // Upsert player document
        const playerDocId = `player:sportmonks:${player.id}`;
        await db.upsertPlayer({
          providerId: player.id,
          name: getPlayerName(player),
          nationality: nationalityInfo,
          image_path: player.image_path || null,
          currentClub: currentClubInfo,
          currentClubCountry: currentClubCountryInfo,
        });

        playerIds.push(playerDocId);
        stats.playersUpserted++;

      } catch (error) {
        console.error(`[ERROR] Failed to process player ${playerId}: ${error.message}`);
        stats.errors.push({ playerId, error: error.message });
      }
    }

    // 4. Upsert squad document with player references
    await db.upsertSquad({
      teamId,
      playerIds,
    });

    console.log(`[OK] Team ${teamId}: ${playerIds.length} players processed`);

  } catch (error) {
    console.error(`[ERROR] Failed to process team ${teamId}: ${error.message}`);
    stats.errors.push({ teamId, error: error.message });
  }

  return stats;
}

/**
 * Main ingestion pipeline
 */
async function main() {
  const startTime = Date.now();

  console.log('\n========================================');
  console.log('  Football Data Ingestion Pipeline');
  console.log('========================================\n');

  // 1. Load and validate config
  const config = loadConfig();
  requireTeamIds(config);

  console.log(`[CONFIG] Database: ${config.DB_NAME}`);
  console.log(`[CONFIG] Teams to process: ${config.TEAM_IDS.length}`);
  console.log(`[CONFIG] Max players per squad: ${config.MAX_PLAYERS_PER_SQUAD}`);
  console.log('');

  // 2. Connect to MongoDB
  await db.connect(config.MONGODB_URI, config.DB_NAME);

  // 3. Ensure indexes exist
  await db.ensureIndexes();

  // 4. Create API client
  const client = createClient(config);

  // 5. Process each team
  const summary = {
    teamsProcessed: 0,
    playersUpserted: 0,
    squadsUpserted: 0,
    errors: [],
  };

  console.log('\n[INGEST] Starting team processing...\n');

  for (const teamId of config.TEAM_IDS) {
    console.log(`\n--- Processing Team ${teamId} ---`);

    const stats = await processTeamSquad(client, teamId, config);

    summary.teamsProcessed++;
    summary.playersUpserted += stats.playersUpserted;
    summary.squadsUpserted++;
    summary.errors.push(...stats.errors);
  }

  // 6. Close connection
  await db.close();

  // 7. Print summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n========================================');
  console.log('           INGESTION SUMMARY');
  console.log('========================================');
  console.log(`  Teams processed:   ${summary.teamsProcessed}`);
  console.log(`  Players upserted:  ${summary.playersUpserted}`);
  console.log(`  Squads upserted:   ${summary.squadsUpserted}`);
  console.log(`  API calls made:    ${client.getApiCallCount()}`);
  console.log(`  Errors:            ${summary.errors.length}`);
  console.log(`  Elapsed time:      ${elapsed}s`);
  console.log('========================================\n');

  if (summary.errors.length > 0) {
    console.log('[ERRORS]');
    summary.errors.forEach(e => console.log(`  - ${JSON.stringify(e)}`));
    console.log('');
  }

  process.exit(summary.errors.length > 0 ? 1 : 0);
}

// Run
main().catch(error => {
  console.error('[FATAL]', error);
  process.exit(1);
});
