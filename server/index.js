import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
let db = null;

async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.DB_NAME || 'football');
  console.log('[DB] Connected to MongoDB Atlas');
  return db;
}

// Flag emoji mapping for all 42 confirmed World Cup teams
const flagEmojis = {
  'Algeria': '🇩🇿',
  'Argentina': '🇦🇷',
  'Australia': '🇦🇺',
  'Austria': '🇦🇹',
  'Belgium': '🇧🇪',
  'Brazil': '🇧🇷',
  'Canada': '🇨🇦',
  'Cape Verde': '🇨🇻',
  'Colombia': '🇨🇴',
  'Croatia': '🇭🇷',
  'Curaçao': '🇨🇼',
  'Ecuador': '🇪🇨',
  'Egypt': '🇪🇬',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'France': '🇫🇷',
  'Germany': '🇩🇪',
  'Ghana': '🇬🇭',
  'Haiti': '🇭🇹',
  'Iran': '🇮🇷',
  'Ivory Coast': '🇨🇮',
  'Japan': '🇯🇵',
  'Jordan': '🇯🇴',
  'Mexico': '🇲🇽',
  'Morocco': '🇲🇦',
  'Netherlands': '🇳🇱',
  'New Zealand': '🇳🇿',
  'Norway': '🇳🇴',
  'Panama': '🇵🇦',
  'Paraguay': '🇵🇾',
  'Portugal': '🇵🇹',
  'Qatar': '🇶🇦',
  'Saudi Arabia': '🇸🇦',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Senegal': '🇸🇳',
  'South Africa': '🇿🇦',
  'South Korea': '🇰🇷',
  'Spain': '🇪🇸',
  'Switzerland': '🇨🇭',
  'Tunisia': '🇹🇳',
  'United States': '🇺🇸',
  'Uruguay': '🇺🇾',
  'Uzbekistan': '🇺🇿',
};

// Position sort order
const positionOrder = { 'GK': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };

// API Routes

// GET /api/teams - Get all teams sorted alphabetically
app.get('/api/teams', async (req, res) => {
  try {
    const teams = await db.collection('teams')
      .find({})
      .sort({ name: 1 })
      .toArray();

    const teamsWithFlags = teams.map(team => ({
      _id: team._id,
      name: team.name,
      flagEmoji: flagEmojis[team.name] || '🏳️',
    }));

    res.json(teamsWithFlags);
  } catch (error) {
    console.error('[API] Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// GET /api/teams/:teamName/players - Get all players for a team
app.get('/api/teams/:teamName/players', async (req, res) => {
  try {
    const { teamName } = req.params;

    const players = await db.collection('players')
      .find({ 'nationality.name': teamName })
      .toArray();

    // Sort by position: GK → DEF → MID → FWD
    const sortedPlayers = players.sort((a, b) => {
      const orderA = positionOrder[a.position] || 5;
      const orderB = positionOrder[b.position] || 5;
      return orderA - orderB;
    });

    const formattedPlayers = sortedPlayers.map(player => ({
      _id: player._id,
      name: player.name,
      position: player.position,
      club: player.currentClub?.name || 'Unknown',
      clubCountry: player.currentClubCountry?.name || 'Unknown',
      image_path: player.image_path,
    }));

    res.json(formattedPlayers);
  } catch (error) {
    console.error('[API] Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// GET /api/players/:playerId - Get single player details
app.get('/api/players/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;

    const player = await db.collection('players').findOne({ _id: playerId });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({
      _id: player._id,
      name: player.name,
      position: player.position,
      club: player.currentClub?.name || 'Unknown',
      clubCountry: player.currentClubCountry?.name || 'Unknown',
      nationality: player.nationality?.name || 'Unknown',
      image_path: player.image_path,
    });
  } catch (error) {
    console.error('[API] Error fetching player:', error);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[SERVER] Running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[SERVER] Failed to start:', error);
    process.exit(1);
  }
}

start();
