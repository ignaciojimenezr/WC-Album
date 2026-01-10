import '../styles/album.css';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function LetterNav({ activeLetter, onLetterClick, availableLetters }) {
  return (
    <nav className="letter-nav">
      {LETTERS.map((letter) => {
        const isAvailable = availableLetters.has(letter);
        const isActive = letter === activeLetter;

        return (
          <button
            key={letter}
            className={`letter-btn ${isActive ? 'active' : ''}`}
            onClick={() => onLetterClick(letter)}
            disabled={!isAvailable}
          >
            {letter}
          </button>
        );
      })}
    </nav>
  );
}
