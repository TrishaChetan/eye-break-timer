/* 20-20-20 Eye Break Timer
   Work phase: 20:00 (1200s) -> alarm -> Break phase: 0:20 (20s) -> chime -> repeat
*/

const WORK_SECONDS = 20 * 60;
const BREAK_SECONDS = 20;

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
};

const CIRCUMFERENCE = 2 * Math.PI * 108;

const STORAGE_KEYS = {
  stoppedDate: 'eyebreak_stopped_date',
  cycleCount: 'eyebreak_cycle_count',
  cycleDate: 'eyebreak_cycle_date',
};

let phase = 'idle'; // 'idle' | 'work' | 'break'
let remaining = WORK_SECONDS;
let ticking = null;
let paused = false;

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
}

function isStoppedForToday() {
  return localStorage.getItem(STORAGE_KEYS.stoppedDate) === todayStr();
}

function stopForToday() {
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

function beep({ freq = 880, duration = 0.18, type = 'sine', gain = 0.22, delay = 0 }) {
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

/* ---- timer control ---- */

function startTick() {
  clearInterval(ticking);
  ticking = setInterval(() => {
    if (paused) return;
    remaining -= 1;
    if (remaining <= 0) {
      handlePhaseEnd();
    } else {
      render();
    }
  }, 1000);
}

function handlePhaseEnd() {
  if (phase === 'work') {
    playAlarm();
    notify('Look 20 feet away 👀', 'Rest your eyes for 20 seconds — resuming automatically.');
    showToast('Time to look 20 feet away for 20 seconds 🌸', 5000);
    phase = 'break';
    remaining = BREAK_SECONDS;
    render();
  } else if (phase === 'break') {
    playChime();
    cycles += 1;
    saveCycleCount(cycles);
    notify('Back to work', 'Nice work — the next 20 minutes just started.');
    showToast('Resuming — next break in 20 minutes ✨', 3500);
    phase = 'work';
    remaining = WORK_SECONDS;
    render();
  }
}

function resetToIdle() {
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
  els.startBtn.disabled = true;
  els.pauseBtn.disabled = false;
  els.hint.textContent = "Running — we'll ping you every 20 minutes.";
  startTick();
  render();
}

function togglePause() {
  paused = !paused;
  els.pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  showToast(paused ? 'Paused' : 'Resumed', 1500);
}

/* ---- init ---- */

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

// keep the countdown accurate even if the tab is throttled in the background
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    render();
  }
});
