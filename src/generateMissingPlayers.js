import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;

const OUTPUT_DIR = './client/public/players/argentina';

// Players with their correct Fox Sports URLs
const missingPlayers = [
  {
    name: 'Emiliano Martinez',
    foxUrl: 'https://www.foxsports.com/soccer/damian-martinez-player',
  },
  {
    name: 'Enzo Fernández',
    foxUrl: 'https://www.foxsports.com/soccer/santiago-sosa-3-player',
  },
];

// Extract headshot URL from Fox Sports page
async function getHeadshotFromFoxUrl(foxUrl) {
  const response = await fetch(foxUrl);
  if (!response.ok) throw new Error(`Failed to fetch ${foxUrl}`);

  const html = await response.text();
  const match = html.match(/https:\/\/b\.fssta\.com\/uploads\/application\/soccer\/headshots\/(\d+)\.vresize/);

  if (!match) throw new Error('No headshot found on page');

  return `https://b.fssta.com/uploads/application/soccer/headshots/${match[1]}.vresize.350.350.medium.1.png`;
}

// Submit to FLUX Kontext Pro
async function submitToKontext(imageUrl) {
  const prompt = `Transform into Panini football sticker illustration. CRITICAL: Keep the EXACT same face, eyes, nose, mouth, hair - person must be instantly recognizable.

Style: Semi-realistic cartoon, smooth cel-shading, clean black outlines, vibrant saturated colors. Head and upper chest visible, facing camera.

Jersey: light blue and white vertical striped Argentina national team jersey, plain solid color, NO logos NO badges NO emblems - completely blank fabric.

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
    throw new Error(`Kontext API error: ${response.status} - ${error}`);
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

async function main() {
  if (!FIREWORKS_API_KEY) {
    console.error('❌ FIREWORKS_API_KEY not set');
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const player of missingPlayers) {
    console.log(`\n🏃 Processing: ${player.name}`);

    try {
      // Get headshot from Fox Sports
      console.log(`  🔍 Fetching from Fox Sports...`);
      const imageUrl = await getHeadshotFromFoxUrl(player.foxUrl);
      console.log(`  ✅ Found headshot`);

      // Submit to Kontext
      console.log(`  🎨 Generating sticker...`);
      const requestId = await submitToKontext(imageUrl);
      console.log(`  ⏳ Request ID: ${requestId}`);

      // Get result
      const result = await getKontextResult(requestId);
      const imageData = result.sample || result.output_image || result.image || result.url;

      // Save image
      const playerSlug = player.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const outputPath = path.join(OUTPUT_DIR, `${playerSlug}.png`);

      if (typeof imageData === 'string' && imageData.startsWith('http')) {
        const imgResponse = await fetch(imageData);
        const buffer = Buffer.from(await imgResponse.arrayBuffer());
        fs.writeFileSync(outputPath, buffer);
        console.log(`  💾 Saved: ${outputPath}`);
      } else {
        throw new Error('Unexpected result format');
      }

    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}`);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('\n✅ Done!');
}

main();
