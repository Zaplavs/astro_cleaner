const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- UI ЭЛЕМЕНТЫ ---
const ui = {
    level: document.getElementById('level'),
    progress: document.getElementById('progress'),
    coins: document.getElementById('coins'),
    capacity: document.getElementById('capacity'),
    hpFill: document.getElementById('hpFill'),
    damageFlash: document.getElementById('damageFlash'),

    // Кнопки
    upgradeSpeedBtn: document.getElementById('upgradeSpeedBtn'),
    upgradeCapBtn: document.getElementById('upgradeCapBtn'),
    upgradeMagnetBtn: document.getElementById('upgradeMagnetBtn'),
    upgradeDroneBtn: document.getElementById('upgradeDroneBtn'),

    // Экраны
    overlayScreen: document.getElementById('overlayScreen'),
    overlayTitle: document.getElementById('overlayTitle'),
    overlayText: document.getElementById('overlayText'),
    nextSectorBtn: document.getElementById('nextSectorBtn'),

    reviveScreen: document.getElementById('reviveScreen'),
    reviveBtn: document.getElementById('reviveBtn'),
    restartBtn: document.getElementById('restartBtn')
};

// --- СОСТОЯНИЕ ИГРЫ ---
let state = {
    coins: 0,
    sector: 1,
    debrisCollected: 0,
    speedLevel: 1,
    capacityLevel: 1,
    magnetLevel: 1,
    droneLevel: 0
};

let gameState = 'PLAYING'; // PLAYING, PAUSED, GAME_OVER

// Настройки стоимости
const costs = {
    speed: (lvl) => 50 * lvl,
    capacity: (lvl) => 50 * lvl,
    magnet: (lvl) => 100 * lvl,
    drone: (lvl) => lvl === 0 ? 200 : 300 * lvl
};

let ys = null;
let playerSDK = null;

// --- ИГРОВЫЕ ОБЪЕКТЫ ---
const player = {
    x: 0, y: 0,
    radius: 20,
    inventory: 0,
    hp: 100, maxHp: 100,
    invulnerableTime: 0,
    get speed() { return 4 + state.speedLevel; },
    get maxCapacity() { return 10 + state.capacityLevel * 5; },
    get magnetRadius() { return 100 + state.magnetLevel * 30; }
};

let target = { x: player.x, y: player.y };

const base = {
    x: 0, y: 0,
    radius: 80,
    rotation: 0
};

let debrisList = [];
let piratesList = [];
let floatingTexts = [];

// Дрон
let droneObj = { angle: 0, dist: 60, radius: 8 };

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function getDebrisNeeded() { return 20 + state.sector * 10; }
function getDebrisValue() { return 5 + (state.sector - 1) * 2; }
function getPirateCount() { return Math.min(1 + Math.floor(state.sector / 2), 10); }

// --- ИНИЦИАЛИЗАЦИЯ И РЕСАЙЗ ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (player.x === 0 && player.y === 0) {
        player.x = canvas.width / 2;
        player.y = canvas.height / 2 + 100;
        target.x = player.x; target.y = player.y;
    }
    base.x = canvas.width / 2;
    base.y = canvas.height / 2;
}
window.addEventListener('resize', resize);
resize();

// Управление
window.addEventListener('mousemove', (e) => { if(gameState==='PLAYING'){target.x = e.clientX; target.y = e.clientY;} });
window.addEventListener('touchmove', (e) => { if(gameState==='PLAYING'){target.x = e.touches[0].clientX; target.y = e.touches[0].clientY;} });
window.addEventListener('touchstart', (e) => { if(gameState==='PLAYING'){target.x = e.touches[0].clientX; target.y = e.touches[0].clientY;} });

// --- СПАВНЕРЫ ---
function spawnDebris() {
    if (gameState !== 'PLAYING') return;
    const maxDebris = 15 + state.sector * 5;
    if (debrisList.length < maxDebris) {
        // Спавним подальше от базы
        let x, y, dDist;
        do {
            x = Math.random() * canvas.width;
            y = Math.random() * canvas.height;
            dDist = Math.hypot(x - base.x, y - base.y);
        } while(dDist < base.radius + 50);

        debrisList.push({
            x: x, y: y,
            radius: 4 + Math.random() * 8,
            pulled: false,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.1,
            type: Math.floor(Math.random() * 3) // Разные формы мусора
        });
    }
}
setInterval(spawnDebris, 800);

function spawnPirate() {
    if (gameState !== 'PLAYING') return;
    if (piratesList.length < getPirateCount()) {
        // Спавн за краем экрана
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.max(canvas.width, canvas.height);
        piratesList.push({
            x: player.x + Math.cos(angle) * dist,
            y: player.y + Math.sin(angle) * dist,
            radius: 15,
            speed: 2 + state.sector * 0.2, // Пираты быстрее с каждым сектором
            wobble: Math.random() * Math.PI * 2
        });
    }
}
setInterval(spawnPirate, 2000);

// --- ЛОГИКА ---
function updateUI() {
    ui.level.innerText = state.sector;
    ui.progress.innerText = `${state.debrisCollected} / ${getDebrisNeeded()}`;
    ui.coins.innerText = state.coins;
    ui.capacity.innerText = `${player.inventory} / ${player.maxCapacity}`;

    // HP
    const hpPercent = Math.max(0, (player.hp / player.maxHp) * 100);
    ui.hpFill.style.width = hpPercent + '%';

    // Кнопки
    ui.upgradeSpeedBtn.innerText = `Скорость (${costs.speed(state.speedLevel)})`;
    ui.upgradeCapBtn.innerText = `Трюм (${costs.capacity(state.capacityLevel)})`;
    ui.upgradeMagnetBtn.innerText = `Магнит (${costs.magnet(state.magnetLevel)})`;
    ui.upgradeDroneBtn.innerText = state.droneLevel === 0 ? `Купить Дрона (${costs.drone(0)})` : `Дрон ур.${state.droneLevel} (MAX)`;

    ui.upgradeSpeedBtn.disabled = state.coins < costs.speed(state.speedLevel);
    ui.upgradeCapBtn.disabled = state.coins < costs.capacity(state.capacityLevel);
    ui.upgradeMagnetBtn.disabled = state.coins < costs.magnet(state.magnetLevel);
    ui.upgradeDroneBtn.disabled = state.droneLevel > 0 || state.coins < costs.drone(0);
}

function showFloatingText(text, x, y, color) {
    floatingTexts.push({ text, x, y, color, life: 1.0 });
}

function takeDamage() {
    if (player.invulnerableTime > 0) return;

    player.hp -= 25;
    player.invulnerableTime = 60; // 1 секунда при 60fps

    // Эффект вспышки
    ui.damageFlash.style.opacity = '1';
    setTimeout(() => { ui.damageFlash.style.opacity = '0'; }, 100);

    updateUI();

    if (player.hp <= 0) {
        gameState = 'GAME_OVER';
        ui.reviveScreen.classList.remove('hidden');
    }
}

function update() {
    if (gameState !== 'PLAYING') return;

    // Вращение базы
    base.rotation += 0.005;

    // Движение НЛО
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > player.speed) {
        player.x += (dx / dist) * player.speed;
        player.y += (dy / dist) * player.speed;
    }

    if (player.invulnerableTime > 0) player.invulnerableTime--;

    // Обновление дрона
    let droneX = player.x, droneY = player.y;
    if (state.droneLevel > 0) {
        droneObj.angle += 0.05;
        droneX = player.x + Math.cos(droneObj.angle) * droneObj.dist;
        droneY = player.y + Math.sin(droneObj.angle) * droneObj.dist;
    }

    // Взаимодействие с мусором
    for (let i = debrisList.length - 1; i >= 0; i--) {
        let d = debrisList[i];
        d.rotation += d.rotSpeed;

        let ddx = player.x - d.x;
        let ddy = player.y - d.y;
        let dDist = Math.hypot(ddx, ddy);

        // Дрон тоже может притягивать
        let drDist = state.droneLevel > 0 ? Math.hypot(droneX - d.x, droneY - d.y) : Infinity;

        // Притягивание
        if (player.inventory < player.maxCapacity) {
            if (dDist < player.magnetRadius) d.pulled = 'player';
            else if (drDist < player.magnetRadius / 2) d.pulled = 'drone';
        }

        if (d.pulled === 'player') {
            d.x += (ddx / dDist) * (player.speed * 2);
            d.y += (ddy / dDist) * (player.speed * 2);
            if (dDist < player.radius) {
                player.inventory++;
                debrisList.splice(i, 1);
                updateUI();
            }
        } else if (d.pulled === 'drone') {
            d.x += ((droneX - d.x) / drDist) * (player.speed * 2);
            d.y += ((droneY - d.y) / drDist) * (player.speed * 2);
            if (drDist < droneObj.radius) {
                player.inventory++;
                debrisList.splice(i, 1);
                updateUI();
            }
        }
    }

    // Пираты
    for (let i = piratesList.length - 1; i >= 0; i--) {
        let p = piratesList[i];
        // Пират летит к игроку
        let pdx = player.x - p.x;
        let pdy = player.y - p.y;
        let pDist = Math.hypot(pdx, pdy);

        p.wobble += 0.1;
        let wx = Math.cos(p.wobble) * 2;
        let wy = Math.sin(p.wobble) * 2;

        if (pDist > 0) {
            p.x += (pdx / pDist) * p.speed + wx;
            p.y += (pdy / pDist) * p.speed + wy;
        }

        // Столкновение с игроком
        if (pDist < player.radius + p.radius) {
            takeDamage();
            // Отбрасываем пирата
            p.x -= (pdx / pDist) * 50;
            p.y -= (pdy / pDist) * 50;
        }
    }

    // Сдача на Базе
    let bDist = Math.hypot(base.x - player.x, base.y - player.y);
    if (bDist < base.radius + player.radius && player.inventory > 0) {
        let earned = player.inventory * getDebrisValue();
        state.coins += earned;

        showFloatingText(`+${earned}$`, player.x, player.y - 30, '#00ff00');

        state.debrisCollected += player.inventory;
        player.inventory = 0;

        saveProgress();
        updateUI();

        // Проверка завершения сектора
        if (state.debrisCollected >= getDebrisNeeded()) {
            gameState = 'PAUSED';
            ui.overlayScreen.classList.remove('hidden');
        }
    }

    // Анимация текста
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].y -= 1;
        floatingTexts[i].life -= 0.02;
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }
}

// --- ОТРИСОВКА СПРАЙТОВ (КАНВАС) ---

function drawPlayer(x, y, isInvulnerable) {
    ctx.save();
    ctx.translate(x, y);

    // Мигание при неуязвимости
    if (isInvulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }

    // Свечение двигателя
    ctx.beginPath();
    ctx.arc(0, 5, 15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.filter = 'blur(5px)';
    ctx.fill();
    ctx.filter = 'none';

    // Тело тарелки
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#aaa';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Кабина
    ctx.beginPath();
    ctx.arc(0, -5, 10, Math.PI, 0);
    ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

function drawBase(x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // Панели
    ctx.fillStyle = '#1a365d';
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    for(let i=0; i<4; i++) {
        ctx.rotate(Math.PI/2);
        ctx.fillRect(-20, -75, 40, 50);
        ctx.strokeRect(-20, -75, 40, 50);
        // Линии на панелях
        ctx.beginPath();
        ctx.moveTo(-10, -75); ctx.lineTo(-10, -25);
        ctx.moveTo(10, -75); ctx.lineTo(10, -25);
        ctx.stroke();
    }

    // Центральный хаб
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#2d3748';
    ctx.fill();
    ctx.stroke();

    // Внутреннее свечение
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#ff00ff';
    ctx.fill();

    ctx.restore();

    // Текст поверх базы
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('БАЗА', x, y + 5);
}

function drawPirate(x, y, pX, pY) {
    ctx.save();
    ctx.translate(x, y);
    // Поворот к игроку
    let angle = Math.atan2(pY - y, pX - x);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, 10);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, -10);
    ctx.closePath();
    ctx.fillStyle = '#e53e3e';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
}

function drawDebris(d) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rotation);

    ctx.beginPath();
    if (d.type === 0) { // Треугольный
        ctx.moveTo(0, -d.radius); ctx.lineTo(d.radius, d.radius); ctx.lineTo(-d.radius, d.radius);
    } else if (d.type === 1) { // Квадратный
        ctx.rect(-d.radius, -d.radius, d.radius*2, d.radius*2);
    } else { // Многоугольник
        for (let i = 0; i < 5; i++) {
            ctx.lineTo(Math.cos(i * 1.25) * d.radius, Math.sin(i * 1.25) * d.radius);
        }
    }
    ctx.closePath();
    ctx.fillStyle = '#a0aec0';
    ctx.fill();
    ctx.strokeStyle = '#718096';
    ctx.stroke();

    ctx.restore();
}

function drawDrone(x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * 2);

    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#edf2f7';
    ctx.fill();
    ctx.stroke();

    // Антенны
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(0, -12);
    ctx.moveTo(-5, 3); ctx.lineTo(-10, 6);
    ctx.moveTo(5, 3); ctx.lineTo(10, 6);
    ctx.strokeStyle = '#00ffff';
    ctx.stroke();

    ctx.restore();
}

// --- ОТРИСОВКА ---
function draw() {
    // Фон
    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Звезды (простые точки)
    ctx.fillStyle = '#fff';
    for(let i=0; i<20; i++) {
        let sx = (i * 137) % canvas.width;
        let sy = (i * 251 + base.rotation * 100) % canvas.height;
        ctx.fillRect(sx, sy, 1, 1);
    }

    drawBase(base.x, base.y, base.rotation);

    debrisList.forEach(drawDebris);

    piratesList.forEach(p => drawPirate(p.x, p.y, player.x, player.y));

    if (state.droneLevel > 0) {
        let droneX = player.x + Math.cos(droneObj.angle) * droneObj.dist;
        let droneY = player.y + Math.sin(droneObj.angle) * droneObj.dist;
        drawDrone(droneX, droneY, droneObj.angle);
    }

    if (player.hp > 0) {
        drawPlayer(player.x, player.y, player.invulnerableTime > 0);
    }

    // Плавающий текст
    floatingTexts.forEach(t => {
        ctx.fillStyle = t.color;
        ctx.globalAlpha = t.life;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1.0;
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// --- ВЗАИМОДЕЙСТВИЕ И СОХРАНЕНИЕ ---
function saveProgress() {
    if (playerSDK) {
        playerSDK.setData(state).catch(err => console.log('Save Error', err));
    }
}

// Обработчики кнопок апгрейдов
function buyUpgrade(type) {
    const cost = costs[type](state[type + 'Level']);
    if (state.coins >= cost) {
        if (type === 'drone' && state.droneLevel >= 1) return; // Только 1 дрон
        state.coins -= cost;
        state[type + 'Level']++;
        saveProgress();
        updateUI();
    }
}
ui.upgradeSpeedBtn.onclick = () => buyUpgrade('speed');
ui.upgradeCapBtn.onclick = () => buyUpgrade('capacity');
ui.upgradeMagnetBtn.onclick = () => buyUpgrade('magnet');
ui.upgradeDroneBtn.onclick = () => buyUpgrade('drone');

// Переход на следующий сектор
function nextSector() {
    state.sector++;
    state.debrisCollected = 0;
    debrisList = [];
    piratesList = [];
    player.hp = player.maxHp;
    saveProgress();
    updateUI();
    gameState = 'PLAYING';
    ui.overlayScreen.classList.add('hidden');
}

ui.nextSectorBtn.onclick = () => {
    if (ys) {
        ys.adv.showFullscreenAdv({
            callbacks: {
                onClose: nextSector,
                onError: nextSector
            }
        });
    } else {
        nextSector();
    }
};

// Воскрешение
function resetToMenu() {
    state.sector = 1;
    state.debrisCollected = 0;
    state.coins = Math.floor(state.coins / 2); // Штраф
    debrisList = [];
    piratesList = [];
    player.hp = player.maxHp;
    saveProgress();
    updateUI();
    gameState = 'PLAYING';
    ui.reviveScreen.classList.add('hidden');
    // Ставим игрока на базу
    player.x = base.x; player.y = base.y + 100;
    target.x = player.x; target.y = player.y;
}

ui.reviveBtn.onclick = () => {
    if (ys) {
        ys.adv.showRewardedVideo({
            callbacks: {
                onRewarded: () => {
                    player.hp = player.maxHp;
                    player.invulnerableTime = 180; // 3 секунды бессмертия после возрождения
                    piratesList = []; // Очищаем пиратов рядом
                    updateUI();
                    gameState = 'PLAYING';
                    ui.reviveScreen.classList.add('hidden');
                },
                onError: resetToMenu
            }
        });
    } else {
        // Для теста локально
        player.hp = player.maxHp;
        player.invulnerableTime = 180;
        piratesList = [];
        updateUI();
        gameState = 'PLAYING';
        ui.reviveScreen.classList.add('hidden');
    }
};

ui.restartBtn.onclick = resetToMenu;

// --- СТАРТ ---
updateUI();
gameLoop();

if (typeof YaGames !== 'undefined') {
    YaGames.init().then(ysdk => {
        ys = ysdk;
        ys.features.LoadingAPI?.ready();
        ys.getPlayer({ scopes: false }).then(_player => {
            playerSDK = _player;
            playerSDK.getData().then(data => {
                if (data && data.sector) {
                    state = { ...state, ...data };
                }
                updateUI();
            }).catch(e => console.log('Load error', e));
        }).catch(e => console.log('Auth error', e));
    });
}