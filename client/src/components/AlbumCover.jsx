import '../styles/album.css';

export default function AlbumCover({ onOpen }) {
  return (
    <div className="album-cover">
      <div className="trophy">🏆</div>
      <h1>World Cup 2026</h1>
      <h2>Sticker Album</h2>
      <button className="open-album-btn" onClick={onOpen}>
        Open Album
      </button>
    </div>
  );
}
