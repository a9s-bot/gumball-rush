const COLORS = [
  { name: "Cherry pop", value: "#e94337" },
  { name: "Lemon fizz", value: "#ffd242" },
  { name: "Blue razz", value: "#3d9be9" },
  { name: "Grape jam", value: "#8654d2" },
  { name: "Orange zip", value: "#f38a38" },
  { name: "Melon chew", value: "#54b878" },
];

const MODES = {
  rush: { label: "Rush", seconds: 45, note: "45 sec" },
  precision: { label: "Precision", drops: 18, note: "18 drops" },
  daily: { label: "Daily", seconds: 45, note: "Seeded" },
};

const POWER_UPS = [
  { id: "bomb", name: "Color Bomb", description: "Next ball fills the best order", icon: "sparkles" },
  { id: "double", name: "Double Dip", description: "Double the next scoring drop", icon: "badge-x" },
  { id: "freeze", name: "Freeze Pop", description: "Add four seconds to the clock", icon: "snowflake" },
  { id: "magnet", name: "Candy Magnet", description: "Pull target colors toward intake", icon: "magnet" },
];

const ACHIEVEMENTS = {
  first_order: "First order filled",
  streak_five: "Five sweet streak",
  perfect_five: "Precision expert",
  score_3000: "Three grand rush",
  tray_clear: "Full candy tray",
  daily_run: "Daily machine played",
};

const state = {
  running: false,
  busy: false,
  pendingEnd: false,
  muted: false,
  mode: "rush",
  score: 0,
  seconds: 45,
  dropsLeft: 18,
  totalDrops: 0,
  combo: 0,
  bestCombo: 0,
  matches: 0,
  perfectDrops: 0,
  collected: [],
  orders: [],
  orderSerial: 0,
  shake: 100,
  powerCharge: 0,
  power: null,
  activePower: null,
  goldMultiplier: 1,
  timerId: null,
  timingPosition: .5,
  rng: Math.random,
  roundStartedAt: 0,
};

const profile = loadProfile();

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
  metricLabel: document.querySelector("#roundMetricLabel"),
  timerStat: document.querySelector(".timer-stat"),
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
  finalAccuracy: document.querySelector("#finalAccuracy"),
  finalPerfect: document.querySelector("#finalPerfect"),
  medal: document.querySelector("#medalLabel"),
  nextGoal: document.querySelector("#nextGoal"),
  resultKicker: document.querySelector("#resultKicker"),
  replay: document.querySelector("#replayButton"),
  sound: document.querySelector("#soundButton"),
  fullscreen: document.querySelector("#fullscreenButton"),
  theme: document.querySelector("#themeButton"),
  orderQueue: document.querySelector("#orderQueue"),
  orderValue: document.querySelector("#orderValue"),
  modeNote: document.querySelector("#modeNote"),
  modeButtons: [...document.querySelectorAll("[data-mode]")],
  nudgeLeft: document.querySelector("#nudgeLeft"),
  nudgeRight: document.querySelector("#nudgeRight"),
  shakeButton: document.querySelector("#shakeButton"),
  shakeFill: document.querySelector("#shakeFill"),
  timingCursor: document.querySelector("#timingCursor"),
  timingGrade: document.querySelector("#timingGrade"),
  powerButton: document.querySelector("#powerButton"),
  powerName: document.querySelector("#powerName"),
  powerDescription: document.querySelector("#powerDescription"),
  powerCharge: document.querySelector("#powerCharge"),
  phaseLabel: document.querySelector("#phaseLabel"),
  phaseFill: document.querySelector("#phaseFill"),
  levelBadge: document.querySelector("#levelBadge"),
  achievementPop: document.querySelector("#achievementPop"),
  achievementName: document.querySelector("#achievementName"),
};

const ctx = el.canvas.getContext("2d");
const { Engine, Bodies, Body, Composite } = Matter;
const physics = Engine.create({ gravity: { x: 0, y: .7, scale: .001 } });
const INTAKE = { x: 260, y: 411 };
let balls = [];
let walls = [];
let audioCtx;
let lastFrame = performance.now();

function loadProfile() {
  const fallback = { xp: 0, totalScore: 0, totalOrders: 0, games: 0, best: {}, achievements: [], theme: 0 };
  try { return { ...fallback, ...JSON.parse(localStorage.getItem("gumball-profile") || "{}") }; }
  catch { return fallback; }
}

function saveProfile() {
  localStorage.setItem("gumball-profile", JSON.stringify(profile));
}

function level() { return 1 + Math.floor(profile.xp / 900); }
function unlockedThemes() { return Math.min(3, 1 + Math.floor((level() - 1) / 2)); }

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dailySeed() {
  return Number(new Date().toISOString().slice(0, 10).replaceAll("-", ""));
}

function randomColor() { return COLORS[Math.floor(state.rng() * COLORS.length)]; }

function makeBall(x, y, index = 0, forceGold = false) {
  const radius = 20 + (index % 4);
  const color = randomColor();
  const gold = forceGold || state.rng() < .055;
  const body = Bodies.circle(x, y, radius, {
    restitution: .5,
    friction: .035,
    frictionStatic: .07,
    frictionAir: .006,
    density: .00125,
    slop: .04,
  });
  body.gumball = gold ? { name: "Golden gumball", value: "#f6c83c", gold: true } : color;
  body.gumballRadius = radius;
  Body.setVelocity(body, { x: (state.rng() - .5) * .4, y: 0 });
  return body;
}

function resetPhysics() {
  Composite.clear(physics.world, false);
  Engine.clear(physics);
  walls = [];
  const center = { x: 260, y: 225 };
  const radius = { x: 244, y: 216 };
  const segments = 30;
  for (let i = 0; i < segments; i += 1) {
    const a1 = (i / segments) * Math.PI * 2;
    const a2 = ((i + 1) / segments) * Math.PI * 2;
    const p1 = { x: center.x + Math.cos(a1) * radius.x, y: center.y + Math.sin(a1) * radius.y };
    const p2 = { x: center.x + Math.cos(a2) * radius.x, y: center.y + Math.sin(a2) * radius.y };
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    walls.push(Bodies.rectangle((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, Math.hypot(dx, dy) + 8, 22, {
      isStatic: true, angle: Math.atan2(dy, dx), restitution: .24, friction: .09,
    }));
  }
  balls = Array.from({ length: 46 }, (_, i) => makeBall(
    91 + (i % 8) * 48 + (Math.floor(i / 8) % 2) * 13,
    124 + Math.floor(i / 8) * 47 + (i % 2) * 2,
    i,
    i === 9 || i === 34,
  ));
  Composite.add(physics.world, [...walls, ...balls]);
}

function shade(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (num & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

function intakeScore(ball) {
  const dx = ball.position.x - INTAKE.x;
  const dy = ball.position.y - INTAKE.y;
  return Math.hypot(dx * 1.35, dy) - ball.velocity.y * 3 + Math.abs(ball.velocity.x) * 1.5;
}

function intakeCandidates() {
  return [...balls].sort((a, b) => intakeScore(a) - intakeScore(b)).slice(0, 3);
}

function drawBall(ball, previewIndex) {
  const { x, y } = ball.position;
  const radius = ball.gumballRadius;
  const color = ball.gumball.value;
  if (previewIndex >= 0) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 7 + previewIndex * 2, 0, Math.PI * 2);
    ctx.strokeStyle = previewIndex === 0 ? "rgba(255,210,66,.95)" : "rgba(255,255,255,.52)";
    ctx.lineWidth = previewIndex === 0 ? 5 : 2.5;
    ctx.setLineDash(previewIndex === 0 ? [] : [5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const grad = ctx.createRadialGradient(x - 7, y - 8, 3, x, y, radius);
  grad.addColorStop(0, shade(color, 65));
  grad.addColorStop(.38, color);
  grad.addColorStop(1, shade(color, -42));
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#202224";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - 7, y - 8, radius * .22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.fill();
  if (ball.gumball.gold) {
    ctx.fillStyle = "#202224";
    ctx.font = "800 16px DM Sans";
    ctx.textAlign = "center";
    ctx.fillText("×2", x, y + 6);
  }
}

function animationLoop(now) {
  const delta = Math.min(50, now - lastFrame);
  lastFrame = now;
  Engine.update(physics, Math.min(1000 / 60, delta));
  const candidates = intakeCandidates();
  el.canvas.dataset.ballCount = String(balls.length);
  el.canvas.dataset.intakeColor = candidates[0]?.gumball.value || "";
  const speeds = balls.map((ball) => ball.speed);
  el.canvas.dataset.averageSpeed = (speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length).toFixed(2);
  el.canvas.dataset.maximumSpeed = Math.max(...speeds).toFixed(2);
  ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
  balls.forEach((ball) => drawBall(ball, candidates.indexOf(ball)));

  const speed = state.running && state.seconds <= 10 ? .0082 : .0055;
  state.timingPosition = (Math.sin(now * speed) + 1) / 2;
  el.timingCursor.style.left = `${state.timingPosition * 100}%`;
  const grade = timingGrade();
  el.timingGrade.textContent = grade.label;
  el.timingGrade.dataset.grade = grade.id;

  if (state.running && !state.busy) state.shake = Math.min(100, state.shake + delta * .0065);
  el.shakeFill.style.width = `${state.shake}%`;
  el.shakeButton.disabled = !state.running || state.busy || state.shake < 55;
  el.nudgeLeft.disabled = !state.running || state.busy || state.shake < 18;
  el.nudgeRight.disabled = !state.running || state.busy || state.shake < 18;
  requestAnimationFrame(animationLoop);
}

function timingGrade() {
  const distance = Math.abs(state.timingPosition - .5);
  if (distance <= .095) return { id: "perfect", label: "PERFECT", bonus: 75, pull: .018 };
  if (distance <= .25) return { id: "good", label: "GOOD", bonus: 30, pull: .011 };
  return { id: "risky", label: "RISKY", bonus: 0, pull: .005 };
}

function applyMachineForce(direction, strength, upward = 0) {
  balls.forEach((ball) => {
    Body.applyForce(ball, ball.position, {
      x: direction * strength * (.72 + state.rng() * .5),
      y: upward - state.rng() * Math.abs(upward) * .35,
    });
    Body.setAngularVelocity(ball, (state.rng() - .5) * .18);
  });
}

function nudge(direction) {
  if (!state.running || state.busy || state.shake < 18) return;
  state.shake -= 18;
  applyMachineForce(direction, .008, -.006);
  el.machine.classList.remove("nudge-left", "nudge-right");
  void el.machine.offsetWidth;
  el.machine.classList.add(direction < 0 ? "nudge-left" : "nudge-right");
  tone(145, .09, "square");
}

function shakeMachine() {
  if (!state.running || state.busy || state.shake < 55) return;
  state.shake -= 55;
  const pulse = (strength) => {
    balls.forEach((ball, index) => {
      const side = index % 2 ? 1 : -1;
      const horizontal = (state.rng() - .5) * strength + side * strength * .35;
      const vertical = -.065 - state.rng() * strength * 1.45;
      Body.applyForce(ball, ball.position, { x: horizontal, y: vertical });
      Body.setAngularVelocity(ball, (state.rng() - .5) * .3);
    });
  };
  pulse(.05);
  setTimeout(() => state.running && pulse(.04), 90);
  setTimeout(() => state.running && pulse(.032), 180);
  el.machine.classList.remove("shaking");
  void el.machine.offsetWidth;
  el.machine.classList.add("shaking");
  tone(110, .18, "sawtooth");
}

function pullTargetColors() {
  const wanted = new Set(state.orders.flatMap((order) => order.colors.map((color) => color.value)));
  balls.forEach((ball) => {
    if (!wanted.has(ball.gumball.value)) return;
    const dx = INTAKE.x - ball.position.x;
    const dy = INTAKE.y - ball.position.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    Body.applyForce(ball, ball.position, { x: dx / length * .024, y: dy / length * .024 });
  });
}

function createOrder(slot = 0) {
  state.orderSerial += 1;
  const roll = state.rng();
  const rushEligible = state.running && state.mode !== "precision" && state.seconds <= 30;
  if (roll < .16 && slot === 0) {
    const first = randomColor();
    let second = randomColor();
    while (second.value === first.value) second = randomColor();
    return { id: state.orderSerial, type: "recipe", colors: [first, second], progress: 0, created: performance.now(), label: "Recipe" };
  }
  if (roll < .34) {
    const first = randomColor();
    let second = randomColor();
    while (second.value === first.value) second = randomColor();
    return { id: state.orderSerial, type: "wild", colors: [first, second], progress: 0, created: performance.now(), label: "Either" };
  }
  const color = randomColor();
  return { id: state.orderSerial, type: rushEligible && roll > .72 ? "rush" : "single", colors: [color], progress: 0, created: performance.now(), label: rushEligible && roll > .72 ? "Rush" : "Pick" };
}

function fillOrderQueue() {
  while (state.orders.length < 3) state.orders.push(createOrder(state.orders.length));
}

function orderMatches(order, ball) {
  if (state.activePower === "bomb") return true;
  if (order.type === "recipe") return order.colors[order.progress].value === ball.value;
  return order.colors.some((color) => color.value === ball.value);
}

function renderOrders() {
  el.orderQueue.innerHTML = state.orders.map((order, index) => {
    const points = [100, 65, 40][index];
    const ballsMarkup = order.colors.map((color, colorIndex) => `<i class="queue-ball ${order.type === "recipe" && colorIndex < order.progress ? "done" : ""}" style="--ball:${color.value}"></i>`).join("");
    return `<div class="queue-order ${index === 0 ? "primary" : ""}"><span class="queue-rank">${index + 1}</span><div class="queue-balls">${ballsMarkup}</div><div><strong>${order.label}</strong><small>${order.type === "recipe" ? `${order.progress}/${order.colors.length}` : order.colors.map((c) => c.name.split(" ")[0]).join(" / ")}</small></div><b>+${points}${order.type === "rush" ? "×" : ""}</b></div>`;
  }).join("");
  el.orderValue.textContent = `+${100 * Math.max(1, state.combo || 1)}`;
}

function formatScore(value) { return String(Math.round(value)).padStart(4, "0"); }

function updateUI() {
  el.score.textContent = formatScore(state.score);
  const precision = state.mode === "precision";
  el.metricLabel.textContent = precision ? "Drops" : "Time";
  el.timer.textContent = precision ? String(state.dropsLeft).padStart(2, "0") : `0:${String(Math.max(0, state.seconds)).padStart(2, "0")}`;
  el.comboValue.textContent = `x${Math.max(1, state.combo)}`;
  el.comboBars.forEach((bar, index) => bar.classList.toggle("on", index < Math.min(state.combo, 5)));
  el.collectedCount.textContent = `${state.collected.length} / 8`;
  el.powerCharge.textContent = state.power ? "READY" : `${state.powerCharge} / 3`;
  el.timerStat.classList.toggle("warning", state.running && !precision && state.seconds <= 10);
  el.levelBadge.textContent = `LV ${level()}`;

  const progress = precision ? (18 - state.dropsLeft) / 18 : (MODES[state.mode].seconds - state.seconds) / MODES[state.mode].seconds;
  el.phaseFill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  if (!state.running) el.phaseLabel.textContent = "Warm up";
  else if ((!precision && state.seconds <= 10) || (precision && state.dropsLeft <= 4)) el.phaseLabel.textContent = "Sugar rush";
  else if (progress >= .34) el.phaseLabel.textContent = "Rush orders";
  else el.phaseLabel.textContent = "Warm up";
}

function updatePowerUI() {
  const power = state.power;
  el.powerButton.disabled = !state.running || state.busy || !power;
  el.powerButton.classList.toggle("ready", Boolean(power));
  el.powerName.textContent = power ? power.name : "Building charge";
  el.powerDescription.textContent = power ? power.description : "Match orders to earn a power-up";
  const icon = document.createElement("i");
  icon.setAttribute("data-lucide", power?.icon || "zap");
  el.powerButton.querySelector("svg, i")?.replaceWith(icon);
  window.lucide?.createIcons();
}

function tone(freq, duration, type = "sine", delay = 0) {
  if (state.muted) return;
  audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;
  gain.gain.setValueAtTime(.055, audioCtx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + delay + duration);
  oscillator.connect(gain).connect(audioCtx.destination);
  oscillator.start(audioCtx.currentTime + delay);
  oscillator.stop(audioCtx.currentTime + delay + duration);
}

function showToast(text, type = "match") {
  el.toast.textContent = text;
  el.toast.className = `toast ${type}`;
  void el.toast.offsetWidth;
  el.toast.classList.add("show");
}

function addToTray(color) {
  if (state.collected.length >= 8) state.collected.shift();
  state.collected.push(color);
  el.collection.forEach((slot, index) => {
    slot.innerHTML = state.collected[index] ? `<span style="background:${state.collected[index]}"></span>` : "";
  });
  if (state.collected.length === 8) unlockAchievement("tray_clear");
}

function confetti(count = 24) {
  const colors = COLORS.map((color) => color.value).concat("#ffd242");
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement("i");
    piece.className = "confetti";
    piece.style.left = `${15 + Math.random() * 70}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--drift", `${(Math.random() - .5) * 280}px`);
    piece.style.animationDelay = `${Math.random() * .3}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2300);
  }
}

function unlockAchievement(id) {
  if (!ACHIEVEMENTS[id] || profile.achievements.includes(id)) return;
  profile.achievements.push(id);
  profile.xp += 150;
  saveProfile();
  el.achievementName.textContent = ACHIEVEMENTS[id];
  el.achievementPop.classList.remove("show");
  void el.achievementPop.offsetWidth;
  el.achievementPop.classList.add("show");
  tone(659, .12, "triangle"); tone(880, .2, "triangle", .12);
}

function earnPowerCharge() {
  if (state.power) return;
  state.powerCharge += 1;
  if (state.powerCharge >= 3) {
    const available = state.mode === "precision" ? POWER_UPS.filter((power) => power.id !== "freeze") : POWER_UPS;
    state.power = available[Math.floor(state.rng() * available.length)];
    state.powerCharge = 0;
    showToast(`${state.power.name.toUpperCase()} READY`, "power");
  }
  updatePowerUI();
}

function usePower() {
  if (!state.running || state.busy || !state.power) return;
  const power = state.power;
  state.power = null;
  if (power.id === "freeze") {
    state.seconds += 4;
    showToast("FREEZE POP +4 SEC", "power");
  } else if (power.id === "magnet") {
    pullTargetColors();
    showToast("TARGET COLORS PULLED", "power");
  } else {
    state.activePower = power.id;
    showToast(`${power.name.toUpperCase()} ARMED`, "power");
  }
  tone(440, .12, "triangle"); tone(660, .18, "triangle", .1);
  updatePowerUI();
  updateUI();
}

function phaseMultiplier() {
  if (state.mode === "precision") return state.dropsLeft <= 4 ? 1.5 : 1;
  return state.seconds <= 10 ? 1.5 : 1;
}

function resolveDrop(gumball, grade) {
  state.totalDrops += 1;
  if (state.mode === "precision") state.dropsLeft -= 1;
  addToTray(gumball.value);

  if (gumball.gold) {
    state.goldMultiplier = Math.min(4, state.goldMultiplier * 2);
    state.score += 100;
    showToast(`GOLDEN! NEXT SCORE ×${state.goldMultiplier}`, "gold");
    confetti(18);
    tone(523, .12, "triangle"); tone(659, .12, "triangle", .1); tone(784, .2, "triangle", .2);
  } else {
    let matchIndex = state.orders.findIndex((order) => orderMatches(order, gumball));
    if (state.activePower === "bomb") matchIndex = Math.max(0, matchIndex);
    if (matchIndex >= 0) {
      const order = state.orders[matchIndex];
      const base = [100, 65, 40][matchIndex];
      const isRecipeStep = order.type === "recipe" && order.progress < order.colors.length - 1;
      if (isRecipeStep) {
        order.progress += 1;
        state.score += Math.round(35 * state.goldMultiplier);
        showToast(`RECIPE STEP +${Math.round(35 * state.goldMultiplier)}`, "match");
      } else {
        state.combo += 1;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.matches += 1;
        const speedBonus = performance.now() - order.created < 4500 ? 50 : 0;
        const rushBonus = order.type === "rush" ? 1.5 : 1;
        const double = state.activePower === "double" ? 2 : 1;
        const points = Math.round((base * Math.max(1, state.combo) + grade.bonus + speedBonus) * rushBonus * phaseMultiplier() * state.goldMultiplier * double);
        state.score += points;
        state.orders.splice(matchIndex, 1);
        fillOrderQueue();
        earnPowerCharge();
        showToast(`${grade.label} MATCH +${points}`, grade.id === "perfect" ? "perfect" : "match");
        tone(480 + state.combo * 28, .12, "triangle"); tone(700 + state.combo * 25, .16, "triangle", .1);
        if (state.combo >= 3) confetti(10);
        if (state.matches === 1) unlockAchievement("first_order");
        if (state.combo >= 5) unlockAchievement("streak_five");
      }
    } else {
      const consolation = Math.round(20 * phaseMultiplier());
      state.score += consolation;
      state.combo = 0;
      showToast(`TRAY BONUS +${consolation}`, "miss");
      tone(210, .12, "square");
    }
    if (grade.id === "perfect") {
      state.perfectDrops += 1;
      if (state.perfectDrops >= 5) unlockAchievement("perfect_five");
    }
    state.goldMultiplier = 1;
    state.activePower = null;
  }

  if (state.score >= 3000) unlockAchievement("score_3000");
  renderOrders();
  updateUI();
}

function replenishBall(index) {
  const body = makeBall(225 + state.rng() * 70, 62 + state.rng() * 18, index);
  balls.push(body);
  Composite.add(physics.world, body);
}

function dispense() {
  if (!state.running || state.busy) return;
  state.busy = true;
  el.drop.disabled = true;
  el.play.disabled = true;
  const grade = timingGrade();
  const likely = intakeCandidates()[0];
  const dx = INTAKE.x - likely.position.x;
  const dy = INTAKE.y - likely.position.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  Body.applyForce(likely, likely.position, { x: dx / distance * grade.pull, y: dy / distance * grade.pull });
  applyMachineForce(state.rng() > .5 ? 1 : -1, grade.id === "risky" ? .009 : .004, -.013);

  el.machine.classList.remove("turning");
  el.dispensed.classList.remove("drop");
  void el.machine.offsetWidth;
  el.machine.classList.add("turning");
  tone(120, .18, "square");

  setTimeout(() => {
    const selected = intakeCandidates()[0];
    const result = selected.gumball;
    const index = balls.indexOf(selected);
    balls.splice(index, 1);
    Composite.remove(physics.world, selected);
    el.canvas.dataset.lastExtracted = result.value;
    el.dispensed.style.backgroundColor = result.value;
    el.dispensed.classList.add("drop");
    tone(310, .08, "sine");
    setTimeout(() => replenishBall(index), 180);
    setTimeout(() => {
      resolveDrop(result, grade);
      state.busy = false;
      el.drop.disabled = false;
      el.play.disabled = false;
      updatePowerUI();
      if (state.pendingEnd || (state.mode === "precision" && state.dropsLeft <= 0)) endRound(true);
    }, 540);
  }, 360);
}

function configureMode(mode) {
  if (state.running || !MODES[mode]) return;
  state.mode = mode;
  el.modeButtons.forEach((button) => button.classList.toggle("selected", button.dataset.mode === mode));
  el.modeNote.textContent = MODES[mode].note;
  state.seconds = MODES[mode].seconds || 0;
  state.dropsLeft = MODES[mode].drops || 18;
  const best = profile.best[mode] || 0;
  el.best.textContent = formatScore(best);
  updateUI();
}

function startRound() {
  clearInterval(state.timerId);
  state.rng = state.mode === "daily" ? seededRandom(dailySeed()) : Math.random;
  state.running = true;
  state.busy = false;
  state.pendingEnd = false;
  state.score = 0;
  state.seconds = MODES[state.mode].seconds || 0;
  state.dropsLeft = MODES[state.mode].drops || 18;
  state.totalDrops = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.matches = 0;
  state.perfectDrops = 0;
  state.collected = [];
  state.orders = [];
  state.shake = 100;
  state.powerCharge = 0;
  state.power = null;
  state.activePower = null;
  state.goldMultiplier = 1;
  state.roundStartedAt = performance.now();
  el.collection.forEach((slot) => { slot.innerHTML = ""; });
  el.modal.classList.remove("open");
  el.modal.setAttribute("aria-hidden", "true");
  el.play.classList.add("active");
  el.playLabel.textContent = "DISPENSE";
  el.hint.textContent = "Intake candidates shifting";
  el.roundStatus.textContent = `${MODES[state.mode].label} in progress`;
  el.roundDot.classList.add("live");
  el.modeButtons.forEach((button) => { button.disabled = true; });
  resetPhysics();
  fillOrderQueue();
  renderOrders();
  updatePowerUI();
  updateUI();
  tone(392, .1, "triangle"); tone(523, .16, "triangle", .12);

  if (state.mode !== "precision") {
    state.timerId = setInterval(() => {
      state.seconds -= 1;
      updateUI();
      if (state.seconds <= 0) endRound();
      else if (state.seconds <= 5) tone(640, .07, "square");
    }, 1000);
  }
}

function medalFor(score) {
  if (score >= 5000) return "SUGAR LEGEND";
  if (score >= 3000) return "GOLD RUN";
  if (score >= 1600) return "SILVER RUN";
  return "BRONZE RUN";
}

function endRound(force = false) {
  if (!state.running && !force) return;
  if (state.busy && !force) {
    state.pendingEnd = true;
    clearInterval(state.timerId);
    return;
  }
  clearInterval(state.timerId);
  state.running = false;
  state.busy = false;
  state.pendingEnd = false;
  const previousBest = profile.best[state.mode] || 0;
  const newBest = Math.max(previousBest, state.score);
  profile.best[state.mode] = newBest;
  profile.totalScore += state.score;
  profile.totalOrders += state.matches;
  profile.games += 1;
  profile.xp += Math.round(state.score / 10) + state.matches * 12;
  if (state.mode === "daily") unlockAchievement("daily_run");
  saveProfile();

  el.best.textContent = formatScore(newBest);
  el.finalScore.textContent = formatScore(state.score);
  el.finalStreak.textContent = state.bestCombo;
  el.finalMatches.textContent = state.matches;
  el.finalAccuracy.textContent = `${state.totalDrops ? Math.round(state.matches / state.totalDrops * 100) : 0}%`;
  el.finalPerfect.textContent = state.perfectDrops;
  el.medal.textContent = medalFor(state.score);
  el.resultKicker.textContent = state.score > previousBest ? "NEW HIGH SCORE" : `${MODES[state.mode].label.toUpperCase()} COMPLETE`;
  el.nextGoal.textContent = state.score < 1600 ? "Reach 1,600 for silver" : state.bestCombo < 5 ? "Build a five-order streak" : `Beat ${formatScore(newBest + 200)}`;
  el.roundStatus.textContent = "Round complete";
  el.roundDot.classList.remove("live");
  el.timerStat.classList.remove("warning");
  el.play.classList.remove("active");
  el.playLabel.textContent = "START ROUND";
  el.hint.textContent = "Intake ready";
  el.modeButtons.forEach((button) => { button.disabled = false; });
  updatePowerUI();
  updateUI();
  applyTheme(profile.theme);
  setTimeout(() => {
    el.modal.classList.add("open");
    el.modal.setAttribute("aria-hidden", "false");
    el.replay.focus();
    confetti(state.score >= 1600 ? 36 : 18);
  }, 180);
}

function applyTheme(index) {
  const available = unlockedThemes();
  profile.theme = Math.min(index, available - 1);
  document.body.dataset.theme = ["classic", "berry", "mint"][profile.theme];
  el.theme.title = `Machine style ${profile.theme + 1} of ${available}`;
  saveProfile();
}

el.play.addEventListener("click", () => state.running ? dispense() : startRound());
el.drop.addEventListener("click", dispense);
el.replay.addEventListener("click", startRound);
el.nudgeLeft.addEventListener("click", () => nudge(-1));
el.nudgeRight.addEventListener("click", () => nudge(1));
el.shakeButton.addEventListener("click", shakeMachine);
el.powerButton.addEventListener("click", usePower);
el.modeButtons.forEach((button) => button.addEventListener("click", () => configureMode(button.dataset.mode)));

document.addEventListener("keydown", (event) => {
  if (el.modal.classList.contains("open")) return;
  if (event.code === "Space" && !event.repeat) {
    event.preventDefault();
    state.running ? dispense() : startRound();
  } else if (event.code === "ArrowLeft" && state.running) {
    event.preventDefault();
    nudge(-1);
  } else if (event.code === "ArrowRight" && state.running) {
    event.preventDefault();
    nudge(1);
  } else if (["ArrowUp", "ArrowDown", "KeyS"].includes(event.code) && state.running) {
    event.preventDefault();
    shakeMachine();
  } else if (event.code === "KeyP" && state.running) {
    event.preventDefault();
    usePower();
  }
});

el.sound.addEventListener("click", () => {
  state.muted = !state.muted;
  el.sound.setAttribute("aria-label", state.muted ? "Turn sound on" : "Mute sound");
  el.sound.title = state.muted ? "Turn sound on" : "Mute sound";
  el.sound.innerHTML = `<i data-lucide="${state.muted ? "volume-x" : "volume-2"}"></i>`;
  window.lucide?.createIcons();
});

el.theme.addEventListener("click", () => {
  const available = unlockedThemes();
  applyTheme((profile.theme + 1) % available);
  showToast(available === 1 ? "MORE STYLES UNLOCK AT LEVEL 3" : `MACHINE STYLE ${profile.theme + 1}`, "power");
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
applyTheme(profile.theme);
configureMode("rush");
state.rng = Math.random;
resetPhysics();
fillOrderQueue();
renderOrders();
updatePowerUI();
updateUI();
requestAnimationFrame(animationLoop);
