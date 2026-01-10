/**
 * Team ID Finder Helper
 *
 * Searches Sportmonks API for team IDs by country/team name.
 * Useful for finding national team IDs to use in TEAM_IDS env var.
 *
 * Usage: npm run find-teams -- Spain Portugal Brazil Argentina
 */

import { loadConfig } from './config.js';
import { createClient } from './sportmonksClient.js';

/**
 * Search for national teams by country name
 */
async function findNationalTeam(client, countryName) {
  const results = await client.searchTeam(countryName);

  if (!results || results.length === 0) {
    return { countryName, found: false, teams: [] };
  }

  // Filter for national teams (type === 'national')
  const nationalTeams = results.filter(team =>
    team.type === 'national' ||
    team.name?.toLowerCase().includes('national')
  );

  // Also include any team that matches the country name closely
  const allMatches = results.filter(team => {
    const nameLower = team.name?.toLowerCase() || '';
    const searchLower = countryName.toLowerCase();
    return nameLower.includes(searchLower) || searchLower.includes(nameLower);
  });

  // Combine and dedupe, prioritize national teams
  const seen = new Set();
  const combined = [];

  for (const team of [...nationalTeams, ...allMatches]) {
    if (!seen.has(team.id)) {
      seen.add(team.id);
      combined.push({
        id: team.id,
        name: team.name,
        type: team.type,
        country: team.country?.name || 'Unknown',
        countryCode: team.country?.iso2 || team.country?.fifa_name || 'N/A',
      });
    }
  }

  return { countryName, found: combined.length > 0, teams: combined };
}

/**
 * Format team info for display
 */
function formatTeamInfo(team) {
  return `  ID: ${team.id.toString().padEnd(8)} | ${team.name.padEnd(30)} | Type: ${(team.type || 'unknown').padEnd(10)} | Country: ${team.country} (${team.countryCode})`;
}

/**
 * Main function
 */
async function main() {
  // Get search terms from command line arguments
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('\nUsage: npm run find-teams -- <country1> <country2> ...\n');
    console.log('Example: npm run find-teams -- Spain Portugal Brazil Argentina France England\n');
    console.log('This will search for national team IDs for each country.\n');
    process.exit(0);
  }

  console.log('\n========================================');
  console.log('  Sportmonks Team ID Finder');
  console.log('========================================\n');

  // Load config (only needs API key)
  const config = loadConfig();
  const client = createClient(config);

  const foundIds = [];

  for (const countryName of args) {
    console.log(`\nSearching for "${countryName}"...`);

    try {
      const result = await findNationalTeam(client, countryName);

      if (!result.found) {
        console.log(`  No teams found for "${countryName}"`);
        continue;
      }

      console.log(`  Found ${result.teams.length} matching team(s):\n`);

      for (const team of result.teams) {
        console.log(formatTeamInfo(team));

        // Track national teams for the suggested TEAM_IDS
        if (team.type === 'national') {
          foundIds.push({ country: countryName, id: team.id, name: team.name });
        }
      }

    } catch (error) {
      console.error(`  Error searching for "${countryName}": ${error.message}`);
    }
  }

  // Print suggested TEAM_IDS
  if (foundIds.length > 0) {
    console.log('\n========================================');
    console.log('  SUGGESTED TEAM_IDS FOR .env');
    console.log('========================================\n');

    const ids = foundIds.map(t => t.id).join(',');
    console.log(`TEAM_IDS=${ids}\n`);

    console.log('Teams included:');
    foundIds.forEach(t => console.log(`  - ${t.country}: ${t.name} (ID: ${t.id})`));
    console.log('');
  }

  console.log(`\nTotal API calls: ${client.getApiCallCount()}\n`);
}

// Run
main().catch(error => {
  console.error('[FATAL]', error);
  process.exit(1);
});
