class WordConstellation {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.resizeCanvas();

    // Audio elements
    this.bgm = document.getElementById("bgm");
    this.bgm.volume = 0.3; // Set initial volume to 30%
    // Game sound volume (separate from BGM and typing sounds) - load from localStorage
    const savedGameSoundVolume =
      localStorage.getItem("gameSoundVolume") || "30";
    this.gameSoundVolume = parseInt(savedGameSoundVolume) / 100;

    this.warningSound = document.getElementById("warningSound");
    if (this.warningSound) {
      this.warningSound.volume = 0.5 * this.gameSoundVolume;
      this.warningSound.addEventListener("ended", () => {
        if (this.isPlaying && !this.bgm.muted && this.bgm.paused) {
          this.bgm.play().catch((e) => console.log("BGM resume failed", e));
        }
      });
    }
    this.startSound = document.getElementById("startSound");
    if (this.startSound) this.startSound.volume = 0.4 * this.gameSoundVolume;
    this.endingSound = document.getElementById("endingSound");
    if (this.endingSound) {
      this.endingSound.volume = 0.6 * this.gameSoundVolume;
      this.endingSound.addEventListener("ended", () => {
        // After the game-over sound, restart the BGM for the menu
        if (!this.bgm.muted) {
          this.bgm.currentTime = 0;
          this.bgm.play().catch((e) => console.log("BGM resume failed", e));
        }
      });
    }

    // Synesthetic Typing System
    this.setupSynestheticSystem();

    // Game state
    this.isPlaying = false;
    this.isPaused = false;
    this.gameTime = 60; // Default time
    this.timeLeft = this.gameTime;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.wordsCompleted = 0;
    this.wpm = 0;
    this.timerStarted = false;

    // High score system - now time-specific
    this.highScores = this.loadHighScores();
    this.sessionBestScore = 0;

    // Word management
    this.currentWord = null;
    this.typedText = "";
    this.wordQueue = [];
    this.wordsInRound = 0;
    this.lastActionWasError = false;

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
    this.endingSoundPlayed = false;

    this.setupEventListeners();
    this.showInstructions();
    this.updateHighScoreDisplay();
    this.setupTimeSelection();

    // Hide word container initially
    const wordContainer = document.getElementById("wordContainer");
    if (wordContainer) {
      wordContainer.style.display = "none";
    }

    // Mute based on saved preference, default to unmuted
    const persistedMute = localStorage.getItem("soundMuted") === "1";
    this.setMuted(persistedMute);

    // Settings menu functionality
    this.setupSettingsMenu();

    // Try to play BGM on first interaction
    const playBgmOnFirstInteraction = () => {
      if (this.bgm.paused && !this.bgm.muted) {
        this.bgm.play().catch((error) => {
          console.log("Initial audio playback failed:", error);
        });
      }
      // This listener should only ever run once.
      document.removeEventListener("click", playBgmOnFirstInteraction);
    };
    document.addEventListener("click", playBgmOnFirstInteraction);
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setupEventListeners() {
    window.addEventListener("resize", () => this.resizeCanvas());

    document.addEventListener("keydown", (e) => {
      // Check if we're on the landing screen
      const landingScreen = document.getElementById("landingScreen");
      const isOnLandingScreen =
        landingScreen && landingScreen.style.display !== "none";

      if (isOnLandingScreen) {
        if (e.code === "Enter") {
          e.preventDefault();
          startFromLanding(); // Use the existing landing transition function
        }
        return;
      }

      // Check if we're on the game over screen
      const gameOverScreen = document.getElementById("gameOver");
      const isOnGameOverScreen =
        gameOverScreen && !gameOverScreen.classList.contains("hidden");

      if (isOnGameOverScreen) {
        if (e.code === "Enter") {
          e.preventDefault();
          startGame(); // Use the existing play again function
        }
        return;
      }

      if (!this.isPlaying) {
        if (e.code === "Space") {
          e.preventDefault();
          this.startGame();
        }
        return;
      }

      if (e.code === "Escape") {
        // Play ending sound and do blackout sequence like when timer runs out
        if (this.endingSound && !this.bgm.muted) {
          this.bgm.pause();
          this.endingSound.currentTime = 0;
          this.endingSound
            .play()
            .catch((e) => console.log("Ending sound failed", e));
        }
        this.endGame();
        return;
      }

      this.handleKeyPress(e);
    });
  }

  setupTimeSelection() {
    const timeOptions = document.querySelectorAll(".time-option");

    // Load saved time preference from cookies
    const savedTime = this.loadTimePreference();

    timeOptions.forEach((option) => {
      option.addEventListener("click", () => {
        // Remove active class from all options
        timeOptions.forEach((opt) => opt.classList.remove("active"));
        // Add active class to clicked option
        option.classList.add("active");
        // Update game time
        this.gameTime = parseInt(option.dataset.time);
        this.timeLeft = this.gameTime;

        // Save time preference to cookies
        this.saveTimePreference(this.gameTime);

        // Update timer display if not playing
        if (!this.isPlaying) {
          document.getElementById(
            "timer"
          ).textContent = `Time: ${this.gameTime}s`;
        }
        // Update high score display for the selected time
        this.updateHighScoreDisplay();
      });
    });

    // Set the saved time as active (or default to 60s)
    const activeTime = savedTime || 60;
    this.gameTime = activeTime;
    this.timeLeft = this.gameTime;

    // Find and activate the correct option
    const activeOption = Array.from(timeOptions).find(
      (option) => parseInt(option.dataset.time) === activeTime
    );
    if (activeOption) {
      activeOption.classList.add("active");
    } else {
      // Fallback to 60s if saved time not found
      timeOptions[2].classList.add("active");
    }
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
    this.lastActionWasError = false;
    this.gameStartTime = Date.now();
    this.lastWordTime = Date.now();
    this.timerStarted = false;
    this.lastTime = performance.now();

    // Start background music
    this.bgm.play().catch((error) => {
      console.log("Audio playback failed:", error);
    });

    // Reset timer warning flags
    this.timerWarningTriggered = {
      warning: false,
      critical: false,
      extreme: false,
    };
    this.endingSoundPlayed = false;

    // Clear any error effects from previous game
    this.clearErrorEffects();
    this.clearTimerEffects();

    // Clear blackout overlay classes from previous game
    const blackoutOverlay = document.getElementById("blackoutOverlay");
    if (blackoutOverlay) {
      blackoutOverlay.classList.remove("fade-in", "fade-out");
    }

    // Show all game elements again
    document.getElementById("header").style.display = "block";
    document.getElementById("gameCanvas").style.display = "block";
    document.getElementById("currentWord").style.display = "block";
    document.getElementById("instructions").style.display = "block";
    document.getElementById("timerContainer").style.display = "block";
    document.getElementById("scoreContainer").style.display = "block";
    document.getElementById("highScoreContainer").style.display = "block";
    document.getElementById("timeSelection").style.display = "flex";
    document.getElementById("settingsMenu").style.display = "block";
    document.getElementById("escHint").style.display = "block";
    document.getElementById("timeSelection").classList.remove("disabled");
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

    // Stop background music
    this.bgm.pause();
    this.bgm.currentTime = 0;

    // Stop warning sound if playing
    if (this.warningSound) {
      this.warningSound.pause();
      this.warningSound.currentTime = 0;
    }

    // Clear any dramatic timer effects immediately
    this.clearTimerEffects();

    // Clear synesthetic effects
    this.clearSynestheticEffects();

    // Update high scores
    this.sessionBestScore = Math.max(this.sessionBestScore, this.score);

    let isNewHighScore = false;
    const currentTime = this.gameTime.toString();
    if (this.score > (this.highScores[currentTime] || 0)) {
      this.highScores[currentTime] = this.score;
      this.saveHighScores(this.highScores);
      isNewHighScore = true;
    }

    document.getElementById("finalScore").textContent = this.score;
    document.getElementById("wordsCompleted").textContent = this.wordsCompleted;
    document.getElementById("bestCombo").textContent = this.maxCombo;
    document.getElementById("gameOverHighScore").textContent =
      this.highScores[currentTime];

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

    // Trigger blackout sequence
    const blackoutOverlay = document.getElementById("blackoutOverlay");

    // First fade in to black
    blackoutOverlay.classList.add("fade-in");

    // After fade in, wait a moment, then show game over and fade out
    setTimeout(() => {
      // Hide ALL game elements and show full-screen game over
      document.getElementById("header").style.display = "none";
      document.getElementById("gameCanvas").style.display = "none";
      document.getElementById("currentWord").style.display = "none";
      document.getElementById("instructions").style.display = "none";
      document.getElementById("timerContainer").style.display = "none";
      document.getElementById("scoreContainer").style.display = "none";
      document.getElementById("highScoreContainer").style.display = "none";
      document.getElementById("timeSelection").style.display = "none";
      document.getElementById("settingsMenu").style.display = "none";
      document.getElementById("escHint").style.display = "none";
      document.getElementById("gameOver").style.display = "flex";
      document.getElementById("gameOver").classList.remove("hidden");

      // Fade out the black overlay
      blackoutOverlay.classList.remove("fade-in");
      blackoutOverlay.classList.add("fade-out");

      this.updateHighScoreDisplay();
    }, 1000); // Wait 1 second in black before showing game over
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
    // Ignore if modifier keys are pressed (Alt, Ctrl, Shift, etc.)
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }

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

    // Only process actual letter keys (a-z)
    if (key.match(/^[a-z]$/)) {
      if (!this.currentWord) return;

      // Start timer on first letter typed
      if (!this.timerStarted) {
        this.timerStarted = true;
        this.gameStartTime = Date.now(); // Reset start time to when typing actually begins
        this.lastTime = performance.now(); // Initialize lastTime for gameLoop

        // Disable time selection once game starts
        document.getElementById("timeSelection").classList.add("disabled");
      }

      // SYNESTHETIC EFFECTS - Play note and create visual trail for each letter
      this.playLetterNote(key, 0.2);

      // Get letter position for visual effects
      const wordDisplay = document.getElementById("wordDisplay");
      const wordContainer = document.getElementById("wordContainer");
      if (wordDisplay && wordContainer) {
        const rect = wordContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        this.createLetterTrail(key, centerX, centerY);
      }

      this.typedText += key;
      this.lastActionWasError = false; // Reset error flag on successful typing

      // Check if word is complete
      if (this.typedText === this.currentWord.text.toLowerCase()) {
        this.completeWord();
      } else if (
        !this.currentWord.text.toLowerCase().startsWith(this.typedText)
      ) {
        // Wrong letter - remove only the incorrect character and lose combo
        const lostCombo = this.combo;
        this.typedText = this.typedText.slice(0, -1); // Remove only the last (incorrect) character
        this.combo = 0;
        this.lastActionWasError = true; // Flag to prevent animation on previous letter

        // SYNESTHETIC ERROR - Play harsh error sound with red visuals
        this.playErrorSound();

        // SYNESTHETIC COMBO LOSS - Also play combo loss sound if combo was lost
        if (lostCombo > 0) {
          this.playComboLossSound();
        }

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

    // SYNESTHETIC CELEBRATION - Play word melody
    this.playWordMelody(word.text);

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

          // Add "just-typed" class only to the most recently typed letter
          // but not if the last action was an error correction
          if (i === typed.length - 1 && !this.lastActionWasError) {
            letterDiv.classList.add("just-typed");
          }

          // Add subtle synesthetic color tinting to text
          const letterColor = this.letterColors[word[i].toLowerCase()];
          if (letterColor) {
            // Subtle color tint by mixing the letter color with white
            const tintedColor = `hsl(${letterColor.h}, ${Math.min(
              letterColor.s,
              40
            )}%, ${Math.max(letterColor.l, 85)}%)`;
            letterDiv.style.color = tintedColor;
          }
        } else if (i === typed.length) {
          letterDiv.classList.add("current");

          // Add subtle color preview for current letter
          const letterColor = this.letterColors[word[i].toLowerCase()];
          if (letterColor) {
            // Very subtle color tint for the upcoming letter
            const previewColor = `hsl(${letterColor.h}, ${Math.min(
              letterColor.s,
              20
            )}%, ${Math.max(letterColor.l, 90)}%)`;
            letterDiv.style.color = previewColor;
          }
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
          // Play warning sound
          if (this.warningSound && !this.bgm.muted) {
            this.bgm.pause();
            this.warningSound.currentTime = 0;
            this.warningSound
              .play()
              .catch((e) => console.log("Warning sound failed", e));
          }
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

      // Play ending sound when 3 seconds left
      if (this.timeLeft <= 2.0 && !this.endingSoundPlayed) {
        this.endingSoundPlayed = true;
        if (this.endingSound && !this.bgm.muted) {
          this.bgm.pause();
          this.endingSound.currentTime = 0;
          this.endingSound
            .play()
            .catch((e) => console.log("Ending sound failed", e));
        }
      }

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

      // SYNESTHETIC COMBO LOSS - Play deflating sound with orange visuals
      this.playComboLossSound();

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

    // Update synesthetic visual effects
    this.updateSynestheticEffects(deltaTime);
  }

  updateSynestheticEffects(deltaTime) {
    const dt = deltaTime / 1000; // Convert to seconds

    // Update letter trails
    for (let i = this.letterTrails.length - 1; i >= 0; i--) {
      const trail = this.letterTrails[i];

      // Update position
      trail.x += trail.vx;
      trail.y += trail.vy;

      // Apply gravity and friction
      trail.vy += 0.2; // Gravity
      trail.vx *= 0.98; // Friction
      trail.vy *= 0.98;

      // Update life
      trail.life -= dt * 2; // Fade over 0.5 seconds

      // Remove dead trails
      if (trail.life <= 0) {
        this.letterTrails.splice(i, 1);
      }
    }

    // Update harmonic visuals
    for (let i = this.harmonicVisuals.length - 1; i >= 0; i--) {
      const visual = this.harmonicVisuals[i];

      // Update phase for wave animation
      visual.phase += dt * visual.frequency * 0.01; // Scale down frequency for visual

      // Update life
      visual.life -= dt * 0.5; // Fade over 2 seconds

      // Remove dead visuals
      if (visual.life <= 0) {
        this.harmonicVisuals.splice(i, 1);
      }
    }

    // Melody timeouts are cleaned up automatically
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

    // Render synesthetic effects
    this.renderSynestheticEffects();
  }

  renderSynestheticEffects() {
    // Render harmonic waveforms first (background)
    this.renderHarmonicVisuals();

    // Render letter trails
    this.renderLetterTrails();
  }

  renderHarmonicVisuals() {
    this.ctx.save();

    this.harmonicVisuals.forEach((visual) => {
      const alpha = visual.life / visual.maxLife;
      const color = visual.color;

      // Create waveform across screen
      this.ctx.globalAlpha = alpha * 0.3;
      this.ctx.strokeStyle = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();

      const waveLength = this.canvas.width;
      const amplitude = visual.amplitude * 30 * alpha;
      const centerY = this.canvas.height / 2;

      for (let x = 0; x < waveLength; x += 5) {
        const normalizedX = x / waveLength;
        const y =
          centerY +
          Math.sin(normalizedX * Math.PI * 4 + visual.phase) * amplitude;

        if (x === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }

      this.ctx.stroke();

      // Add secondary wave with different frequency
      this.ctx.globalAlpha = alpha * 0.2;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();

      for (let x = 0; x < waveLength; x += 3) {
        const normalizedX = x / waveLength;
        const y =
          centerY +
          Math.sin(normalizedX * Math.PI * 8 + visual.phase * 1.5) *
            amplitude *
            0.5;

        if (x === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }

      this.ctx.stroke();
    });

    this.ctx.restore();
  }

  renderLetterTrails() {
    this.ctx.save();

    this.letterTrails.forEach((trail) => {
      const alpha = trail.life / trail.maxLife;
      const color = trail.color;

      // Main particle
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
      this.ctx.beginPath();
      this.ctx.arc(trail.x, trail.y, trail.size * alpha, 0, Math.PI * 2);
      this.ctx.fill();

      // Glow effect
      this.ctx.globalAlpha = alpha * 0.3;
      this.ctx.fillStyle = `hsl(${color.h}, ${color.s}%, ${Math.min(
        color.l + 20,
        90
      )}%)`;
      this.ctx.beginPath();
      this.ctx.arc(trail.x, trail.y, trail.size * alpha * 2, 0, Math.PI * 2);
      this.ctx.fill();

      // Letter text (fading)
      if (alpha > 0.7) {
        this.ctx.globalAlpha = (alpha - 0.7) / 0.3;
        this.ctx.fillStyle = `hsl(${color.h}, ${color.s}%, 90%)`;
        this.ctx.font = `${trail.size * 2}px "Courier New", monospace`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(trail.letter.toUpperCase(), trail.x, trail.y);
      }
    });

    this.ctx.restore();
  }

  renderMelodyVisualization() {
    if (this.currentMelody.length === 0) return;

    this.ctx.save();

    const now = Date.now();
    const melodyX = 50;
    const melodyY = this.canvas.height - 100;

    // Draw melody background
    this.ctx.globalAlpha = 0.2;
    this.ctx.fillStyle = "rgba(64, 159, 255, 0.1)";
    this.ctx.fillRect(melodyX - 10, melodyY - 30, 400, 60);

    // Draw melody notes
    this.currentMelody.forEach((note, index) => {
      const age = (now - note.time) / 1000; // seconds
      const alpha = Math.max(0, 1 - age / 5); // Fade over 5 seconds

      if (alpha <= 0) return;

      const x = melodyX + index * 15;
      const y = melodyY;
      const color = note.color;

      // Note circle
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 8, 0, Math.PI * 2);
      this.ctx.fill();

      // Note letter
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = "white";
      this.ctx.font = '12px "Courier New", monospace';
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(note.letter.toUpperCase(), x, y);

      // Connection line to next note
      if (index < this.currentMelody.length - 1) {
        const nextNote = this.currentMelody[index + 1];
        const nextAge = (now - nextNote.time) / 1000;
        const nextAlpha = Math.max(0, 1 - nextAge / 5);

        if (nextAlpha > 0) {
          this.ctx.globalAlpha = Math.min(alpha, nextAlpha) * 0.5;
          this.ctx.strokeStyle = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(x + 8, y);
          this.ctx.lineTo(x + 15 - 8, y);
          this.ctx.stroke();
        }
      }
    });

    // Add "MELODY" label with frequency order info
    this.ctx.globalAlpha = 0.6;
    this.ctx.fillStyle = "rgba(64, 159, 255, 0.8)";
    this.ctx.font = '14px "Courier New", monospace';
    this.ctx.textAlign = "left";
    this.ctx.fillText("MELODY (Frequency Order):", melodyX, melodyY - 50);

    // Add frequency info for current notes
    this.ctx.globalAlpha = 0.4;
    this.ctx.font = '10px "Courier New", monospace';
    if (this.currentMelody.length > 0) {
      const latestNote = this.currentMelody[this.currentMelody.length - 1];
      if (latestNote.frequency) {
        this.ctx.fillText(
          `${latestNote.frequency.toFixed(0)}Hz`,
          melodyX,
          melodyY + 35
        );
      }
    }

    this.ctx.restore();
  }

  // High Score System - Updated for time-specific scores
  loadHighScores() {
    const saved = document.cookie
      .split("; ")
      .find((row) => row.startsWith("wordConstellationHighScores="));
    return saved
      ? JSON.parse(decodeURIComponent(saved.split("=")[1]))
      : {
          15: 0,
          30: 0,
          60: 0,
          120: 0,
        };
  }

  saveHighScores(scores) {
    // Save for 1 year
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `wordConstellationHighScores=${encodeURIComponent(
      JSON.stringify(scores)
    )}; expires=${expires.toUTCString()}; path=/`;
  }

  updateHighScoreDisplay() {
    const highScoreElement = document.getElementById("highScore");
    if (highScoreElement) {
      const currentTime = this.gameTime.toString();
      const highScore = this.highScores[currentTime] || 0;
      highScoreElement.textContent = `High Score: ${highScore}`;
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

        // Screen shake + red flash for combo loss
        container.classList.add("screen-shake");
        overlay.style.display = "block";
        overlay.classList.add("red-flash");

        setTimeout(() => {
          overlay.classList.remove("red-flash");
        }, 600);

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

  setMuted(muted) {
    this.bgm.muted = muted;

    // Update settings menu toggle
    const menuToggle = document.getElementById("soundToggleInMenu");
    if (menuToggle) {
      if (muted) {
        menuToggle.classList.add("off");
      } else {
        menuToggle.classList.remove("off");
      }
    }

    // Optionally, persist state
    localStorage.setItem("soundMuted", muted ? "1" : "0");
  }

  setupSettingsMenu() {
    const settingsMenu = document.getElementById("settingsMenu");
    const settingsHeader = document.querySelector(".settings-header");
    const soundToggleInMenu = document.getElementById("soundToggleInMenu");
    const bgmVolumeSlider = document.getElementById("bgmVolumeSlider");
    const bgmVolumeValue = document.getElementById("bgmVolumeValue");
    const typingVolumeSlider = document.getElementById("typingVolumeSlider");
    const typingVolumeValue = document.getElementById("typingVolumeValue");
    const gameSoundVolumeSlider = document.getElementById(
      "gameSoundVolumeSlider"
    );
    const gameSoundVolumeValue = document.getElementById(
      "gameSoundVolumeValue"
    );

    // Load saved volumes
    const savedBgmVolume = localStorage.getItem("bgmVolume") || "30";
    const savedTypingVolume = localStorage.getItem("typingVolume") || "30";
    const savedGameSoundVolume =
      localStorage.getItem("gameSoundVolume") || "30";

    // Set initial values
    bgmVolumeSlider.value = savedBgmVolume;
    bgmVolumeValue.textContent = savedBgmVolume + "%";
    this.bgm.volume = parseInt(savedBgmVolume) / 100;

    typingVolumeSlider.value = savedTypingVolume;
    typingVolumeValue.textContent = savedTypingVolume + "%";

    gameSoundVolumeSlider.value = savedGameSoundVolume;
    gameSoundVolumeValue.textContent = savedGameSoundVolume + "%";

    // Toggle settings menu
    settingsHeader.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent event bubbling
      settingsMenu.classList.toggle("expanded");
    });

    // Close settings menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!settingsMenu.contains(e.target)) {
        settingsMenu.classList.remove("expanded");
      }
    });

    // Sound toggle in menu
    soundToggleInMenu.addEventListener("click", () => {
      this.setMuted(!this.bgm.muted);
    });

    // BGM volume control
    bgmVolumeSlider.addEventListener("input", (e) => {
      const value = e.target.value;
      bgmVolumeValue.textContent = value + "%";
      this.bgm.volume = parseInt(value) / 100;
      localStorage.setItem("bgmVolume", value);
    });

    // Typing sound volume control
    typingVolumeSlider.addEventListener("input", (e) => {
      const value = e.target.value;
      typingVolumeValue.textContent = value + "%";
      if (this.masterGain) {
        this.masterGain.gain.value = parseInt(value) / 100;
      }
      localStorage.setItem("typingVolume", value);
    });

    // Game sound volume control
    gameSoundVolumeSlider.addEventListener("input", (e) => {
      const value = e.target.value;
      gameSoundVolumeValue.textContent = value + "%";
      this.gameSoundVolume = parseInt(value) / 100;

      // Update all game sounds immediately with their base volumes
      if (this.warningSound)
        this.warningSound.volume = 0.5 * this.gameSoundVolume;
      if (this.startSound) this.startSound.volume = 0.4 * this.gameSoundVolume;
      if (this.endingSound)
        this.endingSound.volume = 0.6 * this.gameSoundVolume;

      localStorage.setItem("gameSoundVolume", value);
    });

    // Initialize sound toggle state
    this.setMuted(this.bgm.muted);
  }

  // Time Preference System
  loadTimePreference() {
    const saved = document.cookie
      .split("; ")
      .find((row) => row.startsWith("wordConstellationTimePreference="));
    return saved ? parseInt(decodeURIComponent(saved.split("=")[1])) : null;
  }

  saveTimePreference(time) {
    // Save for 1 year
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `wordConstellationTimePreference=${time}; expires=${expires.toUTCString()}; path=/`;
  }

  // SYNESTHETIC TYPING SYSTEM
  setupSynestheticSystem() {
    // Create audio context for musical notes
    this.audioContext = null;
    this.masterGain = null;

    // Try to initialize audio context (user interaction required)
    this.initializeAudio();

    // Letter to frequency mapping (in Hz) - DEEP BASS THUD RANGE
    this.letterFrequencies = {
      a: 40.0, // Ultra-low bass thud
      b: 45.0, // Deep kick drum
      c: 50.0, // Low timpani
      d: 55.0, // Bass drum
      e: 60.0, // Deep thud
      f: 65.0, // Low boom
      g: 70.0, // Bass hit
      h: 75.0, // Deep punch
      i: 80.0, // Low thump
      j: 85.0, // Bass knock
      k: 90.0, // Deep pop
      l: 95.0, // Low smack
      m: 100.0, // Bass bump
      n: 110.0, // Deep hit
      o: 120.0, // Low strike
      p: 130.0, // Bass tap
      q: 140.0, // Deep click
      r: 150.0, // Low bang
      s: 160.0, // Bass snap
      t: 170.0, // Deep crack
      u: 180.0, // Low pop
      v: 190.0, // Bass tick
      w: 200.0, // Deep knock
      x: 220.0, // Low hit
      y: 240.0, // Bass thump
      z: 260.0, // Deep boom
    };

    // Letter to color mapping (HSL values)
    this.letterColors = {
      a: { h: 0, s: 70, l: 60 }, // Red
      b: { h: 15, s: 70, l: 60 }, // Red-Orange
      c: { h: 30, s: 70, l: 60 }, // Orange
      d: { h: 45, s: 70, l: 60 }, // Yellow-Orange
      e: { h: 60, s: 70, l: 60 }, // Yellow
      f: { h: 75, s: 70, l: 60 }, // Yellow-Green
      g: { h: 90, s: 70, l: 60 }, // Green-Yellow
      h: { h: 120, s: 70, l: 60 }, // Green
      i: { h: 150, s: 70, l: 60 }, // Green-Cyan
      j: { h: 180, s: 70, l: 60 }, // Cyan
      k: { h: 195, s: 70, l: 60 }, // Cyan-Blue
      l: { h: 210, s: 70, l: 60 }, // Light Blue
      m: { h: 225, s: 70, l: 60 }, // Blue-Cyan
      n: { h: 240, s: 70, l: 60 }, // Blue
      o: { h: 255, s: 70, l: 60 }, // Blue-Purple
      p: { h: 270, s: 70, l: 60 }, // Purple
      q: { h: 285, s: 70, l: 60 }, // Purple-Magenta
      r: { h: 300, s: 70, l: 60 }, // Magenta
      s: { h: 315, s: 70, l: 60 }, // Magenta-Red
      t: { h: 330, s: 70, l: 60 }, // Pink-Red
      u: { h: 345, s: 70, l: 60 }, // Pink
      v: { h: 20, s: 80, l: 70 }, // Bright Orange
      w: { h: 200, s: 80, l: 70 }, // Bright Blue
      x: { h: 280, s: 80, l: 70 }, // Bright Purple
      y: { h: 50, s: 90, l: 75 }, // Bright Yellow
      z: { h: 320, s: 90, l: 75 }, // Bright Magenta
    };

    // Visual trail system
    this.letterTrails = [];
    this.harmonicVisuals = [];

    // Word melody system
    this.melodyTimeouts = [];
  }

  initializeAudio() {
    // Audio context requires user interaction
    const initAudio = () => {
      if (!this.audioContext) {
        try {
          this.audioContext = new (window.AudioContext ||
            window.webkitAudioContext)();
          this.masterGain = this.audioContext.createGain();
          this.masterGain.connect(this.audioContext.destination);

          // Set initial volume from localStorage
          const savedTypingVolume =
            localStorage.getItem("typingVolume") || "30";
          this.masterGain.gain.value = parseInt(savedTypingVolume) / 100;
          console.log("Synesthetic audio initialized");
        } catch (error) {
          console.log("Audio context initialization failed:", error);
        }
      }
      document.removeEventListener("click", initAudio);
      document.removeEventListener("keydown", initAudio);
    };

    document.addEventListener("click", initAudio);
    document.addEventListener("keydown", initAudio);
  }

  playErrorSound() {
    if (!this.audioContext || this.bgm.muted) {
      return;
    }

    try {
      // Create harsh, dissonant error sound
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      // Connect audio nodes
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);

      // ERROR SOUND DESIGN - Harsh, low frequency burst
      oscillator.frequency.setValueAtTime(
        80, // Low, menacing frequency
        this.audioContext.currentTime
      );
      oscillator.type = "sawtooth"; // Harsh sawtooth wave

      // Add frequency modulation for harshness
      const modOsc = this.audioContext.createOscillator();
      const modGain = this.audioContext.createGain();
      modOsc.frequency.value = 8; // 8Hz modulation
      modGain.gain.value = 30; // Modulation depth
      modOsc.connect(modGain);
      modGain.connect(oscillator.frequency);

      // Distortion filter
      const distortionFilter = this.audioContext.createBiquadFilter();
      distortionFilter.type = "lowpass";
      distortionFilter.frequency.value = 150; // Cut high frequencies for bass thud
      distortionFilter.Q.value = 5; // High resonance for harshness

      // Connect through filter
      oscillator.connect(distortionFilter);
      distortionFilter.connect(gainNode);

      // ERROR ENVELOPE - Sharp attack, quick decay
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        0.6 * this.gameSoundVolume,
        this.audioContext.currentTime + 0.01
      ); // Sharp attack with game sound volume
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + 0.3
      ); // Quick decay

      // Start modulation and main oscillator
      modOsc.start(this.audioContext.currentTime);
      modOsc.stop(this.audioContext.currentTime + 0.3);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.3);

      // Create red visual effect for error
      this.createErrorVisual();
    } catch (error) {
      console.log("Error playing error sound:", error);
    }
  }

  playComboLossSound() {
    if (!this.audioContext || this.bgm.muted) {
      return;
    }

    try {
      // Create deflating, descending combo loss sound
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      // Connect audio nodes
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);

      // COMBO LOSS SOUND DESIGN - Descending "deflation" sound
      oscillator.frequency.setValueAtTime(
        200, // Start higher than error sound
        this.audioContext.currentTime
      );
      // Descend to low frequency over time
      oscillator.frequency.exponentialRampToValueAtTime(
        50,
        this.audioContext.currentTime + 0.8
      );
      oscillator.type = "triangle"; // Softer than sawtooth but still noticeable

      // Add gentle vibrato for "deflating" feel
      const vibratoOsc = this.audioContext.createOscillator();
      const vibratoGain = this.audioContext.createGain();
      vibratoOsc.frequency.value = 4; // Slow vibrato
      vibratoGain.gain.value = 8; // Gentle modulation
      vibratoOsc.connect(vibratoGain);
      vibratoGain.connect(oscillator.frequency);

      // Gentle lowpass filter
      const filter = this.audioContext.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 400;
      filter.Q.value = 1;

      // Connect through filter
      oscillator.connect(filter);
      filter.connect(gainNode);

      // COMBO LOSS ENVELOPE - Gradual fade out like air escaping
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        0.4 * this.gameSoundVolume,
        this.audioContext.currentTime + 0.05
      ); // Gentle attack with game sound volume
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + 0.8
      ); // Long deflating decay

      // Start vibrato and main oscillator
      vibratoOsc.start(this.audioContext.currentTime);
      vibratoOsc.stop(this.audioContext.currentTime + 0.8);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.8);

      // Create orange/yellow visual effect for combo loss (warning color)
      this.createComboLossVisual();
    } catch (error) {
      console.log("Error playing combo loss sound:", error);
    }
  }

  playLetterNote(letter, duration = 0.3) {
    if (
      !this.audioContext ||
      !this.letterFrequencies[letter] ||
      this.bgm.muted
    ) {
      return;
    }

    try {
      // Create oscillator for the note
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      // Connect audio nodes
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);

      // BASS THUD SOUND DESIGN
      const baseFreq = this.letterFrequencies[letter];

      // Main bass oscillator (sine wave for pure low end)
      oscillator.frequency.setValueAtTime(
        baseFreq,
        this.audioContext.currentTime
      );
      oscillator.type = "sine";

      // Create a second oscillator for the "click" attack
      const clickOsc = this.audioContext.createOscillator();
      const clickGain = this.audioContext.createGain();
      clickOsc.frequency.setValueAtTime(
        baseFreq * 8,
        this.audioContext.currentTime
      ); // High frequency click
      clickOsc.type = "square";
      clickOsc.connect(clickGain);
      clickGain.connect(this.masterGain);

      // Bass filter - emphasize low end
      const bassFilter = this.audioContext.createBiquadFilter();
      bassFilter.type = "lowpass";
      bassFilter.frequency.value = 200; // Cut everything above 200Hz
      bassFilter.Q.value = 2; // Emphasize the cutoff

      // High-pass filter to remove sub-sonic rumble
      const hpFilter = this.audioContext.createBiquadFilter();
      hpFilter.type = "highpass";
      hpFilter.frequency.value = 30; // Remove anything below 30Hz
      hpFilter.Q.value = 1;

      // Connect audio chain: oscillator → highpass → lowpass → gain → output
      oscillator.connect(hpFilter);
      hpFilter.connect(bassFilter);
      bassFilter.connect(gainNode);

      // BASS THUD ENVELOPE - Sharp attack, quick decay
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);

      // Instant attack for thud impact
      gainNode.gain.linearRampToValueAtTime(
        0.8,
        this.audioContext.currentTime + 0.005
      );

      // Quick drop to sustain level
      gainNode.gain.exponentialRampToValueAtTime(
        0.3,
        this.audioContext.currentTime + 0.03
      );

      // Slow decay to silence
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + duration
      );

      // CLICK ATTACK ENVELOPE - Very brief high frequency snap
      clickGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      clickGain.gain.linearRampToValueAtTime(
        0.3,
        this.audioContext.currentTime + 0.001
      );
      clickGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + 0.02
      );

      // Start both oscillators
      clickOsc.start(this.audioContext.currentTime);
      clickOsc.stop(this.audioContext.currentTime + 0.02); // Click only lasts 20ms

      // Start and stop the note
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.log("Error playing letter note:", error);
    }
  }

  createLetterTrail(letter, x, y) {
    const color = this.letterColors[letter];
    if (!color) return;

    // Create multiple trail particles
    for (let i = 0; i < 8; i++) {
      this.letterTrails.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1.0,
        maxLife: 1.0,
        color: color,
        size: Math.random() * 8 + 4,
        letter: letter,
        createdAt: Date.now(),
      });
    }
  }

  createWaveformVisual(letter, intensity = 1.0) {
    const color = this.letterColors[letter];
    const frequency = this.letterFrequencies[letter];
    if (!color || !frequency) return;

    // Create a visual waveform that ripples across the screen
    this.harmonicVisuals.push({
      letter: letter,
      color: color,
      frequency: frequency,
      amplitude: intensity,
      phase: 0,
      life: 1.0,
      maxLife: 2.0,
      createdAt: Date.now(),
    });
  }

  createErrorVisual() {
    // Create aggressive red visual effects for errors
    const redColor = { h: 0, s: 100, l: 50 }; // Pure red

    // Create error harmonic visual
    this.harmonicVisuals.push({
      letter: "ERROR",
      color: redColor,
      frequency: 80, // Low frequency matching the error sound
      amplitude: 2.0, // Extra intensity
      phase: 0,
      life: 1.0,
      maxLife: 1.5,
      createdAt: Date.now(),
    });

    // Create multiple red particles for dramatic effect
    const canvas = document.getElementById("gameCanvas");
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < 15; i++) {
      this.letterTrails.push({
        x: centerX + (Math.random() - 0.5) * 200,
        y: centerY + (Math.random() - 0.5) * 200,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        maxLife: 1.0,
        color: redColor,
        size: Math.random() * 12 + 8,
        letter: "ERROR",
        createdAt: Date.now(),
      });
    }
  }

  createComboLossVisual() {
    // Create orange/yellow warning visual effects for combo loss
    const warningColor = { h: 30, s: 100, l: 60 }; // Orange-yellow warning color

    // Create combo loss harmonic visual - descending frequency
    this.harmonicVisuals.push({
      letter: "COMBO_LOST",
      color: warningColor,
      frequency: 200, // Start high, will visually "deflate"
      amplitude: 1.5,
      phase: 0,
      life: 1.0,
      maxLife: 2.0, // Longer than error for deflating effect
      createdAt: Date.now(),
    });

    // Create deflating particle effect - particles fall down like air escaping
    const canvas = document.getElementById("gameCanvas");
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < 20; i++) {
      this.letterTrails.push({
        x: centerX + (Math.random() - 0.5) * 150,
        y: centerY + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 3, // Slower horizontal movement
        vy: Math.random() * 2 + 1, // Downward drift (deflating)
        life: 1.0,
        maxLife: 1.5, // Longer life for deflating effect
        color: warningColor,
        size: Math.random() * 10 + 6,
        letter: "COMBO",
        createdAt: Date.now(),
      });
    }
  }

  playWordMelody(word) {
    if (!this.audioContext || this.bgm.muted) return;

    // Clear existing melody timeouts
    this.melodyTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.melodyTimeouts = [];

    // Get letters with their frequencies and sort by frequency (low to high)
    const lettersWithFreq = word
      .toLowerCase()
      .split("")
      .map((letter, originalIndex) => ({
        letter: letter,
        frequency: this.letterFrequencies[letter] || 0,
        originalIndex: originalIndex,
        color: this.letterColors[letter],
      }))
      .sort((a, b) => a.frequency - b.frequency); // Sort by frequency (ascending)

    // Play each letter in frequency order with slight delay
    lettersWithFreq.forEach((letterData, sortedIndex) => {
      const timeout = setTimeout(() => {
        this.playLetterNote(letterData.letter, 0.4);

        // Create harmonic visual effect
        this.createWaveformVisual(letterData.letter, 0.8);
      }, sortedIndex * 100); // 100ms between notes in frequency order

      this.melodyTimeouts.push(timeout);
    });
  }

  clearSynestheticEffects() {
    // Clear all visual effects
    this.letterTrails = [];
    this.harmonicVisuals = [];
    this.currentMelody = [];

    // Clear any pending melody timeouts
    this.melodyTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.melodyTimeouts = [];

    // Stop any ongoing audio oscillators (they auto-cleanup, but good practice)
    if (this.audioContext && this.audioContext.state !== "closed") {
      // Audio context cleanup is automatic for short-lived oscillators
    }
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

// Initialize and start background music
const bgm = document.getElementById("bgm");
bgm.volume = 0.3; // Set initial volume to 30%

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
  // Play start sound immediately on click
  if (game && game.startSound && !game.bgm.muted) {
    game.startSound.currentTime = 0;
    game.startSound.play().catch((e) => console.log("Start sound failed", e));
  }

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
  // Play start sound immediately on click
  if (game && game.startSound && !game.bgm.muted) {
    game.startSound.currentTime = 0;
    game.startSound.play().catch((e) => console.log("Start sound failed", e));
  }
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
