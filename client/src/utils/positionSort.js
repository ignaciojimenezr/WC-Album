export const positionOrder = { 'GK': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };

export const positionColors = {
  'GK': '#facc15',   // Yellow
  'DEF': '#3b82f6',  // Blue
  'MID': '#22c55e',  // Green
  'FWD': '#ef4444',  // Red
};

export const positionLabels = {
  'GK': 'Goalkeeper',
  'DEF': 'Defender',
  'MID': 'Midfielder',
  'FWD': 'Forward',
};

export function sortPlayersByPosition(players) {
  return [...players].sort((a, b) => {
    const orderA = positionOrder[a.position] || 5;
    const orderB = positionOrder[b.position] || 5;
    return orderA - orderB;
  });
}
