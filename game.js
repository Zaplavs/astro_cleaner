const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ЗВУКОВАЯ СИСТЕМА (AUDIO MANAGER) ---
const audio = {
    muted: false,
    sounds: {
        coin: new Audio('coin.mp3'),
        collect: new Audio('collect.wav'),
        suck: new Audio('suck.mp3'),
        hit: new Audio('hit.mp3'),
        upgrade: new Audio('upgrade.mp3')
    },
    play: function(soundName) {
        if (!this.muted && this.sounds[soundName]) {
            let sound = this.sounds[soundName].cloneNode();
            sound.volume = 0.5;
            sound.play().catch(e => { /* Ignore autoplay errors */ });
        }
    },
    toggleMute: function() {
        this.muted = !this.muted;
        return this.muted;
    }
};

// --- UI ЭЛЕМЕНТЫ ---
const ui = {
    mainMenu: document.getElementById('mainMenu'), sectorMenu: document.getElementById('sectorMenu'),
    hud: document.getElementById('hud'), shopModal: document.getElementById('shopModal'),
    overlayScreen: document.getElementById('overlayScreen'), reviveScreen: document.getElementById('reviveScreen'),
    tutorialOverlay: document.getElementById('tutorialOverlay'), tutorialText: document.getElementById('tutorialText'),

    btnPlay: document.getElementById('btnPlay'), sectorGrid: document.getElementById('sectorGrid'),
    btnBackToMain: document.getElementById('btnBackToMain'), btnMuteMenu: document.getElementById('btnMuteMenu'),
    btnMuteHud: document.getElementById('btnMuteHud'),

    level: document.getElementById('level'), progress: document.getElementById('progress'),
    coins: document.getElementById('coins'), capacity: document.getElementById('capacity'),
    hpText: document.getElementById('hpText'), hpFill: document.getElementById('hpFill'),
    dronesCount: document.getElementById('dronesCount'), damageFlash: document.getElementById('damageFlash'),
    thrustText: document.getElementById('thrustText'), thrustFill: document.getElementById('thrustFill'),

    openShopBtn: document.getElementById('openShopBtn'), closeShopBtn: document.getElementById('closeShopBtn'),
    buyDroneBtn: document.getElementById('buyDroneBtn'), upgradeHpBtn: document.getElementById('upgradeHpBtn'),
    upgradeProfitBtn: document.getElementById('upgradeProfitBtn'), upgradeCapBtn: document.getElementById('upgradeCapBtn'),
    upgradeMagnetBtn: document.getElementById('upgradeMagnetBtn'), upgradeSpeedBtn: document.getElementById('upgradeSpeedBtn'),

    overlayTitle: document.getElementById('overlayTitle'), overlayText: document.getElementById('overlayText'),
    nextSectorBtn: document.getElementById('nextSectorBtn'), reviveBtn: document.getElementById('reviveBtn'), restartBtn: document.getElementById('restartBtn')
};

// --- СОСТОЯНИЕ ИГРЫ (ОБЛАКО) ---
let state = {
    coins: 0, maxSector: 1, tutorialCompleted: false, muted: false,
    hpLevel: 1, profitLevel: 1, speedLevel: 1, capacityLevel: 1, magnetLevel: 1,
};

// --- ТЕКУЩАЯ СЕССИЯ ---
let currentSector = 1; let activeDrones = 0; let debrisCollected = 0;
let gameState = 'MENU'; let tutorialStage = 0;

const costs = { hp: (lvl) => 100 * lvl, profit: (lvl) => 150 * lvl, speed: (lvl) => 50 * lvl, capacity: (lvl) => 50 * lvl, magnet: (lvl) => 100 * lvl, drone: () => 200 };

let ys = null; let playerSDK = null;

// --- ИГРОВЫЕ ОБЪЕКТЫ ---
const player = {
    x: 0, y: 0, radius: 20, inventory: 0, hp: 100, invulnerableTime: 0,
    get maxHp() { return 100 + (state.hpLevel - 1) * 25; },
    get speed() { return 4 + state.speedLevel; },
    get maxCapacity() { return 10 + state.capacityLevel * 5; },
    get magnetRadius() { return 100 + state.magnetLevel * 30; },
    get profitMult() { return 1 + (state.profitLevel - 1) * 0.5; }
};

let target = { x: player.x, y: player.y };
const base = { x: 0, y: 0, radius: 80, rotation: 0 };

let debrisList = []; let piratesList = []; let asteroidsList = [];
let floatingTexts = []; let explosions = []; let orbitAngle = 0;

// Баланс
function getDebrisNeeded() { return 20 + currentSector * 10; }
function getDebrisValue() { return Math.floor((5 + (currentSector - 1) * 3) * player.profitMult); }
function getPirateCount() { return Math.min(1 + Math.floor(currentSector / 2), 15); }
function getAsteroidCount() { return currentSector >= 3 ? Math.min(Math.floor(currentSector / 3), 5) : 0; }

// --- ИНИЦИАЛИЗАЦИЯ И РЕСАЙЗ ---
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; base.x = canvas.width / 2; base.y = canvas.height / 2; }
window.addEventListener('resize', resize); resize();

function setTarget(x, y) { if (gameState === 'PLAYING') { target.x = x; target.y = y; } }
window.addEventListener('mousemove', (e) => setTarget(e.clientX, e.clientY));
window.addEventListener('touchmove', (e) => setTarget(e.touches[0].clientX, e.touches[0].clientY));
window.addEventListener('touchstart', (e) => setTarget(e.touches[0].clientX, e.touches[0].clientY));

// --- НАВИГАЦИЯ И ЗВУК ---
function updateMuteButtons() { const icon = audio.muted ? '🔇' : '🔊'; ui.btnMuteMenu.innerText = icon; ui.btnMuteHud.innerText = icon; }
function toggleSound() { state.muted = audio.toggleMute(); updateMuteButtons(); saveProgress(); }
ui.btnMuteMenu.onclick = toggleSound; ui.btnMuteHud.onclick = toggleSound;

function showScreen(screenId) {
    ui.mainMenu.classList.add('hidden'); ui.sectorMenu.classList.add('hidden'); ui.hud.classList.add('hidden');
    ui.shopModal.classList.add('hidden'); ui.overlayScreen.classList.add('hidden'); ui.reviveScreen.classList.add('hidden');
    if (screenId === 'MAIN') { gameState = 'MENU'; ui.mainMenu.classList.remove('hidden'); }
    else if (screenId === 'SECTORS') { gameState = 'SECTOR_SELECT'; buildSectorGrid(); ui.sectorMenu.classList.remove('hidden'); }
    else if (screenId === 'GAME') { gameState = 'PLAYING'; ui.hud.classList.remove('hidden'); }
}

function buildSectorGrid() {
    ui.sectorGrid.innerHTML = ''; let displayMax = Math.min(Math.max(state.maxSector + 2, 10), 50);
    for (let i = 1; i <= displayMax; i++) {
        let btn = document.createElement('button'); btn.className = 'sector-btn'; btn.innerText = i;
        if (i <= state.maxSector) btn.onclick = () => startGame(i); else { btn.disabled = true; btn.innerText = '🔒'; }
        ui.sectorGrid.appendChild(btn);
    }
}

// --- СПАВНЕРЫ ---
function spawnDebris() {
    if (gameState !== 'PLAYING') return;
    const maxDebris = 15 + currentSector * 5;
    if (debrisList.length < maxDebris) {
        let x, y, dDist;
        do {
            x = Math.random() * canvas.width; y = Math.random() * canvas.height;
            dDist = Math.hypot(x - base.x, y - base.y);
        } while(dDist < base.radius + 50);

        // Шанс золотого мусора начиная с 5 сектора
        let isGolden = currentSector >= 5 && Math.random() < 0.1;

        debrisList.push({
            x: x, y: y, radius: isGolden ? 12 : 4 + Math.random() * 8, pulled: false,
            rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.1,
            type: Math.floor(Math.random() * 3), isGolden: isGolden
        });
    }
}
setInterval(spawnDebris, 800);

function spawnHazards() {
    if (gameState !== 'PLAYING') return;

    // Пираты
    if (piratesList.length < getPirateCount()) {
        let side = Math.floor(Math.random() * 4);
        let px, py;
        if (side === 0) { px = Math.random() * canvas.width; py = -50; }
        else if (side === 1) { px = canvas.width + 50; py = Math.random() * canvas.height; }
        else if (side === 2) { px = Math.random() * canvas.width; py = canvas.height + 50; }
        else { px = -50; py = Math.random() * canvas.height; }

        let type = 'normal';
        let speedMult = 1;
        let hpMult = 1;
        let color = '#ff0044';

        if (currentSector >= 3 && Math.random() < 0.3) {
            type = 'fast'; speedMult = 1.5; hpMult = 0.5; color = '#ff00ff';
        } else if (currentSector >= 4 && Math.random() < 0.2) {
            type = 'tank'; speedMult = 0.6; hpMult = 2.5; color = '#880000';
        }

        piratesList.push({
            x: px, y: py, radius: 18,
            speed: (1.5 + currentSector * 0.2) * speedMult,
            hp: (20 + currentSector * 10) * hpMult,
            maxHp: (20 + currentSector * 10) * hpMult,
            color: color,
            type: type,
            wobble: Math.random() * Math.PI * 2
        });
    }

    // Астероиды
    if (currentSector >= 3 && asteroidsList.length < getAsteroidCount()) {
        let side = Math.floor(Math.random() * 4);
        let px, py;
        if (side === 0) { px = Math.random() * canvas.width; py = -50; }
        else if (side === 1) { px = canvas.width + 50; py = Math.random() * canvas.height; }
        else if (side === 2) { px = Math.random() * canvas.width; py = canvas.height + 50; }
        else { px = -50; py = Math.random() * canvas.height; }

        let angle = Math.random() * Math.PI * 2;
        let speed = 1 + Math.random() * 2;

        asteroidsList.push({
            x: px, y: py, radius: 25 + Math.random() * 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            hp: 50 + currentSector * 10,
            rotation: 0,
            rotSpeed: (Math.random() - 0.5) * 0.1
        });
    }
}
setInterval(spawnHazards, 2000);

// --- ЛОГИКА ---
function updateUI() {
    ui.level.innerText = currentSector; ui.progress.innerText = `${debrisCollected} / ${getDebrisNeeded()}`;
    ui.coins.innerText = state.coins; ui.capacity.innerText = `${player.inventory} / ${player.maxCapacity}`;
    ui.dronesCount.innerText = `${activeDrones} / 3`;

    ui.hpFill.style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%';
    ui.hpText.innerText = `❤️ ${Math.floor(player.hp)}/${player.maxHp}`;

    // Динамическая тяга
    let fillRatio = player.inventory / player.maxCapacity;
    let thrustPercent = Math.floor((1 - (0.5 * fillRatio)) * 100);
    ui.thrustText.innerText = `${thrustPercent}%`;
    ui.thrustFill.style.width = `${thrustPercent}%`;

    ui.upgradeHpBtn.innerText = `Улучшить (${costs.hp(state.hpLevel)})`; ui.upgradeProfitBtn.innerText = `Улучшить (${costs.profit(state.profitLevel)})`;
    ui.upgradeSpeedBtn.innerText = `Улучшить (${costs.speed(state.speedLevel)})`; ui.upgradeCapBtn.innerText = `Улучшить (${costs.capacity(state.capacityLevel)})`;
    ui.upgradeMagnetBtn.innerText = `Улучшить (${costs.magnet(state.magnetLevel)})`;

    ui.upgradeHpBtn.disabled = state.coins < costs.hp(state.hpLevel); ui.upgradeProfitBtn.disabled = state.coins < costs.profit(state.profitLevel);
    ui.upgradeSpeedBtn.disabled = state.coins < costs.speed(state.speedLevel); ui.upgradeCapBtn.disabled = state.coins < costs.capacity(state.capacityLevel);
    ui.upgradeMagnetBtn.disabled = state.coins < costs.magnet(state.magnetLevel); ui.buyDroneBtn.disabled = state.coins < costs.drone() || activeDrones >= 3;
}

function showTutorialText(text, timeMs = 0) {
    ui.tutorialText.innerText = text; ui.tutorialOverlay.classList.remove('hidden');
    if (timeMs > 0) setTimeout(() => ui.tutorialOverlay.classList.add('hidden'), timeMs);
}
function showFloatingText(text, x, y, color) { floatingTexts.push({ text, x, y, color, life: 1.0 }); }
function createExplosion(x, y, color, count=10) {
    audio.play('hit');
    for(let i=0; i<count; i++) explosions.push({ x: x, y: y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 1.0, color: color });
}

function takeDamage(amount = 25) {
    if (player.invulnerableTime > 0) return;
    audio.play('hit'); player.hp -= amount; player.invulnerableTime = 60;
    ui.damageFlash.style.opacity = '1'; setTimeout(() => { ui.damageFlash.style.opacity = '0'; }, 100);
    updateUI();
    if (player.hp <= 0) { gameState = 'GAME_OVER'; ui.hud.classList.add('hidden'); ui.reviveScreen.classList.remove('hidden'); }
}

function update() {
    if (gameState !== 'PLAYING') return;

    base.rotation += 0.005; orbitAngle += 0.05;

    // Физика веса
    let fillRatio = player.inventory / player.maxCapacity;
    let currentSpeed = player.speed * (1 - (0.5 * fillRatio));

    const dx = target.x - player.x; const dy = target.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > currentSpeed) { player.x += (dx / dist) * currentSpeed; player.y += (dy / dist) * currentSpeed; }
    if (player.invulnerableTime > 0) player.invulnerableTime--;

    // Мусор
    for (let i = debrisList.length - 1; i >= 0; i--) {
        let d = debrisList[i]; d.rotation += d.rotSpeed;
        let ddx = player.x - d.x; let ddy = player.y - d.y;
        let dDist = Math.hypot(ddx, ddy);

        if (player.inventory < player.maxCapacity && dDist < player.magnetRadius) {
            if (!d.pulled) audio.play('suck'); d.pulled = true;
        }
        if (d.pulled) {
            d.x += (ddx / dDist) * (currentSpeed * 2); d.y += (ddy / dDist) * (currentSpeed * 2);
            if (dDist < player.radius) {
                // Если мусор золотой, он занимает столько же места, но стоит x5
                audio.play('collect');
                d.isGolden ? player.inventory++ : player.inventory++;
                d.isGolden ? state.goldenValueBuff = true : null; // Временный маркер для сдачи
                debrisList.splice(i, 1); updateUI();
                if (tutorialStage === 1 && player.inventory >= player.maxCapacity) { tutorialStage = 2; showTutorialText("Багажник полон! Лети на Базу!"); }
            }
        }
    }

    let dronePositions = []; let orbitRadius = 60;
    for (let i = 0; i < activeDrones; i++) {
        let angle = orbitAngle + (Math.PI * 2 / activeDrones) * i;
        dronePositions.push({ x: player.x + Math.cos(angle) * orbitRadius, y: player.y + Math.sin(angle) * orbitRadius, radius: 12 });
    }

    // Пираты
    for (let i = piratesList.length - 1; i >= 0; i--) {
        let p = piratesList[i]; let pdx = player.x - p.x; let pdy = player.y - p.y;
        let pDist = Math.hypot(pdx, pdy); p.wobble += 0.1;
        if (pDist > 0) { p.x += (pdx / pDist) * p.speed + Math.cos(p.wobble) * 2; p.y += (pdy / pDist) * p.speed + Math.sin(p.wobble) * 2; }

        let pirateHit = false;
        for (let j = 0; j < dronePositions.length; j++) {
            let dp = dronePositions[j];
            if (Math.hypot(dp.x - p.x, dp.y - p.y) < dp.radius + p.radius) {
                createExplosion(dp.x, dp.y, '#00ffff'); showFloatingText("ЩИТ СРАБОТАЛ!", p.x, p.y, '#00ffff'); activeDrones--;
                p.hp--;
                if (p.hp <= 0) { createExplosion(p.x, p.y, p.color); piratesList.splice(i, 1); pirateHit = true; }
                updateUI(); break;
            }
        }
        if (!pirateHit && pDist < player.radius + p.radius) {
            let dmg = p.type === 'tank' ? 50 : 25;
            takeDamage(dmg); p.x -= (pdx / pDist) * 50; p.y -= (pdy / pDist) * 50;
        }
    }

    // Астероиды
    for (let i = asteroidsList.length - 1; i >= 0; i--) {
        let a = asteroidsList[i];
        a.x += a.vx; a.y += a.vy; a.rotation += a.rotSpeed;

        // Отскок от краев виртуального поля (чтобы не улетали бесконечно)
        if (a.x < -1000 || a.x > canvas.width + 1000) a.vx *= -1;
        if (a.y < -1000 || a.y > canvas.height + 1000) a.vy *= -1;

        let aDist = Math.hypot(player.x - a.x, player.y - a.y);
        if (aDist < player.radius + a.radius) {
            takeDamage(10);
            createExplosion(a.x, a.y, '#a0aec0', 5);
            // Отброс игрока и астероида
            player.x -= a.vx * 10; player.y -= a.vy * 10; target.x = player.x; target.y = player.y;
            a.vx *= -1; a.vy *= -1;
        }
    }

    // База
    if (Math.hypot(base.x - player.x, base.y - player.y) < base.radius + player.radius && player.inventory > 0) {
        let multiplier = state.goldenValueBuff ? 5 : 1; state.goldenValueBuff = false; // Золотой множитель применяется ко всему грузу если попался хоть один золотой кусок
        let earned = player.inventory * getDebrisValue() * multiplier;

        state.coins += earned; audio.play('coin');
        showFloatingText(`+${earned}`, player.x, player.y - 30, multiplier > 1 ? '#ffd700' : '#00ff00');
        debrisCollected += player.inventory; player.inventory = 0;

        saveProgress(); updateUI();

        if (tutorialStage === 2) { tutorialStage = 3; showTutorialText("Открой Магазин и улучши свой корабль!"); }
        if (debrisCollected >= getDebrisNeeded()) {
            gameState = 'PAUSED'; ui.hud.classList.add('hidden'); ui.overlayScreen.classList.remove('hidden');
            if (tutorialStage === 3) { state.tutorialCompleted = true; tutorialStage = 0; saveProgress(); }
            if (currentSector === state.maxSector) { state.maxSector++; saveProgress(); }
        }
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) { floatingTexts[i].y -= 1; floatingTexts[i].life -= 0.02; if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1); }
    for (let i = explosions.length - 1; i >= 0; i--) { explosions[i].x += explosions[i].vx; explosions[i].y += explosions[i].vy; explosions[i].life -= 0.05; if (explosions[i].life <= 0) explosions.splice(i, 1); }
}

// --- ОТРИСОВКА ---
function drawPlayer(x, y, isInvulnerable) {
    ctx.save(); ctx.translate(x, y);
    if (isInvulnerable && Math.floor(Date.now() / 100) % 2 === 0) ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(0, 5, 15, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0, 255, 255, 0.5)'; ctx.filter = 'blur(5px)'; ctx.fill(); ctx.filter = 'none';
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2); ctx.fillStyle = '#aaa'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -5, 10, Math.PI, 0); ctx.fillStyle = 'rgba(0, 255, 255, 0.7)'; ctx.fill(); ctx.stroke();
    ctx.restore();
}

function drawBase(x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = '#1a365d'; ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2;
    for(let i=0; i<4; i++) {
        ctx.rotate(Math.PI/2); ctx.fillRect(-20, -75, 40, 50); ctx.strokeRect(-20, -75, 40, 50);
        ctx.beginPath(); ctx.moveTo(-10, -75); ctx.lineTo(-10, -25); ctx.moveTo(10, -75); ctx.lineTo(10, -25); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fillStyle = '#2d3748'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fillStyle = '#00ff00'; ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; // ctx.fillText('БАЗА', x, y + 5);
}

function drawPirate(p) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(player.y - p.y, player.x - p.x));

    // Изменение формы в зависимости от типа
    ctx.beginPath();
    if (p.type === 'tank') {
        ctx.moveTo(p.radius, 0); ctx.lineTo(-p.radius/2, p.radius); ctx.lineTo(-p.radius/2, -p.radius);
    } else if (p.type === 'fast') {
        ctx.moveTo(p.radius*1.5, 0); ctx.lineTo(-p.radius, p.radius/2); ctx.lineTo(-p.radius, -p.radius/2);
    } else {
        ctx.moveTo(15, 0); ctx.lineTo(-10, 10); ctx.lineTo(-5, 0); ctx.lineTo(-10, -10);
    }
    ctx.closePath();

    ctx.fillStyle = p.color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
}

function drawDebris(d) {
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rotation);
    ctx.beginPath();
    if (d.type === 0) { ctx.moveTo(0, -d.radius); ctx.lineTo(d.radius, d.radius); ctx.lineTo(-d.radius, d.radius); }
    else if (d.type === 1) { ctx.rect(-d.radius, -d.radius, d.radius*2, d.radius*2); }
    else { for (let i = 0; i < 5; i++) { ctx.lineTo(Math.cos(i * 1.25) * d.radius, Math.sin(i * 1.25) * d.radius); } }
    ctx.closePath();

    ctx.fillStyle = d.isGolden ? '#ffd700' : '#a0aec0';
    ctx.fill();
    ctx.strokeStyle = d.isGolden ? '#fff' : '#718096';
    ctx.stroke();
    ctx.restore();
}

function drawAsteroid(a) {
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rotation);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        let r = a.radius - (i % 2 === 0 ? Math.random()*5 : 0); // Немного неровные края
        ctx.lineTo(Math.cos(i * Math.PI/4) * r, Math.sin(i * Math.PI/4) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#4a5568'; ctx.fill(); ctx.strokeStyle = '#2d3748'; ctx.lineWidth = 2; ctx.stroke();

    // Кратеры
    ctx.beginPath(); ctx.arc(a.radius/3, -a.radius/3, a.radius/4, 0, Math.PI*2); ctx.fillStyle = '#2d3748'; ctx.fill();
    ctx.restore();
}

function drawDrone(x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0, 255, 255, 0.2)'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fillStyle = '#00ffff'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 4, 0, 0, Math.PI*2); ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
}

function draw() {
    ctx.fillStyle = '#0b0c10'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; for(let i=0; i<20; i++) { let sx = (i * 137) % canvas.width; let sy = (i * 251 + base.rotation * 100) % canvas.height; ctx.fillRect(sx, sy, 1, 1); }

    if (gameState === 'MENU' || gameState === 'SECTOR_SELECT') { base.rotation += 0.002; drawBase(base.x, base.y, base.rotation); return; }

    drawBase(base.x, base.y, base.rotation);
    asteroidsList.forEach(drawAsteroid);
    debrisList.forEach(drawDebris);
    piratesList.forEach(drawPirate);

    let orbitRadius = 60;
    for (let i = 0; i < activeDrones; i++) {
        let angle = orbitAngle + (Math.PI * 2 / activeDrones) * i;
        let dx = player.x + Math.cos(angle) * orbitRadius; let dy = player.y + Math.sin(angle) * orbitRadius;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(dx, dy); ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'; ctx.lineWidth = 1; ctx.stroke();
        drawDrone(dx, dy, orbitAngle * 2);
    }

    if (player.hp > 0) {
        if (player.inventory < player.maxCapacity) {
            ctx.beginPath(); ctx.arc(player.x, player.y, player.magnetRadius, 0, Math.PI*2); ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)'; ctx.lineWidth = 2; ctx.stroke();
        }
        drawPlayer(player.x, player.y, player.invulnerableTime > 0);
    }

    explosions.forEach(e => { ctx.fillStyle = e.color; ctx.globalAlpha = Math.max(0, e.life); ctx.beginPath(); ctx.arc(e.x, e.y, 3, 0, Math.PI*2); ctx.fill(); }); ctx.globalAlpha = 1.0;
    floatingTexts.forEach(t => { ctx.fillStyle = t.color; ctx.globalAlpha = t.life; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center'; ctx.fillText(t.text, t.x, t.y); }); ctx.globalAlpha = 1.0;
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }

// --- ВЗАИМОДЕЙСТВИЕ И СОХРАНЕНИЯ ---
function saveProgress() { if (playerSDK) playerSDK.setData(state).catch(e => console.log('Save Error', e)); }

function startGame(sectorNumber) {
    currentSector = sectorNumber; debrisCollected = 0; player.hp = player.maxHp; player.inventory = 0; activeDrones = 0;
    debrisList = []; piratesList = []; asteroidsList = []; state.goldenValueBuff = false;

    player.x = base.x; player.y = base.y + 120; target.x = player.x; target.y = player.y;
    updateUI(); showScreen('GAME');

    if (sectorNumber === 1 && !state.tutorialCompleted) { tutorialStage = 1; showTutorialText("Управляй кораблем и собирай мусор!", 3000); }
}

ui.btnPlay.onclick = () => showScreen('SECTORS'); ui.btnBackToMain.onclick = () => showScreen('MAIN');
ui.openShopBtn.onclick = () => { gameState = 'PAUSED'; updateUI(); ui.hud.classList.add('hidden'); ui.shopModal.classList.remove('hidden'); if (tutorialStage === 3) ui.tutorialOverlay.classList.add('hidden'); };
ui.closeShopBtn.onclick = () => { gameState = 'PLAYING'; target.x = player.x; target.y = player.y; ui.shopModal.classList.add('hidden'); ui.hud.classList.remove('hidden'); };

function buyUpgrade(type) {
    let success = false;
    if (type === 'drone') { if (state.coins >= costs.drone() && activeDrones < 3) { state.coins -= costs.drone(); activeDrones++; success = true; } }
    else { const cost = costs[type](state[type + 'Level']); if (state.coins >= cost) { state.coins -= cost; state[type + 'Level']++; if (type === 'hp') player.hp = player.maxHp; success = true; } }
    if (success) { audio.play('upgrade'); saveProgress(); updateUI(); }
}

ui.buyDroneBtn.onclick = () => buyUpgrade('drone'); ui.upgradeHpBtn.onclick = () => buyUpgrade('hp'); ui.upgradeProfitBtn.onclick = () => buyUpgrade('profit'); ui.upgradeSpeedBtn.onclick = () => buyUpgrade('speed'); ui.upgradeCapBtn.onclick = () => buyUpgrade('capacity'); ui.upgradeMagnetBtn.onclick = () => buyUpgrade('magnet');

ui.nextSectorBtn.onclick = () => { if (ys) { ys.adv.showFullscreenAdv({ callbacks: { onClose: () => showScreen('SECTORS'), onError: () => showScreen('SECTORS') } }); } else { showScreen('SECTORS'); } };
ui.reviveBtn.onclick = () => { if (ys) { ys.adv.showRewardedVideo({ callbacks: { onRewarded: () => { player.hp = player.maxHp; player.invulnerableTime = 180; piratesList = []; updateUI(); showScreen('GAME'); }, onError: () => showScreen('SECTORS') } }); } else { player.hp = player.maxHp; player.invulnerableTime = 180; piratesList = []; updateUI(); showScreen('GAME'); } };
ui.restartBtn.onclick = () => showScreen('SECTORS');

// --- СТАРТ И YANDEX SDK ---
showScreen('MAIN'); gameLoop();

if (typeof YaGames !== 'undefined') {
    YaGames.init().then(ysdk => {
        ys = ysdk; ys.features.LoadingAPI?.ready();
        ys.getPlayer({ scopes: false }).then(_player => {
            playerSDK = _player;
            playerSDK.getData().then(data => {
                if (data && data.maxSector) { state = { ...state, ...data }; audio.muted = state.muted; updateMuteButtons(); } updateUI();
            }).catch(e => console.log('Load error', e));
        }).catch(e => console.log('Auth error', e));
    });
}
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm' || e.key.toLowerCase() === 'ь') {
        if (gameState !== 'PLAYING' && gameState !== 'PAUSED') return;
        if (ui.shopModal && ui.shopModal.classList.contains('hidden')) {
            ui.openShopBtn.onclick();
        } else if (ui.shopModal && !ui.shopModal.classList.contains('hidden')) {
            ui.closeShopBtn.onclick();
        }
    }
});
