/* 20-20-20 Eye Break Timer
   Work phase: 20:00 (1200s) -> alarm -> Break phase: 0:20 (20s) -> chime -> repeat
*/

// Defaults follow the 20-20-20 rule; both can be changed under "Timing"
// and are remembered in localStorage.
const DEFAULT_WORK_MIN = 20;
const DEFAULT_BREAK_SEC = 20;
const LIMITS = { workMin: [1, 90], breakSec: [10, 300], standEvery: [0, 12], standMin: [1, 10] };
// Every few cycles the break becomes a longer "stand up and stretch" one:
// eyes aren't the only thing that suffers from hours at a desk.
const DEFAULT_STAND_EVERY = 3;  // cycles (0 = off) — every hour at 20-minute cycles
const DEFAULT_STAND_MIN = 2;
let STAND_EVERY = DEFAULT_STAND_EVERY;
let STAND_SECONDS = DEFAULT_STAND_MIN * 60;
let currentBreakSeconds = DEFAULT_BREAK_SEC; // length of the break in progress
let standBreak = false;

const STAND_TIPS = [
  'Stand up, roll your shoulders back 10 times, then reach both arms overhead and hold for 10 seconds.',
  'Walk to get a glass of water. Drink it standing up and look out of a window while you do.',
  'Stand and do 10 slow calf raises, then gently tilt your head ear-to-shoulder on each side.',
  'Clasp your hands behind your back, open your chest and breathe deeply 5 times. Then shake out your wrists.',
  'Walk around for a minute. On the way back, stretch your hip flexors: one foot forward, sink gently, swap.',
];

let WORK_SECONDS = DEFAULT_WORK_MIN * 60;
let BREAK_SECONDS = DEFAULT_BREAK_SEC;

const els = {
  ring: document.getElementById('ringProgress'),
  phaseLabel: document.getElementById('phaseLabel'),
  time: document.getElementById('timeDisplay'),
  cycleCount: document.getElementById('cycleCount'),
  hint: document.getElementById('hint'),
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  stopDayBtn: document.getElementById('stopDayBtn'),
  toast: document.getElementById('toast'),
  workInput: document.getElementById('workMinutes'),
  breakInput: document.getElementById('breakSeconds'),
  resetTiming: document.getElementById('resetTiming'),
  weekBars: document.getElementById('weekBars'),
  breakTip: document.getElementById('breakTip'),
  soundToggle: document.getElementById('soundToggle'),
  streak: document.getElementById('streak'),
  snoozeBtn: document.getElementById('snoozeBtn'),
  exercise: document.getElementById('exercise'),
  exerciseLabel: document.getElementById('exerciseLabel'),
  exerciseToggle: document.getElementById('exerciseToggle'),
  exercisePreview: document.getElementById('exercisePreview'),
  standEveryInput: document.getElementById('standEvery'),
  standMinInput: document.getElementById('standMinutes'),
};

const CIRCUMFERENCE = 2 * Math.PI * 108;

const STORAGE_KEYS = {
  stoppedDate: 'eyebreak_stopped_date',
  cycleCount: 'eyebreak_cycle_count',
  cycleDate: 'eyebreak_cycle_date',
  sound: 'eyebreak_sound',       // "on" | "off"
  tipIndex: 'eyebreak_tip_index',
  history: 'eyebreak_history',   // {"2026-11-12": 9, ...} — last 60 days
  workMin: 'eyebreak_work_minutes',
  breakSec: 'eyebreak_break_seconds',
  standEvery: 'eyebreak_stand_every',
  standMin: 'eyebreak_stand_minutes',
  standTipIndex: 'eyebreak_stand_tip_index',
  exercise: 'eyebreak_exercise',       // "on" | "off"
  exerciseIndex: 'eyebreak_exercise_index',
};

function clamp(v, [lo, hi], fallback) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}

function safeGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* private mode etc. */ }
}

function workMinutes() { return Math.round(WORK_SECONDS / 60); }

function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }

function loadTiming() {
  WORK_SECONDS = clamp(safeGet(STORAGE_KEYS.workMin) ?? DEFAULT_WORK_MIN, LIMITS.workMin, DEFAULT_WORK_MIN) * 60;
  BREAK_SECONDS = clamp(safeGet(STORAGE_KEYS.breakSec) ?? DEFAULT_BREAK_SEC, LIMITS.breakSec, DEFAULT_BREAK_SEC);
  if (els.workInput) els.workInput.value = workMinutes();
  if (els.breakInput) els.breakInput.value = BREAK_SECONDS;
  STAND_EVERY = clamp(safeGet(STORAGE_KEYS.standEvery) ?? DEFAULT_STAND_EVERY, LIMITS.standEvery, DEFAULT_STAND_EVERY);
  STAND_SECONDS = clamp(safeGet(STORAGE_KEYS.standMin) ?? DEFAULT_STAND_MIN, LIMITS.standMin, DEFAULT_STAND_MIN) * 60;
  if (els.standEveryInput) els.standEveryInput.value = STAND_EVERY;
  if (els.standMinInput) els.standMinInput.value = STAND_SECONDS / 60;
}

// Is the break about to start a stand-up one? (cycles = breaks finished today)
function isStandBreakNext() {
  return STAND_EVERY > 0 && (cycles + 1) % STAND_EVERY === 0;
}

function nextStandTip() {
  const i = (Number(safeGet(STORAGE_KEYS.standTipIndex)) || 0) % STAND_TIPS.length;
  safeSet(STORAGE_KEYS.standTipIndex, String(i + 1));
  return STAND_TIPS[i];
}

function idleHint() {
  return `Press start. Every ${plural(workMinutes(), 'minute')} we'll tell you to look 20 feet away for ` +
    `${plural(BREAK_SECONDS, 'second')} — then work resumes on its own. Space starts and pauses.`;
}

function applyTiming() {
  const w = clamp(els.workInput.value, LIMITS.workMin, workMinutes());
  const b = clamp(els.breakInput.value, LIMITS.breakSec, BREAK_SECONDS);
  els.workInput.value = w;
  els.breakInput.value = b;
  safeSet(STORAGE_KEYS.workMin, String(w));
  safeSet(STORAGE_KEYS.breakSec, String(b));
  WORK_SECONDS = w * 60;
  BREAK_SECONDS = b;
  if (els.standEveryInput && els.standMinInput) {
    const se = clamp(els.standEveryInput.value, LIMITS.standEvery, STAND_EVERY);
    const sm = clamp(els.standMinInput.value, LIMITS.standMin, STAND_SECONDS / 60);
    els.standEveryInput.value = se;
    els.standMinInput.value = sm;
    safeSet(STORAGE_KEYS.standEvery, String(se));
    safeSet(STORAGE_KEYS.standMin, String(sm));
    STAND_EVERY = se;
    STAND_SECONDS = sm * 60;
  }
  if (phase === 'idle') {
    remaining = WORK_SECONDS;
    if (!isStoppedForToday()) els.hint.textContent = idleHint();
    render();
  } else {
    showToast('New timing starts with the next phase', 2500);
  }
}

let phase = 'idle'; // 'idle' | 'work' | 'break'
let remaining = WORK_SECONDS;
let ticking = null;
let paused = false;
let deadline = 0; // wall-clock ms when the current phase ends

// Snooze: push a break back a few minutes (e.g. you're presenting), but only
// a couple of times in a row so it can't quietly replace every break.
const SNOOZE_SECONDS = 5 * 60;
const MAX_SNOOZES_IN_ROW = 2;
let snoozesInRow = 0;

const BASE_TITLE = document.title;

function todayStr() {
  return new Date().toDateString();
}

function loadCycleCount() {
  const savedDate = localStorage.getItem(STORAGE_KEYS.cycleDate);
  if (savedDate !== todayStr()) {
    localStorage.setItem(STORAGE_KEYS.cycleDate, todayStr());
    localStorage.setItem(STORAGE_KEYS.cycleCount, '0');
    return 0;
  }
  return parseInt(localStorage.getItem(STORAGE_KEYS.cycleCount) || '0', 10);
}

function saveCycleCount(n) {
  localStorage.setItem(STORAGE_KEYS.cycleDate, todayStr());
  localStorage.setItem(STORAGE_KEYS.cycleCount, String(n));
  recordHistory(n);
}

/* ---- 7-day history & streak ---- */

function dayKey(d = new Date()) {
  // local calendar date, not UTC
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadHistory() {
  try {
    const h = JSON.parse(safeGet(STORAGE_KEYS.history) || '{}');
    return h && typeof h === 'object' ? h : {};
  } catch (e) {
    return {};
  }
}

function recordHistory(count) {
  const h = loadHistory();
  h[dayKey()] = count;
  const keep = Object.keys(h).sort().slice(-60);  // don't grow forever
  const trimmed = {};
  keep.forEach((k) => { trimmed[k] = h[k]; });
  safeSet(STORAGE_KEYS.history, JSON.stringify(trimmed));
  renderHistory();
}

function lastDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

// consecutive days (ending today, or yesterday if none yet today) with at least one break
function streakDays(h) {
  let streak = 0;
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  if (!h[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (h[dayKey(d)] > 0) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function renderHistory() {
  if (!els.weekBars) return;
  const h = loadHistory();
  const days = lastDays(7);
  const counts = days.map((d) => h[dayKey(d)] || 0);
  const max = Math.max(3, ...counts);
  els.weekBars.innerHTML = days.map((d, i) => {
    const pct = Math.round((counts[i] / max) * 100);
    const label = d.toLocaleDateString(undefined, { weekday: 'narrow' });
    const full = d.toLocaleDateString(undefined, { weekday: 'long' });
    const today = i === days.length - 1 ? ' is-today' : '';
    return `<div class="day${today}" title="${full}: ${plural(counts[i], 'break')}">
      <div class="bar"><span style="height:${pct}%"></span></div><small>${label}</small></div>`;
  }).join('');
  const total = counts.reduce((a, b) => a + b, 0);
  const s = streakDays(h);
  els.streak.textContent = `${plural(total, 'break')} this week` + (s > 1 ? ` · 🔥 ${s}-day streak` : '');
}

function isStoppedForToday() {
  return localStorage.getItem(STORAGE_KEYS.stoppedDate) === todayStr();
}

function stopForToday() {
  showTip('');
  localStorage.setItem(STORAGE_KEYS.stoppedDate, todayStr());
  resetToIdle();
  els.startBtn.disabled = true;
  els.stopDayBtn.disabled = true;
  els.hint.textContent = "Stopped for today. It'll be ready again tomorrow — or just refresh after midnight.";
  showToast('Timer stopped for the day 🌙');
}

let cycles = 0;

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateRing(currentRemaining, total) {
  const fraction = currentRemaining / total;
  const offset = CIRCUMFERENCE * (1 - fraction);
  els.ring.style.strokeDashoffset = offset;
}

function render() {
  els.time.textContent = formatTime(remaining);
  els.cycleCount.textContent = `${cycles} break${cycles === 1 ? '' : 's'} today`;

  if (phase === 'work') {
    els.phaseLabel.textContent = 'focus time';
    els.ring.classList.remove('break-mode', 'pulse');
    updateRing(remaining, WORK_SECONDS);
  } else if (phase === 'break') {
    els.phaseLabel.textContent = standBreak ? 'stand & stretch!' : 'look away!';
    els.ring.classList.add('break-mode', 'pulse');
    updateRing(remaining, currentBreakSeconds);
  } else {
    els.phaseLabel.textContent = 'ready';
    els.ring.classList.remove('break-mode', 'pulse');
    updateRing(1, 1);
  }
  updateTitle();
  renderSnooze();
}

function renderSnooze() {
  if (!els.snoozeBtn) return;
  const left = MAX_SNOOZES_IN_ROW - snoozesInRow;
  els.snoozeBtn.hidden = phase !== 'break' || paused || left <= 0;
  els.snoozeBtn.textContent = `⏰ In a meeting? Snooze 5 min (${left} left)`;
}

function snooze() {
  if (phase !== 'break' || snoozesInRow >= MAX_SNOOZES_IN_ROW) return;
  snoozesInRow += 1;
  showTip('');
  phase = 'work';
  paused = false;
  remaining = SNOOZE_SECONDS;
  setDeadline(SNOOZE_SECONDS);
  els.pauseBtn.textContent = 'Pause';
  showToast(snoozesInRow >= MAX_SNOOZES_IN_ROW
    ? 'Snoozed — the next break can\'t be snoozed, your eyes need it 👀'
    : 'Snoozed for 5 minutes', 3500);
  render();
}

// Show the countdown in the browser tab so you can see it without switching tabs
function updateTitle() {
  if (phase === 'idle') {
    document.title = BASE_TITLE;
  } else if (paused) {
    document.title = `⏸ ${formatTime(remaining)} · paused`;
  } else if (phase === 'break') {
    document.title = standBreak ? `🧍 ${formatTime(remaining)} · stand & stretch` : `👀 ${formatTime(remaining)} · look away!`;
  } else {
    document.title = `${formatTime(remaining)} · focus`;
  }
}

function showToast(msg, duration = 4000) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove('show'), duration);
}

function notify(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: 'icon.svg' });
    } catch (e) { /* ignore */ }
  }
}

/* ---- sound: generated with Web Audio API, no external files needed ---- */
let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function soundOn() {
  return safeGet(STORAGE_KEYS.sound) !== 'off';
}

function renderSoundToggle() {
  if (!els.soundToggle) return;
  const on = soundOn();
  els.soundToggle.textContent = on ? '🔔 Sound on' : '🔕 Sound off';
  els.soundToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function beep({ freq = 880, duration = 0.18, type = 'sine', gain = 0.22, delay = 0 }) {
  if (!soundOn()) return;  // quiet mode: notifications and visuals still work
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = 0;
  osc.connect(g);
  g.connect(ctx.destination);
  const start = ctx.currentTime + delay;
  osc.start(start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.stop(start + duration + 0.05);
}

function playAlarm() {
  // urgent, attention-getting pattern for "time to break"
  [0, 0.28, 0.56].forEach((d, i) => {
    beep({ freq: i % 2 === 0 ? 880 : 1046, duration: 0.22, type: 'triangle', gain: 0.28, delay: d });
  });
}

function playChime() {
  // soft, pleasant pattern for "back to work"
  [0, 0.18].forEach((d, i) => {
    beep({ freq: i === 0 ? 660 : 880, duration: 0.3, type: 'sine', gain: 0.18, delay: d });
  });
}

/* ---- break coach: a different simple eye exercise each break ---- */
const BREAK_TIPS = [
  'Look at something at least 20 feet (6 m) away — a window is perfect.',
  'Blink slowly 10 times to re-wet your eyes.',
  'Close your eyes and relax your shoulders. Breathe in for 4, out for 4.',
  'Trace a big sideways figure 8 with your eyes, slowly.',
  'Look far away, then at your fingertip, then far again — repeat 5 times.',
  'Find the farthest green thing you can see and focus on it.',
  'Rub your palms warm and rest them gently over closed eyes.',
  'Look up, down, left, right — hold each for 2 seconds.',
  'Unclench your jaw and drop your shoulders while you gaze into the distance.',
  'Close your eyes tightly for 3 seconds, then open wide. Repeat 3 times.',
];

/* ---- guided eye exercise: a dot to follow during the break ---- */
const EXERCISES = [
  { kind: 'circle', label: 'Follow the dot around the circle — move only your eyes.' },
  { kind: 'eight', label: 'Trace the figure-8 with your eyes, keep your head still.' },
  { kind: 'sides', label: 'Track the dot left and right, slowly and smoothly.' },
  { kind: 'focus', label: 'Small = far away, big = close. Shift your focus with it.' },
];
const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let previewTimer = null;

function exerciseOn() { return safeGet(STORAGE_KEYS.exercise) !== 'off'; }

function renderExerciseToggle() {
  if (!els.exerciseToggle) return;
  const on = exerciseOn();
  els.exerciseToggle.textContent = on ? '👁 Guided exercise on' : '👁 Guided exercise off';
  els.exerciseToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function showExercise(ex) {
  if (!els.exercise) return;
  clearTimeout(previewTimer);
  if (!ex) {
    els.exercise.hidden = true;
    delete els.exercise.dataset.kind;
    return;
  }
  els.exercise.dataset.kind = ex.kind;
  els.exerciseLabel.textContent = reducedMotion
    ? 'Look at something far away, then back at the dot. Repeat slowly.'
    : ex.label;
  els.exercise.hidden = false;
}

function nextExercise() {
  const i = (Number(safeGet(STORAGE_KEYS.exerciseIndex)) || 0) % EXERCISES.length;
  safeSet(STORAGE_KEYS.exerciseIndex, String(i + 1));
  return EXERCISES[i];
}

function nextTip() {
  const i = (Number(safeGet(STORAGE_KEYS.tipIndex)) || 0) % BREAK_TIPS.length;
  safeSet(STORAGE_KEYS.tipIndex, String(i + 1));
  return BREAK_TIPS[i];
}

function showTip(text) {
  if (!els.breakTip) return;
  els.breakTip.textContent = text || '';
  els.breakTip.hidden = !text;
}

/* ---- timer control ---- */

// Browsers throttle timers in background tabs, so instead of counting ticks
// we compare against a wall-clock deadline. The countdown stays accurate even
// if the tab was hidden for minutes.
function setDeadline(seconds) {
  deadline = Date.now() + seconds * 1000;
}

function tick() {
  if (paused || phase === 'idle') return;
  remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  if (remaining <= 0) {
    handlePhaseEnd();
  } else {
    render();
  }
}

function startTick() {
  clearInterval(ticking);
  ticking = setInterval(tick, 250);
}

function handlePhaseEnd() {
  if (phase === 'work') {
    playAlarm();
    standBreak = isStandBreakNext();
    currentBreakSeconds = standBreak ? STAND_SECONDS : BREAK_SECONDS;
    if (standBreak) {
      const mins = plural(STAND_SECONDS / 60, 'minute');
      notify('Stand up & stretch 🧍', `A ${mins} movement break — look far away too. Resuming automatically.`);
      showToast(`Stand-up break: ${mins} to move and stretch 🧍`, 6000);
    } else {
      notify('Look 20 feet away 👀', `Rest your eyes for ${plural(BREAK_SECONDS, 'second')} — resuming automatically.`);
      showToast(`Time to look 20 feet away for ${plural(BREAK_SECONDS, 'second')} 🌸`, 5000);
    }
    phase = 'break';
    remaining = currentBreakSeconds;
    setDeadline(currentBreakSeconds);
    showTip(standBreak ? nextStandTip() : nextTip());
    if (exerciseOn() && !standBreak) showExercise(nextExercise());  // you're away from the screen for this one
    render();
  } else if (phase === 'break') {
    showTip('');
    showExercise(null);
    playChime();
    snoozesInRow = 0;  // a real break resets the snooze allowance
    cycles += 1;
    saveCycleCount(cycles);
    notify('Back to work', `Nice work — the next ${plural(workMinutes(), 'minute')} just started.`);
    showToast(`Resuming — next break in ${plural(workMinutes(), 'minute')} ✨`, 3500);
    phase = 'work';
    remaining = WORK_SECONDS;
    setDeadline(WORK_SECONDS);
    render();
  }
}

function resetToIdle() {
  showTip('');
  showExercise(null);
  clearInterval(ticking);
  phase = 'idle';
  paused = false;
  snoozesInRow = 0;
  remaining = WORK_SECONDS;
  els.startBtn.textContent = 'Start';
  els.startBtn.disabled = false;
  els.pauseBtn.disabled = true;
  els.pauseBtn.textContent = 'Pause';
  render();
}

function start() {
  if (isStoppedForToday()) return;
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  phase = 'work';
  remaining = WORK_SECONDS;
  paused = false;
  setDeadline(WORK_SECONDS);
  els.startBtn.disabled = true;
  els.pauseBtn.disabled = false;
  els.hint.textContent = `Running — we'll ping you every ${plural(workMinutes(), 'minute')}.`;
  startTick();
  render();
}

function togglePause() {
  paused = !paused;
  if (!paused) setDeadline(remaining); // resume exactly where we left off
  render();
  els.pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  showToast(paused ? 'Paused' : 'Resumed', 1500);
}

/* ---- init ---- */

loadTiming();
renderHistory();
renderSoundToggle();
renderExerciseToggle();
remaining = WORK_SECONDS;
els.hint.textContent = idleHint();
cycles = loadCycleCount();

if (isStoppedForToday()) {
  els.startBtn.disabled = true;
  els.stopDayBtn.disabled = true;
  els.hint.textContent = "Stopped for today. It'll be ready again tomorrow.";
}

render();

els.startBtn.addEventListener('click', start);
els.pauseBtn.addEventListener('click', togglePause);
els.snoozeBtn.addEventListener('click', snooze);
els.stopDayBtn.addEventListener('click', () => {
  if (confirm('Stop the timer for the rest of today?')) {
    stopForToday();
  }
});

els.soundToggle.addEventListener('click', () => {
  safeSet(STORAGE_KEYS.sound, soundOn() ? 'off' : 'on');
  renderSoundToggle();
  if (soundOn()) playChime();  // a little preview so you know it works
});

if (els.exerciseToggle) {
  els.exerciseToggle.addEventListener('click', () => {
    safeSet(STORAGE_KEYS.exercise, exerciseOn() ? 'off' : 'on');
    renderExerciseToggle();
    if (!exerciseOn() && phase !== 'break') showExercise(null);
  });
}
if (els.exercisePreview) {
  els.exercisePreview.addEventListener('click', () => {
    if (phase === 'break') return;
    const ex = EXERCISES[Math.floor(Math.random() * EXERCISES.length)];
    showExercise(ex);
    previewTimer = setTimeout(() => { if (phase !== 'break') showExercise(null); }, 8000);
  });
}
els.workInput.addEventListener('change', applyTiming);
els.standEveryInput?.addEventListener('change', applyTiming);
els.standMinInput?.addEventListener('change', applyTiming);
els.breakInput.addEventListener('change', applyTiming);
els.resetTiming.addEventListener('click', () => {
  els.workInput.value = DEFAULT_WORK_MIN;
  els.breakInput.value = DEFAULT_BREAK_SEC;
  if (els.standEveryInput) els.standEveryInput.value = DEFAULT_STAND_EVERY;
  if (els.standMinInput) els.standMinInput.value = DEFAULT_STAND_MIN;
  applyTiming();
});

// Keyboard: Space starts, then pauses/resumes. Ignored while typing in a field.
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'button') return;
  e.preventDefault();
  if (phase === 'idle') {
    if (!els.startBtn.disabled) start();
  } else {
    togglePause();
  }
});

// keep the countdown accurate even if the tab is throttled in the background
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    tick();
  }
});
