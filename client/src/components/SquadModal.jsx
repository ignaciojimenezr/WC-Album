import { useEffect, useState } from 'react';
import PlayerSlot from './PlayerSlot';
import '../styles/album.css';

export default function SquadModal({ team, onClose, onPlayerClick }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlayers() {
      try {
        const res = await fetch(`/api/teams/${encodeURIComponent(team.name)}/players`);
        const data = await res.json();
        setPlayers(data);
      } catch (error) {
        console.error('Failed to fetch players:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPlayers();
  }, [team.name]);

  return (
    <div className="squad-modal-overlay">
      <div className="squad-modal">
        <div className="squad-header">
          <button className="back-btn" onClick={onClose}>
            ←
          </button>
          <span className="flag">{team.flagEmoji}</span>
          <span className="team-name">{team.name}</span>
                  </div>

        {loading ? (
          <div className="loading">Loading squad...</div>
        ) : (
          <>
            <div className="player-grid">
              {players.map((player) => (
                <PlayerSlot
                  key={player._id}
                  player={player}
                  onClick={() => onPlayerClick(player)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
