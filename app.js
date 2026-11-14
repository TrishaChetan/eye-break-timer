/* 20-20-20 Eye Break Timer
   Work phase: 20:00 (1200s) -> alarm -> Break phase: 0:20 (20s) -> chime -> repeat
*/

// Defaults follow the 20-20-20 rule; both can be changed under "Timing"
// and are remembered in localStorage.
const DEFAULT_WORK_MIN = 20;
const DEFAULT_BREAK_SEC = 20;
const LIMITS = { workMin: [1, 90], breakSec: [10, 300] };

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
    els.phaseLabel.textContent = 'look away!';
    els.ring.classList.add('break-mode', 'pulse');
    updateRing(remaining, BREAK_SECONDS);
  } else {
    els.phaseLabel.textContent = 'ready';
    els.ring.classList.remove('break-mode', 'pulse');
    updateRing(1, 1);
  }
  updateTitle();
}

// Show the countdown in the browser tab so you can see it without switching tabs
function updateTitle() {
  if (phase === 'idle') {
    document.title = BASE_TITLE;
  } else if (paused) {
    document.title = `⏸ ${formatTime(remaining)} · paused`;
  } else if (phase === 'break') {
    document.title = `👀 ${formatTime(remaining)} · look away!`;
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
    notify('Look 20 feet away 👀', `Rest your eyes for ${plural(BREAK_SECONDS, 'second')} — resuming automatically.`);
    showToast(`Time to look 20 feet away for ${plural(BREAK_SECONDS, 'second')} 🌸`, 5000);
    phase = 'break';
    remaining = BREAK_SECONDS;
    setDeadline(BREAK_SECONDS);
    showTip(nextTip());
    render();
  } else if (phase === 'break') {
    showTip('');
    playChime();
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
  clearInterval(ticking);
  phase = 'idle';
  paused = false;
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

els.workInput.addEventListener('change', applyTiming);
els.breakInput.addEventListener('change', applyTiming);
els.resetTiming.addEventListener('click', () => {
  els.workInput.value = DEFAULT_WORK_MIN;
  els.breakInput.value = DEFAULT_BREAK_SEC;
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
