class WordConstellation {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.resizeCanvas();

    // Game state
    this.isPlaying = false;
    this.isPaused = false;
    this.gameTime = 60;
    this.timeLeft = this.gameTime;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.wordsCompleted = 0;
    this.wpm = 0;

    // High score system
    this.highScore = this.loadHighScore();
    this.sessionBestScore = 0;

    // Word management
    this.currentWord = null;
    this.typedText = "";
    this.wordQueue = [];
    this.wordsInRound = 0;

    // Timing
    this.lastTime = 0;
    this.gameStartTime = 0;
    this.lastWordTime = 0;

    // Particles
    this.particles = [];

    this.setupEventListeners();
    this.showInstructions();
    this.updateHighScoreDisplay();

    // Hide word container initially
    const wordContainer = document.getElementById("wordContainer");
    if (wordContainer) {
      wordContainer.style.display = "none";
    }
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setupEventListeners() {
    window.addEventListener("resize", () => this.resizeCanvas());

    document.addEventListener("keydown", (e) => {
      if (!this.isPlaying) {
        if (e.code === "Space") {
          e.preventDefault();
          this.startGame();
        }
        return;
      }

      if (e.code === "Escape") {
        this.endGame();
        return;
      }

      this.handleKeyPress(e);
    });
  }

  startGame() {
    this.isPlaying = true;
    this.isPaused = false;
    this.timeLeft = this.gameTime;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.wordsCompleted = 0;
    this.wpm = 0;
    this.currentWord = null;
    this.typedText = "";
    this.wordQueue = [];
    this.wordsInRound = 0;
    this.gameStartTime = Date.now();
    this.lastWordTime = Date.now();

    // Show all game elements again
    document.getElementById("header").style.display = "block";
    document.getElementById("gameCanvas").style.display = "block";
    document.getElementById("currentWord").style.display = "block";
    document.getElementById("instructions").style.display = "block";
    document.getElementById("timerContainer").style.display = "block";
    document.getElementById("gameOver").style.display = "none";
    document.getElementById("gameOver").classList.add("hidden");
    document.getElementById("instructions").classList.add("hidden");

    // Start with first word
    this.nextWord();

    this.gameLoop();
  }

  endGame() {
    this.isPlaying = false;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    // Update high scores
    this.sessionBestScore = Math.max(this.sessionBestScore, this.score);

    let isNewHighScore = false;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore(this.highScore);
      isNewHighScore = true;
    }

    document.getElementById("finalScore").textContent = this.score;
    document.getElementById("wordsCompleted").textContent = this.wordsCompleted;
    document.getElementById("bestCombo").textContent = this.maxCombo;
    document.getElementById("gameOverHighScore").textContent = this.highScore;

    // Show/hide new high score message
    const newHighScoreMsg = document.getElementById("newHighScore");
    if (newHighScoreMsg) {
      newHighScoreMsg.style.display = isNewHighScore ? "block" : "none";
    }

    // Hide ALL game elements and show full-screen game over
    document.getElementById("header").style.display = "none";
    document.getElementById("gameCanvas").style.display = "none";
    document.getElementById("currentWord").style.display = "none";
    document.getElementById("instructions").style.display = "none";
    document.getElementById("timerContainer").style.display = "none";
    document.getElementById("gameOver").style.display = "flex";
    document.getElementById("gameOver").classList.remove("hidden");

    this.updateHighScoreDisplay();
  }

  nextWord() {
    // Choose difficulty based on progress
    let difficulty = "easy";
    if (this.wordsCompleted >= 5 && this.wordsCompleted < 15)
      difficulty = "medium";
    else if (this.wordsCompleted >= 15) difficulty = "hard";

    // Bonus word occasionally
    if (this.wordsCompleted > 0 && Math.random() < 0.1) {
      difficulty = "bonus";
    }

    const word = getRandomWord(difficulty);

    this.currentWord = {
      text: word,
      difficulty: difficulty,
      startTime: Date.now(),
    };

    this.typedText = "";
    this.updateWordDisplay();
  }

  handleKeyPress(e) {
    const key = e.key.toLowerCase();

    if (key === "backspace") {
      e.preventDefault();
      if (this.typedText.length > 0) {
        this.typedText = this.typedText.slice(0, -1);
        this.updateWordDisplay();
      }
      return;
    }

    if (key === "escape") {
      this.typedText = "";
      this.updateWordDisplay();
      return;
    }

    if (key.match(/[a-z]/)) {
      if (!this.currentWord) return;

      this.typedText += key;

      // Check if word is complete
      if (this.typedText === this.currentWord.text.toLowerCase()) {
        this.completeWord();
      } else if (
        !this.currentWord.text.toLowerCase().startsWith(this.typedText)
      ) {
        // Wrong letter - reset typing and lose combo
        const lostCombo = this.combo;
        this.typedText = "";
        this.combo = 0;
        if (lostCombo >= 2) {
          this.showComboLoss(lostCombo);
        }
        this.updateWordDisplay();
      } else {
        this.updateWordDisplay();
      }
    }
  }

  completeWord() {
    const word = this.currentWord;

    // Calculate points with speed and combo bonuses
    const basePoints = getWordPoints(word.text);
    const timeTaken = (Date.now() - word.startTime) / 1000;
    const speedBonus = Math.max(1, 3 - timeTaken / 2); // Faster = more points

    // Combo system
    this.combo++;
    const comboMultiplier = Math.min(3, 1 + (this.combo - 1) * 0.1);

    const finalPoints = Math.floor(basePoints * speedBonus * comboMultiplier);
    this.score += finalPoints;
    this.wordsCompleted++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.lastWordTime = Date.now();

    // Show Fruit Ninja style combo display for combos >= 2
    if (this.combo >= 2) {
      this.showCombo(this.combo);
    }

    // Calculate WPM
    const gameTimeElapsed = (Date.now() - this.gameStartTime) / 1000 / 60;
    this.wpm = Math.floor(this.wordsCompleted / gameTimeElapsed);

    // Move to next word
    this.nextWord();
    this.updateUI();
  }

  updateWordDisplay() {
    const display = document.getElementById("wordDisplay");
    const cursor = document.getElementById("cursor");
    const wordContainer = document.getElementById("wordContainer");

    if (this.currentWord) {
      const word = this.currentWord.text.toUpperCase();
      const typed = this.typedText.toUpperCase();

      // Show the word container
      wordContainer.style.display = "block";

      // Clear previous content
      display.innerHTML = "";

      // Create letter elements
      for (let i = 0; i < word.length; i++) {
        const letterDiv = document.createElement("div");
        letterDiv.className = "letter";
        letterDiv.textContent = word[i];

        // Apply appropriate class based on typing progress
        if (i < typed.length) {
          letterDiv.classList.add("typed");
        } else if (i === typed.length) {
          letterDiv.classList.add("current");
        } else {
          letterDiv.classList.add("pending");
        }

        display.appendChild(letterDiv);
      }

      // Show/hide cursor based on completion
      if (typed.length === word.length) {
        cursor.style.display = "none";
      } else {
        cursor.style.display = "inline-block";
      }
    } else {
      // Hide the word container when no active word
      wordContainer.style.display = "none";
    }
  }

  updateUI() {
    document.getElementById("score").textContent = `Score: ${this.score}`;
    document.getElementById("combo").textContent = `Combo: ${this.combo}x`;
    document.getElementById("wpm").textContent = `WPM: ${this.wpm}`;

    const timerElement = document.getElementById("timer");
    const timeLeft = Math.ceil(this.timeLeft);
    timerElement.textContent = `Time: ${timeLeft}s`;

    // Add warning class when time is low
    if (timeLeft <= 10) {
      timerElement.classList.add("warning");
    } else {
      timerElement.classList.remove("warning");
    }
  }

  showInstructions() {
    document.getElementById("instructions").classList.remove("hidden");
  }

  gameLoop(currentTime = 0) {
    if (!this.isPlaying) return;

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Update timer
    this.timeLeft -= deltaTime / 1000;
    if (this.timeLeft <= 0) {
      this.endGame();
      return;
    }

    // Lose combo if no word typed for too long
    if (Date.now() - this.lastWordTime > 5000 && this.combo > 0) {
      const lostCombo = this.combo;
      this.combo = 0;
      if (lostCombo >= 2) {
        this.showComboLoss(lostCombo);
      }
    }

    this.update(deltaTime);
    this.render();
    this.updateUI();

    requestAnimationFrame((time) => this.gameLoop(time));
  }

  update(deltaTime) {
    // Simple update - just lose combo if idle too long
    if (Date.now() - this.lastWordTime > 5000) {
      this.combo = 0;
    }
  }

  render() {
    // Clear canvas and draw simple background
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw gradient background
    const gradient = this.ctx.createRadialGradient(
      this.canvas.width / 2,
      this.canvas.height / 2,
      0,
      this.canvas.width / 2,
      this.canvas.height / 2,
      Math.max(this.canvas.width, this.canvas.height) / 2
    );
    gradient.addColorStop(0, "rgba(26, 26, 46, 1)");
    gradient.addColorStop(1, "rgba(15, 15, 35, 1)");

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // High Score System
  loadHighScore() {
    const saved = document.cookie
      .split("; ")
      .find((row) => row.startsWith("wordConstellationHighScore="));
    return saved ? parseInt(saved.split("=")[1]) : 0;
  }

  saveHighScore(score) {
    // Save for 1 year
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `wordConstellationHighScore=${score}; expires=${expires.toUTCString()}; path=/`;
  }

  updateHighScoreDisplay() {
    const highScoreElement = document.getElementById("highScore");
    if (highScoreElement) {
      highScoreElement.textContent = `High Score: ${this.highScore}`;
    }
  }

  showCombo(comboCount) {
    const comboDisplay = document.getElementById("comboDisplay");
    const comboText = document.getElementById("comboText");
    const comboMultiplier = document.getElementById("comboMultiplier");

    // Clear any existing classes
    comboDisplay.className = "";

    // Add streak classes for special effects
    if (comboCount >= 10) {
      comboDisplay.classList.add("combo-streak-10");
    } else if (comboCount >= 5) {
      comboDisplay.classList.add("combo-streak-5");
    } else if (comboCount >= 3) {
      comboDisplay.classList.add("combo-streak-3");
    }

    // Update text
    comboText.textContent = "COMBO";
    comboMultiplier.textContent = `${comboCount}X`;

    // Show the display
    comboDisplay.style.display = "block";

    // Hide after animation completes
    setTimeout(() => {
      comboDisplay.style.display = "none";
    }, 1500);
  }

  showComboLoss(lostCombo) {
    const comboDisplay = document.getElementById("comboDisplay");
    const comboText = document.getElementById("comboText");
    const comboMultiplier = document.getElementById("comboMultiplier");

    // Clear any existing classes and add combo loss class
    comboDisplay.className = "";
    comboText.className = "combo-loss";
    comboMultiplier.className = "combo-loss";

    // Update text
    comboText.textContent = "COMBO LOST";
    comboMultiplier.textContent = `${lostCombo}X`;

    // Show the display
    comboDisplay.style.display = "block";

    // Hide after animation completes
    setTimeout(() => {
      comboDisplay.style.display = "none";
      // Reset classes
      comboText.className = "combo-text";
      comboMultiplier.className = "combo-multiplier";
    }, 1000);
  }

  showNewHighScore() {
    // Create a celebratory effect for new high score
    const gameOverDiv = document.getElementById("gameOver");
    const newHighScoreMsg = document.createElement("div");
    newHighScoreMsg.innerHTML = "🌟 NEW HIGH SCORE! 🌟";
    newHighScoreMsg.style.cssText = `
      color: #ffd93d;
      font-size: 1.5em;
      font-weight: bold;
      margin: 10px 0;
      text-shadow: 0 0 20px #ffd93d;
      animation: glow 1s ease-in-out infinite alternate;
    `;
    gameOverDiv.insertBefore(newHighScoreMsg, gameOverDiv.firstChild);

    // Remove the message after 5 seconds
    setTimeout(() => {
      if (newHighScoreMsg.parentNode) {
        newHighScoreMsg.parentNode.removeChild(newHighScoreMsg);
      }
    }, 5000);
  }
}

// Initialize game when page loads
let game;
window.addEventListener("load", () => {
  game = new WordConstellation();
});

// Expose startGame function globally for the play again button
function startGame() {
  game.startGame();
}
