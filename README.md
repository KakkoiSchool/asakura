# kakkoi-hockey

朝倉さんが作った、ブラウザで遊べるネオン調のエアホッケー風ゲームです。
A neon air-hockey-style browser game made by Asakura-san.

[日本語](#日本語) | [English](#english)

---

## 日本語

### どんなゲーム？

HTML の Canvas と JavaScript だけで作られたゲームです。インストールもビルドも要りません。

- あなたは水色に光る四角（パドル）です。緑の四角（パック）を打ち返します。
- 左のシアンのゴールが自陣、右のピンクのゴールが敵陣です。
  パックが敵陣ゴールに入ると自陣（YOU）の得点、自陣ゴールに入ると敵陣（ENEMY）の得点です。
- パックは上下の壁と、ゴール以外の左右の壁で跳ね返ります。パドルの端で当てるほど角度がつきます。
- **コンボ**: 同じ側が続けて得点すると、2連続目は2点、3連続目は3点…と1点ずつ増えます。
- **セット**: 25点先取で1セット獲得（★ WIN ★）。**5セット先取**で完全勝利（VICTORY！！）。
- **RESET** ボタンで点数とセットを0に戻します。同じ部屋の全員に伝わります。
- 同じページを開いている他の人のパドルも画面に出て、パックを打ち返せます（下の「マルチプレイ」）。

### 操作方法

| | 操作 |
|---|---|
| キーボード | `W` `A` `S` `D` または 矢印キーで移動。WASD は小文字だけ反応するので、Caps Lock がオンだと動きません（矢印キーは常に動きます）。 |
| マウス | キャンバスの上でボタンを押したまま動かすと、パドルがその場所へ向かいます。押している間はキーボードより優先されます。 |
| タッチ | 画面をドラッグすると同じように動きます。 |
| RESET | 点数とセットをリセットします。 |

**スマホについて**: 今の画面は横幅800pxのパソコン向けです。スマホでは画面の真ん中しか見えず、
ドラッグがページのスクロールに取られやすいです。詳しくは
[docs/REPORT-2026-10-03.md](docs/REPORT-2026-10-03.md) の「Found along the way」を見てください。

### マルチプレイ（サーバーなし）

[Trystero](https://github.com/dmotz/trystero)（`vendor/trystero/` に同梱、v0.21.5 の Nostr 版）を使った
ピアツーピア通信です。**ゲーム用のサーバーはありません。** だから GitHub Pages のような、
ファイルを置くだけのホスティングで動きます。

1. ページを開くと、`kakkoi-lobby` という部屋に入ります（appId は `kakkoi-game-app`）。
   このページを開いている人は全員同じ部屋です。
2. 相手を見つけるための最初のあいさつ（シグナリング）だけ、公開の Nostr リレーを使います
   （`main.js` の `relayUrls`）。
3. つながった後は、ブラウザ同士が WebRTC で直接データを送り合います。
   STUN サーバー（Google、Cloudflare）は通り道を見つけるためだけに使われます。
4. 送るもの: 自分の位置と色（1秒に10回）、パックの位置と速さ（打ったとき・ゴールのとき）、
   スコア、リセット。パックはそれぞれのブラウザで動いていて、これらの合図で揃えられます。

通信のつなぎ込みは `multiplayer.js` にまとまっていて、Trystero の古い API
（`[send, on]` の配列）と v0.20 以降の API（`{ send, onMessage }`）の両方に対応しています。
リレーにつながらないときも、一人で遊べます。

### 手元で動かす

```sh
python3 -m http.server 8000
```

ブラウザで <http://localhost:8000/> を開きます。`index.html` をダブルクリック（`file://`）
では JavaScript のモジュールが読み込めないので、必ずサーバー経由で開いてください。
インターネットにつながっていれば、タブを2つ開くとお互いのパドルが見えるはずです。

### テスト

```sh
node --test tests/*.test.mjs
```

Node 22 で動きます。`npm install` は要りません。偽の部屋を使って、`multiplayer.js` が
両方の Trystero API で正しくつながるかを確かめます。プルリクエストと `main` への push のたびに
`.github/workflows/test.yml` が実行します。

### 公開（GitHub Pages）

`.github/workflows/pages.yml` が、`main` への push（または手動実行）のたびに

1. テストを実行し、
2. `index.html`、`main.js`、`multiplayer.js`、`vendor/` を `_site` にコピーして、
3. GitHub Pages に公開します。ビルドはありません。

公開先は <https://kakkoischool.github.io/asakura/> です（リポジトリの Settings → Pages →
Source を「GitHub Actions」にした後）。

- ページが読み込むファイルを新しく増やしたら、`pages.yml` のコピーの行にも足してください。
- `main.js` などを変えたら、`index.html` と `main.js` の `?v=2026-10-03b` の番号も上げてください
  （ブラウザのキャッシュ対策。`main.js` の先頭のコメントのとおりです）。

### ファイル

| ファイル | 中身 |
|---|---|
| `index.html` | ページ、見た目、RESET ボタン |
| `main.js` | ゲーム本体（動き、当たり判定、得点、描画） |
| `multiplayer.js` | Trystero の部屋とゲームのつなぎ込み |
| `vendor/trystero/` | 同梱した Trystero |
| `tests/` | `multiplayer.js` のテスト |
| `0826game.md` | 最初の開発記録 |
| `docs/` | 作業レポート |

### クレジット

- **ゲーム**: 朝倉さん。`0826game.md` は、朝倉さんが AI アシスタントと一緒に作り始めたときの開発記録です。
- **KakkoiSchool** のプロジェクトです。
- **通信**: [Trystero](https://github.com/dmotz/trystero)（Dan Motzenbecker、MIT License）。

---

## English

### What is it?

A game made with nothing but an HTML canvas and JavaScript. Nothing to install, nothing to build.

- You are the glowing cyan square (the paddle). Hit the green square (the puck).
- The cyan goal on the left is yours, the pink goal on the right is the enemy's.
  Puck in the enemy goal: a point for you (YOU). Puck in your goal: a point for the enemy (ENEMY).
- The puck bounces off the top and bottom walls, and off the side walls outside the goals.
  The nearer the edge of your paddle you hit it, the sharper the angle.
- **Combo**: when the same side scores again in a row, the goal is worth more: 2 points
  for the second in a row, 3 for the third, and so on.
- **Sets**: first to 25 points wins a set (★ WIN ★). First to **5 sets** wins the game (VICTORY!!).
- **RESET** puts points and sets back to zero for everyone in the room.
- Other people who have the page open appear as their own squares and can hit the puck too
  (see Multiplayer below).

### Controls

| | |
|---|---|
| Keyboard | `W` `A` `S` `D` or the arrow keys. WASD only reacts to lowercase, so it does nothing with Caps Lock on (the arrow keys always work). |
| Mouse | Hold the button down on the canvas and move: the paddle heads for the pointer. While held, this wins over the keyboard. |
| Touch | Drag on the canvas, the same way. |
| RESET | Clears points and sets. |

**On phones**: the page is laid out for an 800px-wide desktop screen. On a phone only the
middle of the court is visible, and a drag tends to scroll the page instead of moving the paddle.
See "Found along the way" in [docs/REPORT-2026-10-03.md](docs/REPORT-2026-10-03.md).

### Multiplayer (no server)

Peer-to-peer through [Trystero](https://github.com/dmotz/trystero) (vendored in
`vendor/trystero/`, v0.21.5, Nostr strategy). **There is no game server**, which is why plain
static hosting such as GitHub Pages is enough.

1. Opening the page joins the room `kakkoi-lobby` (app id `kakkoi-game-app`).
   Everyone who has the page open is in the same room.
2. Only the first handshake (signalling, to find each other) goes through public Nostr relays
   (`relayUrls` in `main.js`).
3. After that, browsers talk to each other directly over WebRTC. STUN servers (Google,
   Cloudflare) are only used to find a network path.
4. What is sent: your position and colour (10 times a second), the puck's position and speed
   (on a hit or a goal), the score, and resets. Each browser moves its own puck, and these
   messages bring them back in line.

`multiplayer.js` holds the wiring and works with both Trystero APIs: the older
`[send, on]` pair and the v0.20+ `{ send, onMessage }` object.
If no relay can be reached, the game still plays solo.

### Run it locally

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Opening `index.html` straight from disk (`file://`) does
not work, because browsers will not load JavaScript modules that way.
With an internet connection, two tabs should see each other's paddles.

### Tests

```sh
node --test tests/*.test.mjs
```

Runs on Node 22 with no `npm install`. The tests use a fake room to check that
`multiplayer.js` wires up correctly with both Trystero APIs.
`.github/workflows/test.yml` runs them on every pull request and every push to `main`.

### Publishing (GitHub Pages)

On every push to `main` (or when started by hand), `.github/workflows/pages.yml`:

1. runs the tests,
2. copies `index.html`, `main.js`, `multiplayer.js` and `vendor/` into `_site`,
3. deploys that to GitHub Pages. There is no build step.

The game is then at <https://kakkoischool.github.io/asakura/> (once Settings → Pages →
Source is set to "GitHub Actions").

- If the page starts loading a new file, add it to the copy line in `pages.yml` too.
- After changing `main.js` or friends, bump the `?v=2026-10-03b` number in both `index.html`
  and `main.js` so browsers do not keep the old copy (as the comment at the top of `main.js` says).

### Files

| File | What it is |
|---|---|
| `index.html` | The page, its look, the RESET button |
| `main.js` | The game: movement, collisions, scoring, drawing |
| `multiplayer.js` | Wiring between the Trystero room and the game |
| `vendor/trystero/` | Vendored Trystero |
| `tests/` | Tests for `multiplayer.js` |
| `0826game.md` | The original development log |
| `docs/` | Work reports |

### Credits

- **Game**: Asakura-san (朝倉さん). `0826game.md` is the log of how Asakura-san started it,
  working with an AI assistant.
- A **KakkoiSchool** project.
- **Networking**: [Trystero](https://github.com/dmotz/trystero) by Dan Motzenbecker, MIT License.
