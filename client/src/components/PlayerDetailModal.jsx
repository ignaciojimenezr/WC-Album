import '../styles/album.css';

export default function PlayerDetailModal({ player, onClose }) {
  return (
    <div className="player-detail-overlay" onClick={onClose}>
      <div
        className="player-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close-btn" onClick={onClose}>
          ×
        </button>

        <div className="photo">
          {player.image_path ? (
            <img
              src={player.image_path}
              alt={player.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
            />
          ) : (
            '👤'
          )}
        </div>

        <h2 className="name">{player.name}</h2>

        <span className={`position-badge ${player.position}`}>
          {player.position}
        </span>

        <div className="info-row">
          <span className="info-label">Club</span>
          <span className="info-value">{player.club}</span>
        </div>

        <div className="info-row">
          <span className="info-label">Club Country</span>
          <span className="info-value">{player.clubCountry}</span>
        </div>
      </div>
    </div>
  );
}
