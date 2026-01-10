import '../styles/album.css';

export default function PlayerSlot({ player, onClick }) {
  return (
    <div className="player-slot" onClick={onClick}>
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
      <div className="name">{player.name}</div>
      <span className={`position-badge ${player.position}`}>
        {player.position}
      </span>
      <div className="club">{player.club}</div>
    </div>
  );
}
