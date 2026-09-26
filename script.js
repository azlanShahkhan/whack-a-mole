(function(){
  const board = document.getElementById('board');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('highScore');
  const timeLeftEl = document.getElementById('timeLeft');
  const startBtn = document.getElementById('startBtn');
  const musicBtn = document.getElementById('musicBtn');
  const difficultySel = document.getElementById('difficulty');
  const msg = document.getElementById('msg');

  const HOLE_COUNT = 9;
  const GAME_SECONDS = 50; // total round length
  let holes = [];
  let score = 0;
  let running = false;
  let currentHoleIndex = -1;
  let moleShowTimeout = null;
  let moleHideTimeout = null;
  let gameTimerInterval = null;
  let timeLeft = GAME_SECONDS;

  // High score persists locally between sessions
  let highScore = 0;
  try{
    highScore = parseInt(localStorage.getItem('whackAMoleHighScore'), 10) || 0;
  }catch(e){ highScore = 0; }
  highScoreEl.textContent = highScore;

  function updateHighScore(){
    if(score > highScore){
      highScore = score;
      highScoreEl.textContent = highScore;
      try{ localStorage.setItem('whackAMoleHighScore', String(highScore)); }catch(e){}
    }
  }

  // Build holes
  for(let i=0;i<HOLE_COUNT;i++){
    const hole = document.createElement('div');
    hole.className = 'hole';
    hole.dataset.index = i;

    const opening = document.createElement('div');
    opening.className = 'hole-opening';

    const mole = document.createElement('div');
    mole.className = 'mole';
    mole.innerHTML = `
      <div class="ear left"></div>
      <div class="ear right"></div>
      <div class="eye left"></div>
      <div class="eye right"></div>
      <div class="snout"></div>
      <div class="nose"></div>
      <div class="whiskers"></div>
    `;

    opening.appendChild(mole);
    hole.appendChild(opening);
    hole.addEventListener('click', () => whack(i));
    board.appendChild(hole);
    holes.push(hole);
  }

  function getMoleDuration(){
    return parseInt(difficultySel.value, 10) * 1000;
  }

  function randomHoleIndex(exclude){
    let idx;
    do{
      idx = Math.floor(Math.random() * HOLE_COUNT);
    } while(idx === exclude);
    return idx;
  }

  function showMole(){
    if(!running) return;
    currentHoleIndex = randomHoleIndex(currentHoleIndex);
    const hole = holes[currentHoleIndex];
    hole.classList.remove('whacked');
    hole.classList.add('up');

    const duration = getMoleDuration();
    moleHideTimeout = setTimeout(() => {
      hole.classList.remove('up');
      currentHoleIndex = -1;
      // brief gap before next mole appears
      moleShowTimeout = setTimeout(showMole, 300);
    }, duration);
  }

  function whack(index){
    if(!running) return;
    const hole = holes[index];
    if(!hole.classList.contains('up')) return;

    // scored
    clearTimeout(moleHideTimeout);
    hole.classList.remove('up');
    hole.classList.add('whacked');
    score++;
    scoreEl.textContent = score;
    updateHighScore();
    currentHoleIndex = -1;

    const pop = document.createElement('div');
    pop.className = 'score-pop';
    pop.textContent = '+1';
    hole.appendChild(pop);
    setTimeout(() => pop.remove(), 600);

    playHitSound();

    moleShowTimeout = setTimeout(showMole, 300);
  }

  function startGame(){
    if(running) return;
    running = true;
    score = 0;
    timeLeft = GAME_SECONDS;
    scoreEl.textContent = score;
    timeLeftEl.textContent = timeLeft;
    msg.textContent = 'Go! Whack the moles!';
    startBtn.textContent = 'Restart';
    difficultySel.disabled = false; // allow changing mid-game if desired

    holes.forEach(h => { h.classList.remove('up','whacked'); });

    ensureAudioContext();
    if(musicOn) startMusic();

    showMole();

    gameTimerInterval = setInterval(() => {
      timeLeft--;
      timeLeftEl.textContent = timeLeft;
      if(timeLeft <= 0){
        endGame();
      }
    }, 1000);
  }

  function endGame(){
    running = false;
    clearTimeout(moleShowTimeout);
    clearTimeout(moleHideTimeout);
    clearInterval(gameTimerInterval);
    holes.forEach(h => h.classList.remove('up'));
    updateHighScore();
    const newRecord = score > 0 && score === highScore ? ' New high score!' : '';
    msg.textContent = `Time's up! Final score: ${score}.${newRecord} Press Start to play again.`;
    startBtn.textContent = 'Start';
    stopMusic();
  }

  startBtn.addEventListener('click', () => {
    if(running){
      endGame();
      setTimeout(startGame, 50);
    } else {
      startGame();
    }
  });

  // ---------- Audio (Web Audio API, fully self-contained, no external files) ----------
  let audioCtx = null;
  let musicOn = false;
  let musicNodes = [];
  let musicScheduleTimer = null;

  function ensureAudioContext(){
    if(!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if(audioCtx.state === 'suspended'){
      audioCtx.resume();
    }
  }

  function playHitSound(){
    if(!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Simple looping background melody generated procedurally
  // A short, warm chord-backed riff instead of a plain scale run
  const bpm = 100;
  const beat = 60 / bpm;

  // melody notes (pentatonic-ish, happy) with their own rhythmic length in beats
  const melodySteps = [
    { note: 523.25, len: 0.5 },  // C5
    { note: 587.33, len: 0.25 }, // D5
    { note: 659.25, len: 0.25 }, // E5
    { note: 783.99, len: 0.5 },  // G5
    { note: 659.25, len: 0.5 },  // E5
    { note: 523.25, len: 0.5 },  // C5
    { note: 440.00, len: 0.5 },  // A4
    { note: 493.88, len: 0.5 },  // B4
  ];

  // bass notes, one per 2 beats, under the melody
  const bassSteps = [130.81, 174.61, 110.00, 146.83]; // C3 F3 A2 D3

  let musicGain = null;
  let filterNode = null;
  let delayNode = null;
  let delayFeedback = null;

  function setupMusicChain(){
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.16;

    filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 2600;

    delayNode = audioCtx.createDelay();
    delayNode.delayTime.value = 0.22;
    delayFeedback = audioCtx.createGain();
    delayFeedback.gain.value = 0.18;

    musicGain.connect(filterNode);
    filterNode.connect(audioCtx.destination);
    filterNode.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(audioCtx.destination);
  }

  function playMelodyNote(freq, startTime, duration){
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.22, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain).connect(musicGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  function playBassNote(freq, startTime, duration){
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.18, startTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain).connect(musicGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  let melodyIndex = 0;
  let bassIndex = 0;
  let bassBeatCounter = 0;

  function scheduleMusicStep(){
    if(!musicOn || !audioCtx) return;
    const step = melodySteps[melodyIndex % melodySteps.length];
    const noteDuration = step.len * beat;
    const now = audioCtx.currentTime;

    playMelodyNote(step.note, now, noteDuration * 0.95);

    // play a bass note every 2 beats
    if(bassBeatCounter <= 0){
      playBassNote(bassSteps[bassIndex % bassSteps.length], now, beat * 1.9);
      bassIndex++;
      bassBeatCounter = 2;
    }
    bassBeatCounter -= step.len;

    melodyIndex++;
    musicScheduleTimer = setTimeout(scheduleMusicStep, noteDuration * 1000);
  }

  function startMusic(){
    ensureAudioContext();
    if(!musicGain) setupMusicChain();
    musicOn = true;
    musicBtn.textContent = '🔊 Music';
    melodyIndex = 0;
    bassIndex = 0;
    bassBeatCounter = 0;
    scheduleMusicStep();
  }

  function stopMusicScheduling(){
    clearTimeout(musicScheduleTimer);
  }

  function stopMusic(){
    musicOn = false;
    stopMusicScheduling();
  }

  musicBtn.addEventListener('click', () => {
    ensureAudioContext();
    if(!musicGain) setupMusicChain();
    if(musicOn){
      stopMusic();
      musicBtn.textContent = '🔈 Music';
    } else {
      musicOn = true;
      musicBtn.textContent = '🔊 Music';
      melodyIndex = 0;
      bassIndex = 0;
      bassBeatCounter = 0;
      scheduleMusicStep();
    }
  });

})();