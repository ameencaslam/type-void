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
    this.timerStarted = false;

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

    // Timer warning flags
    this.timerWarningTriggered = {
      warning: false,
      critical: false,
      extreme: false,
    };

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
    this.timerStarted = false;

    // Reset timer warning flags
    this.timerWarningTriggered = {
      warning: false,
      critical: false,
      extreme: false,
    };

    // Clear any error effects from previous game
    this.clearErrorEffects();
    this.clearTimerEffects();

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

    // Clear any dramatic timer effects immediately
    this.clearTimerEffects();

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

    // Clear all dramatic error effects before showing game over screen
    this.clearErrorEffects();

    // Generate game over effects
    generateGameOverStarField();
    generateGameOverParticles();

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

      // Start timer on first letter typed
      if (!this.timerStarted) {
        this.timerStarted = true;
        this.gameStartTime = Date.now(); // Reset start time to when typing actually begins
      }

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

        // Trigger dramatic error for wrong letter (only once per wrong letter)
        this.triggerDramaticError("wrong_letter");

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

    // Animate the persistent combo counter
    this.updatePersistentCombo(this.combo, true);

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

    // Update persistent combo counter
    this.updatePersistentCombo(this.combo);

    const timerElement = document.getElementById("timer");
    if (!this.timerStarted) {
      timerElement.textContent = "READY";
    } else {
      const timeLeft = Math.ceil(this.timeLeft);
      timerElement.textContent = `Time: ${timeLeft}s`;
    }

    // Add warning class and dramatic effects when time is low (only if timer started)
    if (this.timerStarted) {
      const timeLeft = Math.ceil(this.timeLeft);
      if (timeLeft <= 5) {
        // Timer critical - glitch effects only
        timerElement.classList.add("warning");
        if (!this.timerWarningTriggered.critical) {
          this.timerWarningTriggered.critical = true;
          this.triggerDramaticError("timer_critical");
        }
      } else {
        timerElement.classList.remove("warning");
        // Clear timer-specific effects when time is not critical
        this.clearTimerEffects();
        // Reset warning flags when timer is not in warning state
        this.timerWarningTriggered = {
          warning: false,
          critical: false,
          extreme: false,
        };
      }
    } else {
      // Remove any warning states when timer hasn't started
      timerElement.classList.remove("warning");
      this.clearTimerEffects();
    }
  }

  showInstructions() {
    document.getElementById("instructions").classList.remove("hidden");
  }

  gameLoop(currentTime = 0) {
    if (!this.isPlaying) return;

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Update timer only if it has started (user has started typing)
    if (this.timerStarted) {
      this.timeLeft -= deltaTime / 1000;
      if (this.timeLeft <= 0) {
        this.endGame();
        return;
      }
    }

    // Lose combo if no word typed for too long (only after timer started)
    if (
      this.timerStarted &&
      Date.now() - this.lastWordTime > 5000 &&
      this.combo > 0
    ) {
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

  updatePersistentCombo(comboCount, animate = false) {
    const comboCounter = document.getElementById("comboCounter");
    if (!comboCounter) return;

    // Hide combo counter if it's 0, show otherwise
    if (comboCount === 0) {
      comboCounter.style.display = "none";
      return;
    } else {
      comboCounter.style.display = "inline-block";
    }

    // Update text
    comboCounter.textContent = `${comboCount}x`;

    // Clear existing classes
    comboCounter.className = "";

    // Add streak classes for color changes
    if (comboCount >= 10) {
      comboCounter.classList.add("streak-10");
    } else if (comboCount >= 5) {
      comboCounter.classList.add("streak-5");
    } else if (comboCount >= 3) {
      comboCounter.classList.add("streak-3");
    }

    // Add animation if requested
    if (animate && comboCount > 0) {
      comboCounter.classList.add("animate-up");
      // Remove animation class after it completes
      setTimeout(() => {
        comboCounter.classList.remove("animate-up");
      }, 600);
    }
  }

  showComboLoss(lostCombo) {
    const comboLostDisplay = document.getElementById("comboLostDisplay");
    const comboLostText = document.querySelector(".combo-lost-text");
    const comboLostParticles = document.querySelector(".combo-lost-particles");

    // Clear any existing animation classes
    comboLostText.classList.remove("animate");
    comboLostParticles.classList.remove("animate");

    // Show the local combo lost display
    comboLostDisplay.style.display = "flex";

    // Trigger animations
    setTimeout(() => {
      comboLostText.classList.add("animate");
      comboLostParticles.classList.add("animate");
    }, 50);

    // Trigger dramatic error effect for combo loss
    this.triggerDramaticError("combo");

    // Update persistent combo counter to show 0 (hides it)
    this.updatePersistentCombo(0);

    // Hide after animation completes
    setTimeout(() => {
      comboLostDisplay.style.display = "none";
      comboLostText.classList.remove("animate");
      comboLostParticles.classList.remove("animate");
    }, 1500);
  }

  triggerDramaticError(type) {
    const container = document.getElementById("gameContainer");
    const overlay = document.getElementById("errorOverlay");
    const timer = document.getElementById("timer");

    switch (type) {
      case "wrong_letter":
        // Clear only non-timer effects
        container.classList.remove("screen-shake");
        overlay.classList.remove("red-flash", "critical-flash");

        // Screen shake + red flash
        container.classList.add("screen-shake");
        overlay.style.display = "block";
        overlay.classList.add("red-flash");

        setTimeout(() => {
          overlay.style.display = "none";
          overlay.classList.remove("red-flash");
        }, 600);

        setTimeout(() => {
          container.classList.remove("screen-shake");
        }, 800);
        break;

      case "combo":
        // Clear only non-timer effects
        container.classList.remove("screen-shake");
        overlay.classList.remove("red-flash", "critical-flash");
        document
          .getElementById("currentWord")
          .classList.remove("error-pulse-border");

        // Just screen shake for combo loss - no red overlay
        container.classList.add("screen-shake");

        setTimeout(() => {
          container.classList.remove("screen-shake");
        }, 800);
        break;

      case "timer_critical":
        // Timer critical: glitch effects only, no red overlay
        container.classList.add("glitch-effect", "screen-corruption");
        timer.classList.add("timer-warning-strobe");
        break;
    }
  }

  clearTimerEffects() {
    const container = document.getElementById("gameContainer");
    const timer = document.getElementById("timer");

    // Clear timer-specific effects only
    container.classList.remove("glitch-effect", "screen-corruption");
    timer.classList.remove("timer-warning-strobe");
  }

  clearErrorEffects() {
    const container = document.getElementById("gameContainer");
    const overlay = document.getElementById("errorOverlay");
    const timer = document.getElementById("timer");
    const currentWord = document.getElementById("currentWord");

    // Remove all error classes
    container.classList.remove(
      "screen-shake",
      "glitch-effect",
      "screen-corruption"
    );
    overlay.classList.remove("red-flash", "critical-flash");
    timer.classList.remove("timer-warning-strobe", "warning");
    currentWord.classList.remove("error-pulse-border");
    overlay.style.display = "none";

    // Clear any residual animation styles that might interfere with transitions
    container.style.animation = "";
    container.style.transform = "";
    container.style.filter = "";
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
  // Initialize landing screen effects
  initializeLandingScreen();

  // Create game instance but don't start yet
  game = new WordConstellation();

  // Hide game container initially
  document.getElementById("gameContainer").style.display = "none";
});

// Landing Screen Functions
function initializeLandingScreen() {
  generateStarField();
  generateParticles();
}

function generateStarField() {
  const starField = document.getElementById("starField");
  const starCount = 150;

  for (let i = 0; i < starCount; i++) {
    const star = document.createElement("div");
    star.className = "star";

    // Random size class
    const sizes = ["small", "medium", "large"];
    const weights = [70, 25, 5]; // 70% small, 25% medium, 5% large
    const randomNum = Math.random() * 100;
    let sizeClass = "small";

    if (randomNum > weights[0]) {
      sizeClass = randomNum > weights[0] + weights[1] ? "large" : "medium";
    }

    star.classList.add(sizeClass);

    // Random position
    star.style.left = Math.random() * 100 + "%";
    star.style.top = Math.random() * 100 + "%";

    // Random animation delay
    star.style.animationDelay = Math.random() * 4 + "s";

    starField.appendChild(star);
  }
}

function generateParticles() {
  const particleSystem = document.getElementById("particleSystem");
  const particleCount = 30;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.className = "floating-particle";

    // Random horizontal position
    particle.style.left = Math.random() * 100 + "%";

    // Random animation delay
    particle.style.animationDelay = Math.random() * 8 + "s";

    particleSystem.appendChild(particle);
  }
}

function startFromLanding() {
  const landingScreen = document.getElementById("landingScreen");
  const gameContainer = document.getElementById("gameContainer");

  // Clear any error effects before transitioning
  if (game) {
    game.clearErrorEffects();
  }

  // Dramatic transition effect
  landingScreen.style.animation = "landingScreenExit 0.8s ease-in forwards";

  setTimeout(() => {
    landingScreen.style.display = "none";
    gameContainer.style.display = "block";

    // Use requestAnimationFrame to ensure display change is processed before animation
    requestAnimationFrame(() => {
      gameContainer.style.animation =
        "gameContainerEnter 0.6s ease-out forwards";

      // Remove the animation style after it completes
      setTimeout(() => {
        gameContainer.style.animation = "";
      }, 600); // Match the animation duration
    });

    // Generate game screen effects
    generateGameStarField();
    generateGameParticles();

    // Start the game
    game.startGame();
  }, 1000);
}

function generateGameStarField() {
  const gameStarField = document.getElementById("gameStarField");
  if (!gameStarField) return;

  // Clear existing stars
  gameStarField.innerHTML = "";

  const starCount = 80;

  for (let i = 0; i < starCount; i++) {
    const star = document.createElement("div");
    star.className = "star";

    // Random size class
    const sizes = ["small", "medium", "large"];
    const weights = [70, 25, 5]; // 70% small, 25% medium, 5% large
    const randomNum = Math.random() * 100;
    let sizeClass = "small";

    if (randomNum > weights[0]) {
      sizeClass = randomNum > weights[0] + weights[1] ? "large" : "medium";
    }

    star.classList.add(sizeClass);

    // Random position
    star.style.left = Math.random() * 100 + "%";
    star.style.top = Math.random() * 100 + "%";

    // Random animation delay
    star.style.animationDelay = Math.random() * 4 + "s";

    gameStarField.appendChild(star);
  }
}

function generateGameParticles() {
  const gameParticleSystem = document.getElementById("gameParticleSystem");
  if (!gameParticleSystem) return;

  // Clear existing particles
  gameParticleSystem.innerHTML = "";

  const particleCount = 15;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.className = "game-floating-particle";

    // Random horizontal position
    particle.style.left = Math.random() * 100 + "%";

    // Random animation delay
    particle.style.animationDelay = Math.random() * 12 + "s";

    gameParticleSystem.appendChild(particle);
  }
}

// Add exit animation to CSS dynamically
const exitAnimation = `
@keyframes landingScreenExit {
  from {
    opacity: 1;
    transform: translateY(0px);
  }
  to {
    opacity: 0;
    transform: translateY(-30px);
  }
}

@keyframes gameContainerEnter {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0px);
  }
}
`;

// Inject the animation CSS
const style = document.createElement("style");
style.textContent = exitAnimation;
document.head.appendChild(style);

// Expose startGame function globally for the play again button
function startGame() {
  game.startGame();
}

// Return to landing screen
function returnToLanding() {
  const gameContainer = document.getElementById("gameContainer");
  const landingScreen = document.getElementById("landingScreen");

  // Clear any error effects
  game.clearErrorEffects();

  // Animate game container exit
  gameContainer.style.animation = "gameContainerExit 0.6s ease-in forwards";

  setTimeout(() => {
    gameContainer.style.display = "none";
    landingScreen.style.display = "flex";
    landingScreen.style.animation =
      "landingScreenReturn 0.8s ease-out forwards";

    // Regenerate particles for fresh effect
    document.getElementById("particleSystem").innerHTML = "";
    generateParticles();
  }, 600);
}

// Add return animation CSS
const returnAnimation = `
@keyframes gameContainerExit {
  from {
    opacity: 1;
    transform: translateY(0px);
  }
  to {
    opacity: 0;
    transform: translateY(20px);
  }
}

@keyframes landingScreenReturn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0px);
  }
}
`;

// Inject return animation CSS
const returnStyle = document.createElement("style");
returnStyle.textContent = returnAnimation;
document.head.appendChild(returnStyle);

function generateGameOverStarField() {
  const gameOverStarField = document.getElementById("gameOverStarField");
  if (!gameOverStarField) return;

  // Clear existing stars
  gameOverStarField.innerHTML = "";

  const starCount = 100;

  for (let i = 0; i < starCount; i++) {
    const star = document.createElement("div");
    star.className = "star";

    // Random size class
    const sizes = ["small", "medium", "large"];
    const weights = [70, 25, 5]; // 70% small, 25% medium, 5% large
    const randomNum = Math.random() * 100;
    let sizeClass = "small";

    if (randomNum > weights[0]) {
      sizeClass = randomNum > weights[0] + weights[1] ? "large" : "medium";
    }

    star.classList.add(sizeClass);

    // Random position
    star.style.left = Math.random() * 100 + "%";
    star.style.top = Math.random() * 100 + "%";

    // Random animation delay
    star.style.animationDelay = Math.random() * 6 + "s";

    gameOverStarField.appendChild(star);
  }
}

function generateGameOverParticles() {
  const gameOverParticleSystem = document.getElementById(
    "gameOverParticleSystem"
  );
  if (!gameOverParticleSystem) return;

  // Clear existing particles
  gameOverParticleSystem.innerHTML = "";

  const particleCount = 20;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.className = "game-over-floating-particle";

    // Random horizontal position
    particle.style.left = Math.random() * 100 + "%";

    // Random animation delay
    particle.style.animationDelay = Math.random() * 15 + "s";

    gameOverParticleSystem.appendChild(particle);
  }
}
