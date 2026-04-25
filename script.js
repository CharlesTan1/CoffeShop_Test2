// =============================================================
//  POLYFILL for roundRect
// =============================================================
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    return this;
  };
}

// =============================================================
//  CANVAS + SCALING
// =============================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const LW = 800, LH = 520;
let SCALE = 1;

function resize() {
  SCALE = Math.min(window.innerWidth / LW, window.innerHeight / LH);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(LW * SCALE * dpr);
  canvas.height = Math.round(LH * SCALE * dpr);
  canvas.style.width = LW * SCALE + 'px';
  canvas.style.height = LH * SCALE + 'px';
  ctx.setTransform(SCALE * dpr, 0, 0, SCALE * dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);

function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / SCALE, y: (e.clientY - r.top) / SCALE };
}

// =============================================================
//  DRAW HELPERS
// =============================================================
function rect(x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x | 0, y | 0, w, h);
}
function circle(x, y, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x | 0, y | 0, r, 0, Math.PI * 2);
  ctx.fill();
}
function fr(txt, x, y, sz, col, align = 'left') {
  ctx.font = sz + 'px "Fredoka One", cursive';
  ctx.fillStyle = col;
  ctx.textAlign = align;
  ctx.fillText(txt, x | 0, y | 0);
}
function px(txt, x, y, sz, col, align = 'left') {
  ctx.font = sz + 'px "Press Start 2P", monospace';
  ctx.fillStyle = col;
  ctx.textAlign = align;
  ctx.fillText(txt, x | 0, y | 0);
}

const C = {
  gold: '#f4a820',
  goldDk: '#c8820a',
  cream: '#fdf6ec',
  brown: '#3d1f0a',
  green: '#4caf76',
  red: '#e05252',
  blue: '#4a90e2',
  purple: '#aa66cc',
};

const COUNTER_Y = Math.round(LH * 0.55) - 10;
const QUEUE_START_X = 620;
const QUEUE_STEP = 115;

// =============================================================
//  MACHINES & DRINKS
// =============================================================
const MACHINES = [
  { drinkId: 'espresso', x: 50, y: COUNTER_Y - 105, hovered: false, brewing: false, progress: 0, brewElapsed: 0, brewTotal: 0 },
  { drinkId: 'latte', x: 200, y: COUNTER_Y - 105, hovered: false, brewing: false, progress: 0, brewElapsed: 0, brewTotal: 0 },
  { drinkId: 'frappuccino', x: 360, y: COUNTER_Y - 105, hovered: false, brewing: false, progress: 0, brewElapsed: 0, brewTotal: 0 },
  { drinkId: 'tea', x: 520, y: COUNTER_Y - 105, hovered: false, brewing: false, progress: 0, brewElapsed: 0, brewTotal: 0 },
];

const DRINKS_DEF = [
  { id: 'espresso', brew: 2.2, reward: 8 },
  { id: 'latte', brew: 3.2, reward: 12 },
  { id: 'frappuccino', brew: 4.2, reward: 18 },
  { id: 'tea', brew: 2.7, reward: 10 },
];

// HEAVILY INCREASED UPGRADE COSTS (Hard Mode)
const UPGRADES_DEF = [
  { id: 'grinder', name: 'Turbo Grinder', icon: '⚡', desc: 'Brew 30% faster', cost: 250, maxLvl: 3, effect: 'speed' },
  { id: 'music', name: 'Cozy Playlist', icon: '🎵', desc: '+35% patience', cost: 300, maxLvl: 2, effect: 'patience' },
  { id: 'loyalty', name: 'Loyalty Cards', icon: '💳', desc: '+$3 per order', cost: 380, maxLvl: 3, effect: 'bonus' },
  { id: 'seats', name: 'Extra Seating', icon: '🪑', desc: 'Queue +1 customer', cost: 400, maxLvl: 2, effect: 'slots' },
  { id: 'barista', name: 'Hire Barista', icon: '👩‍🍳', desc: 'Auto-brew (every 6s)', cost: 700, maxLvl: 1, effect: 'auto' },
  { id: 'marketing', name: 'Social Media', icon: '📱', desc: '+30% customers', cost: 550, maxLvl: 2, effect: 'spawn' },
  { id: 'quality', name: 'Premium Beans', icon: '✨', desc: 'Drinks +$3 value', cost: 650, maxLvl: 3, effect: 'price' },
  { id: 'expansion', name: 'Shop Expansion', icon: '🏢', desc: 'Max queue +2', cost: 800, maxLvl: 1, effect: 'slots2' },
];

// =============================================================
//  GAME STATE – with Day Selection & Unlock System
// =============================================================
let G = {};

function initGame() {
  G = {
    state: 'daySelect',
    coins: 400,
    served: 0,
    missed: 0,
    streak: 0,
    bestStreak: 0,
    customers: [],
    nextCid: 0,
    spawnT: 0,
    brewSpeed: 1.0,
    patienceMul: 1.0,
    coinBonus: 0,
    maxQ: 4,
    upgrades: Object.fromEntries(UPGRADES_DEF.map(u => [u.id, 0])),
    running: false,
    reputation: 60,
    shopLevel: 1,
    prestigePoints: 0,
    netWorth: 0,
    autoBrewTimer: 0,
    drinkPriceMod: 0,
    spawnMod: 1.0,
    totalEarned: 0,
    currentDay: 1,
    dailyProfitGoal: 1000,
    dailyProfitEarned: 0,
    dayBonusReceived: false,
    showDayCompleteMenu: false,
    unlockedDays: 1,
    selectedDay: 1,
    daySelectButtons: [],
    goBtn: null,
  };
  MACHINES.forEach(m => {
    m.brewing = false;
    m.progress = 0;
    m.hovered = false;
    m.brewElapsed = 0;
    m.brewTotal = 0;
  });
  particles = [];
  floatCups = [];
}

function unlockNextDay() {
  if (G.currentDay + 1 > G.unlockedDays) {
    G.unlockedDays = G.currentDay + 1;
    addLog(`🔓 NEW DAY UNLOCKED! Day ${G.unlockedDays} is now available.`, 'prestige');
  }
}

function startDay(dayNumber) {
  if (dayNumber > G.unlockedDays) {
    addLog(`Day ${dayNumber} is locked! Complete Day ${dayNumber - 1} first.`, 'bad');
    return false;
  }
  G.state = 'playing';
  G.running = true;
  G.currentDay = dayNumber;
  G.dailyProfitGoal = Math.floor(1000 + (dayNumber - 1) * 600 + G.prestigePoints * 150);
  G.dailyProfitEarned = 0;
  G.dayBonusReceived = false;
  G.showDayCompleteMenu = false;
  G.served = 0;
  G.missed = 0;
  G.streak = 0;
  G.customers = [];
  G.spawnT = 0;
  G.reputation = Math.min(100, 60 + G.prestigePoints * 3);
  MACHINES.forEach(m => {
    m.brewing = false;
    m.progress = 0;
    m.brewElapsed = 0;
  });
  updateUpgradePanel();
  document.getElementById('event-log').classList.add('visible');
  document.getElementById('upgrade-panel').classList.add('visible');
  for (let i = 0; i < 2; i++) spawnCustomer();
  addLog(`🌞 DAY ${G.currentDay} START! Goal: $${G.dailyProfitGoal} (No time limit)`, 'day');
  return true;
}

function completeDay(endEarly = false) {
  if (!G.running) return;
  let bonusCoins = 0;
  let repBonus = 8;
  if (endEarly) {
    let excess = G.dailyProfitEarned - G.dailyProfitGoal;
    bonusCoins = Math.floor(excess * 0.4) + 200;
    addLog(`🏁 Day ${G.currentDay} ended early! Bonus: +${bonusCoins} coins`, 'prestige');
    unlockNextDay();
  } else {
    bonusCoins = 120 + G.currentDay * 15;
    addLog(`🏁 Day ${G.currentDay} completed! Bonus: +${bonusCoins} coins`, 'prestige');
    unlockNextDay();
  }
  G.coins += bonusCoins;
  G.reputation = Math.min(100, G.reputation + repBonus);
  G.totalEarned += bonusCoins;
  if (G.currentDay % 2 === 0 && G.currentDay > 0) {
    G.prestigePoints++;
    addLog(`🏅 PERMANENT PRESTIGE +1! (Total: ${G.prestigePoints})`, 'prestige');
  }
  updateShopLevel();
  updateUpgradePanel();
  G.state = 'daySelect';
  G.running = false;
  G.showDayCompleteMenu = false;
  document.getElementById('upgrade-panel').classList.remove('visible');
  document.getElementById('event-log').classList.remove('visible');
}

function checkDailyGoal() {
  if (!G.running) return;
  if (G.dailyProfitEarned >= G.dailyProfitGoal && !G.dayBonusReceived && !G.showDayCompleteMenu) {
    G.dayBonusReceived = true;
    G.showDayCompleteMenu = true;
    addLog(`🎉 DAILY GOAL REACHED! Choose: End Day (unlock next) or Continue`, 'prestige');
  }
}

function prestigeReset() {
  if (G.prestigePoints < 1 && G.netWorth < 2000) {
    addLog("Need at least 1 Prestige Point or $2000 net worth to Prestige!", 'bad');
    return;
  }
  G.prestigePoints++;
  addLog(`✨ PRESTIGE LEVEL ${G.prestigePoints} ✨ Permanent income +20%`, 'prestige');
  G.coins = 400;
  G.served = 0;
  G.missed = 0;
  G.streak = 0;
  G.customers = [];
  G.upgrades = Object.fromEntries(UPGRADES_DEF.map(u => [u.id, 0]));
  G.brewSpeed = 1.0;
  G.patienceMul = 1.0;
  G.coinBonus = 0;
  G.maxQ = 4;
  G.reputation = 60;
  G.shopLevel = 1;
  G.netWorth = 0;
  G.autoBrewTimer = 0;
  G.drinkPriceMod = 0;
  G.spawnMod = 1.0;
  G.totalEarned = 0;
  G.unlockedDays = 1;
  G.currentDay = 1;
  G.state = 'daySelect';
  G.running = false;
  MACHINES.forEach(m => {
    m.brewing = false;
    m.progress = 0;
  });
  updateUpgradePanel();
  addLog("Game reset with prestige bonus! +20% income per level", 'good');
}

function updateShopLevel() {
  let totalEarned = G.totalEarned;
  let newLevel = 1 + Math.floor(totalEarned / 1500);
  if (newLevel > G.shopLevel) {
    G.shopLevel = newLevel;
    addLog(`🏆 Shop reached Level ${G.shopLevel}!`, 'prestige');
  }
  G.netWorth = G.coins;
}

// =============================================================
//  CUSTOMERS (no timer, patience balanced)
// =============================================================
function activeCustomers() {
  return G.customers.filter(c => c.state === 'walking' || c.state === 'waiting');
}
function getDesiredX(customer) {
  const waiting = activeCustomers();
  const index = waiting.findIndex(c => c.id === customer.id);
  if (index === -1) return QUEUE_START_X + 50;
  return QUEUE_START_X - index * QUEUE_STEP;
}
function spawnCustomer() {
  if (!G.running) return;
  let maxSlots = G.maxQ + (G.upgrades.expansion * 2);
  if (activeCustomers().length >= maxSlots) return;
  let drink = DRINKS_DEF[Math.floor(Math.random() * DRINKS_DEF.length)];
  let patienceBonus = (G.reputation - 50) / 100;
  let patience = 65 + patienceBonus * 35;
  G.customers.push({
    id: G.nextCid++,
    seed: Math.floor(Math.random() * 99999),
    drink,
    patience: Math.min(100, Math.max(25, patience)),
    state: 'walking',
    x: LW + 40,
    floatY: 0,
    walkAnim: 0,
    happy: false,
    scale: 0.88 + Math.random() * 0.22,
  });
}
function updateCustomers(dt) {
  let decay = 0.09 / (G.patienceMul * (1 + (G.reputation - 50) / 200));
  const toRemove = [];
  for (let i = 0; i < G.customers.length; i++) {
    const c = G.customers[i];
    if (c.state === 'walking') {
      const targetX = getDesiredX(c);
      c.x += (targetX - c.x) * 0.12;
      c.walkAnim += 0.16;
      if (Math.abs(c.x - targetX) < 1.5) {
        c.x = targetX;
        c.state = 'waiting';
      }
    } else if (c.state === 'waiting') {
      const targetX = getDesiredX(c);
      c.x += (targetX - c.x) * 0.2;
      c.patience -= decay;
      if (c.patience <= 0) {
        c.state = 'leaving';
        addLog('😤 Customer left!', 'bad');
        G.missed++;
        G.streak = 0;
        G.reputation = Math.max(0, G.reputation - 3);
        updateUpgradePanel();
      }
    } else if (c.state === 'leaving') {
      c.x += 4.2;
      if (c.x > LW + 80) toRemove.push(i);
    } else if (c.state === 'served') {
      c.floatY -= 2.2;
      c.x += 1.8;
      if (c.floatY < -90) toRemove.push(i);
    }
  }
  for (let i = toRemove.length - 1; i >= 0; i--) G.customers.splice(toRemove[i], 1);
}

// =============================================================
//  MACHINES + Auto Brew
// =============================================================
function brewDrink(m) {
  if (m.brewing) return;
  const def = DRINKS_DEF.find(d => d.id === m.drinkId);
  const cust = G.customers.find(c => c.drink.id === m.drinkId && c.state === 'waiting');
  if (!cust) {
    addLog('No one wants that!', 'bad');
    return;
  }
  m.brewing = true;
  m.progress = 0;
  m.brewElapsed = 0;
  let brewTime = def.brew * G.brewSpeed;
  if (G.upgrades.barista) brewTime *= 0.65;
  m.brewTotal = brewTime;
}
function updateMachines(dt) {
  if (G.upgrades.barista && G.running) {
    G.autoBrewTimer += dt;
    if (G.autoBrewTimer >= 6.0) {
      G.autoBrewTimer = 0;
      let available = MACHINES.filter(m => !m.brewing && G.customers.some(c => c.drink.id === m.drinkId && c.state === 'waiting'));
      if (available.length) {
        let chosen = available[Math.floor(Math.random() * available.length)];
        brewDrink(chosen);
        addLog("🤖 Barista started brewing " + chosen.drinkId, 'good');
      }
    }
  }
  for (let m of MACHINES) {
    if (!m.brewing) continue;
    m.brewElapsed += dt;
    m.progress = Math.min(100, (m.brewElapsed / m.brewTotal) * 100);
    if (m.brewElapsed >= m.brewTotal) {
      m.brewing = false;
      m.progress = 0;
      const def = DRINKS_DEF.find(d => d.id === m.drinkId);
      const targetIndex = G.customers.findIndex(c => c.drink.id === m.drinkId && c.state === 'waiting');
      if (targetIndex !== -1) {
        const target = G.customers[targetIndex];
        let bonus = G.coinBonus + (G.streak >= 3 ? 3 : 0);
        let priceMod = G.drinkPriceMod + (G.upgrades.quality * 3);
        let prestigeBonus = 1 + G.prestigePoints * 0.2;
        let reward = Math.floor((def.reward + priceMod + bonus) * prestigeBonus);
        G.coins += reward;
        G.totalEarned += reward;
        G.served++;
        G.streak++;
        G.reputation = Math.min(100, G.reputation + 1);
        if (G.streak > G.bestStreak) G.bestStreak = G.streak;
        target.state = 'served';
        target.floatY = 0;
        spawnCoins(m.x + 35, m.y + 40, reward);
        spawnCup(m.x + 35, m.y + 30, m.drinkId);
        addLog(`☕ Served! +$${reward} ${G.streak >= 3 ? '🔥x' + G.streak : ''}`, 'good');
        G.dailyProfitEarned += reward;
        checkDailyGoal();
        updateShopLevel();
        updateUpgradePanel();
      }
    }
  }
}

// =============================================================
//  PARTICLES, SCENE, CUSTOMER DRAWING
// =============================================================
let particles = [],
  floatCups = [];
function spawnCoins(x, y, amount) {
  for (let i = 0; i < 8; i++) {
    let a = (Math.PI * 2 / 8) * i;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * (1.5 + Math.random() * 2.5),
      vy: Math.sin(a) * (1.5 + Math.random() * 2.5) - 2,
      life: 1,
      decay: 0.022,
      col: '#f4a820',
      r: 4 + Math.random() * 3,
      type: 'circle',
    });
  }
  particles.push({ x, y, vx: 0, vy: -1.6, life: 1, decay: 0.017, col: '#f4a820', text: '+$' + amount, size: 15, type: 'text' });
}
function spawnCup(x, y, id) {
  floatCups.push({ x, y, id, life: 1, decay: 0.022, vy: -2 });
}
function updateParticles() {
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.09;
    p.life -= p.decay;
  });
}
function updateCups() {
  floatCups = floatCups.filter(c => c.life > 0);
  floatCups.forEach(c => {
    c.y += c.vy;
    c.vy *= 0.94;
    c.life -= c.decay;
  });
}
function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    if (p.type === 'text') fr(p.text, p.x, p.y, p.size, p.col, 'center');
    else circle(p.x, p.y, p.r * p.life, p.col);
  });
  ctx.globalAlpha = 1;
}
function drawCups() {
  const emap = {
    espresso: '☕',
    latte: '🥛',
    frappuccino: '🧊',
    tea: '🍵',
  };
  floatCups.forEach(c => {
    ctx.globalAlpha = c.life;
    ctx.font = '26px serif';
    ctx.textAlign = 'center';
    ctx.fillText(emap[c.id] || '☕', c.x | 0, c.y | 0);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// =============================================================
//  SCENE DRAWING (condensed but complete)
// =============================================================
function drawScene() {
  const wg = ctx.createLinearGradient(0, 0, 0, LH * 0.55);
  wg.addColorStop(0, '#e8c87a');
  wg.addColorStop(1, '#d4a84a');
  ctx.fillStyle = wg;
  ctx.fillRect(0, 0, LW, LH * 0.55);
  ctx.globalAlpha = 0.06;
  for (let x = 0; x < LW; x += 28) rect(x, 0, 14, LH * 0.55, '#7a4010');
  ctx.globalAlpha = 1;
  const fg = ctx.createLinearGradient(0, LH * 0.55, 0, LH);
  fg.addColorStop(0, '#c4924a');
  fg.addColorStop(1, '#a06830');
  ctx.fillStyle = fg;
  ctx.fillRect(0, LH * 0.55, LW, LH * 0.45);
  ctx.globalAlpha = 0.15;
  for (let x = 0; x < LW; x += 48) rect(x, LH * 0.55, 2, LH * 0.45, '#fff');
  for (let y = LH * 0.55; y < LH; y += 40) rect(0, y, LW, 2, '#fff');
  ctx.globalAlpha = 1;
  drawWindow(55, 35, 120, 130);
  drawWindow(LW - 195, 35, 120, 130);
  drawChalkboard(LW / 2 - 72, 28, 144, 94);
  drawCounter();
  MACHINES.forEach((m, i) => {
    if (i === 0) drawMachineEspresso(m);
    else if (i === 1) drawMachineLatte(m);
    else if (i === 2) drawMachineFrap(m);
    else drawMachineTea(m);
  });
}
function drawWindow(x, y, w, h) {
  ctx.fillStyle = '#5a3010';
  ctx.fillRect(x - 7, y - 7, w + 14, h + 14);
  let gl = ctx.createLinearGradient(x, y, x + w, y + h);
  gl.addColorStop(0, '#c8eeff');
  gl.addColorStop(1, '#7ac8ff');
  ctx.fillStyle = gl;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 0.28;
  rect(x + 5, y + 5, 14, h - 10, '#fff');
  ctx.globalAlpha = 1;
  rect(x + w / 2 - 3, y, 6, h, '#5a3010');
  rect(x, y + h / 2 - 3, w, 6, '#5a3010');
  rect(x - 7, y - 7, w + 14, 14, '#b03030');
  ctx.globalAlpha = 0.55;
  circle(x + w * 0.75, y + 22, 15, '#ffe066');
  ctx.globalAlpha = 1;
}
function drawChalkboard(x, y, w, h) {
  rect(x - 4, y - 4, w + 8, h + 8, '#5a3810');
  rect(x, y, w, h, '#2d4a2a');
  px('MENU', x + w / 2, y + 20, 7, '#f4e88a', 'center');
  ctx.globalAlpha = 0.75;
  px('Espresso  $8', x + w / 2, y + 36, 5, '#fff', 'center');
  px('Latte    $12', x + w / 2, y + 50, 5, '#fff', 'center');
  px('Frappe   $18', x + w / 2, y + 64, 5, '#fff', 'center');
  px('Tea      $10', x + w / 2, y + 78, 5, '#fff', 'center');
  ctx.globalAlpha = 1;
}
function drawCounter() {
  let cg = ctx.createLinearGradient(0, COUNTER_Y, 0, COUNTER_Y + 110);
  cg.addColorStop(0, '#b06030');
  cg.addColorStop(0.3, '#7a4010');
  cg.addColorStop(1, '#5a2808');
  ctx.fillStyle = cg;
  ctx.fillRect(0, COUNTER_Y, LW, 110);
  rect(0, COUNTER_Y, LW, 6, '#c87840');
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < LW; i += 64) rect(i, COUNTER_Y + 10, 3, 100, '#fff');
  ctx.globalAlpha = 1;
  rect(0, COUNTER_Y + 104, LW, 6, '#2a1000');
}
function drawSteam(x, y, col = 'rgba(255,255,255,0.5)') {
  let t = Date.now() / 900;
  for (let i = 0; i < 4; i++) {
    let rise = (t + i * 0.3) % 1;
    ctx.globalAlpha = (1 - rise) * 0.65;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x + Math.sin(t * 2 + i) * 5 + i * 4, y - rise * 28, 3 + rise * 3, 5 + rise * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawBrewBar(x, y, w, progress) {
  rect(x, y, w, 7, '#1a0800');
  if (progress > 0) {
    let g = ctx.createLinearGradient(x, y, x + (progress / 100) * w, y);
    g.addColorStop(0, '#c87830');
    g.addColorStop(1, '#f4a820');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, (progress / 100) * w, 7);
  }
  ctx.strokeStyle = 'rgba(244,168,32,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, 7);
}
function machineGlow(m, x, y, w, h) {
  if (m.hovered || m.brewing) {
    ctx.globalAlpha = m.brewing ? 0.22 : 0.13;
    ctx.fillStyle = '#f4a820';
    ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
    ctx.globalAlpha = 1;
  }
}
function drawMachineEspresso(m) {
  const { x, y } = m;
  machineGlow(m, x, y, 68, 85);
  let g = ctx.createLinearGradient(x, y, x + 68, y + 85);
  g.addColorStop(0, '#909090');
  g.addColorStop(1, '#464646');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, 68, 85);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, 68, 85);
  ctx.fillStyle = '#686868';
  ctx.beginPath();
  ctx.ellipse(x + 34, y + 2, 26, 13, 0, Math.PI, 0);
  ctx.fill();
  rect(x + 7, y + 10, 28, 20, '#1a3a1a');
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 7, y + 10, 28, 20);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++)
      circle(x + 13 + i * 10, y + 17 + j * 8, 2.5, m.brewing ? '#00ff44' : '#002200');
  circle(x + 52, y + 22, 8, '#333');
  circle(x + 52, y + 22, 4, '#666');
  rect(x + 18, y + 52, 32, 16, '#2a2a2a');
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 18, y + 52, 32, 16);
  rect(x + 30, y + 68, 8, 20, '#1a1a1a');
  rect(x + 8, y + 78, 52, 8, '#555');
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 8, y + 78, 52, 8);
  if (m.brewing) {
    rect(x + 33, y + 62, 3, 4, '#4a2000');
    drawSteam(x + 28, y - 8);
  }
  fr('Espresso', x + 34, y + 102, 10, C.cream, 'center');
  fr('$8  Click!', x + 34, y + 115, 9, C.gold, 'center');
  drawBrewBar(x, y + 120, 68, m.progress);
}
function drawMachineLatte(m) {
  const { x, y } = m;
  machineGlow(m, x, y, 72, 85);
  let g = ctx.createLinearGradient(x, y, x + 72, y + 85);
  g.addColorStop(0, '#e8d0a0');
  g.addColorStop(1, '#b89060');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, 72, 85);
  ctx.strokeStyle = '#7a5020';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, 72, 85);
  rect(x - 15, y + 5, 20, 68, '#c0c0c0');
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 15, y + 5, 20, 68);
  circle(x - 5, y + 5, 9, '#bbb');
  circle(x - 5, y + 5, 5, '#eee');
  rect(x + 3, y + 38, 5, 34, '#888');
  circle(x + 5, y + 73, 5, '#666');
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i === 0 && m.brewing ? '#ffcc00' : '#cc8844';
    ctx.beginPath();
    ctx.arc(x + 14 + i * 16, y + 22, 6, 0, Math.PI * 2);
    ctx.fill();
    circle(x + 14 + i * 16, y + 22, 3, i === 0 && m.brewing ? '#fff' : '#aa6622');
  }
  rect(x + 20, y + 56, 30, 20, '#8a5a20');
  ctx.strokeStyle = '#5a3010';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 20, y + 56, 30, 20);
  if (m.brewing) drawSteam(x + 6, y - 8, 'rgba(255,255,255,0.4)');
  fr('Latte', x + 36, y + 102, 10, C.cream, 'center');
  fr('$12  Click!', x + 36, y + 115, 9, C.gold, 'center');
  drawBrewBar(x, y + 120, 72, m.progress);
}
function drawMachineFrap(m) {
  const { x, y } = m;
  machineGlow(m, x, y, 68, 90);
  let g = ctx.createLinearGradient(x, y, x + 68, y + 90);
  g.addColorStop(0, '#aaccff');
  g.addColorStop(1, '#5588cc');
  ctx.fillStyle = g;
  ctx.fillRect(x + 5, y + 20, 58, 70);
  ctx.strokeStyle = '#3355aa';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 5, y + 20, 58, 70);
  ctx.fillStyle = m.brewing ? 'rgba(100,200,255,0.65)' : 'rgba(180,230,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(x + 14, y);
  ctx.lineTo(x + 54, y);
  ctx.lineTo(x + 61, y + 22);
  ctx.lineTo(x + 7, y + 22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5588cc';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (m.brewing) {
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 4; i++) {
      rect(x + 17 + i * 8, y + 5, 8, 8, '#cceeff');
      ctx.strokeStyle = '#88bbdd';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 17 + i * 8, y + 5, 8, 8);
    }
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = i === 0 && m.brewing ? '#00ccff' : '#336699';
    ctx.beginPath();
    ctx.arc(x + 22 + i * 24, y + 57, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  circle(x + 34, y + 76, 10, '#224488');
  circle(x + 34, y + 76, 5, '#aaccff');
  if (m.brewing) {
    ctx.save();
    ctx.translate(x + 34, y + 76);
    ctx.rotate(Date.now() / 180);
    rect(-1, -8, 2, 6, '#fff');
    ctx.restore();
  }
  fr('Frappuccino', x + 34, y + 102, 9, C.cream, 'center');
  fr('$18  Click!', x + 34, y + 115, 9, C.gold, 'center');
  drawBrewBar(x, y + 120, 68, m.progress);
}
function drawMachineTea(m) {
  const { x, y } = m;
  machineGlow(m, x, y, 70, 85);
  let g = ctx.createLinearGradient(x, y, x + 70, y + 85);
  g.addColorStop(0, '#88cc66');
  g.addColorStop(1, '#448822');
  ctx.fillStyle = g;
  ctx.fillRect(x + 5, y + 12, 62, 72);
  ctx.strokeStyle = '#224411';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 5, y + 12, 62, 72);
  ctx.fillStyle = '#448822';
  ctx.beginPath();
  ctx.moveTo(x + 67, y + 32);
  ctx.quadraticCurveTo(x + 88, y + 27, x + 85, y + 52);
  ctx.quadraticCurveTo(x + 72, y + 52, x + 67, y + 47);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#224411';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x - 3, y + 44, 18, -Math.PI * 0.6, Math.PI * 0.6);
  ctx.stroke();
  rect(x + 10, y + 9, 52, 8, '#55aa33');
  ctx.strokeStyle = '#224411';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 10, y + 9, 52, 8);
  circle(x + 36, y + 9, 5, '#77cc55');
  rect(x + 28, y + 16, 14, 3, '#eee');
  rect(x + 33, y + 19, 2, 12, '#aa5511');
  rect(x + 30, y + 31, 8, 12, '#aa5511');
  if (m.brewing) drawSteam(x + 32, y - 8, 'rgba(200,255,180,0.5)');
  fr('Tea', x + 36, y + 102, 10, C.cream, 'center');
  fr('$10  Click!', x + 36, y + 115, 9, C.gold, 'center');
  drawBrewBar(x, y + 120, 70, m.progress);
}

// =============================================================
//  CUSTOMER DRAWING
// =============================================================
function drawCustomer(x, y, seed, scale, happy, walk) {
  let r = (n) => {
    let s = seed * 9301 + 49297;
    s = (s * 9301 + 49297) % 233280;
    seed = s;
    return Math.floor(s / 233280 * n);
  };
  let skin = ['#f5c5a0', '#e8a070', '#c07840', '#8a5030', '#5a3018'][r(5)];
  let hair = ['#1a1008', '#8a4010', '#f4d060', '#cc4488', '#444', '#ff6622'][r(6)];
  let shirt = ['#e05050', '#5080e0', '#50c060', '#e0a020', '#c050c0', '#40a0c0', '#ffffff'][r(7)];
  let pant = ['#2a3a6a', '#1a1a1a', '#6a3a2a', '#3a6a3a', '#c0c0c0'][r(5)];
  let sw = Math.sin(walk) * 5 * scale;
  ctx.save();
  ctx.translate(x | 0, y | 0);
  ctx.scale(scale, scale);
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, 52, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  rect(-9, 34 + sw, 10, 20, pant);
  rect(1, 34 - sw, 10, 20, pant);
  rect(-10, 52 + sw, 12, 5, '#1a1008');
  rect(0, 52 - sw, 12, 5, '#1a1008');
  rect(-12, 16, 24, 22, shirt);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-4, 16);
  ctx.lineTo(4, 16);
  ctx.lineTo(0, 24);
  ctx.closePath();
  ctx.fill();
  rect(-18, 18 + sw * 0.3, 7, 18, skin);
  rect(11, 18 - sw * 0.3, 7, 18, skin);
  circle(-14 + 3, 35 + sw * 0.3, 4, skin);
  circle(14 + 3, 35 - sw * 0.3, 4, skin);
  circle(0, 8, 13, skin);
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(0, -2, 13, 8, 0, Math.PI, 0);
  ctx.fill();
  if (r(2)) {
    rect(-13, -4, 5, 9, hair);
    rect(8, -4, 5, 9, hair);
  }
  if (happy) {
    ctx.strokeStyle = '#1a0808';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-5, 8, 3, -Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5, 8, 3, -Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 13, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    circle(-5, 8, 2, '#1a0808');
    circle(5, 8, 2, '#1a0808');
    ctx.strokeStyle = '#1a0808';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-4, 14);
    ctx.lineTo(4, 14);
    ctx.stroke();
  }
  if (r(3) === 0) {
    ctx.strokeStyle = '#1a0808';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-5, 8, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5, 8, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-1, 8);
    ctx.lineTo(1, 8);
    ctx.stroke();
  }
  if (r(4) === 0) {
    rect(-12, -14, 24, 7, hair);
    rect(-15, -16, 30, 5, hair);
  }
  ctx.restore();
}
function drawCustomers() {
  let baseY = COUNTER_Y - 18;
  for (let c of G.customers) {
    if (!c) continue;
    let drawY = baseY + c.floatY;
    if (c.state === 'waiting') {
      let bx = c.x - 30,
        by = drawY - c.scale * 85;
      rect(bx - 2, by - 2, 64, 10, 'rgba(0,0,0,0.4)');
      let pp = Math.min(1, Math.max(0, c.patience / 100));
      rect(bx, by, 60 * pp, 6, pp > 0.5 ? '#4caf76' : pp > 0.25 ? '#f4a820' : '#e05252');
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, 60, 6);
      let name = { espresso: 'Espresso', latte: 'Latte', frappuccino: 'Frappe', tea: 'Tea' }[c.drink.id];
      let emoji = { espresso: '☕', latte: '🥛', frappuccino: '🧊', tea: '🍵' }[c.drink.id];
      let bw = name.length * 8 + 26,
        bbx = c.x - bw / 2,
        bby = by - 44;
      rect(bbx, bby, bw, 30, '#fff');
      ctx.strokeStyle = '#c8855a';
      ctx.lineWidth = 2;
      ctx.strokeRect(bbx, bby, bw, 30);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(c.x - 6, bby + 30);
      ctx.lineTo(c.x + 6, bby + 30);
      ctx.lineTo(c.x, bby + 40);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#c8855a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c.x - 6, bby + 30);
      ctx.lineTo(c.x, bby + 40);
      ctx.lineTo(c.x + 6, bby + 30);
      ctx.stroke();
      ctx.font = '14px serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#3d1f0a';
      ctx.fillText(emoji, bbx + 5, bby + 20);
      fr(name, bbx + 22, bby + 20, 13, '#3d1f0a');
    }
    drawCustomer(c.x, drawY, c.seed, c.scale, c.happy, c.state === 'walking' ? c.walkAnim : 0);
  }
}

// =============================================================
//  HUD (No timer)
// =============================================================
function drawHUD() {
  function hudBox(x, y, w, h, icon, val, col) {
    rect(x, y, w, h, 'rgba(0,0,0,0.55)');
    ctx.strokeStyle = 'rgba(244,168,32,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.font = '14px serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(icon, x + 8, y + 22);
    fr(val, x + 30, y + 24, 16, col);
  }
  hudBox(8, 4, 110, 34, '💰', '$' + G.coins, '#4caf76');
  hudBox(126, 4, 80, 34, '😊', '' + G.served, '#f4a820');
  hudBox(LW - 100, 4, 92, 34, '🔥', 'x' + G.streak, '#ff7744');
  rect(8, 44, 260, 42, 'rgba(0,0,0,0.5)');
  ctx.strokeStyle = 'rgba(244,168,32,0.4)';
  ctx.strokeRect(8, 44, 260, 42);
  fr(`DAY ${G.currentDay}`, 16, 60, 14, C.gold);
  fr(`Goal: $${G.dailyProfitGoal}`, 16, 78, 11, '#fff');
  let percent = Math.min(100, (G.dailyProfitEarned / G.dailyProfitGoal) * 100);
  rect(130, 54, 120, 8, '#2a1a0a');
  rect(130, 54, 120 * percent / 100, 8, C.green);
  fr(`$${G.dailyProfitEarned} / $${G.dailyProfitGoal}`, 130, 78, 10, C.cream);
  rect(8, 92, 120, 8, '#2a1a0a');
  let repW = Math.max(0, Math.min(120, G.reputation * 1.2));
  rect(8, 92, repW, 8, G.reputation > 70 ? '#4caf76' : G.reputation > 40 ? '#f4a820' : '#e05252');
  fr('Rep', 8, 102, 10, '#fff');
  fr(`Prestige:${G.prestigePoints}`, 140, 102, 11, C.purple);
}

// =============================================================
//  DAY SELECTION MENU
// =============================================================
function drawDaySelect() {
  let bg = ctx.createLinearGradient(0, 0, 0, LH);
  bg.addColorStop(0, '#1a0800');
  bg.addColorStop(1, '#3d1f0a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, LW, LH);
  fr("CHOOSE A DAY", LW / 2, 60, 28, C.gold, 'center');
  fr("Complete daily profit goal to unlock next day", LW / 2, 95, 12, C.cream, 'center');
  let startX = 80,
    startY = 130,
    cols = 4,
    w = 140,
    h = 70,
    gap = 20;
  let buttons = [];
  for (let d = 1; d <= Math.max(6, G.unlockedDays + 1); d++) {
    let col = (d - 1) % cols;
    let row = Math.floor((d - 1) / cols);
    let x = startX + col * (w + gap);
    let y = startY + row * (h + gap);
    let locked = d > G.unlockedDays;
    ctx.globalAlpha = locked ? 0.6 : 1;
    ctx.fillStyle = locked ? '#2a2a2a' : '#5a3810';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = locked ? '#666' : C.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = locked ? '#aaa' : C.gold;
    ctx.font = '22px "Fredoka One", cursive';
    ctx.textAlign = 'center';
    ctx.fillText(`DAY ${d}`, x + w / 2, y + 35);
    if (locked) {
      ctx.fillStyle = '#e05252';
      ctx.font = '14px monospace';
      ctx.fillText("🔒 LOCKED", x + w / 2, y + 58);
    } else {
      let goal = Math.floor(1000 + (d - 1) * 600 + G.prestigePoints * 150);
      ctx.fillStyle = C.cream;
      ctx.font = '12px monospace';
      ctx.fillText(`Goal: $${goal}`, x + w / 2, y + 58);
    }
    ctx.globalAlpha = 1;
    buttons.push({ day: d, x, y, w, h, locked });
  }
  G.daySelectButtons = buttons;
  let prestigeBtn = { x: LW - 120, y: LH - 60, w: 100, h: 40 };
  ctx.fillStyle = C.purple;
  ctx.beginPath();
  ctx.roundRect(prestigeBtn.x, prestigeBtn.y, prestigeBtn.w, prestigeBtn.h, 10);
  ctx.fill();
  fr("✨ PRESTIGE", prestigeBtn.x + prestigeBtn.w / 2, prestigeBtn.y + 26, 12, '#fff', 'center');
  G.prestigeBtn = prestigeBtn;
  fr(`💰 Coins: $${G.coins}`, 20, LH - 30, 14, C.gold);
  fr(`🏆 Prestige: ${G.prestigePoints}`, 20, LH - 50, 12, C.purple);
  fr(`📈 Unlocked Days: ${G.unlockedDays}`, 20, LH - 70, 12, C.cream);
}

function drawDayCompleteMenu() {
  if (!G.showDayCompleteMenu) return;
  ctx.globalAlpha = 0.85;
  rect(0, 0, LW, LH, '#000');
  ctx.globalAlpha = 1;
  let w = 450,
    h = 180,
    x = LW / 2 - w / 2,
    y = LH / 2 - h / 2;
  rect(x, y, w, h, '#2a1a0a');
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  fr("🎉 GOAL REACHED! 🎉", LW / 2, y + 40, 18, C.gold, 'center');
  fr(`You earned $${G.dailyProfitEarned} / $${G.dailyProfitGoal}`, LW / 2, y + 70, 14, C.cream, 'center');
  fr("Choose an option:", LW / 2, y + 95, 12, '#fff', 'center');
  let btnW = 160,
    btnH = 40;
  let btnEnd = { x: x + 30, y: y + 120, w: btnW, h: btnH };
  let btnCont = { x: x + w - btnW - 30, y: y + 120, w: btnW, h: btnH };
  ctx.fillStyle = C.green;
  ctx.beginPath();
  ctx.roundRect(btnEnd.x, btnEnd.y, btnEnd.w, btnEnd.h, 10);
  ctx.fill();
  ctx.fillStyle = C.blue;
  ctx.beginPath();
  ctx.roundRect(btnCont.x, btnCont.y, btnCont.w, btnCont.h, 10);
  ctx.fill();
  fr("END DAY (Unlock Next)", btnEnd.x + btnEnd.w / 2, btnEnd.y + btnEnd.h - 12, 11, '#fff', 'center');
  fr("CONTINUE (Extra Profit)", btnCont.x + btnCont.w / 2, btnCont.y + btnCont.h - 12, 11, '#fff', 'center');
  G.dayCompleteButtons = { end: btnEnd, cont: btnCont };
}

// =============================================================
//  INPUT, UPGRADES, MAIN LOOP
// =============================================================
canvas.addEventListener('mousemove', e => {
  let { x: mx, y: my } = toLogical(e);
  if (G.state === 'playing') {
    MACHINES.forEach(m => (m.hovered = false));
    let m = getMachineAt(mx, my);
    canvas.style.cursor = m ? 'pointer' : 'default';
    if (m) m.hovered = true;
  } else canvas.style.cursor = 'default';
});

canvas.addEventListener('click', e => {
  let { x: mx, y: my } = toLogical(e);
  if (G.state === 'daySelect') {
    if (G.daySelectButtons) {
      for (let btn of G.daySelectButtons) {
        if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h && !btn.locked) {
          startDay(btn.day);
          return;
        }
      }
    }
    if (G.prestigeBtn && mx >= G.prestigeBtn.x && mx <= G.prestigeBtn.x + G.prestigeBtn.w && my >= G.prestigeBtn.y && my <= G.prestigeBtn.y + G.prestigeBtn.h) {
      prestigeReset();
    }
  } else if (G.state === 'playing') {
    if (G.showDayCompleteMenu && G.dayCompleteButtons) {
      let end = G.dayCompleteButtons.end,
        cont = G.dayCompleteButtons.cont;
      if (mx >= end.x && mx <= end.x + end.w && my >= end.y && my <= end.y + end.h) {
        completeDay(true);
        return;
      }
      if (mx >= cont.x && mx <= cont.x + cont.w && my >= cont.y && my <= cont.y + cont.h) {
        G.showDayCompleteMenu = false;
        addLog("Continuing shift – extra profit, but next day stays locked until you End Day.", 'good');
        return;
      }
    }
    let m = getMachineAt(mx, my);
    if (m && !m.brewing) brewDrink(m);
  } else if (G.state === 'gameover') {
    if (G.goBtn) {
      let { pa, mn } = G.goBtn;
      if (mx >= pa.x && mx <= pa.x + pa.w && my >= pa.y && my <= pa.y + pa.h) {
        initGame();
      }
      if (mx >= mn.x && mx <= mn.x + mn.w && my >= mn.y && my <= mn.y + mn.h) {
        initGame();
      }
    }
  }
});

function getMachineAt(mx, my) {
  return MACHINES.find(m => mx >= m.x - 8 && mx <= m.x + 82 && my >= m.y - 8 && my <= m.y + 132) || null;
}

function updateUpgradePanel() {
  try {
    let panel = document.getElementById('upgrade-panel');
    if (G.state !== 'playing') {
      panel.classList.remove('visible');
      return;
    }
    panel.classList.add('visible');
    panel.innerHTML = '<div class="upg-title">MANAGEMENT</div>';
    UPGRADES_DEF.forEach(upg => {
      let lvl = G.upgrades[upg.id],
        maxed = lvl >= upg.maxLvl,
        cost = upg.cost + lvl * 40,
        can = G.coins >= cost;
      let div = document.createElement('div');
      div.className = 'upg-card';
      div.innerHTML = `<div class="upg-row"><div class="upg-icon">${upg.icon}</div><div><div class="upg-name">${upg.name}</div><div class="upg-stars">${'⭐'.repeat(lvl)}${'☆'.repeat(upg.maxLvl - lvl)}</div></div></div><div class="upg-desc">${upg.desc}</div><button class="upg-btn" data-id="${upg.id}"${maxed || !can ? ' disabled' : ''}>${maxed ? '✅ MAX' : 'Buy $' + cost}</button>`;
      panel.appendChild(div);
    });
    panel.querySelectorAll('.upg-btn').forEach(btn => btn.addEventListener('click', () => buyUpgrade(btn.dataset.id)));
    let cd = document.createElement('div');
    cd.style.cssText = 'text-align:center;padding:8px 0;border-top:1px solid rgba(244,168,32,0.3);margin-top:4px;';
    cd.innerHTML = `<span style="font-family:'Fredoka One',cursive;font-size:1.1rem;color:#f4a820;">💰 $${G.coins}</span>`;
    panel.appendChild(cd);
  } catch (e) {}
}

function buyUpgrade(id) {
  let upg = UPGRADES_DEF.find(u => u.id === id);
  let lvl = G.upgrades[id],
    cost = upg.cost + lvl * 40;
  if (G.coins < cost || lvl >= upg.maxLvl) return;
  G.coins -= cost;
  G.upgrades[id]++;
  if (upg.effect === 'speed') G.brewSpeed = Math.max(0.35, G.brewSpeed - 0.22);
  if (upg.effect === 'patience') G.patienceMul += 0.35;
  if (upg.effect === 'bonus') G.coinBonus += 3;
  if (upg.effect === 'slots') G.maxQ += 1;
  if (upg.effect === 'auto') addLog('Barista hired! Auto-brew every 6s', 'good');
  if (upg.effect === 'spawn') G.spawnMod *= 0.7;
  if (upg.effect === 'price') G.drinkPriceMod += 3;
  if (upg.effect === 'slots2') G.maxQ += 2;
  updateUpgradePanel();
  addLog('✨ ' + upg.name + ' upgraded!', 'good');
}

function addLog(msg, type = '') {
  let log = document.getElementById('event-log');
  let d = document.createElement('div');
  d.className = 'log-' + type;
  d.textContent = msg;
  log.appendChild(d);
  while (log.children.length > 10) log.removeChild(log.firstChild);
}

// =============================================================
//  MAIN LOOP
// =============================================================
let lastT = 0;
function loop(ts) {
  try {
    let dt = Math.min((ts - lastT) / 1000, 0.1);
    lastT = ts;
    if (G.state === 'playing' && G.running && !G.showDayCompleteMenu) {
      let spawnRate = Math.max(3.0 - G.served * 0.008, 1.8) / G.spawnMod;
      G.spawnT += dt;
      if (G.spawnT >= spawnRate) {
        G.spawnT = 0;
        spawnCustomer();
      }
      updateMachines(dt);
      updateCustomers(dt);
      updateParticles();
      updateCups();
    } else {
      updateParticles();
      updateCups();
    }
    ctx.clearRect(0, 0, LW, LH);
    if (G.state === 'daySelect') drawDaySelect();
    else if (G.state === 'playing') {
      drawScene();
      drawCustomers();
      drawParticles();
      drawCups();
      drawHUD();
      drawDayCompleteMenu();
    } else if (G.state === 'gameover') drawGameOver();
  } catch (e) {
    console.error(e);
  }
  requestAnimationFrame(loop);
}

function drawGameOver() {
  goT = (goT || 0) + 0.016;
  let bg = ctx.createLinearGradient(0, 0, 0, LH);
  bg.addColorStop(0, '#0d0500');
  bg.addColorStop(1, '#2a1008');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, LW, LH);
  fr("SHIFT OVER", LW / 2, 120, 40, C.gold, 'center');
  fr(`Day ${G.currentDay} Goal: $${G.dailyProfitGoal} (Failed)`, LW / 2, 170, 16, '#fff', 'center');
  fr(`You earned: $${G.dailyProfitEarned}`, LW / 2, 210, 14, C.cream, 'center');
  let stats = [
    { i: '💰', l: 'Total Coins', v: '$' + G.coins },
    { i: '😊', l: 'Served', v: '' + G.served },
    { i: '😤', l: 'Missed', v: '' + G.missed },
    { i: '🔥', l: 'Best Streak', v: 'x' + G.bestStreak },
  ];
  let sx = LW / 2 - 202,
    sy = 250;
  stats.forEach((s, i) => {
    let bx = sx + (i % 2) * 210,
      by = sy + Math.floor(i / 2) * 80;
    rect(bx, by, 192, 68, 'rgba(255,255,255,0.05)');
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, 192, 68);
    ctx.font = '22px serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(s.i, bx + 10, by + 36);
    fr(s.v, bx + 40, by + 36, 22, C.gold);
    fr(s.l, bx + 40, by + 55, 11, 'rgba(255,255,255,0.5)');
  });
  ctx.fillStyle = C.goldDk;
  ctx.beginPath();
  ctx.roundRect(LW / 2 - 100, 400, 200, 50, 25);
  ctx.fill();
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.roundRect(LW / 2 - 100, 394, 200, 50, 25);
  ctx.fill();
  fr("▶ BACK TO MENU", LW / 2, 425, 16, C.brown, 'center');
  G.goBtn = { pa: { x: LW / 2 - 100, y: 394, w: 200, h: 50 } };
}

let goT = 0;
initGame();
requestAnimationFrame(loop);
