# 20-20-20 Eye Break Timer 🌸

A pink, no-frills eye break timer for your laptop, based on the **20-20-20 rule**:
> Every 20 minutes, look at something 20 feet away for 20 seconds.

Runs fully in the browser — no install, no account, no data leaves your machine.

## Features

- ⏱️ 20:00 focus timer with a live pink progress ring
- 🔔 Alarm sound + on-screen toast + (optional) desktop notification when it's break time
- 👀 Auto-starts a 20 second "look away" break
- ▶️ Auto-resumes the next 20-minute focus timer when the break ends — no clicking needed
- ⏸️ Pause/Resume if you get interrupted
- 🛑 "Stop for today" button — permanently stops until the next calendar day
- 📊 Tracks how many breaks you've taken today
- 🧘 Break coach — each break shows a different simple eye exercise (blinking, figure-8s, near/far focus, palming…)
- 👁 Guided exercise — during each break an animated dot moves in a circle, a figure-8, side to side, or grows and shrinks for near/far focus, rotating each break. You can turn it off or preview it under Timing, and it holds still if your system asks for reduced motion
- 🧍 Stand-up breaks — every 3rd break (about once an hour on 20-minute cycles) becomes a 2-minute "stand & stretch" break with a movement tip: shoulder rolls, a water walk, calf raises, chest openers. How often and how long are adjustable under Timing, and 0 turns it off
- 🔕 Sound on/off switch under Timing, remembered between visits — notifications and visuals keep working when muted
- 📅 7-day history — a mini bar chart of breaks per day, weekly total and a 🔥 streak of days with at least one break
- ⚙️ Adjustable timing (work 1–90 min, break 10–300 s), remembered between visits — defaults to 20-20-20
- ⌨️ Space starts the timer and pauses/resumes it
- ⏰ Snooze a break by 5 minutes when you're in a meeting (twice in a row at most — then the break happens)
- 🏷️ Live countdown in the browser tab title, so you can see it from any tab
- 🎯 Stays accurate in background tabs (uses a wall-clock deadline, not tick counting)
- 💻 Installable as a real desktop app (see below) or just used as a webpage

## Run it locally (webpage)

You don't need a server — just open the file:

1. Download/clone this folder.
2. Double-click `index.html` (or right-click → Open with → your browser).

That's it. It works offline after the first load (fonts need internet the first time).

## Install it as a laptop app (recommended)

This is a **PWA (Progressive Web App)**, so Chrome/Edge/Brave can install it as a standalone desktop app with its own icon and window — no Electron, no App Store.

1. Open `index.html` in Chrome or Edge (either double-click it, or serve it locally — see below).
2. Click the **install icon** in the address bar (⊕ or a small monitor icon on the right side of the URL bar).
   - Or open the browser menu (⋮) → **"Install 20-20-20 Eye Break Timer..."**
3. It now opens in its own window from your Start Menu / Applications folder / Dock, just like a native app.

> Note: some browsers only show the install button when the page is served over `http://` or `https://` rather than opened directly as a `file://`. If you don't see the install icon, run a tiny local server first:
> ```bash
> cd eye-break-timer
> python3 -m http.server 8080
> ```
> Then open `http://localhost:8080` in Chrome/Edge and install from there.

## Using it

- Press **Start** → the ring counts down from 20:00.
- When it hits zero, you'll hear an alarm and get a break prompt — a 20 second countdown starts automatically.
- When the break ends, a soft chime plays and the next 20-minute focus timer starts automatically. Repeat all day.
- **Pause** if you're stepping away mid-cycle; press it again to resume exactly where you left off.
- **Stop for today** ends the cycle completely and disables Start until the next day (it resets automatically after midnight, or whenever you next open the page on a new day).

## Project structure

```
eye-break-timer/
├── index.html       # markup
├── styles.css        # pink theme, ring timer styling
├── app.js             # timer logic, alarm sounds, persistence
├── manifest.json  # makes it installable as a desktop app (PWA)
├── icon.svg           # app icon
└── README.md
```

## Publish it to GitHub

From inside the `eye-break-timer` folder:

```bash
git init
git add .
git commit -m "Add 20-20-20 eye break timer"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

(Create the empty repo first on github.com → **New repository**, don't initialize it with a README there, then run the commands above.)

### Optional: host it live with GitHub Pages

1. On GitHub, go to your repo → **Settings** → **Pages**.
2. Under "Build and deployment", set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`.
3. Save. After a minute your app will be live at:
   `https://<your-username>.github.io/<your-repo-name>/`
4. Open that link in Chrome/Edge and install it as an app from there too (works great, and now you can install it on any computer, not just this one).

## Notes

- Sounds are generated in-browser (Web Audio API) — no audio files needed, works offline.
- Everything (break count, "stopped for today" state) is stored in your browser's `localStorage`, per-device.
- No frameworks, no build step — just HTML/CSS/JS.
