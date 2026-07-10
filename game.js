const COLORS = [
  { name: "Cherry pop", value: "#e94337" },
  { name: "Lemon fizz", value: "#ffd242" },
  { name: "Blue razz", value: "#3d9be9" },
  { name: "Grape jam", value: "#8654d2" },
  { name: "Orange zip", value: "#f38a38" },
  { name: "Melon chew", value: "#54b878" },
];

const state = {
  running: false,
  busy: false,
  muted: false,
  score: 0,
  seconds: 45,
  combo: 0,
  bestCombo: 0,
  matches: 0,
  collected: [],
  target: COLORS[0],
  timerId: null,
};

const el = {
  canvas: document.querySelector("#globeCanvas"),
  machine: document.querySelector("#machine"),
  drop: document.querySelector("#dropButton"),
  play: document.querySelector("#playButton"),
  playLabel: document.querySelector("#playButton span"),
  hint: document.querySelector("#commandHint"),
  score: document.querySelector("#score"),
  best: document.querySelector("#best"),
  timer: document.querySelector("#timer"),
  timerStat: document.querySelector(".timer-stat"),
  targetBall: document.querySelector("#targetBall"),
  targetName: document.querySelector("#targetName"),
  orderValue: document.querySelector("#orderValue"),
  orderTicket: document.querySelector("#orderTicket"),
  comboValue: document.querySelector("#comboValue"),
  comboBars: [...document.querySelectorAll(".combo-track i")],
  collection: [...document.querySelectorAll("#collectionGrid > div")],
  collectedCount: document.querySelector("#collectedCount"),
  dispensed: document.querySelector("#dispensedBall"),
  toast: document.querySelector("#toast"),
  roundStatus: document.querySelector("#roundStatus"),
  roundDot: document.querySelector(".round-dot"),
  modal: document.querySelector("#resultModal"),
  finalScore: document.querySelector("#finalScore"),
  finalStreak: document.querySelector("#finalStreak"),
  finalMatches: document.querySelector("#finalMatches"),
  replay: document.querySelector("#replayButton"),
  sound: document.querySelector("#soundButton"),
  fullscreen: document.querySelector("#fullscreenButton"),
};

const ctx = el.canvas.getContext("2d");
const { Engine, Bodies, Body, Composite } = Matter;
const physics = Engine.create({ gravity: { x: 0, y: .82, scale: .001 } });
let balls = [];
let audioCtx;

function createBalls() {
  const walls = [];
  const center = { x: 260, y: 225 };
  const radius = { x: 244, y: 216 };
  const segments = 28;

  for (let i = 0; i < segments; i += 1) {
    const a1 = (i / segments) * Math.PI * 2;
    const a2 = ((i + 1) / segments) * Math.PI * 2;
    const p1 = { x: center.x + Math.cos(a1) * radius.x, y: center.y + Math.sin(a1) * radius.y };
    const p2 = { x: center.x + Math.cos(a2) * radius.x, y: center.y + Math.sin(a2) * radius.y };
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    walls.push(Bodies.rectangle(
      (p1.x + p2.x) / 2,
      (p1.y + p2.y) / 2,
      Math.hypot(dx, dy) + 8,
      22,
      { isStatic: true, angle: Math.atan2(dy, dx), restitution: .25, friction: .08 },
    ));
  }

  balls = Array.from({ length: 46 }, (_, i) => {
    const column = i % 8;
    const row = Math.floor(i / 8);
    const r = 20 + (i % 4);
    const body = Bodies.circle(
      91 + column * 48 + (row % 2) * 13,
      128 + row * 47 + (column % 2) * 2,
      r,
      {
        restitution: .42,
        friction: .055,
        frictionStatic: .12,
        frictionAir: .009,
        density: .0018,
        slop: .04,
      },
    );
    body.gumballColor = COLORS[i % COLORS.length].value;
    body.gumballRadius = r;
    Body.setVelocity(body, { x: (Math.random() - .5) * .35, y: 0 });
    return body;
  });

  Composite.add(physics.world, [...walls, ...balls]);
}

function shade(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (num & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

function drawGlobe() {
  Engine.update(physics, 1000 / 60);
  ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
  balls.forEach((ball) => {
    const { x, y } = ball.position;
    const r = ball.gumballRadius;
    const color = ball.gumballColor;
    const grad = ctx.createRadialGradient(x - 7, y - 8, 3, x, y, r);
    grad.addColorStop(0, shade(color, 65));
    grad.addColorStop(.38, color);
    grad.addColorStop(1, shade(color, -42));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#202224";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 7, y - 8, r * .22, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fill();
  });
  requestAnimationFrame(drawGlobe);
}

function jiggleBalls() {
  balls.forEach((ball) => {
    Body.applyForce(ball, ball.position, {
      x: (Math.random() - .5) * .022,
      y: -.035 - Math.random() * .025,
    });
    Body.setAngularVelocity(ball, (Math.random() - .5) * .16);
  });
}

function formatScore(value) { return String(value).padStart(4, "0"); }

function updateUI() {
  el.score.textContent = formatScore(state.score);
  el.timer.textContent = `0:${String(state.seconds).padStart(2, "0")}`;
  el.comboValue.textContent = `x${Math.max(1, state.combo)}`;
  el.orderValue.textContent = `+${100 * Math.max(1, state.combo || 1)}`;
  el.comboBars.forEach((bar, i) => bar.classList.toggle("on", i < Math.min(state.combo, 5)));
  el.collectedCount.textContent = `${state.collected.length} / 8`;
  el.timerStat.classList.toggle("warning", state.running && state.seconds <= 10);
}

function setTarget(next) {
  state.target = next || COLORS[Math.floor(Math.random() * COLORS.length)];
  el.targetBall.style.backgroundColor = state.target.value;
  el.targetName.textContent = state.target.name;
  el.orderTicket.classList.remove("flash");
  void el.orderTicket.offsetWidth;
  el.orderTicket.classList.add("flash");
}

function tone(freq, duration, type = "sine", delay = 0) {
  if (state.muted) return;
  audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;
  gain.gain.setValueAtTime(.06, audioCtx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + delay + duration);
  oscillator.connect(gain).connect(audioCtx.destination);
  oscillator.start(audioCtx.currentTime + delay);
  oscillator.stop(audioCtx.currentTime + delay + duration);
}

function showToast(text, type) {
  el.toast.textContent = text;
  el.toast.className = `toast ${type}`;
  void el.toast.offsetWidth;
  el.toast.classList.add("show");
}

function addToTray(color) {
  if (state.collected.length >= 8) state.collected.shift();
  state.collected.push(color);
  el.collection.forEach((slot, i) => {
    slot.innerHTML = state.collected[i] ? `<span style="background:${state.collected[i]}"></span>` : "";
  });
}

function confetti(count = 24) {
  const colors = COLORS.map((c) => c.value).concat("#ffd242");
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement("i");
    piece.className = "confetti";
    piece.style.left = `${15 + Math.random() * 70}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--drift", `${(Math.random() - .5) * 280}px`);
    piece.style.animationDelay = `${Math.random() * .3}s`;
    piece.style.transform = `rotate(${Math.random() * 180}deg)`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2300);
  }
}

function resolveDrop(ball) {
  const gold = ball.gold;
  const match = !gold && ball.value === state.target.value;
  if (gold) {
    state.score += 250;
    showToast("GOLDEN! +250", "gold");
    tone(523, .12, "triangle"); tone(659, .12, "triangle", .1); tone(784, .2, "triangle", .2);
    confetti(18);
  } else if (match) {
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.matches += 1;
    const points = 100 * state.combo;
    state.score += points;
    showToast(`SWEET MATCH! +${points}`, "match");
    tone(480 + state.combo * 35, .12, "triangle"); tone(700 + state.combo * 35, .16, "triangle", .1);
    if (state.combo >= 3) confetti(12);
  } else {
    state.score += 20;
    state.combo = 0;
    showToast("TRAY BONUS +20", "miss");
    tone(210, .12, "square");
  }
  addToTray(ball.value);
  setTarget();
  updateUI();
}

function dispense() {
  if (!state.running || state.busy) return;
  state.busy = true;
  el.drop.disabled = true;
  el.play.disabled = true;
  const gold = Math.random() < .08;
  const color = gold ? { name: "Golden gumball", value: "#f6c83c", gold: true } : COLORS[Math.floor(Math.random() * COLORS.length)];
  el.dispensed.style.backgroundColor = color.value;
  el.machine.classList.remove("turning");
  el.dispensed.classList.remove("drop");
  void el.machine.offsetWidth;
  el.machine.classList.add("turning");
  jiggleBalls();
  tone(120, .18, "square");
  setTimeout(() => {
    el.dispensed.classList.add("drop");
    tone(310, .08, "sine");
  }, 380);
  setTimeout(() => {
    resolveDrop(color);
    state.busy = false;
    el.drop.disabled = false;
    el.play.disabled = false;
  }, 920);
}

function startRound() {
  clearInterval(state.timerId);
  state.running = true;
  state.busy = false;
  state.score = 0;
  state.seconds = 45;
  state.combo = 0;
  state.bestCombo = 0;
  state.matches = 0;
  state.collected = [];
  el.collection.forEach((slot) => { slot.innerHTML = ""; });
  el.modal.classList.remove("open");
  el.modal.setAttribute("aria-hidden", "true");
  el.play.classList.add("active");
  el.playLabel.textContent = "DROP A GUMBALL";
  el.play.querySelector("svg")?.setAttribute("data-lucide", "circle-arrow-down");
  el.hint.textContent = "45 second sugar rush";
  el.roundStatus.textContent = "Round in progress";
  el.roundDot.classList.add("live");
  setTarget();
  updateUI();
  tone(392, .1, "triangle"); tone(523, .16, "triangle", .12);
  state.timerId = setInterval(() => {
    state.seconds -= 1;
    updateUI();
    if (state.seconds <= 0) endRound();
    else if (state.seconds <= 5) tone(640, .07, "square");
  }, 1000);
}

function endRound() {
  clearInterval(state.timerId);
  state.running = false;
  state.busy = false;
  const oldBest = Number(localStorage.getItem("gumball-best") || 0);
  const best = Math.max(oldBest, state.score);
  localStorage.setItem("gumball-best", String(best));
  el.best.textContent = formatScore(best);
  el.finalScore.textContent = formatScore(state.score);
  el.finalStreak.textContent = state.bestCombo;
  el.finalMatches.textContent = state.matches;
  el.roundStatus.textContent = "Round complete";
  el.roundDot.classList.remove("live");
  el.timerStat.classList.remove("warning");
  el.play.classList.remove("active");
  el.playLabel.textContent = "START ROUND";
  setTimeout(() => {
    el.modal.classList.add("open");
    el.modal.setAttribute("aria-hidden", "false");
    el.replay.focus();
    confetti(36);
  }, state.busy ? 900 : 150);
}

el.play.addEventListener("click", () => state.running ? dispense() : startRound());
el.drop.addEventListener("click", dispense);
el.replay.addEventListener("click", startRound);
document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !event.repeat && !el.modal.classList.contains("open")) {
    event.preventDefault();
    state.running ? dispense() : startRound();
  }
});

el.sound.addEventListener("click", () => {
  state.muted = !state.muted;
  el.sound.setAttribute("aria-label", state.muted ? "Turn sound on" : "Mute sound");
  el.sound.title = state.muted ? "Turn sound on" : "Mute sound";
  el.sound.innerHTML = `<i data-lucide="${state.muted ? "volume-x" : "volume-2"}"></i>`;
  window.lucide?.createIcons();
});

el.fullscreen.addEventListener("click", async () => {
  if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  else await document.exitFullscreen();
});

document.addEventListener("fullscreenchange", () => {
  const full = Boolean(document.fullscreenElement);
  el.fullscreen.setAttribute("aria-label", full ? "Exit fullscreen" : "Enter fullscreen");
  el.fullscreen.title = full ? "Exit fullscreen" : "Enter fullscreen";
  el.fullscreen.innerHTML = `<i data-lucide="${full ? "minimize" : "maximize"}"></i>`;
  window.lucide?.createIcons();
});

window.lucide?.createIcons();
el.best.textContent = formatScore(Number(localStorage.getItem("gumball-best") || 0));
createBalls();
setTarget(COLORS[0]);
updateUI();
drawGlobe();
