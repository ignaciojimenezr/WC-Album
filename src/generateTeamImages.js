import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'football';

// Base output directory for player images
const OUTPUT_BASE = './client/public/players';

// Country to jersey description mapping
const countryJerseys = {
  'Argentina': 'light blue and white vertical striped Argentina national team jersey',
  'Brazil': 'yellow Brazil national team jersey with green trim',
  'France': 'dark blue France national team jersey',
  'England': 'white England national team jersey',
  'Spain': 'red Spain national team jersey',
  'Germany': 'white Germany national team jersey with black trim',
  'Portugal': 'dark red Portugal national team jersey',
  'Netherlands': 'orange Netherlands national team jersey',
  'Belgium': 'red Belgium national team jersey',
  'Italy': 'blue Italy national team jersey',
  'Croatia': 'red and white checkered Croatia national team jersey',
  'Morocco': 'red Morocco national team jersey with green trim',
  'USA': 'white USA national team jersey with red and blue accents',
  'United States': 'white USA national team jersey with red and blue accents',
  'Mexico': 'green Mexico national team jersey',
  'Japan': 'blue Japan national team jersey',
  'South Korea': 'red South Korea national team jersey',
  'Australia': 'gold Australia national team jersey',
  'Canada': 'red Canada national team jersey',
  'Colombia': 'yellow Colombia national team jersey',
  'Uruguay': 'light blue Uruguay national team jersey',
  'Ecuador': 'yellow Ecuador national team jersey',
  'Senegal': 'white Senegal national team jersey with green trim',
  'Ghana': 'white Ghana national team jersey',
  'Cameroon': 'green Cameroon national team jersey',
  'Nigeria': 'green and white Nigeria national team jersey',
  'Tunisia': 'red Tunisia national team jersey',
  'Egypt': 'red Egypt national team jersey',
  'Algeria': 'white Algeria national team jersey with green trim',
  'Saudi Arabia': 'white Saudi Arabia national team jersey with green',
  'Iran': 'white Iran national team jersey',
  'Qatar': 'maroon Qatar national team jersey',
  'Switzerland': 'red Switzerland national team jersey',
  'Denmark': 'red Denmark national team jersey',
  'Poland': 'white Poland national team jersey with red accents',
  'Sweden': 'yellow Sweden national team jersey with blue trim',
  'Norway': 'red Norway national team jersey',
  'Austria': 'red Austria national team jersey',
  'Wales': 'red Wales national team jersey',
  'Scotland': 'navy blue Scotland national team jersey',
  'Serbia': 'red Serbia national team jersey',
  'Ukraine': 'yellow Ukraine national team jersey',
};

// Search for player headshot image
async function searchPlayerImage(playerName) {
  console.log(`  🔍 Searching for: "${playerName}"`);

  // Clean name for Fox Sports URL
  const foxSlug = playerName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[éèê]/g, 'e')
    .replace(/[áàâ]/g, 'a')
    .replace(/[íìî]/g, 'i')
    .replace(/[óòô]/g, 'o')
    .replace(/[úùû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c');

  // Try Fox Sports with variations
  const foxUrls = [
    `https://www.foxsports.com/soccer/${foxSlug}-player`,
    `https://www.foxsports.com/soccer/${foxSlug}-2-player`,
    `https://www.foxsports.com/soccer/${foxSlug}-3-player`,
  ];

  for (const foxUrl of foxUrls) {
    try {
      const foxResponse = await fetch(foxUrl);
      if (foxResponse.ok) {
        const html = await foxResponse.text();
        const match = html.match(/https:\/\/b\.fssta\.com\/uploads\/application\/soccer\/headshots\/(\d+)\.vresize/);
        if (match) {
          const imageUrl = `https://b.fssta.com/uploads/application/soccer/headshots/${match[1]}.vresize.350.350.medium.1.png`;
          console.log(`  ✅ Fox Sports: ${match[1]}`);
          return imageUrl;
        }
      }
    } catch (e) {
      // Continue
    }
  }

  // Fallback to Wikipedia
  console.log(`  ⚠️ Trying Wikipedia...`);
  const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(playerName)}&pithumbsize=500&origin=*`;

  try {
    const response = await fetch(wikiUrl);
    const data = await response.json();
    const pages = data.query?.pages;
    if (pages) {
      const page = Object.values(pages)[0];
      if (page.thumbnail?.source) {
        console.log(`  ✅ Wikipedia found`);
        return page.thumbnail.source;
      }
    }
  } catch (e) {
    // Continue
  }

  return null;
}

// Submit to FLUX Kontext Pro
async function submitToKontext(imageUrl, country) {
  const jerseyDesc = countryJerseys[country] || `${country} national team jersey`;

  const prompt = `Transform into Panini football sticker illustration. CRITICAL: Keep the EXACT same face, eyes, nose, mouth, hair - person must be instantly recognizable.

Style: Semi-realistic cartoon, smooth cel-shading, clean black outlines, vibrant saturated colors. Head and upper chest visible, facing camera.

Jersey: ${jerseyDesc}, plain solid color, NO logos NO badges NO emblems - completely blank fabric.

Background: Blurred stadium crowd, blue sky, bright daylight.

No text anywhere.`;

  const response = await fetch(
    'https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-kontext-pro',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIREWORKS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input_image: imageUrl,
        prompt: prompt,
        aspect_ratio: '1:1',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kontext API error: ${response.status}`);
  }

  const data = await response.json();
  return data.request_id;
}

// Poll for result
async function getKontextResult(requestId) {
  const maxAttempts = 30;

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      'https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-kontext-pro/get_result',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FIREWORKS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: requestId }),
      }
    );

    const data = await response.json();

    if (data.status === 'Ready') {
      return data.result;
    } else if (data.status === 'Error' || data.status === 'Content Moderated' || data.status === 'Request Moderated') {
      throw new Error(`Generation failed: ${data.status}`);
    }

    console.log(`  ⏳ ${data.status}...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Timeout');
}

// Generate single player sticker
async function generatePlayerSticker(playerName, country, outputPath) {
  // Find image
  const imageUrl = await searchPlayerImage(playerName);
  if (!imageUrl) {
    throw new Error('No source image found');
  }

  // Submit to Kontext
  console.log(`  🎨 Generating sticker...`);
  const requestId = await submitToKontext(imageUrl, country);

  // Get result
  const result = await getKontextResult(requestId);

  // Save image
  const imageData = result.sample || result.output_image || result.image || result.url;

  if (typeof imageData === 'string' && imageData.startsWith('http')) {
    const imgResponse = await fetch(imageData);
    const buffer = Buffer.from(await imgResponse.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
  } else {
    throw new Error('Unexpected result format');
  }

  console.log(`  💾 Saved: ${outputPath}`);
}

// Main function
async function generateTeamImages(teamName) {
  console.log(`\n🏆 Generating images for: ${teamName}\n`);

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Find squad by teamName (not teamId)
    const squad = await db.collection('squads').findOne({
      teamName: { $regex: new RegExp(`^${teamName}$`, 'i') }
    });

    if (!squad) {
      console.error(`❌ Squad not found for: ${teamName}`);
      return;
    }

    // Get players
    const players = await db.collection('players').find({
      _id: { $in: squad.playerIds }
    }).toArray();

    console.log(`📋 Found ${players.length} players\n`);

    // Create output directory
    const teamSlug = teamName.toLowerCase().replace(/\s+/g, '-');
    const outputDir = path.join(OUTPUT_BASE, teamSlug);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Track results
    const results = { success: [], failed: [] };

    // Generate images for each player
    for (const player of players) {
      const playerSlug = player.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const outputPath = path.join(outputDir, `${playerSlug}.png`);

      // Skip if already exists
      if (fs.existsSync(outputPath)) {
        console.log(`⏭️ Skipping ${player.name} (already exists)`);
        results.success.push(player.name);
        continue;
      }

      console.log(`\n🏃 ${player.name} (${player.position})`);

      try {
        await generatePlayerSticker(player.name, teamName, outputPath);
        results.success.push(player.name);

        // Update player document with image path
        await db.collection('players').updateOne(
          { _id: player._id },
          { $set: { image_path: `/players/${teamSlug}/${playerSlug}.png` } }
        );

      } catch (error) {
        console.error(`  ❌ Failed: ${error.message}`);
        results.failed.push({ name: player.name, error: error.message });
      }

      // Rate limiting - wait between players
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Summary
    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ Success: ${results.success.length}/${players.length}`);
    if (results.failed.length > 0) {
      console.log(`❌ Failed: ${results.failed.length}`);
      results.failed.forEach(f => console.log(`   - ${f.name}: ${f.error}`));
    }
    console.log(`📁 Output: ${outputDir}`);

  } finally {
    await client.close();
  }
}

// Get team name from command line args
const teamName = process.argv[2] || 'Argentina';
generateTeamImages(teamName);
