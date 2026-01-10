import '../styles/album.css';

export default function TeamCard({ team, onClick }) {
  return (
    <div className="team-card" onClick={onClick}>
      <div className="flag">{team.flagEmoji}</div>
      <div className="name">{team.name}</div>
    </div>
  );
}
