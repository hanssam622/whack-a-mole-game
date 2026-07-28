// Main Game Logic Engine
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const gameBoard = document.getElementById('game-board');
  const scoreEl = document.getElementById('score');
  const timerEl = document.getElementById('timer');
  const comboEl = document.getElementById('combo');
  const highScoreEl = document.getElementById('high-score');
  const difficultySelect = document.getElementById('difficulty');
  const btnStart = document.getElementById('btn-start');
  const btnAudio = document.getElementById('btn-audio');
  const btnInfo = document.getElementById('btn-info');
  const comboBanner = document.getElementById('combo-banner');
  const comboText = document.getElementById('combo-text');
  
  // Modals
  const modalGameOver = document.getElementById('modal-gameover');
  const modalInfo = document.getElementById('modal-info');
  const btnRestart = document.getElementById('btn-restart');
  const btnCloseInfo = document.getElementById('btn-close-info');
  
  // Summary Stats
  const finalScoreEl = document.getElementById('final-score');
  const newRecordBadge = document.getElementById('new-record-badge');
  const summaryAccuracy = document.getElementById('summary-accuracy');
  const summaryCombo = document.getElementById('summary-combo');
  const summaryMoles = document.getElementById('summary-moles');

  // Canvas for FX
  const fxCanvas = document.getElementById('fx-canvas');
  const ctx = fxCanvas.getContext('2d');

  // Game Settings per Difficulty
  const DIFFICULTY_SETTINGS = {
    easy: { grid: 9, minTime: 900, maxTime: 1600, duration: 30, bombChance: 0.1, goldChance: 0.15, helmetChance: 0.1 },
    medium: { grid: 9, minTime: 600, maxTime: 1100, duration: 30, bombChance: 0.2, goldChance: 0.15, helmetChance: 0.15 },
    hard: { grid: 16, minTime: 400, maxTime: 800, duration: 30, bombChance: 0.25, goldChance: 0.2, helmetChance: 0.2 },
    frenzy: { grid: 16, minTime: 300, maxTime: 650, duration: 45, bombChance: 0.3, goldChance: 0.25, helmetChance: 0.25 }
  };

  // State Variables
  let score = 0;
  let timeLeft = 30;
  let combo = 0;
  let maxCombo = 0;
  let totalWhacks = 0;
  let successfulHits = 0;
  let molesWhackedCount = 0;
  let highScore = parseInt(localStorage.getItem('whack_mole_highscore') || '0', 10);
  
  let gameInterval = null;
  let timerInterval = null;
  let lastHoleIndex = -1;
  let isPlaying = false;
  let particles = [];

  // Initialize Canvas Size
  function resizeCanvas() {
    fxCanvas.width = window.innerWidth;
    fxCanvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // High Score Display Init
  highScoreEl.textContent = highScore;

  // Render Holes according to difficulty
  function setupBoard(gridSize) {
    gameBoard.innerHTML = '';
    if (gridSize === 16) {
      gameBoard.className = 'game-board grid-4x4';
    } else {
      gameBoard.className = 'game-board grid-3x3';
    }

    for (let i = 0; i < gridSize; i++) {
      const hole = document.createElement('div');
      hole.className = 'hole';
      hole.dataset.index = i;

      const mole = document.createElement('div');
      mole.className = 'mole mole-normal';
      mole.innerHTML = '🐹';
      mole.dataset.hp = 1;
      mole.dataset.type = 'normal';

      hole.appendChild(mole);
      gameBoard.appendChild(hole);

      // Event Listeners for Mole Hit
      mole.addEventListener('mousedown', (e) => whackMole(e, mole));
      mole.addEventListener('touchstart', (e) => {
        e.preventDefault();
        whackMole(e.touches[0], mole);
      });
    }
  }

  // Pick Random Hole
  function getRandomHole(holes) {
    const idx = Math.floor(Math.random() * holes.length);
    if (idx === lastHoleIndex) {
      return getRandomHole(holes);
    }
    lastHoleIndex = idx;
    return holes[idx];
  }

  // Pick Random Mole Type based on difficulty weights
  function getRandomMoleType(settings) {
    const rand = Math.random();
    if (rand < settings.bombChance) {
      return { type: 'bomb', emoji: '💣', hp: 1, class: 'mole-bomb' };
    }
    if (rand < settings.bombChance + settings.goldChance) {
      return { type: 'golden', emoji: '🌟', hp: 1, class: 'mole-golden' };
    }
    if (rand < settings.bombChance + settings.goldChance + settings.helmetChance) {
      return { type: 'helmet', emoji: '🪖', hp: 2, class: 'mole-helmet' };
    }
    return { type: 'normal', emoji: '🐹', hp: 1, class: 'mole-normal' };
  }

  // Popup Mole Loop
  function popMole() {
    if (!isPlaying) return;

    const holes = document.querySelectorAll('.hole');
    const settings = DIFFICULTY_SETTINGS[difficultySelect.value];
    const hole = getRandomHole(holes);
    const mole = hole.querySelector('.mole');
    const moleData = getRandomMoleType(settings);

    // Reset Mole State
    mole.className = `mole ${moleData.class}`;
    mole.innerHTML = moleData.emoji;
    mole.dataset.type = moleData.type;
    mole.dataset.hp = moleData.hp;

    // Animate Up
    mole.classList.add('up');

    const popupTime = Math.random() * (settings.maxTime - settings.minTime) + settings.minTime;
    
    setTimeout(() => {
      if (mole.classList.contains('up')) {
        mole.classList.remove('up');
        // Missed hit breaks combo (unless it was a bomb)
        if (moleData.type !== 'bomb' && !mole.classList.contains('whacked')) {
          resetCombo();
        }
      }
      if (isPlaying) popMole();
    }, popupTime);
  }

  // Whack Handler
  function whackMole(e, mole) {
    if (!isPlaying || !mole.classList.contains('up') || mole.classList.contains('whacked')) {
      return;
    }

    totalWhacks++;
    const type = mole.dataset.type;
    let hp = parseInt(mole.dataset.hp, 10);
    hp--;

    mole.dataset.hp = hp;

    const clickX = e.clientX || e.pageX;
    const clickY = e.clientY || e.pageY;

    if (hp > 0) {
      // Partially damaged helmet mole
      audioFX.playHit();
      mole.innerHTML = '🩹'; // Damaged emoji
      createParticles(clickX, clickY, '#94a3b8', 6);
      return;
    }

    // Fully whacked
    mole.classList.remove('up');
    mole.classList.add('whacked');
    successfulHits++;

    let pts = 0;
    let pointClass = 'plus';
    let label = '';

    if (type === 'normal') {
      pts = 10;
      audioFX.playHit();
      molesWhackedCount++;
      createParticles(clickX, clickY, '#a16207', 10);
      increaseCombo();
    } else if (type === 'golden') {
      pts = 30;
      timeLeft += 2;
      timerEl.textContent = `${timeLeft}s`;
      audioFX.playGolden();
      molesWhackedCount++;
      pointClass = 'golden';
      label = '+30 (+2s)';
      createParticles(clickX, clickY, '#facc15', 18);
      increaseCombo();
    } else if (type === 'helmet') {
      pts = 25;
      audioFX.playHit();
      molesWhackedCount++;
      label = '+25';
      createParticles(clickX, clickY, '#cbd5e1', 12);
      increaseCombo();
    } else if (type === 'bomb') {
      pts = -20;
      timeLeft = Math.max(0, timeLeft - 3);
      timerEl.textContent = `${timeLeft}s`;
      audioFX.playBomb();
      pointClass = 'minus';
      label = '-20 (-3s)';
      triggerScreenShake();
      resetCombo();
      createParticles(clickX, clickY, '#ef4444', 20);
    }

    // Combo multiplier applied to positive scores
    if (pts > 0) {
      const multiplier = getComboMultiplier();
      pts *= multiplier;
      score += pts;
      if (!label) label = `+${pts}`;
    } else {
      score = Math.max(0, score + pts);
    }

    scoreEl.textContent = score;
    showFloatingText(clickX, clickY, label, pointClass);
  }

  // Combo logic
  function increaseCombo() {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    comboEl.textContent = `x${getComboMultiplier()}`;

    if (combo >= 3) {
      audioFX.playCombo();
      showComboBanner(`COMBO x${getComboMultiplier()}! 🔥`);
    }
  }

  function resetCombo() {
    combo = 0;
    comboEl.textContent = 'x1';
    comboBanner.classList.add('hidden');
  }

  function getComboMultiplier() {
    if (combo >= 10) return 5;
    if (combo >= 6) return 3;
    if (combo >= 3) return 2;
    return 1;
  }

  function showComboBanner(text) {
    comboText.textContent = text;
    comboBanner.classList.remove('hidden');
  }

  // Screen Shake Effect
  function triggerScreenShake() {
    gameBoard.classList.add('shake');
    setTimeout(() => gameBoard.classList.remove('shake'), 350);
  }

  // Floating text feedback
  function showFloatingText(x, y, text, typeClass) {
    const el = document.createElement('div');
    el.className = `floating-text ${typeClass}`;
    el.textContent = text;
    el.style.left = `${x - 20}px`;
    el.style.top = `${y - 30}px`;
    document.body.appendChild(el);

    setTimeout(() => el.remove(), 800);
  }

  // Particle Canvas Engine
  function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2,
        size: Math.random() * 6 + 3,
        color: color,
        alpha: 1,
        life: 1
      });
    }
  }

  function animateParticles() {
    ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2; // gravity
      p.life -= 0.03;
      p.alpha = Math.max(0, p.life);

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
    requestAnimationFrame(animateParticles);
  }
  requestAnimationFrame(animateParticles);

  // Start Game
  function startGame() {
    audioFX.playClick();
    const settings = DIFFICULTY_SETTINGS[difficultySelect.value];
    
    // Reset Game State
    score = 0;
    combo = 0;
    maxCombo = 0;
    totalWhacks = 0;
    successfulHits = 0;
    molesWhackedCount = 0;
    timeLeft = settings.duration;
    isPlaying = true;

    scoreEl.textContent = '0';
    timerEl.textContent = `${timeLeft}s`;
    comboEl.textContent = 'x1';
    comboBanner.classList.add('hidden');
    modalGameOver.classList.add('hidden');
    btnStart.disabled = true;

    setupBoard(settings.grid);

    // Timer Loop
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timeLeft--;
      timerEl.textContent = `${timeLeft}s`;
      if (timeLeft <= 0) {
        endGame();
      }
    }, 1000);

    popMole();
  }

  // End Game
  function endGame() {
    isPlaying = false;
    clearInterval(timerInterval);
    btnStart.disabled = false;
    audioFX.playGameOver();

    // Accuracy computation
    const accuracy = totalWhacks > 0 ? Math.round((successfulHits / totalWhacks) * 100) : 0;

    // Check High Score
    let isNewRecord = false;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('whack_mole_highscore', highScore.toString());
      highScoreEl.textContent = highScore;
      isNewRecord = true;
    }

    // Modal populate
    finalScoreEl.textContent = score;
    summaryAccuracy.textContent = `${accuracy}%`;
    summaryCombo.textContent = `${maxCombo}x`;
    summaryMoles.textContent = `${molesWhackedCount}마리`;

    if (isNewRecord) {
      newRecordBadge.classList.remove('hidden');
    } else {
      newRecordBadge.classList.add('hidden');
    }

    modalGameOver.classList.remove('hidden');
  }

  // Event Listeners
  btnStart.addEventListener('click', startGame);
  btnRestart.addEventListener('click', startGame);

  difficultySelect.addEventListener('change', () => {
    const settings = DIFFICULTY_SETTINGS[difficultySelect.value];
    setupBoard(settings.grid);
  });

  btnAudio.addEventListener('click', () => {
    const isMuted = audioFX.toggleMute();
    btnAudio.textContent = isMuted ? '🔇' : '🔊';
  });

  btnInfo.addEventListener('click', () => {
    audioFX.playClick();
    modalInfo.classList.remove('hidden');
  });

  btnCloseInfo.addEventListener('click', () => {
    audioFX.playClick();
    modalInfo.classList.add('hidden');
  });

  // Initial Board Setup
  setupBoard(DIFFICULTY_SETTINGS.medium.grid);
});
