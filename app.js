(() => {
  const durations = { work: 30, break: 5 };
  let mode = 'work';
  let isRunning = false;
  let endTime = null;
  let remainingSeconds = durations.work * 60;
  let timerId = null;
  let completedWorkSessions = 0;
  let audioContext = null;
  let soundEnabled = true;
  let ringing = false;
  let transitionTimeout = null;
  let activeOscillators = [];

  const ui = {
    app: document.body,
    display: document.querySelector('#time-display'), mode: document.querySelector('#mode-label'), status: document.querySelector('#status'),
    progress: document.querySelector('#progress-fill'), action: document.querySelector('#start-pause'), actionLabel: document.querySelector('#start-label'),
    actionIcon: document.querySelector('#start-icon'), reset: document.querySelector('#reset'), workInput: document.querySelector('#work-duration'),
    breakInput: document.querySelector('#break-duration'), sound: document.querySelector('#sound-toggle'), soundLabel: document.querySelector('#sound-label'), cycle: document.querySelector('#cycle-count'), stopRinging: document.querySelector('#stop-ringing'),
    resetDialog: document.querySelector('#reset-dialog'), cancelReset: document.querySelector('#cancel-reset'), resetChoices: document.querySelectorAll('[data-reset-mode]')
  };

  function formattedTime(seconds) { const mins = Math.floor(seconds / 60); return `${String(mins).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`; }
  function durationForCurrentMode() { return durations[mode] * 60; }
  function syncUI() {
    ui.display.textContent = formattedTime(remainingSeconds);
    ui.display.setAttribute('aria-label', `${Math.floor(remainingSeconds / 60)} minutes ${remainingSeconds % 60} seconds remaining`);
    ui.mode.textContent = mode === 'work' ? 'Work' : 'Break';
    ui.app.classList.toggle('break-mode', mode === 'break');
    ui.progress.style.width = `${Math.max(0, Math.min(100, (1 - remainingSeconds / durationForCurrentMode()) * 100))}%`;
    ui.status.textContent = ringing ? 'Session complete · Ringing' : isRunning ? `${mode === 'work' ? 'Stay focused' : 'Take a breather'} · Running` : remainingSeconds === durationForCurrentMode() ? 'Ready when you are' : 'Paused';
    ui.actionLabel.textContent = isRunning ? 'Pause' : remainingSeconds === durationForCurrentMode() ? 'Start' : 'Resume';
    ui.actionIcon.textContent = isRunning ? 'Ⅱ' : '▶';
    ui.action.disabled = ringing;
    ui.reset.disabled = ringing;
    ui.stopRinging.hidden = !ringing;
    ui.cycle.textContent = `Session ${String(completedWorkSessions + 1).padStart(2, '0')}`;
  }
  function clearTimer() { if (timerId !== null) { clearInterval(timerId); timerId = null; } }
  function updateTimer() {
    remainingSeconds = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    if (remainingSeconds <= 0) { beginTransition(); return; }
    syncUI();
  }
  function startTimer() {
    if (isRunning) return;
    unlockAudio();
    isRunning = true;
    endTime = Date.now() + remainingSeconds * 1000;
    clearTimer();
    timerId = setInterval(updateTimer, 250);
    syncUI();
  }
  function pauseTimer() {
    if (!isRunning) return;
    updateTimer();
    isRunning = false;
    clearTimer();
    endTime = null;
    syncUI();
  }
  function openResetDialog() { ui.resetDialog.hidden = false; ui.resetChoices[0].focus(); }
  function closeResetDialog() { ui.resetDialog.hidden = true; ui.reset.focus(); }
  function resetTimer(nextMode) {
    cancelRinging();
    isRunning = false; clearTimer(); endTime = null;
    mode = nextMode;
    remainingSeconds = durationForCurrentMode();
    syncUI();
  }
  function beginTransition() {
    clearTimer();
    isRunning = false;
    ringing = true;
    playAlarm();
    transitionTimeout = setTimeout(completeTransition, 5000);
    syncUI();
  }
  function completeTransition() {
    cancelRinging();
    if (mode === 'work') completedWorkSessions += 1;
    mode = mode === 'work' ? 'break' : 'work';
    remainingSeconds = durationForCurrentMode();
    endTime = Date.now() + remainingSeconds * 1000;
    isRunning = true;
    timerId = setInterval(updateTimer, 250);
    syncUI();
  }
  function cancelRinging() {
    if (transitionTimeout !== null) { clearTimeout(transitionTimeout); transitionTimeout = null; }
    activeOscillators.forEach(oscillator => { try { oscillator.stop(); } catch {} });
    activeOscillators = [];
    ringing = false;
  }
  function setDuration(type, input) {
    const max = type === 'work' ? 120 : 60;
    const value = Math.max(1, Math.min(max, Number.parseInt(input.value, 10) || durations[type]));
    durations[type] = value; input.value = value;
    if (type === mode && !isRunning) { remainingSeconds = value * 60; syncUI(); }
  }
  function unlockAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
  }
  function playAlarm() {
    if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
    const now = audioContext.currentTime;
    for (let cycle = 0; cycle < 6; cycle += 1) [0, .19, .38].forEach((offset, index) => {
      const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain();
      const start = now + cycle * .82 + offset;
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(index === 2 ? 988 : 740, start);
      gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(.2, start + .015); gain.gain.exponentialRampToValueAtTime(.0001, start + .29);
      oscillator.connect(gain).connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + .31);
      activeOscillators.push(oscillator);
    });
  }
  ui.action.addEventListener('click', () => isRunning ? pauseTimer() : startTimer());
  ui.reset.addEventListener('click', openResetDialog);
  ui.stopRinging.addEventListener('click', completeTransition);
  ui.resetChoices.forEach(choice => choice.addEventListener('click', () => { resetTimer(choice.dataset.resetMode); closeResetDialog(); }));
  ui.cancelReset.addEventListener('click', closeResetDialog);
  ui.resetDialog.addEventListener('click', event => { if (event.target === ui.resetDialog) closeResetDialog(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !ui.resetDialog.hidden) closeResetDialog(); });
  ui.workInput.addEventListener('change', () => setDuration('work', ui.workInput));
  ui.breakInput.addEventListener('change', () => setDuration('break', ui.breakInput));
  ui.sound.addEventListener('change', () => { soundEnabled = ui.sound.checked; ui.soundLabel.textContent = soundEnabled ? 'On' : 'Off'; });
  document.addEventListener('visibilitychange', () => { if (isRunning && !document.hidden) updateTimer(); });
  syncUI();
})();