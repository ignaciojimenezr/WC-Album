import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'football';

// Create output directory for test images
const OUTPUT_DIR = './test-images';
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Country to jersey description mapping (2026 style)
const countryJerseys = {
  'Argentina': 'light blue and white striped Argentina national team jersey',
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
  'Mexico': 'green Mexico national team jersey',
  'Japan': 'blue Japan national team jersey',
  'South Korea': 'red South Korea national team jersey',
  'Australia': 'gold Australia national team jersey',
  'Canada': 'red Canada national team jersey',
  'Colombia': 'yellow Colombia national team jersey',
  'Uruguay': 'light blue Uruguay national team jersey',
  'Ecuador': 'yellow Ecuador national team jersey',
  'Senegal': 'white Senegal national team jersey with green trim',
  'Ghana': 'white Ghana national team jersey with black star',
  'Cameroon': 'green Cameroon national team jersey',
  'Nigeria': 'green and white Nigeria national team jersey',
  'Tunisia': 'red Tunisia national team jersey',
  'Egypt': 'red Egypt national team jersey',
  'Algeria': 'white Algeria national team jersey with green trim',
  'Saudi Arabia': 'white Saudi Arabia national team jersey with green',
  'Iran': 'white Iran national team jersey',
  'Qatar': 'maroon Qatar national team jersey',
  'Switzerland': 'red Switzerland national team jersey with white cross',
  'Denmark': 'red Denmark national team jersey',
  'Poland': 'white Poland national team jersey with red accents',
  'Sweden': 'yellow Sweden national team jersey with blue trim',
  'Norway': 'red Norway national team jersey',
  'Austria': 'red Austria national team jersey',
  'Wales': 'red Wales national team jersey',
  'Scotland': 'navy blue Scotland national team jersey',
  'Serbia': 'red Serbia national team jersey',
  'Ukraine': 'yellow Ukraine national team jersey',
  'Czech Republic': 'red Czech Republic national team jersey',
  'Turkey': 'red Turkey national team jersey',
  'Cape Verde': 'blue Cape Verde national team jersey',
};

// Step 1: Search for player headshot image
async function searchPlayerImage(playerName, country) {
  // Try Fox Sports first - they have consistent headshots
  console.log(`  🔍 Trying Fox Sports for: "${playerName}"`);

  const foxSlug = playerName.toLowerCase().replace(/\s+/g, '-').replace(/[éè]/g, 'e').replace(/[áà]/g, 'a');

  // Try multiple URL variations (some players have -2, -3 suffixes)
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
        // Look for headshot URL pattern (not default-headshot)
        const match = html.match(/https:\/\/b\.fssta\.com\/uploads\/application\/soccer\/headshots\/(\d+)\.vresize/);
        if (match) {
          const imageUrl = `https://b.fssta.com/uploads/application/soccer/headshots/${match[1]}.vresize.350.350.medium.1.png`;
          console.log(`  ✅ Found Fox Sports image: ${imageUrl.substring(0, 60)}...`);
          return imageUrl;
        }
      }
    } catch (e) {
      // Continue to next URL
    }
  }
  console.log(`  ⚠️ Fox Sports failed`);

  // Fallback to Wikipedia
  console.log(`  ⚠️ Fox Sports failed, trying Wikipedia...`);
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(playerName)}&pithumbsize=500&origin=*`;

  const response = await fetch(searchUrl);
  const data = await response.json();

  const pages = data.query?.pages;
  if (pages) {
    const page = Object.values(pages)[0];
    if (page.thumbnail?.source) {
      console.log(`  ✅ Found Wikipedia image: ${page.thumbnail.source.substring(0, 60)}...`);
      return page.thumbnail.source;
    }
  }

  throw new Error(`No images found for ${playerName}`);
}

// Step 2: Submit image to FLUX Kontext Pro for stylization
async function submitToKontext(imageUrl, player, country) {
  const jersey = countryJerseys[country] || `${country} national team jersey`;

  // Consistent Panini sticker style - based on the good Messi result
  const jerseyColor = countryJerseys[country] || `${country} national team jersey`;

  const prompt = `Transform into Panini football sticker illustration. CRITICAL: Keep the EXACT same face, eyes, nose, mouth, hair - person must be instantly recognizable.

Style: Semi-realistic cartoon, smooth cel-shading, clean black outlines, vibrant saturated colors. Head and upper chest visible, facing camera.

Jersey: ${jerseyColor}, plain solid color, NO logos NO badges NO emblems - completely blank fabric.

Background: Blurred stadium crowd, blue sky, bright daylight.

No text anywhere.`;

  console.log(`  🎨 Submitting to Kontext Pro...`);

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
    throw new Error(`Kontext API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log(`  ⏳ Request ID: ${data.request_id}`);
  return data.request_id;
}

// Step 3: Poll for result
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

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Get result error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    if (data.status === 'Ready') {
      console.log(`  ✅ Image ready!`);
      return data.result;
    } else if (data.status === 'Error' || data.status === 'Content Moderated' || data.status === 'Request Moderated') {
      throw new Error(`Generation failed: ${data.status}`);
    }

    console.log(`  ⏳ Status: ${data.status}, waiting...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Timeout waiting for image generation');
}

// Main generation function
async function generatePlayerSticker(player, country, filename, wikiName = null) {
  console.log(`\n🏃 Processing: ${player.name} (${country})`);

  // Step 1: Find player photo (use wikiName for search if provided)
  const searchName = wikiName || player.name;
  const imageUrl = await searchPlayerImage(searchName, country);

  // Step 2: Submit to Kontext
  const requestId = await submitToKontext(imageUrl, player, country);

  // Step 3: Get result
  const result = await getKontextResult(requestId);

  // Save the image
  const filepath = path.join(OUTPUT_DIR, filename);

  // Debug: log result type
  console.log(`  📦 Result type: ${typeof result}`);

  // Handle different result formats
  let imageData;
  if (typeof result === 'object') {
    // Result has 'sample' property with the image URL
    imageData = result.sample || result.output_image || result.image || result.url;
    console.log(`  📦 Image URL: ${imageData?.substring(0, 60)}...`);
  } else {
    imageData = result;
  }

  if (typeof imageData === 'string') {
    if (imageData.startsWith('data:')) {
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
    } else if (imageData.startsWith('http')) {
      const imgResponse = await fetch(imageData);
      const buffer = Buffer.from(await imgResponse.arrayBuffer());
      fs.writeFileSync(filepath, buffer);
    } else {
      // Assume it's base64 without prefix
      fs.writeFileSync(filepath, Buffer.from(imageData, 'base64'));
    }
  } else {
    console.log(`  📦 Full result:`, JSON.stringify(result).substring(0, 300));
    throw new Error('Unexpected result format');
  }

  console.log(`  💾 Saved: ${filepath}`);
  return filepath;
}

async function main() {
  if (!FIREWORKS_API_KEY) {
    console.error('❌ FIREWORKS_API_KEY not set in .env');
    process.exit(1);
  }
  if (!BRAVE_API_KEY) {
    console.error('❌ BRAVE_API_KEY not set in .env');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const playersCol = db.collection('players');

    // Select test players - picking famous ones from different countries
    // Use Wikipedia-friendly names (with accents where needed)
    const testPlayers = [
      { name: 'Lionel Messi', wikiName: 'Lionel Messi', country: 'Argentina', fallbackClub: 'Inter Miami', fallbackClubCountry: 'United States' },
      { name: 'Kylian Mbappe', wikiName: 'Kylian Mbappé', country: 'France', fallbackClub: 'Real Madrid', fallbackClubCountry: 'Spain' },
      { name: 'Erling Haaland', wikiName: 'Erling Haaland', country: 'Norway', fallbackClub: 'Manchester City', fallbackClubCountry: 'England' },
    ];

    console.log('\n🔍 Finding test players in database...');

    for (const testPlayer of testPlayers) {
      // Find player in DB
      const player = await playersCol.findOne({
        name: { $regex: testPlayer.name, $options: 'i' }
      });

      console.log(`  DB result for ${testPlayer.name}:`, player ? `Found (club: ${player.club})` : 'Not found');

      const playerData = player ? {
        name: player.name,
        position: player.position || 'FWD',
        club: player.club || testPlayer.fallbackClub,
        clubCountry: player.currentClubCountry?.name || player.clubCountry || 'Unknown',
      } : {
        name: testPlayer.name,
        position: 'FWD',
        club: testPlayer.fallbackClub,
        clubCountry: testPlayer.fallbackClubCountry || 'Unknown',
      };

      // Get team info if player found
      let country = testPlayer.country;
      if (player) {
        const squad = await db.collection('squads').findOne({ playerIds: player._id });
        const team = squad ? await db.collection('teams').findOne({ _id: squad.teamId }) : null;
        country = team ? team.name : testPlayer.country;
      }

      try {
        const safeName = testPlayer.name.toLowerCase().replace(/\s+/g, '-');
        await generatePlayerSticker(playerData, country, `${safeName}.jpg`, testPlayer.wikiName);
      } catch (error) {
        console.error(`  ❌ Failed: ${error.message}`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('\n✅ Test image generation complete!');
    console.log(`📁 Check the ${OUTPUT_DIR} folder for results`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

main();
