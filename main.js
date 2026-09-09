// CONNECT
import { joinRoom } from './vendor/trystero/trystero-nostr.min.js';
import { connectMultiplayer } from './multiplayer.js';

const config = { appId: 'kakkoi-game-app' };
const room = joinRoom(config, 'kakkoi-lobby');
const peers = {};
const { sendMove } = connectMultiplayer(room, peers);

// かっこいいゲームのメインスクリプト
console.dir("main.js が読み込まれました！");

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

let playerColor = 'rgb(255, 165, 0)';

let pointer = null;

canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointer = at(e);
});
canvas.addEventListener('pointermove', (e) => {
    if (pointer) pointer = at(e);
});
canvas.addEventListener('pointerup', () => {
    pointer = null;
});

function at(e) {
    const box = canvas.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
}

const held = new Set();
window.addEventListener('keydown', (e) => held.add(e.key));
window.addEventListener('keyup', (e) => held.delete(e.key));

const KEY = 'kakkoi-save';   // one name in the drawer, one save
const VERSION = 2;           // stamped on everything we write

const SIZE = 32;
const SPEED = 220;

function read() {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
}

function fresh() {
    return { x: 100, y: 100, name: '朝倉さん' };
}

function load() {
    let data;
    try {
        data = read();
    } catch (err) {
        console.warn('save is not readable, starting fresh:', err.message);
        return fresh();
    }
    if (data === null) return fresh();
    if (data.version !== VERSION) {
        console.warn('save is version', data.version, 'and we speak', VERSION, '- starting fresh');
        return fresh();
    }
    if (typeof data.x !== 'number' || typeof data.y !== 'number') {
        return fresh();
    }
    return { x: data.x, y: data.y, name: String(data.name || '朝倉さん') };
}

const player = fresh();

// SEND
setInterval(() => {
    sendMove({ x: player.x, y: player.y, color: playerColor });
}, 100);

// セーブ関数
function save() {
    const data = { version: VERSION, name: player.name, x: player.x, y: player.y };
    localStorage.setItem(KEY, JSON.stringify(data));
}

// ボタンクリックによるセーブの実行
document.getElementById('save-btn').addEventListener('click', () => {
    save();
    console.log("手動セーブ完了！");
    // ボタンのテキストを一時的に変更してフィードバック
    const btn = document.getElementById('save-btn');
    const originalText = btn.textContent;
    btn.textContent = "Saved! ✓";
    btn.style.borderColor = "#00ffcc";
    btn.style.color = "#00ffcc";
    btn.style.boxShadow = "0 0 18px #00ffcc";
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.borderColor = "#ff0055";
        btn.style.color = "#ff0055";
        btn.style.boxShadow = "0 0 8px #ff0055";
    }, 1000);
});

// ボタンクリックによるロードの実行
document.getElementById('load-btn').addEventListener('click', () => {
    const data = load();
    player.x = data.x;
    player.y = data.y;
    player.name = data.name;
    console.log("手動ロード完了:", player);
    
    // ボタンのテキストを一時的に変更してフィードバック
    const btn = document.getElementById('load-btn');
    const originalText = btn.textContent;
    btn.textContent = "Loaded! ✓";
    btn.style.borderColor = "#ff0055";
    btn.style.color = "#ff0055";
    btn.style.boxShadow = "0 0 18px #ff0055";
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.borderColor = "#00ffcc";
        btn.style.color = "#00ffcc";
        btn.style.boxShadow = "0 0 8px #00ffcc";
    }, 1000);
});

// 自動で動く2つ目の四角形（エネミー）の定義
const enemy = {
    x: 300,
    y: 200,
    vx: 180, // 秒間移動ピクセル数 (X)
    vy: 180, // 秒間移動ピクセル数 (Y)
    size: 24,
    color: "#00ff66" // ネオングリーン
};

function update(dt) {
    let dx = 0;
    let dy = 0;

    if (held.has('ArrowLeft')  || held.has('a')) dx -= 1;
    if (held.has('ArrowRight') || held.has('d')) dx += 1;
    if (held.has('ArrowUp')    || held.has('w')) dy -= 1;
    if (held.has('ArrowDown')  || held.has('s')) dy += 1;

    if (pointer) {
        const toX = pointer.x - (player.x + SIZE / 2);
        const toY = pointer.y - (player.y + SIZE / 2);
        const distance = Math.hypot(toX, toY);
        if (distance > 1) { dx = toX / distance; dy = toY / distance; }
    }

    player.x += dx * SPEED * dt;
    player.y += dy * SPEED * dt;

    player.x = Math.max(0, Math.min(canvas.width - SIZE, player.x));
    player.y = Math.max(0, Math.min(canvas.height - SIZE, player.y));

    // 2つ目の四角形の移動更新と壁バウンド
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;

    if (enemy.x <= 0) {
        enemy.x = 0;
        enemy.vx = Math.abs(enemy.vx); // 右方向へ反転
    } else if (enemy.x >= canvas.width - enemy.size) {
        enemy.x = canvas.width - enemy.size;
        enemy.vx = -Math.abs(enemy.vx); // 左方向へ反転
    }

    if (enemy.y <= 0) {
        enemy.y = 0;
        enemy.vy = Math.abs(enemy.vy); // 下方向へ反転
    } else if (enemy.y >= canvas.height - enemy.size) {
        enemy.y = canvas.height - enemy.size;
        enemy.vy = -Math.abs(enemy.vy); // 上方向へ反転
    }

    // プレイヤーとエネミー（緑の箱）の衝突判定 (AABB)
    const pLeft = player.x;
    const pRight = player.x + SIZE;
    const pTop = player.y;
    const pBottom = player.y + SIZE;

    const eLeft = enemy.x;
    const eRight = enemy.x + enemy.size;
    const eTop = enemy.y;
    const eBottom = enemy.y + enemy.size;

    if (eRight > pLeft && eLeft < pRight && eBottom > pTop && eTop < pBottom) {
        // 重なり量を計算して侵入方向を判定
        const overlapX = Math.min(eRight - pLeft, pRight - eLeft);
        const overlapY = Math.min(eBottom - pTop, pBottom - eTop);

        const speed = Math.hypot(enemy.vx, enemy.vy);

        if (overlapX < overlapY) {
            // 左右からの衝突
            if (enemy.x + enemy.size / 2 < player.x + SIZE / 2) {
                // 左側に衝突
                enemy.x = player.x - enemy.size;
                enemy.vx = -Math.abs(enemy.vx);
            } else {
                // 右側に衝突
                enemy.x = player.x + SIZE;
                enemy.vx = Math.abs(enemy.vx);
            }

            // 当たったY座標の相対位置（-1 〜 1）を取得
            const relativeY = (enemy.y + enemy.size / 2) - (player.y + SIZE / 2);
            const normalizedY = relativeY / (SIZE / 2 + enemy.size / 2);

            // 当たった位置によってY軸方向の速度をそらし、全体のスピードを維持する
            enemy.vy = normalizedY * speed * 0.8;
            enemy.vx = Math.sign(enemy.vx) * Math.sqrt(Math.max(1000, speed * speed - enemy.vy * enemy.vy));
        } else {
            // 上下からの衝突
            if (enemy.y + enemy.size / 2 < player.y + SIZE / 2) {
                // 上側に衝突
                enemy.y = player.y - enemy.size;
                enemy.vy = -Math.abs(enemy.vy);
            } else {
                // 下側に衝突
                enemy.y = player.y + SIZE;
                enemy.vy = Math.abs(enemy.vy);
            }

            // 当たったX座標の相対位置（-1 〜 1）を取得
            const relativeX = (enemy.x + enemy.size / 2) - (player.x + SIZE / 2);
            const normalizedX = relativeX / (SIZE / 2 + enemy.size / 2);

            // 当たった位置によってX軸方向の速度をそらし、全体のスピードを維持する
            enemy.vx = normalizedX * speed * 0.8;
            enemy.vy = Math.sign(enemy.vy) * Math.sqrt(Math.max(1000, speed * speed - enemy.vx * enemy.vx));
        }
    }
}

// 描画関数
function draw() {
    const timestamp = performance.now();

    // 背景をクリア
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // プレイヤーの色をオレンジ（rgb(255, 165, 0)）と青（rgb(0, 100, 255)）の間で徐々に変化させる
    // 約2秒周期で往復させます
    const cycle = (Math.sin(timestamp * 0.003) + 1) / 2;
    const r = Math.round(255 * (1 - cycle));
    const g = Math.round(165 * (1 - cycle) + 100 * cycle);
    const b = Math.round(255 * cycle);
    playerColor = `rgb(${r}, ${g}, ${b})`;

    // プレイヤーの描画 (かっこいいネオンスクエア)
    ctx.shadowBlur = 15;
    ctx.shadowColor = playerColor;
    ctx.fillStyle = playerColor;
    ctx.fillRect(player.x, player.y, SIZE, SIZE);

    // 2つ目の四角形（エネミー）の描画 (ネオングリーン)
    ctx.shadowColor = enemy.color;
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x, enemy.y, enemy.size, enemy.size);

    // DRAW
    for (const id in peers) {
        const peer = peers[id];
        ctx.shadowColor = peer.color || '#ffaa00';
        ctx.fillStyle = peer.color || '#ffaa00';
        ctx.fillRect(peer.x, peer.y, SIZE, SIZE);
    }
    
    // シャドウ設定を一旦リセットして他を描画
    ctx.shadowBlur = 0;

    // ポインターが押されている場合、かっこいいエフェクトを描画
    if (pointer) {
        // 外側のグロー効果
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 30, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 255, 204, 0.2)";
        ctx.fill();

        // 内側の丸
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#00ffcc";
        ctx.fill();

        // 座標テキストの描画
        ctx.fillStyle = "#ffffff";
        ctx.font = "14px sans-serif";
        ctx.fillText(`X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}`, pointer.x + 15, pointer.y - 15);
    } else {
        // キーボード操作やポインター操作の案内
        ctx.fillStyle = "#888888";
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("WASD / 矢印キー または 画面ドラッグでプレイヤーが動きます", canvas.width / 2, canvas.height / 2);
        ctx.textAlign = "left"; // リセット
    }
}

let previous = performance.now();
function frame(now) {
    const dt = Math.min((now - previous) / 1000, 0.25);
    previous = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
}

// ループの開始
requestAnimationFrame(frame);


