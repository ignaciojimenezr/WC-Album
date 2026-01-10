import TeamCard from './TeamCard';
import '../styles/album.css';

export default function TeamGrid({ teams, activeLetter, onTeamClick }) {
  const filteredTeams = teams.filter(
    (team) => team.name.charAt(0).toUpperCase() === activeLetter
  );

  if (filteredTeams.length === 0) {
    return (
      <div className="empty-state">
        No teams found for letter "{activeLetter}"
      </div>
    );
  }

  return (
    <div className="team-grid">
      {filteredTeams.map((team) => (
        <TeamCard
          key={team._id}
          team={team}
          onClick={() => onTeamClick(team)}
        />
      ))}
    </div>
  );
}
