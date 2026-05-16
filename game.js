const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ИНТЕРФЕЙС ---
const ui = {
    level: document.getElementById('level'),
    progress: document.getElementById('progress'),
    coins: document.getElementById('coins'),
    capacity: document.getElementById('capacity'),
    upgradeSpeedBtn: document.getElementById('upgradeSpeedBtn'),
    upgradeCapBtn: document.getElementById('upgradeCapBtn'),
    rewardBtn: document.getElementById('rewardBtn'),
    nextLevelBtn: document.getElementById('nextLevelBtn')
};

// --- СОСТОЯНИЕ ИГРЫ ---
let state = {
    coins: 0,
    level: 1,
    debrisCollected: 0,
    debrisNeeded: 10,
    speedLevel: 1,
    capacityLevel: 1
};

// Yandex SDK переменные
let ys = null;
let playerSDK = null;

// Настройки цен
const upgradeCostBase = 50;
function getUpgradeCost(level) {
    return upgradeCostBase * level;
}

// --- ОБЪЕКТЫ ---
const player = {
    x: 0, y: 0,
    radius: 20,
    color: '#00ffff',
    inventory: 0,
    get speed() { return 4 + state.speedLevel; },
    get maxCapacity() { return 5 + state.capacityLevel * 5; }
};

let target = { x: player.x, y: player.y };

const base = {
    x: 0, y: 0,
    radius: 70,
    color: '#ff00ff'
};

let debrisList = [];

// --- ИНИЦИАЛИЗАЦИЯ И РЕСАЙЗ ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Изначально ставим НЛО в центр, а базу вниз
    if (player.x === 0 && player.y === 0) {
        player.x = canvas.width / 2;
        player.y = canvas.height / 2;
        target.x = player.x;
        target.y = player.y;
    }

    base.x = canvas.width / 2;
    base.y = canvas.height - 100;
}
window.addEventListener('resize', resize);
resize();

// --- УПРАВЛЕНИЕ ---
window.addEventListener('mousemove', (e) => { target.x = e.clientX; target.y = e.clientY; });
window.addEventListener('touchmove', (e) => { target.x = e.touches[0].clientX; target.y = e.touches[0].clientY; });
window.addEventListener('touchstart', (e) => { target.x = e.touches[0].clientX; target.y = e.touches[0].clientY; });

// --- ЛОГИКА ИГРЫ ---

// Генерация мусора
function spawnDebris() {
    // Максимум мусора зависит от уровня
    const maxDebris = 15 + state.level * 5;
    if (debrisList.length < maxDebris) {
        debrisList.push({
            x: Math.random() * canvas.width,
            // Генерируем мусор так, чтобы он не попадал на базу
            y: Math.random() * (canvas.height - 200),
            radius: 4 + Math.random() * 6,
            color: '#aaaaaa',
            pulled: false
        });
    }
}
setInterval(spawnDebris, 800);

function updateUI() {
    ui.level.innerText = state.level;
    ui.progress.innerText = `${state.debrisCollected} / ${state.debrisNeeded}`;
    ui.coins.innerText = state.coins;
    ui.capacity.innerText = `${player.inventory} / ${player.maxCapacity}`;

    const speedCost = getUpgradeCost(state.speedLevel);
    const capCost = getUpgradeCost(state.capacityLevel);

    ui.upgradeSpeedBtn.innerText = `Улучшить скорость (${speedCost})`;
    ui.upgradeCapBtn.innerText = `Улучшить вместимость (${capCost})`;

    ui.upgradeSpeedBtn.disabled = state.coins < speedCost;
    ui.upgradeCapBtn.disabled = state.coins < capCost;

    if (state.debrisCollected >= state.debrisNeeded) {
        ui.nextLevelBtn.style.display = 'block';
    } else {
        ui.nextLevelBtn.style.display = 'none';
    }
}

function saveProgress() {
    if (playerSDK) {
        playerSDK.setData(state).catch(err => console.log('Ошибка сохранения', err));
    }
}

function update() {
    // Движение НЛО
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > player.speed) {
        player.x += (dx / dist) * player.speed;
        player.y += (dy / dist) * player.speed;
    } else {
        player.x = target.x;
        player.y = target.y;
    }

    // Взаимодействие с мусором
    const pullRadius = 120;
    for (let i = debrisList.length - 1; i >= 0; i--) {
        let d = debrisList[i];
        let ddx = player.x - d.x;
        let ddy = player.y - d.y;
        let dDist = Math.sqrt(ddx * ddx + ddy * ddy);

        // Начинаем притягивать, если близко и есть место
        if (dDist < pullRadius && player.inventory < player.maxCapacity) {
            d.pulled = true;
        }

        if (d.pulled) {
            // Летим к НЛО (в 2 раза быстрее самого НЛО)
            d.x += (ddx / dDist) * (player.speed * 2);
            d.y += (ddy / dDist) * (player.speed * 2);

            // Если почти коснулись НЛО - поглощаем
            if (dDist < player.radius || dDist < 10) {
                player.inventory++;
                debrisList.splice(i, 1);
                updateUI();
            }
        }
    }

    // Сдача мусора на Базе
    let bdx = base.x - player.x;
    let bdy = base.y - player.y;
    let bDist = Math.sqrt(bdx * bdx + bdy * bdy);

    if (bDist < base.radius + player.radius && player.inventory > 0) {
        state.coins += player.inventory * 5; // 5 монет за 1 мусор

        // Увеличиваем прогресс уровня
        if (state.debrisCollected < state.debrisNeeded) {
            state.debrisCollected = Math.min(state.debrisCollected + player.inventory, state.debrisNeeded);
        }

        player.inventory = 0;
        saveProgress();
        updateUI();
    }
}

// --- ОТРИСОВКА ---
function draw() {
    ctx.fillStyle = '#1c1c24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Рисуем базу
    ctx.beginPath();
    ctx.arc(base.x, base.y, base.radius, 0, Math.PI * 2);
    ctx.fillStyle = base.color;
    ctx.fill();
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('БАЗА', base.x, base.y + 7);

    // Рисуем мусор
    debrisList.forEach(d => {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.fill();
        ctx.closePath();
    });

    // Рисуем НЛО
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.closePath();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// --- СОБЫТИЯ КНОПОК ---
ui.upgradeSpeedBtn.onclick = () => {
    let cost = getUpgradeCost(state.speedLevel);
    if (state.coins >= cost) {
        state.coins -= cost;
        state.speedLevel++;
        saveProgress();
        updateUI();
    }
};

ui.upgradeCapBtn.onclick = () => {
    let cost = getUpgradeCost(state.capacityLevel);
    if (state.coins >= cost) {
        state.coins -= cost;
        state.capacityLevel++;
        saveProgress();
        updateUI();
    }
};

function levelUp() {
    state.level++;
    state.debrisCollected = 0;
    state.debrisNeeded = 10 + state.level * 5;
    debrisList = []; // Очищаем мусор на новом уровне
    saveProgress();
    updateUI();
}

ui.nextLevelBtn.onclick = () => {
    // Показываем полноэкранную рекламу перед новым уровнем
    if (ys) {
        ys.adv.showFullscreenAdv({
            callbacks: {
                onClose: function(wasShown) { levelUp(); },
                onError: function(error) { levelUp(); }
            }
        });
    } else {
        levelUp();
    }
};

ui.rewardBtn.onclick = () => {
    // Видео за вознаграждение
    if (ys) {
        ys.adv.showRewardedVideo({
            callbacks: {
                onRewarded: () => {
                    state.coins += 500;
                    saveProgress();
                    updateUI();
                },
                onError: (e) => {
                    console.log('Ошибка рекламы', e);
                }
            }
        });
    } else {
        // Заглушка для теста без Яндекса
        state.coins += 500;
        updateUI();
    }
};

// --- СТАРТ ---
updateUI();
gameLoop();

// Подключение Яндекс SDK
if (typeof YaGames !== 'undefined') {
    YaGames.init().then(ysdk => {
        ys = ysdk;
        ys.features.LoadingAPI?.ready(); // Говорим Яндексу, что игра загружена

        ys.getPlayer({ scopes: false }).then(_player => {
            playerSDK = _player;
            playerSDK.getData().then(data => {
                // Восстанавливаем сохранение
                if (data && data.level) {
                    state = { ...state, ...data };
                }
                updateUI();
            }).catch(err => console.log('Ошибка загрузки данных', err));
        }).catch(err => console.log('Ошибка getPlayer', err));
    }).catch(err => console.log('Ошибка инициализации SDK', err));
}