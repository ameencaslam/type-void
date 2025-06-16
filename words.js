// Word database organized by difficulty
const WORDS = {
  easy: [
    "cat",
    "dog",
    "run",
    "jump",
    "blue",
    "red",
    "sun",
    "moon",
    "star",
    "fire",
    "water",
    "earth",
    "wind",
    "light",
    "dark",
    "love",
    "hope",
    "dream",
    "wish",
    "play",
    "game",
    "code",
    "type",
    "word",
    "fast",
    "slow",
    "big",
    "small",
    "good",
    "nice",
    "cool",
    "warm",
    "cold",
    "hot",
    "new",
    "old",
    "yes",
    "no",
  ],

  medium: [
    "galaxy",
    "planet",
    "cosmic",
    "stellar",
    "nebula",
    "orbit",
    "meteor",
    "typing",
    "coding",
    "gaming",
    "puzzle",
    "rhythm",
    "energy",
    "magic",
    "forest",
    "ocean",
    "mountain",
    "desert",
    "castle",
    "bridge",
    "tunnel",
    "rocket",
    "engine",
    "system",
    "network",
    "circuit",
    "matrix",
    "vector",
    "chrome",
    "firefox",
    "cursor",
    "window",
    "folder",
    "binary",
    "pixel",
  ],

  hard: [
    "constellation",
    "supernova",
    "parallax",
    "quantum",
    "infinity",
    "paradox",
    "algorithm",
    "programming",
    "javascript",
    "development",
    "architecture",
    "synchronize",
    "optimization",
    "authentication",
    "encryption",
    "deployment",
    "magnificent",
    "extraordinary",
    "phenomenal",
    "spectacular",
    "breathtaking",
    "revolutionary",
    "metamorphosis",
    "crystalline",
    "kaleidoscope",
    "symphony",
  ],

  bonus: [
    "stardust",
    "moonbeam",
    "lightning",
    "thunder",
    "rainbow",
    "crystal",
    "diamond",
    "emerald",
    "sapphire",
    "phoenix",
    "dragon",
    "unicorn",
    "wizard",
    "enchant",
    "mystic",
    "cosmic",
    "astral",
    "eternal",
  ],
};

// Get random word by difficulty
function getRandomWord(difficulty = "medium") {
  const wordList = WORDS[difficulty];
  return wordList[Math.floor(Math.random() * wordList.length)];
}

// Get word difficulty level
function getWordDifficulty(word) {
  for (const [difficulty, words] of Object.entries(WORDS)) {
    if (words.includes(word.toLowerCase())) {
      return difficulty;
    }
  }
  return "medium"; // default
}

// Get points for word based on difficulty and length
function getWordPoints(word) {
  const difficulty = getWordDifficulty(word);
  const basePoints = word.length;

  const multipliers = {
    easy: 1,
    medium: 1.5,
    hard: 2,
    bonus: 3,
  };

  return Math.floor(basePoints * multipliers[difficulty]);
}
