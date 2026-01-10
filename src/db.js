import { MongoClient } from 'mongodb';

let client = null;
let db = null;

/**
 * Connect to MongoDB Atlas
 */
export async function connect(mongoUri, dbName) {
  console.log(`[DB] Connecting to MongoDB Atlas...`);

  client = new MongoClient(mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  await client.connect();
  db = client.db(dbName);

  // Verify connection
  await db.command({ ping: 1 });
  console.log(`[DB] Connected to database: ${dbName}`);

  return db;
}

/**
 * Get the database instance
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connect() first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export async function close() {
  if (client) {
    console.log('[DB] Closing connection...');
    await client.close();
    client = null;
    db = null;
  }
}

/**
 * Ensure all required indexes exist
 */
export async function ensureIndexes() {
  console.log('[DB] Ensuring indexes...');

  const teamsCollection = db.collection('teams');
  const playersCollection = db.collection('players');
  const squadsCollection = db.collection('squads');
  const countriesCollection = db.collection('countries');

  // Teams indexes
  await teamsCollection.createIndex(
    { provider: 1, providerId: 1 },
    { unique: true, name: 'provider_providerId_unique' }
  );
  await teamsCollection.createIndex(
    { 'country.id': 1 },
    { name: 'country_id' }
  );

  // Players indexes
  await playersCollection.createIndex(
    { provider: 1, providerId: 1 },
    { unique: true, name: 'provider_providerId_unique' }
  );
  await playersCollection.createIndex(
    { 'nationality.id': 1 },
    { name: 'nationality_id' }
  );
  await playersCollection.createIndex(
    { 'currentClub.id': 1 },
    { name: 'currentClub_id' }
  );

  // Squads indexes
  await squadsCollection.createIndex(
    { provider: 1, teamId: 1 },
    { unique: true, name: 'provider_teamId_unique' }
  );
  await squadsCollection.createIndex(
    { teamId: 1 },
    { name: 'teamId' }
  );

  // Countries indexes (optional collection)
  await countriesCollection.createIndex(
    { provider: 1, providerId: 1 },
    { unique: true, name: 'provider_providerId_unique' }
  );

  console.log('[DB] Indexes created/verified');
}

/**
 * Upsert a team document
 * Supports both Sportmonks (numeric providerId) and CSV (custom _id)
 */
export async function upsertTeam(teamData) {
  const _id = teamData._id || `team:sportmonks:${teamData.providerId}`;
  const provider = teamData.provider || 'sportmonks';

  const doc = {
    _id,
    provider,
    providerId: teamData.providerId,
    name: teamData.name || null,
    type: teamData.type || null,
    country: teamData.country || { id: null, name: null, code: null },
    image_path: teamData.image_path || null,
    updatedAt: new Date(),
  };

  await db.collection('teams').updateOne(
    { _id },
    { $set: doc },
    { upsert: true }
  );

  return doc;
}

/**
 * Upsert a player document
 * Supports both Sportmonks (numeric providerId) and CSV (custom _id)
 */
export async function upsertPlayer(playerData) {
  const _id = playerData._id || `player:sportmonks:${playerData.providerId}`;
  const provider = playerData.provider || 'sportmonks';

  const doc = {
    _id,
    provider,
    providerId: playerData.providerId,
    name: playerData.name || null,
    position: playerData.position || null,
    nationality: playerData.nationality || { id: null, name: null, code: null },
    image_path: playerData.image_path || null,
    currentClub: playerData.currentClub || { id: null, name: null },
    currentClubCountry: playerData.currentClubCountry || { id: null, name: null, code: null },
    updatedAt: new Date(),
  };

  await db.collection('players').updateOne(
    { _id },
    { $set: doc },
    { upsert: true }
  );

  return doc;
}

/**
 * Upsert a squad document
 * Supports both Sportmonks (numeric teamId) and CSV (custom _id)
 */
export async function upsertSquad(squadData) {
  const _id = squadData._id || `squad:sportmonks:${squadData.teamId}:current`;
  const provider = squadData.provider || 'sportmonks';

  const doc = {
    _id,
    provider,
    teamId: squadData.teamId,
    teamName: squadData.teamName || null,
    playerIds: squadData.playerIds || [],
    fetchedAt: new Date(),
  };

  await db.collection('squads').updateOne(
    { _id },
    { $set: doc },
    { upsert: true }
  );

  return doc;
}

/**
 * Upsert a country document (optional caching)
 */
export async function upsertCountry(countryData) {
  const { providerId } = countryData;
  const _id = `country:sportmonks:${providerId}`;

  const doc = {
    _id,
    provider: 'sportmonks',
    providerId,
    name: countryData.name || null,
    code: countryData.code || null,
    updatedAt: new Date(),
  };

  await db.collection('countries').updateOne(
    { _id },
    { $set: doc },
    { upsert: true }
  );

  return doc;
}
