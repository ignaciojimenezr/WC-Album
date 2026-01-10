/**
 * CSV Squad Data Ingestion Pipeline
 *
 * Ingests player/squad data from a CSV file into MongoDB Atlas.
 *
 * CSV Format (supports both):
 *   team,name,position,club,country
 *   team,player_fullname,position,club,club_country
 *
 * Usage: npm run ingest-csv -- data/squads.csv
 */

import { readFileSync } from 'fs';
import { loadConfig } from './config.js';
import * as db from './db.js';

// Max players per squad (World Cup squads are 26)
const MAX_PLAYERS_PER_SQUAD = 26;

/**
 * Parse CSV content into array of objects
 */
function parseCSV(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());

  // Check for required columns (support both naming conventions)
  const hasTeam = header.includes('team');
  const hasName = header.includes('name') || header.includes('player_fullname');

  if (!hasTeam || !hasName) {
    throw new Error('CSV must have "team" and either "name" or "player_fullname" columns');
  }

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted values with commas
    const values = parseCSVLine(line);

    if (values.length !== header.length) {
      console.warn(`[WARN] Line ${i + 1}: expected ${header.length} columns, got ${values.length}. Skipping.`);
      continue;
    }

    const row = {};
    header.forEach((col, idx) => {
      row[col] = values[idx]?.trim() || null;
    });
    data.push(row);
  }

  return data;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);

  return values;
}

/**
 * Generate a simple ID from a string
 */
function generateId(prefix, name) {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${prefix}:csv:${slug}`;
}

/**
 * Main ingestion pipeline
 */
async function main() {
  const startTime = Date.now();

  console.log('\n========================================');
  console.log('  CSV Squad Data Ingestion Pipeline');
  console.log('========================================\n');

  // Get CSV file path from command line
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('[ERROR] Please provide a CSV file path');
    console.error('Usage: npm run ingest-csv -- path/to/squads.csv\n');
    process.exit(1);
  }

  // 1. Load config
  const config = loadConfig();
  console.log(`[CONFIG] Database: ${config.DB_NAME}`);

  // 2. Read and parse CSV
  console.log(`[CSV] Reading ${csvPath}...`);
  let csvContent;
  try {
    csvContent = readFileSync(csvPath, 'utf-8');
  } catch (error) {
    console.error(`[ERROR] Could not read CSV file: ${error.message}`);
    process.exit(1);
  }

  const rows = parseCSV(csvContent);
  console.log(`[CSV] Parsed ${rows.length} player rows`);

  // 3. Connect to MongoDB
  await db.connect(config.MONGODB_URI, config.DB_NAME);

  // 4. Ensure indexes exist
  await db.ensureIndexes();

  // 5. Group players by team
  const teamMap = new Map();
  for (const row of rows) {
    const team = row.team;
    if (!teamMap.has(team)) {
      teamMap.set(team, []);
    }
    teamMap.get(team).push(row);
  }

  console.log(`[CSV] Found ${teamMap.size} teams\n`);

  // 6. Process each team
  const summary = {
    teamsUpserted: 0,
    playersUpserted: 0,
    squadsUpserted: 0,
  };

  for (const [teamName, players] of teamMap) {
    console.log(`--- Processing Team: ${teamName} (${players.length} players) ---`);

    // Upsert team document
    const teamId = generateId('team', teamName);
    await db.upsertTeam({
      _id: teamId,
      provider: 'csv',
      providerId: teamName,
      name: teamName,
      type: 'national',
      country: { id: null, name: teamName, code: null },
      image_path: null,
    });
    summary.teamsUpserted++;

    // Upsert each player (max 26 for World Cup squads)
    const playerIds = [];
    const maxPlayers = Math.min(players.length, MAX_PLAYERS_PER_SQUAD);

    for (let i = 0; i < maxPlayers; i++) {
      const player = players[i];
      // Support both column naming conventions
      const playerName = player.name || player.player_fullname;
      const clubCountry = player.club_country || player.country || null;

      const playerId = generateId('player', `${teamName}-${playerName}`);

      await db.upsertPlayer({
        _id: playerId,
        provider: 'csv',
        providerId: `${teamName}:${playerName}`,
        name: playerName,
        position: player.position || null,
        nationality: { id: null, name: teamName, code: null },
        image_path: player.image || null,
        currentClub: { id: null, name: player.club || null },
        currentClubCountry: { id: null, name: clubCountry, code: null },
      });

      playerIds.push(playerId);
      summary.playersUpserted++;
    }

    // Upsert squad document
    await db.upsertSquad({
      _id: `squad:csv:${teamName.toLowerCase().replace(/\s+/g, '-')}:current`,
      provider: 'csv',
      teamId: teamName,
      teamName: teamName,
      playerIds,
    });
    summary.squadsUpserted++;

    console.log(`[OK] ${teamName}: ${playerIds.length} players\n`);
  }

  // 7. Close connection
  await db.close();

  // 8. Print summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('========================================');
  console.log('           INGESTION SUMMARY');
  console.log('========================================');
  console.log(`  Teams upserted:    ${summary.teamsUpserted}`);
  console.log(`  Players upserted:  ${summary.playersUpserted}`);
  console.log(`  Squads upserted:   ${summary.squadsUpserted}`);
  console.log(`  Elapsed time:      ${elapsed}s`);
  console.log('========================================\n');
}

// Run
main().catch(error => {
  console.error('[FATAL]', error);
  process.exit(1);
});
