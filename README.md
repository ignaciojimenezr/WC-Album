# Football Data Ingestion

Ingest football squad/player data into MongoDB Atlas. Supports both CSV import and Sportmonks API.

## Features

- **CSV Import** (Recommended): Import your own curated squad data
- **Sportmonks API**: Fetch from Sportmonks Football API v3
- Stores up to 24 players per team
- Persists teams, players, and squad references to MongoDB Atlas
- Upsert behavior (safe to re-run)

## Prerequisites

- Node.js 18+ (uses native fetch)
- MongoDB Atlas account and cluster

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI
   ```

## Usage

### Option 1: CSV Import (Recommended)

Import squad data from your own CSV file:

```bash
npm run ingest-csv -- data/squads.csv
```

**CSV Format:**
```csv
team,name,position,club,country
Spain,Pedri,Midfielder,Barcelona,Spain
Spain,Lamine Yamal,Forward,Barcelona,Spain
Argentina,Lionel Messi,Forward,Inter Miami,USA
Argentina,Julián Álvarez,Forward,Atlético Madrid,Spain
```

Required columns: `team`, `name`
Optional columns: `position`, `club`, `country`

See `data/squads.example.csv` for a template.

### Option 2: Sportmonks API

If you have a Sportmonks API key with access to national team data:

```bash
# Set TEAM_IDS in .env first
npm run ingest
```

Note: Sportmonks free plan may have limited access to national team data.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `DB_NAME` | No | Database name (default: "football") |
| `SPORTMONKS_API_KEY` | For API | Your Sportmonks API key |
| `TEAM_IDS` | For API | Comma-separated team IDs |

## Data Model

### `teams` Collection

```javascript
{
  _id: "team:csv:spain",
  provider: "csv",
  providerId: "Spain",
  name: "Spain",
  type: "national",
  country: { id: null, name: "Spain", code: null },
  updatedAt: ISODate("...")
}
```

### `players` Collection

```javascript
{
  _id: "player:csv:spain-pedri",
  provider: "csv",
  providerId: "Spain:Pedri",
  name: "Pedri",
  position: "Midfielder",
  nationality: { id: null, name: "Spain", code: null },
  currentClub: { id: null, name: "Barcelona" },
  currentClubCountry: { id: null, name: null, code: null },
  updatedAt: ISODate("...")
}
```

### `squads` Collection

```javascript
{
  _id: "squad:csv:spain:current",
  provider: "csv",
  teamId: "Spain",
  teamName: "Spain",
  playerIds: ["player:csv:spain-pedri", ...],  // max 24
  fetchedAt: ISODate("...")
}
```

## Indexes

Created automatically on startup:

- `teams`: unique `{ provider, providerId }`, query on `country.id`
- `players`: unique `{ provider, providerId }`, query on `nationality.id`, `currentClub.id`
- `squads`: unique `{ provider, teamId }`, query on `teamId`

## Project Structure

```
├── package.json
├── .env.example
├── README.md
├── data/
│   └── squads.example.csv    # CSV template
└── src/
    ├── config.js             # Environment configuration
    ├── db.js                 # MongoDB utilities
    ├── ingestCSV.js          # CSV import pipeline
    ├── ingest.js             # Sportmonks API pipeline
    ├── sportmonksClient.js   # API client
    └── findTeamIds.js        # Team ID search helper
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run ingest-csv -- <file>` | Import from CSV file |
| `npm run ingest` | Import from Sportmonks API |
| `npm run find-teams -- <countries>` | Search Sportmonks for team IDs |
