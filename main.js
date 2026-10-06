// CONNECT
// ?v= はブラウザキャッシュ避け。ファイルを変えたら index.html と合わせて番号を上げる。
// p2p-core is pinned so multiplayer behavior does not change underneath the game.
import { joinRoom } from 'https://cdn.jsdelivr.net/gh/KakkoiDev/p2p-core@v0.1.0/p2p-core.js';
import { openPairing } from 'https://cdn.jsdelivr.net/gh/KakkoiDev/p2p-core@v0.1.0/extras/pairing-ui.js';
import { describeStatus, diagnose } from 'https://cdn.jsdelivr.net/gh/KakkoiDev/p2p-core@v0.1.0/extras/status-ui.js';
import { connectMultiplayer } from './multiplayer.js?v=2026-10-06a';

// p2p-core keeps the existing Trystero/Nostr wire format, but adds the shared
// relay pool, same-browser/LAN transports, status diagnostics and manual pairing.
// Cross-network WebRTC still needs TURN on networks that block direct links.
const room = joinRoom({
    app: 'kakkoi-game-app',
    room: 'kakkoi-lobby',
    mode: 'auto',
    allow: {
        sameBrowser: true,
        sameNetwork: true,
        otherNetworks: true
    },
    kinds: ['move', 'puck', 'score', 'reset'],
    validate: {
        move: (data) => Number.isFinite(data?.x) && Number.isFinite(data?.y) && typeof data?.color === 'string',
        puck: (data) => Number.isFinite(data?.x) && Number.isFinite(data?.y)
            && Number.isFinite(data?.vx) && Number.isFinite(data?.vy),
        score: (data) => data && typeof data === 'object',
        reset: (data) => data && typeof data === 'object'
    },
    rateLimit: 60
});
const peers = {};

const networkStatus = document.getElementById('network-status');
const pairBtn = document.getElementById('pair-btn');
const networkStartedAt = performance.now();

function renderNetworkStatus() {
    if (!networkStatus) return;
    const status = room.status();
    const relays = status.transports?.relays;
    const issue = diagnose(status, performance.now() - networkStartedAt);

    if (status.peers > 0) {
        networkStatus.textContent = `ONLINE · ${status.peers + 1} PLAYERS`;
        networkStatus.dataset.state = 'connected';
    } else if (issue) {
        networkStatus.textContent = relays?.open === 0 ? 'P2P · RELAYS BLOCKED' : 'P2P · DIRECT LINK BLOCKED?';
        networkStatus.dataset.state = 'warning';
    } else if (relays?.state === 'ready') {
        networkStatus.textContent = `P2P READY · ${relays.open}/${relays.total} RELAYS`;
        networkStatus.dataset.state = 'ready';
    } else {
        networkStatus.textContent = 'P2P · CONNECTING…';
        networkStatus.dataset.state = 'connecting';
    }

    networkStatus.title = issue || describeStatus(status);
}

room.onStatus(renderNetworkStatus);
room.onPeerJoin(renderNetworkStatus);
room.onPeerLeave(renderNetworkStatus);
room.onError((error) => {
    console.warn('p2p-core:', error);
    renderNetworkStatus();
});
renderNetworkStatus();
setInterval(renderNetworkStatus, 5000);

if (pairBtn) {
    pairBtn.addEventListener('click', async () => {
        try {
            const peerId = await openPairing(room, {
                text: {
                    title: '手動ペアリング',
                    intro: '自動接続できないとき、2台をコードで直接つなぎます。',
                    invite: 'この端末から招待',
                    join: 'コードで参加',
                    close: '閉じる',
                    back: '戻る',
                    making: '招待コードを作成中…',
                    inviteShow: 'もう一方の端末で「コードで参加」を選び、このQRコードを読み取ってください。',
                    copy: 'コードをコピー',
                    copied: 'コピーしました',
                    answerPrompt: '相手側に表示された回答コードを読み取るか貼り付けてください。',
                    scanAnswer: '回答QRを読む',
                    scanInvite: '招待QRを読む',
                    pastePrompt: 'またはコードを貼り付け:',
                    connect: '接続',
                    answerShow: 'この回答コードを招待した端末に見せてください。',
                    waiting: '接続を待っています…',
                    connected: '接続しました！',
                    noCamera: 'カメラが使えない場合は、コードをコピーして共有してください。',
                    stopScan: 'カメラを停止'
                }
            });
            if (peerId) renderNetworkStatus();
        } catch (error) {
            console.warn('manual pairing failed:', error);
            if (networkStatus) {
                networkStatus.textContent = 'P2P · PAIRING FAILED';
                networkStatus.title = error?.message || String(error);
                networkStatus.dataset.state = 'warning';
            }
        }
    });
}

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

// ゲーム定数
const PLAYER_SIZE = 32;
const PLAYER_SPEED = 250;
const GOAL_HEIGHT = 160;
const GOAL_TOP = (canvas.height - GOAL_HEIGHT) / 2; // 160
const GOAL_BOTTOM = GOAL_TOP + GOAL_HEIGHT;         // 320
const GOAL_DEPTH = 18;

const POINTS_TO_WIN_SET = 25; // 25点先制で1セット勝利
const SETS_TO_WIN_GAME = 5;   // 5セット先取で完全勝利

// スコア・セット管理
const points = { left: 0, right: 0 };
const sets = { left: 0, right: 0 };

let lastScorer = null; // 'left' | 'right' | null
let comboCount = 0;

let gameState = 'PLAYING'; // 'PLAYING' | 'SET_WON' | 'GAME_WON'
let winnerSide = null;     // 'left' | 'right' | null

// 自プレイヤーの初期位置（自陣・左側）
const player = {
    x: 100,
    y: canvas.height / 2 - PLAYER_SIZE / 2,
    name: '朝倉さん'
};

let playerColor = 'rgb(0, 240, 255)';

// 動く四角（パック）
const puck = {
    x: canvas.width / 2 - 12,
    y: canvas.height / 2 - 12,
    vx: 220,
    vy: 140,
    size: 24,
    color: "#00ff66" // ネオングリーン
};

// エフェクト管理
const GOAL_EFFECT_DURATION = 2.0;
let goalEffectTimer = 0;
let goalMessage = 'GOAL！！';
let comboMessage = '';
let goalSubMessage = '';

let setWinTimer = 0;
let victoryTimer = 0;

function triggerGoalEffect(scorerSide, combo, addedPoints) {
    goalMessage = 'GOAL！！';
    goalEffectTimer = GOAL_EFFECT_DURATION; // 2秒間

    if (combo >= 2) {
        const bonus = combo - 1;
        comboMessage = `⚡ ${combo} Combo！ (+${bonus}点) ⚡`;
    } else {
        comboMessage = '';
    }

    if (scorerSide === 'left') {
        goalSubMessage = `自陣得点 (+${addedPoints} pts)`;
    } else {
        goalSubMessage = `敵陣得点 (+${addedPoints} pts)`;
    }
}

function triggerSetWinEffect(scorerSide) {
    setWinTimer = 2.4;
}

function triggerVictoryEffect(scorerSide) {
    victoryTimer = 9999; // リセットされるまで表示
}

function resetPuck(serveDirection = 0) {
    puck.x = canvas.width / 2 - puck.size / 2;
    puck.y = canvas.height / 2 - puck.size / 2;
    const dirX = serveDirection !== 0 ? serveDirection : (Math.random() > 0.5 ? 1 : -1);
    const dirY = (Math.random() - 0.5) * 1.6;
    const speed = 230;
    const angle = Math.atan2(dirY, dirX);
    puck.vx = Math.cos(angle) * speed;
    puck.vy = Math.sin(angle) * speed;
}

// マルチプレイヤー接続
const { sendMove, sendPuck, sendScore, sendReset } = connectMultiplayer(room, peers, {
    onPuck: (data) => {
        puck.x = data.x;
        puck.y = data.y;
        puck.vx = data.vx;
        puck.vy = data.vy;
    },
    onScore: (data) => {
        if (data.points) {
            points.left = data.points.left;
            points.right = data.points.right;
        }
        if (data.sets) {
            sets.left = data.sets.left;
            sets.right = data.sets.right;
        }
        if (data.state) {
            gameState = data.state;
            winnerSide = data.winner || null;
            if (gameState === 'SET_WON') triggerSetWinEffect(winnerSide);
            if (gameState === 'GAME_WON') triggerVictoryEffect(winnerSide);
        }
        if (data.scorer) {
            triggerGoalEffect(data.scorer, data.combo || 1, data.addedPoints || 1);
        }
    },
    onReset: () => {
        points.left = 0;
        points.right = 0;
        sets.left = 0;
        sets.right = 0;
        lastScorer = null;
        comboCount = 0;
        gameState = 'PLAYING';
        winnerSide = null;
        setWinTimer = 0;
        victoryTimer = 0;
        resetPuck(0);
        goalMessage = 'RESET!';
        comboMessage = '';
        goalSubMessage = 'スコア＆セット初期化';
        goalEffectTimer = 1.5;
    }
});

// 定期的な自分の位置送信
setInterval(() => {
    sendMove({ x: player.x, y: player.y, color: playerColor });
}, 100);

// RESETボタンのイベントリスナー
const resetBtn = document.getElementById('reset-btn');
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        points.left = 0;
        points.right = 0;
        sets.left = 0;
        sets.right = 0;
        lastScorer = null;
        comboCount = 0;
        gameState = 'PLAYING';
        winnerSide = null;
        setWinTimer = 0;
        victoryTimer = 0;
        resetPuck(0);

        goalMessage = 'RESET!';
        comboMessage = '';
        goalSubMessage = 'スコア＆セット初期化';
        goalEffectTimer = 1.5;

        sendReset({});
        sendPuck({ x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy });
        sendScore({
            points: { left: 0, right: 0 },
            sets: { left: 0, right: 0 },
            state: 'PLAYING',
            winner: null
        });

        const originalText = resetBtn.textContent;
        resetBtn.textContent = "Reset Done! ✓";
        resetBtn.style.borderColor = "#ff007f";
        resetBtn.style.color = "#ff007f";
        resetBtn.style.boxShadow = "0 0 20px #ff007f";
        setTimeout(() => {
            resetBtn.textContent = originalText;
            resetBtn.style.borderColor = "#00f0ff";
            resetBtn.style.color = "#00f0ff";
            resetBtn.style.boxShadow = "0 0 12px rgba(0, 240, 255, 0.4)";
        }, 1000);
    });
}

// ポインター操作
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

// キーボード操作
const held = new Set();
window.addEventListener('keydown', (e) => held.add(e.key));
window.addEventListener('keyup', (e) => held.delete(e.key));

// パドル（プレイヤー／相手）とパックの衝突判定・跳ね返し
function checkPaddleCollision(paddle, size) {
    if (gameState === 'GAME_WON') return false;

    const pLeft = paddle.x;
    const pRight = paddle.x + size;
    const pTop = paddle.y;
    const pBottom = paddle.y + size;

    const eLeft = puck.x;
    const eRight = puck.x + puck.size;
    const eTop = puck.y;
    const eBottom = puck.y + puck.size;

    if (eRight > pLeft && eLeft < pRight && eBottom > pTop && eTop < pBottom) {
        const overlapX = Math.min(eRight - pLeft, pRight - eLeft);
        const overlapY = Math.min(eBottom - pTop, pBottom - eTop);
        const currentSpeed = Math.max(220, Math.hypot(puck.vx, puck.vy));

        if (overlapX < overlapY) {
            // 左右衝突
            if (puck.x + puck.size / 2 < paddle.x + size / 2) {
                puck.x = paddle.x - puck.size;
                puck.vx = -Math.abs(puck.vx);
            } else {
                puck.x = paddle.x + size;
                puck.vx = Math.abs(puck.vx);
            }

            const relativeY = (puck.y + puck.size / 2) - (paddle.y + size / 2);
            const normalizedY = relativeY / (size / 2 + puck.size / 2);
            puck.vy = normalizedY * currentSpeed * 0.85;
            puck.vx = Math.sign(puck.vx) * Math.sqrt(Math.max(1200, currentSpeed * currentSpeed - puck.vy * puck.vy));
        } else {
            // 上下衝突
            if (puck.y + puck.size / 2 < paddle.y + size / 2) {
                puck.y = paddle.y - puck.size;
                puck.vy = -Math.abs(puck.vy);
            } else {
                puck.y = paddle.y + size;
                puck.vy = Math.abs(puck.vy);
            }

            const relativeX = (puck.x + puck.size / 2) - (paddle.x + size / 2);
            const normalizedX = relativeX / (size / 2 + puck.size / 2);
            puck.vx = normalizedX * currentSpeed * 0.85;
            puck.vy = Math.sign(puck.vy) * Math.sqrt(Math.max(1200, currentSpeed * currentSpeed - puck.vy * puck.vy));
        }

        // 衝突が起きたらパックの最新位置と速度を同期
        sendPuck({ x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy });
        return true;
    }
    return false;
}

// ゴールスコア処理（コンボ、25点先制、5セットVICTORY）
function scoreGoal(scorerSide) {
    if (gameState === 'GAME_WON' || gameState === 'SET_WON') return;

    let addedPoints = 1;
    let combo = 1;

    if (lastScorer === scorerSide) {
        comboCount++;
        combo = comboCount;
        const bonus = comboCount - 1; // 2連続なら+1, 3連続なら+2...
        addedPoints = 1 + bonus;
    } else {
        lastScorer = scorerSide;
        comboCount = 1;
        combo = 1;
    }

    points[scorerSide] += addedPoints;
    triggerGoalEffect(scorerSide, combo, addedPoints);

    // 25点先制判定（セット勝利）
    if (points[scorerSide] >= POINTS_TO_WIN_SET) {
        sets[scorerSide]++;
        lastScorer = null;
        comboCount = 0;

        // 5セット先取判定（ゲーム完全勝利）
        if (sets[scorerSide] >= SETS_TO_WIN_GAME) {
            gameState = 'GAME_WON';
            winnerSide = scorerSide;
            triggerVictoryEffect(scorerSide);
        } else {
            gameState = 'SET_WON';
            winnerSide = scorerSide;
            triggerSetWinEffect(scorerSide);
        }

        sendScore({
            points: { left: points.left, right: points.right },
            sets: { left: sets.left, right: sets.right },
            scorer: scorerSide,
            combo,
            addedPoints,
            state: gameState,
            winner: winnerSide
        });

        if (gameState === 'SET_WON') {
            setTimeout(() => {
                if (gameState === 'SET_WON') {
                    points.left = 0;
                    points.right = 0;
                    gameState = 'PLAYING';
                    winnerSide = null;
                    resetPuck(scorerSide === 'left' ? 1 : -1);
                    sendScore({
                        points: { left: 0, right: 0 },
                        sets: { left: sets.left, right: sets.right },
                        state: 'PLAYING',
                        winner: null
                    });
                    sendPuck({ x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy });
                }
            }, 2300);
        }
        return;
    }

    resetPuck(scorerSide === 'left' ? 1 : -1);
    sendScore({
        points: { left: points.left, right: points.right },
        sets: { left: sets.left, right: sets.right },
        scorer: scorerSide,
        combo,
        addedPoints,
        state: gameState
    });
    sendPuck({ x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy });
}

// ゲーム状態の更新
function update(dt) {
    if (goalEffectTimer > 0) goalEffectTimer -= dt;
    if (setWinTimer > 0) setWinTimer -= dt;
    if (victoryTimer > 0) victoryTimer -= dt;

    if (gameState === 'GAME_WON') return;

    // プレイヤーの移動
    let dx = 0;
    let dy = 0;

    if (held.has('ArrowLeft')  || held.has('a')) dx -= 1;
    if (held.has('ArrowRight') || held.has('d')) dx += 1;
    if (held.has('ArrowUp')    || held.has('w')) dy -= 1;
    if (held.has('ArrowDown')  || held.has('s')) dy += 1;

    if (pointer) {
        const toX = pointer.x - (player.x + PLAYER_SIZE / 2);
        const toY = pointer.y - (player.y + PLAYER_SIZE / 2);
        const distance = Math.hypot(toX, toY);
        if (distance > 1) { dx = toX / distance; dy = toY / distance; }
    }

    player.x += dx * PLAYER_SPEED * dt;
    player.y += dy * PLAYER_SPEED * dt;

    player.x = Math.max(0, Math.min(canvas.width - PLAYER_SIZE, player.x));
    player.y = Math.max(0, Math.min(canvas.height - PLAYER_SIZE, player.y));

    // パックの移動（セット勝利時の一時停止中はパックを減速）
    if (gameState !== 'SET_WON') {
        puck.x += puck.vx * dt;
        puck.y += puck.vy * dt;
    }

    // 上下の壁バウンド
    if (puck.y <= 0) {
        puck.y = 0;
        puck.vy = Math.abs(puck.vy);
    } else if (puck.y >= canvas.height - puck.size) {
        puck.y = canvas.height - puck.size;
        puck.vy = -Math.abs(puck.vy);
    }

    // 左側の壁・ゴール判定（自陣ゴール）
    if (puck.x <= 0) {
        const inGoal = (puck.y + puck.size >= GOAL_TOP && puck.y <= GOAL_BOTTOM);
        if (inGoal) {
            // 敵陣（右側）の得点！
            scoreGoal('right');
        } else {
            puck.x = 0;
            puck.vx = Math.abs(puck.vx);
        }
    }

    // 右側の壁・ゴール判定（敵陣ゴール）
    if (puck.x >= canvas.width - puck.size) {
        const inGoal = (puck.y + puck.size >= GOAL_TOP && puck.y <= GOAL_BOTTOM);
        if (inGoal) {
            // 自陣（左側）の得点！
            scoreGoal('left');
        } else {
            puck.x = canvas.width - puck.size;
            puck.vx = -Math.abs(puck.vx);
        }
    }

    // 自プレイヤーとパックの衝突判定
    checkPaddleCollision(player, PLAYER_SIZE);

    // オンライン相手（peers）とパックの衝突判定（相手もパックを跳ね返せる！）
    for (const id in peers) {
        const peer = peers[id];
        if (peer && typeof peer.x === 'number' && typeof peer.y === 'number') {
            checkPaddleCollision(peer, PLAYER_SIZE);
        }
    }
}

// 描画処理
function draw() {
    const timestamp = performance.now();

    // 1. コート背景（ダークネオン）
    ctx.fillStyle = "#0a0f1d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. コート中央の縦の点線
    ctx.save();
    ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    // 3. コート中央の円の点線
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 65, 0, Math.PI * 2);
    ctx.stroke();

    // 中央のドット
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 240, 255, 0.8)";
    ctx.fill();
    ctx.restore();

    // 4. 左ゴールポスト（自陣ゴール - シアン）
    ctx.save();
    ctx.strokeStyle = "#00f0ff";
    ctx.fillStyle = "rgba(0, 240, 255, 0.18)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 10;
    ctx.fillRect(0, GOAL_TOP, GOAL_DEPTH, GOAL_HEIGHT);
    ctx.strokeRect(0, GOAL_TOP, GOAL_DEPTH, GOAL_HEIGHT);
    ctx.restore();

    // 5. 右ゴールポスト（敵陣ゴール - ネオンピンク）
    ctx.save();
    ctx.strokeStyle = "#ff007f";
    ctx.fillStyle = "rgba(255, 0, 127, 0.18)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ff007f";
    ctx.shadowBlur = 10;
    ctx.fillRect(canvas.width - GOAL_DEPTH, GOAL_TOP, GOAL_DEPTH, GOAL_HEIGHT);
    ctx.strokeRect(canvas.width - GOAL_DEPTH, GOAL_TOP, GOAL_DEPTH, GOAL_HEIGHT);
    ctx.restore();

    // 6. スコアボード（セット数＆ポイント）
    ctx.save();
    // セットスコア（最上部）
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`SETS (5先取) : [ ${sets.left} - ${sets.right} ]`, canvas.width / 2, 22);

    // ポイントスコア（中央）
    ctx.font = "bold 32px 'Segoe UI', Tahoma, sans-serif";

    // 自陣ポイント（左）
    ctx.fillStyle = "#00f0ff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 12;
    ctx.fillText(`${points.left}`, canvas.width / 2 - 60, 52);

    // 区切りハイフン
    ctx.fillStyle = "#475569";
    ctx.shadowBlur = 0;
    ctx.fillText("-", canvas.width / 2, 50);

    // 敵陣ポイント（右）
    ctx.fillStyle = "#ff007f";
    ctx.shadowColor = "#ff007f";
    ctx.shadowBlur = 12;
    ctx.fillText(`${points.right}`, canvas.width / 2 + 60, 52);

    // エリアラベル＆先制目標
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = "rgba(0, 240, 255, 0.85)";
    ctx.shadowBlur = 0;
    ctx.fillText("自陣 (YOU)", canvas.width / 4, 30);

    ctx.fillStyle = "rgba(255, 0, 127, 0.85)";
    ctx.fillText("敵陣 (ENEMY)", (canvas.width * 3) / 4, 30);
    ctx.restore();

    // 7. 自プレイヤーの色グラデーション
    const cycle = (Math.sin(timestamp * 0.003) + 1) / 2;
    const r = Math.round(0 * (1 - cycle) + 50 * cycle);
    const g = Math.round(240 * (1 - cycle) + 160 * cycle);
    const b = Math.round(255 * (1 - cycle) + 255 * cycle);
    playerColor = `rgb(${r}, ${g}, ${b})`;

    // 自プレイヤー描画
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = playerColor;
    ctx.fillStyle = playerColor;
    ctx.fillRect(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE);
    ctx.restore();

    // 8. オンライン相手（peers）の描画
    for (const id in peers) {
        const peer = peers[id];
        ctx.save();
        const peerColor = peer.color || '#ff0055';
        ctx.shadowBlur = 15;
        ctx.shadowColor = peerColor;
        ctx.fillStyle = peerColor;
        ctx.fillRect(peer.x, peer.y, PLAYER_SIZE, PLAYER_SIZE);
        ctx.restore();
    }

    // 9. 動く四角（パック）の描画
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = puck.color;
    ctx.fillStyle = puck.color;
    ctx.fillRect(puck.x, puck.y, puck.size, puck.size);
    ctx.restore();

    // 10. セット勝利時（25点先制）の「WIN」表示
    if (gameState === 'SET_WON' || setWinTimer > 0) {
        ctx.save();
        const winX = winnerSide === 'left' ? canvas.width / 4 : (canvas.width * 3) / 4;
        const winColor = winnerSide === 'left' ? '#00f0ff' : '#ff007f';

        ctx.font = "900 56px 'Segoe UI', Impact, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur = 25;
        ctx.fillStyle = "#ffd700";
        ctx.fillText("★ WIN ★", winX, canvas.height / 2 - 30);

        ctx.font = "bold 20px sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 10;
        ctx.shadowColor = winColor;
        ctx.fillText(winnerSide === 'left' ? "自陣がセット獲得！" : "敵陣がセット獲得！", winX, canvas.height / 2 + 25);
        ctx.restore();
    }

    // 11. ゴール時／コンボ時の大迫力エフェクト（GOAL！！ ＋ Combo！）
    if (goalEffectTimer > 0 && gameState === 'PLAYING') {
        ctx.save();

        const progress = goalEffectTimer / GOAL_EFFECT_DURATION; // 1.0 -> 0.0
        const alpha = Math.min(1.0, progress * 1.4); // 最後の時間で滑らかにフェードアウト

        // シェイク（残り時間に応じて減衰）
        const shakeIntensity = progress * 14;
        const shakeX = (Math.random() * 2 - 1) * shakeIntensity;
        const shakeY = (Math.random() * 2 - 1) * shakeIntensity;

        const centerX = canvas.width / 2 + shakeX;
        const centerY = canvas.height / 2 + shakeY - (comboMessage ? 25 : 10);

        // 濃い色のグラデーション（高速変化）
        const speedMultiplier = 0.012; // 高速カラーシフト
        const hue1 = (timestamp * speedMultiplier * 180) % 360;
        const hue2 = (hue1 + 75) % 360;
        const hue3 = (hue1 + 150) % 360;

        // 濃い色（高彩度 100%, ディープ輝度 32〜42%）
        const color1 = `hsla(${hue1}, 100%, 36%, ${alpha})`;
        const color2 = `hsla(${hue2}, 100%, 42%, ${alpha})`;
        const color3 = `hsla(${hue3}, 100%, 30%, ${alpha})`;

        // 動的なグラデーションベクトル
        const gradAngle = timestamp * 0.008;
        const gradRadius = 200;
        const gx1 = centerX + Math.cos(gradAngle) * gradRadius;
        const gy1 = centerY + Math.sin(gradAngle) * gradRadius;
        const gx2 = centerX - Math.cos(gradAngle) * gradRadius;
        const gy2 = centerY - Math.sin(gradAngle) * gradRadius;

        const textGrad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
        textGrad.addColorStop(0, color1);
        textGrad.addColorStop(0.5, color2);
        textGrad.addColorStop(1, color3);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // メインテキスト「GOAL！！」
        ctx.font = "900 68px 'Segoe UI', Impact, Arial Black, sans-serif";

        // 白い発光外枠・グロー
        ctx.shadowColor = `rgba(255, 255, 255, ${0.95 * alpha})`;
        ctx.shadowBlur = 25;
        ctx.lineWidth = 6;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
        ctx.strokeText(goalMessage, centerX, centerY);

        // 濃いグラデーション塗りつぶし
        ctx.shadowBlur = 0;
        ctx.fillStyle = textGrad;
        ctx.fillText(goalMessage, centerX, centerY);

        // Combo！表示（GOAL！！の直下）
        if (comboMessage) {
            ctx.font = "900 32px 'Segoe UI', Impact, sans-serif";
            ctx.shadowColor = "#ffcc00";
            ctx.shadowBlur = 18;
            ctx.fillStyle = "#fffb00";
            ctx.fillText(comboMessage, centerX, centerY + 55);

            if (goalSubMessage) {
                ctx.font = "bold 15px sans-serif";
                ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * alpha})`;
                ctx.shadowBlur = 6;
                ctx.fillText(goalSubMessage, centerX, centerY + 88);
            }
        } else if (goalSubMessage) {
            ctx.font = "bold 18px 'Segoe UI', sans-serif";
            ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
            ctx.shadowColor = `rgba(0, 240, 255, ${0.8 * alpha})`;
            ctx.shadowBlur = 10;
            ctx.fillText(goalSubMessage, centerX, centerY + 52);
        }

        ctx.restore();
    }

    // 12. 5セット先取で完全勝利「VICTORY！！」表示（GOALよりも特大）
    if (gameState === 'GAME_WON') {
        ctx.save();
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // 背景の半透明暗転
        ctx.fillStyle = "rgba(10, 15, 29, 0.85)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 超高速グラデーション
        const speedMultiplier = 0.02;
        const hue1 = (timestamp * speedMultiplier * 180) % 360;
        const hue2 = (hue1 + 90) % 360;
        const hue3 = (hue1 + 180) % 360;

        const color1 = `hsl(${hue1}, 100%, 45%)`;
        const color2 = `hsl(${hue2}, 100%, 50%)`;
        const color3 = `hsl(${hue3}, 100%, 40%)`;

        const victoryGrad = ctx.createLinearGradient(centerX - 240, centerY - 60, centerX + 240, centerY + 60);
        victoryGrad.addColorStop(0, color1);
        victoryGrad.addColorStop(0.5, color2);
        victoryGrad.addColorStop(1, color3);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // GOALより大きな特大フォント（90px）で VICTORY！！
        ctx.font = "900 90px 'Segoe UI', Impact, Arial Black, sans-serif";

        // 黄金の発光外枠
        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur = 35;
        ctx.lineWidth = 8;
        ctx.strokeStyle = "#ffffff";
        ctx.strokeText("VICTORY！！", centerX, centerY - 35);

        // 鮮烈グラデーション
        ctx.shadowBlur = 0;
        ctx.fillStyle = victoryGrad;
        ctx.fillText("VICTORY！！", centerX, centerY - 35);

        // 勝者タイトル
        ctx.font = "bold 26px 'Segoe UI', sans-serif";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#ffffff";
        const championText = winnerSide === 'left' ? "🏆 自陣 (YOU) の完全勝利！！ (5セット先取) 🏆" : "🏆 敵陣 (ENEMY) の完全勝利！！ (5セット先取) 🏆";
        ctx.fillText(championText, centerX, centerY + 45);

        ctx.font = "bold 16px sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.shadowBlur = 0;
        ctx.fillText("RESETボタンを押してもう一度プレイできます", centerX, centerY + 85);

        ctx.restore();
    }

    // 13. ポインター追従エフェクト
    if (pointer && gameState !== 'GAME_WON') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 25, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 240, 255, 0.25)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#00f0ff";
        ctx.fill();
        ctx.restore();
    }
}

// メインループ
let previous = performance.now();
function frame(now) {
    const dt = Math.min((now - previous) / 1000, 0.25);
    previous = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
}

// ゲームループ開始
requestAnimationFrame(frame);


