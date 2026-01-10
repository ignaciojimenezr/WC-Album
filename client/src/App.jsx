import { useState, useEffect, useMemo } from 'react';
import AlbumCover from './components/AlbumCover';
import LetterNav from './components/LetterNav';
import TeamGrid from './components/TeamGrid';
import SquadModal from './components/SquadModal';
import PlayerDetailModal from './components/PlayerDetailModal';
import './styles/album.css';

export default function App() {
  const [showCover, setShowCover] = useState(true);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLetter, setActiveLetter] = useState('A');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // Fetch teams on mount
  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch('/api/teams');
        const data = await res.json();
        setTeams(data);
      } catch (error) {
        console.error('Failed to fetch teams:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTeams();
  }, []);

  // Calculate which letters have teams
  const availableLetters = useMemo(() => {
    const letters = new Set();
    teams.forEach((team) => {
      letters.add(team.name.charAt(0).toUpperCase());
    });
    return letters;
  }, [teams]);

  // Show album cover
  if (showCover) {
    return <AlbumCover onOpen={() => setShowCover(false)} />;
  }

  // Show loading state
  if (loading) {
    return <div className="loading">Loading teams...</div>;
  }

  return (
    <div className="album-main">
      <LetterNav
        activeLetter={activeLetter}
        onLetterClick={setActiveLetter}
        availableLetters={availableLetters}
      />

      <TeamGrid
        teams={teams}
        activeLetter={activeLetter}
        onTeamClick={setSelectedTeam}
      />

      {selectedTeam && (
        <SquadModal
          team={selectedTeam}
          onClose={() => setSelectedTeam(null)}
          onPlayerClick={setSelectedPlayer}
        />
      )}

      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
