# Virtual World Cup Album

A virtual World Cup album built for MongoDB's AI Hackathon. Player data and image URLs are stored in MongoDB Atlas, then Fireworks AI takes those image URLs and generates cartoon versions of the players to avoid copyright issues.

![Argentina Squad](client/public/screenshots/argentina-squad.png)

## Tech Stack

- **MongoDB Atlas** - Database for player data and image URLs
- **Fireworks AI** - Image generation (cartoon player images)
- **Node.js** - Backend

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI and Fireworks API key
   ```

## GitHub

🔗 https://github.com/ignaciojimenezr/WC-Album
