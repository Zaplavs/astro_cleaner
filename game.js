const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- UI ЭЛЕМЕНТЫ ---
const ui = {
    // Экраны
    mainMenu: document.getElementById('mainMenu'),
    sectorMenu: document.getElementById('sectorMenu'),
    hud: document.getElementById('hud'),
    shopModal: document.getElementById('shopModal'),
    overlayScreen: document.getElementById('overlayScreen'),
    reviveScreen: document.getElementById('reviveScreen'),

    // Меню
    btnPlay: document.getElementById('btnPlay'),
    sectorGrid: document.getElementById('sectorGrid'),
    btnBackToMain: document.getElementById('btnBackToMain'),

    // HUD
    level: document.getElementById('level'),
    progress: document.getElementById('progress'),
    coins: document.getElementById('coins'),
    capacity: document.getElementById('capacity'),
    hpText: document.getElementById('hpText'),
    hpFill: document.getElementById('hpFill'),
    dronesCount: document.getElementById('dronesCount'),
    damageFlash: document.getElementById('damageFlash'),

    // Магазин
    openShopBtn: document.getElementById('openShopBtn'),
    closeShopBtn: document.getElementById('closeShopBtn'),
    buyDroneBtn: document.getElementById('buyDroneBtn'),
    upgradeHpBtn: document.getElementById('upgradeHpBtn'),
    upgradeProfitBtn: document.getElementById('upgradeProfitBtn'),
    upgradeCapBtn: document.getElementById('upgradeCapBtn'),
    upgradeMagnetBtn: document.getElementById('upgradeMagnetBtn'),
    upgradeSpeedBtn: document.getElementById('upgradeSpeedBtn'),

    // Концевые экраны
    overlayTitle: document.getElementById('overlayTitle'),
    overlayText: document.getElementById('overlayText'),
    nextSectorBtn: document.getElementById('nextSectorBtn'),
    reviveBtn: document.getElementById('reviveBtn'),
    restartBtn: document.getElementById('restartBtn')
};

// --- СОСТОЯНИЕ ИГРЫ (ОБЛАКО) ---
let state = {
    coins: 0,
    maxSector: 1, // Максимальный открытый сектор

    // Уровни прокачки
    hpLevel: 1,
    profitLevel: 1,
    speedLevel: 1,
    capacityLevel: 1,
    magnetLevel: 1,
};

// --- ТЕКУЩАЯ СЕССИЯ ---
let currentSector = 1;
let activeDrones = 0;
let debrisCollected = 0;
let gameState = 'MENU'; // MENU, SECTOR_SELECT, PLAYING, PAUSED, GAME_OVER

// Настройки стоимости
const costs = {
    hp: (lvl) => 100 * lvl,
    profit: (lvl) => 150 * lvl,
    speed: (lvl) => 50 * lvl,
    capacity: (lvl) => 50 * lvl,
    magnet: (lvl) => 100 * lvl,
    drone: () => 200
};

let ys = null;
let playerSDK = null;

// --- ИГРОВЫЕ ОБЪЕКТЫ ---
const player = {
    x: 0, y: 0, radius: 20,
    inventory: 0,
    hp: 100,
    invulnerableTime: 0,
    get maxHp() { return 100 + (state.hpLevel - 1) * 25; },
    get speed() { return 4 + state.speedLevel; },
    get maxCapacity() { return 10 + state.capacityLevel * 5; },
    get magnetRadius() { return 100 + state.magnetLevel * 30; },
    get profitMult() { return 1 + (state.profitLevel - 1) * 0.5; }
};

let target = { x: player.x, y: player.y };

const base = { x: 0, y: 0, radius: 80, rotation: 0 };

let debrisList = [];
let piratesList = [];
let floatingTexts = [];
let explosions = [];
let orbitAngle = 0;

// --- БАЛАНС СЕКТОРОВ ---
function getDebrisNeeded() { return 20 + currentSector * 10; }
// Базовая стоимость растет, плюс множитель
function getDebrisValue() { return Math.floor((5 + (currentSector - 1) * 3) * player.profitMult); }
function getPirateCount() { return Math.min(1 + Math.floor(currentSector / 2), 15); }

// --- ИНИЦИАЛИЗАЦИЯ ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    base.x = canvas.width / 2;
    base.y = canvas.height / 2;
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('mousemove', (e) => { if(gameState==='PLAYING'){target.x = e.clientX; target.y = e.clientY;} });
window.addEventListener('touchmove', (e) => { if(gameState==='PLAYING'){target.x = e.touches[0].clientX; target.y = e.touches[0].clientY;} });
window.addEventListener('touchstart', (e) => { if(gameState==='PLAYING'){target.x = e.touches[0].clientX; target.y = e.touches[0].clientY;} });

// --- НАВИГАЦИЯ ЭКРАНОВ ---
function showScreen(screenId) {
    // Скрываем все
    ui.mainMenu.classList.add('hidden');
    ui.sectorMenu.classList.add('hidden');
    ui.hud.classList.add('hidden');
    ui.shopModal.classList.add('hidden');
    ui.overlayScreen.classList.add('hidden');
    ui.reviveScreen.classList.add('hidden');

    // Показываем нужный
    if (screenId === 'MAIN') {
        gameState = 'MENU';
        ui.mainMenu.classList.remove('hidden');
    } else if (screenId === 'SECTORS') {
        gameState = 'SECTOR_SELECT';
        buildSectorGrid();
        ui.sectorMenu.classList.remove('hidden');
    } else if (screenId === 'GAME') {
        gameState = 'PLAYING';
        ui.hud.classList.remove('hidden');
    }
}

function buildSectorGrid() {
    ui.sectorGrid.innerHTML = '';
    // Показываем на 1 сектор больше, чем максимум (заблокированный для затравки), или до 50
    let displayMax = Math.min(Math.max(state.maxSector + 2, 10), 50);

    for (let i = 1; i <= displayMax; i++) {
        let btn = document.createElement('button');
        btn.className = 'sector-btn';
        btn.innerText = i;

        if (i <= state.maxSector) {
            btn.onclick = () => startGame(i);
        } else {
            btn.disabled = true;
            btn.innerText = '🔒';
        }
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
            x = Math.random() * canvas.width;
            y = Math.random() * canvas.height;
            dDist = Math.hypot(x - base.x, y - base.y);
        } while(dDist < base.radius + 50);

        debrisList.push({
            x: x, y: y, radius: 4 + Math.random() * 8, pulled: false,
            rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.1,
            type: Math.floor(Math.random() * 3)
        });
    }
}
setInterval(spawnDebris, 800);

function spawnPirate() {
    if (gameState !== 'PLAYING') return;
    if (piratesList.length < getPirateCount()) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.max(canvas.width, canvas.height);
        piratesList.push({
            x: player.x + Math.cos(angle) * dist,
            y: player.y + Math.sin(angle) * dist,
            radius: 15, speed: 2 + currentSector * 0.2, wobble: Math.random() * Math.PI * 2
        });
    }
}
setInterval(spawnPirate, 2000);

// --- ЛОГИКА ---
function updateUI() {
    ui.level.innerText = currentSector;
    ui.progress.innerText = `${debrisCollected} / ${getDebrisNeeded()}`;
    ui.coins.innerText = state.coins;
    ui.capacity.innerText = `${player.inventory} / ${player.maxCapacity}`;
    ui.dronesCount.innerText = `${activeDrones} / 3`;

    const hpPercent = Math.max(0, (player.hp / player.maxHp) * 100);
    ui.hpFill.style.width = hpPercent + '%';
    ui.hpText.innerText = `❤️ ${Math.floor(player.hp)}/${player.maxHp}`;

    // Магазин
    ui.upgradeHpBtn.innerText = `Улучшить (${costs.hp(state.hpLevel)}$)`;
    ui.upgradeProfitBtn.innerText = `Улучшить (${costs.profit(state.profitLevel)}$)`;
    ui.upgradeSpeedBtn.innerText = `Улучшить (${costs.speed(state.speedLevel)}$)`;
    ui.upgradeCapBtn.innerText = `Улучшить (${costs.capacity(state.capacityLevel)}$)`;
    ui.upgradeMagnetBtn.innerText = `Улучшить (${costs.magnet(state.magnetLevel)}$)`;

    ui.upgradeHpBtn.disabled = state.coins < costs.hp(state.hpLevel);
    ui.upgradeProfitBtn.disabled = state.coins < costs.profit(state.profitLevel);
    ui.upgradeSpeedBtn.disabled = state.coins < costs.speed(state.speedLevel);
    ui.upgradeCapBtn.disabled = state.coins < costs.capacity(state.capacityLevel);
    ui.upgradeMagnetBtn.disabled = state.coins < costs.magnet(state.magnetLevel);
    ui.buyDroneBtn.disabled = state.coins < costs.drone() || activeDrones >= 3;
}

function showFloatingText(text, x, y, color) { floatingTexts.push({ text, x, y, color, life: 1.0 }); }
function createExplosion(x, y, color) {
    for(let i=0; i<10; i++) {
        explosions.push({ x: x, y: y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 1.0, color: color });
    }
}

function takeDamage() {
    if (player.invulnerableTime > 0) return;
    player.hp -= 25; player.invulnerableTime = 60;
    ui.damageFlash.style.opacity = '1';
    setTimeout(() => { ui.damageFlash.style.opacity = '0'; }, 100);
    updateUI();

    if (player.hp <= 0) {
        gameState = 'GAME_OVER';
        ui.hud.classList.add('hidden');
        ui.reviveScreen.classList.remove('hidden');
    }
}

function update() {
    if (gameState !== 'PLAYING') return;

    base.rotation += 0.005; orbitAngle += 0.05;

    const dx = target.x - player.x; const dy = target.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > player.speed) {
        player.x += (dx / dist) * player.speed; player.y += (dy / dist) * player.speed;
    }
    if (player.invulnerableTime > 0) player.invulnerableTime--;

    // Мусор
    for (let i = debrisList.length - 1; i >= 0; i--) {
        let d = debrisList[i];
        d.rotation += d.rotSpeed;
        let ddx = player.x - d.x; let ddy = player.y - d.y;
        let dDist = Math.hypot(ddx, ddy);

        if (player.inventory < player.maxCapacity && dDist < player.magnetRadius) d.pulled = true;

        if (d.pulled) {
            d.x += (ddx / dDist) * (player.speed * 2); d.y += (ddy / dDist) * (player.speed * 2);
            if (dDist < player.radius) {
                player.inventory++; debrisList.splice(i, 1); updateUI();
            }
        }
    }

    // Дроны
    let dronePositions = []; let orbitRadius = 60;
    for (let i = 0; i < activeDrones; i++) {
        let angle = orbitAngle + (Math.PI * 2 / activeDrones) * i;
        dronePositions.push({ x: player.x + Math.cos(angle) * orbitRadius, y: player.y + Math.sin(angle) * orbitRadius, radius: 12 });
    }

    // Пираты
    for (let i = piratesList.length - 1; i >= 0; i--) {
        let p = piratesList[i];
        let pdx = player.x - p.x; let pdy = player.y - p.y;
        let pDist = Math.hypot(pdx, pdy);

        p.wobble += 0.1;
        if (pDist > 0) {
            p.x += (pdx / pDist) * p.speed + Math.cos(p.wobble) * 2;
            p.y += (pdy / pDist) * p.speed + Math.sin(p.wobble) * 2;
        }

        let pirateHit = false;
        for (let j = 0; j < dronePositions.length; j++) {
            let dp = dronePositions[j];
            if (Math.hypot(dp.x - p.x, dp.y - p.y) < dp.radius + p.radius) {
                createExplosion(p.x, p.y, '#e53e3e'); createExplosion(dp.x, dp.y, '#00ffff');
                showFloatingText("ЩИТ СРАБОТАЛ!", p.x, p.y, '#00ffff');
                activeDrones--; piratesList.splice(i, 1); pirateHit = true; updateUI();
                break;
            }
        }

        if (!pirateHit && pDist < player.radius + p.radius) {
            takeDamage();
            p.x -= (pdx / pDist) * 50; p.y -= (pdy / pDist) * 50;
        }
    }

    // База
    if (Math.hypot(base.x - player.x, base.y - player.y) < base.radius + player.radius && player.inventory > 0) {
        let earned = player.inventory * getDebrisValue();
        state.coins += earned;
        showFloatingText(`+${earned}$`, player.x, player.y - 30, '#00ff00');
        debrisCollected += player.inventory; player.inventory = 0;

        saveProgress(); updateUI();

        if (debrisCollected >= getDebrisNeeded()) {
            gameState = 'PAUSED';
            ui.hud.classList.add('hidden');
            ui.overlayScreen.classList.remove('hidden');

            // Если прошли максимальный сектор - открываем новый
            if (currentSector === state.maxSector) {
                state.maxSector++;
                saveProgress();
            }
        }
    }

    // Анимации
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].y -= 1; floatingTexts[i].life -= 0.02;
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].x += explosions[i].vx; explosions[i].y += explosions[i].vy; explosions[i].life -= 0.05;
        if (explosions[i].life <= 0) explosions.splice(i, 1);
    }
}

// --- ОТРИСОВКА ---
// (Отрисовка осталась без изменений с прошлой версии)
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
    ctx.fillStyle = '#1a365d'; ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2;
    for(let i=0; i<4; i++) {
        ctx.rotate(Math.PI/2); ctx.fillRect(-20, -75, 40, 50); ctx.strokeRect(-20, -75, 40, 50);
        ctx.beginPath(); ctx.moveTo(-10, -75); ctx.lineTo(-10, -25); ctx.moveTo(10, -75); ctx.lineTo(10, -25); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fillStyle = '#2d3748'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fillStyle = '#ff00ff'; ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillText('БАЗА', x, y + 5);
}

function drawPirate(x, y, pX, pY) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(pY - y, pX - x));
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, 10); ctx.lineTo(-5, 0); ctx.lineTo(-10, -10); ctx.closePath();
    ctx.fillStyle = '#e53e3e'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
}

function drawDebris(d) {
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rotation);
    ctx.beginPath();
    if (d.type === 0) { ctx.moveTo(0, -d.radius); ctx.lineTo(d.radius, d.radius); ctx.lineTo(-d.radius, d.radius); }
    else if (d.type === 1) { ctx.rect(-d.radius, -d.radius, d.radius*2, d.radius*2); }
    else { for (let i = 0; i < 5; i++) { ctx.lineTo(Math.cos(i * 1.25) * d.radius, Math.sin(i * 1.25) * d.radius); } }
    ctx.closePath(); ctx.fillStyle = '#a0aec0'; ctx.fill(); ctx.strokeStyle = '#718096'; ctx.stroke();
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

    // Рисуем космос всегда, даже в меню, для красоты фона
    ctx.fillStyle = '#fff';
    for(let i=0; i<20; i++) {
        let sx = (i * 137) % canvas.width; let sy = (i * 251 + base.rotation * 100) % canvas.height;
        ctx.fillRect(sx, sy, 1, 1);
    }

    if (gameState === 'MENU' || gameState === 'SECTOR_SELECT') {
        base.rotation += 0.002;
        drawBase(base.x, base.y, base.rotation);
        return; // В меню не рисуем игрока и мусор
    }

    drawBase(base.x, base.y, base.rotation);
    debrisList.forEach(drawDebris);
    piratesList.forEach(p => drawPirate(p.x, p.y, player.x, player.y));

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
function saveProgress() {
    console.log("Сохранение в облако:", state);
    if (playerSDK) playerSDK.setData(state).catch(e => console.log('Save Error', e));
}

// Запуск конкретного сектора
function startGame(sectorNumber) {
    currentSector = sectorNumber;
    debrisCollected = 0;
    player.hp = player.maxHp;
    player.inventory = 0;
    activeDrones = 0;
    debrisList = []; piratesList = [];

    player.x = base.x; player.y = base.y + 100;
    target.x = player.x; target.y = player.y;

    updateUI();
    showScreen('GAME');
}

// --- ОБРАБОТЧИКИ КНОПОК ---
ui.btnPlay.onclick = () => showScreen('SECTORS');
ui.btnBackToMain.onclick = () => showScreen('MAIN');

ui.openShopBtn.onclick = () => { gameState = 'PAUSED'; updateUI(); ui.hud.classList.add('hidden'); ui.shopModal.classList.remove('hidden'); };
ui.closeShopBtn.onclick = () => { gameState = 'PLAYING'; target.x = player.x; target.y = player.y; ui.shopModal.classList.add('hidden'); ui.hud.classList.remove('hidden'); };

function buyUpgrade(type) {
    if (type === 'drone') {
        if (state.coins >= costs.drone() && activeDrones < 3) {
            state.coins -= costs.drone(); activeDrones++; saveProgress(); updateUI();
        }
    } else {
        const cost = costs[type](state[type + 'Level']);
        if (state.coins >= cost) {
            state.coins -= cost; state[type + 'Level']++;
            if (type === 'hp') player.hp = player.maxHp; // Лечим при апгрейде ХП
            saveProgress(); updateUI();
        }
    }
}

ui.buyDroneBtn.onclick = () => buyUpgrade('drone');
ui.upgradeHpBtn.onclick = () => buyUpgrade('hp');
ui.upgradeProfitBtn.onclick = () => buyUpgrade('profit');
ui.upgradeSpeedBtn.onclick = () => buyUpgrade('speed');
ui.upgradeCapBtn.onclick = () => buyUpgrade('capacity');
ui.upgradeMagnetBtn.onclick = () => buyUpgrade('magnet');

ui.nextSectorBtn.onclick = () => {
    if (ys) {
        ys.adv.showFullscreenAdv({
            callbacks: { onClose: () => showScreen('SECTORS'), onError: () => showScreen('SECTORS') }
        });
    } else {
        showScreen('SECTORS');
    }
};

function deathToMenu() {
    showScreen('SECTORS');
}

ui.reviveBtn.onclick = () => {
    if (ys) {
        ys.adv.showRewardedVideo({
            callbacks: {
                onRewarded: () => {
                    player.hp = player.maxHp; player.invulnerableTime = 180; piratesList = [];
                    updateUI(); showScreen('GAME');
                },
                onError: deathToMenu
            }
        });
    } else {
        player.hp = player.maxHp; player.invulnerableTime = 180; piratesList = [];
        updateUI(); showScreen('GAME');
    }
};

ui.restartBtn.onclick = deathToMenu;

// --- СТАРТ И YANDEX SDK ---
showScreen('MAIN');
gameLoop();

if (typeof YaGames !== 'undefined') {
    YaGames.init().then(ysdk => {
        ys = ysdk;
        ys.features.LoadingAPI?.ready();
        ys.getPlayer({ scopes: false }).then(_player => {
            playerSDK = _player;
            // Пытаемся загрузить данные
            playerSDK.getData().then(data => {
                if (data && data.maxSector) {
                    console.log("Данные загружены из облака:", data);
                    state = { ...state, ...data };
                } else {
                    console.log("Новый игрок, используются базовые настройки.");
                }
                updateUI();
            }).catch(e => console.log('Load error', e));
        }).catch(e => console.log('Auth error', e));
    });
}