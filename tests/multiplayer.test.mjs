import test from 'node:test';
import assert from 'node:assert/strict';
import { connectMultiplayer } from '../multiplayer.js';

test('registers Trystero callbacks and keeps peer boxes in sync (legacy tuple API)', () => {
    const handlers = {};
    const sent = {};
    const room = {
        makeAction(name) {
            sent[name] = [];
            return [
                (data) => sent[name].push(data),
                (handler) => { handlers[name] = handler; }
            ];
        },
        onPeerJoin(handler) {
            handlers.join = handler;
        },
        onPeerLeave(handler) {
            handlers.leave = handler;
        }
    };
    const peers = {};
    const puckEvents = [];
    const scoreEvents = [];
    const resetEvents = [];

    const { sendMove, sendPuck, sendScore, sendReset } = connectMultiplayer(room, peers, {
        onPuck: (data) => puckEvents.push(data),
        onScore: (data) => scoreEvents.push(data),
        onReset: (data) => resetEvents.push(data)
    });

    assert.equal(typeof handlers.move, 'function');
    assert.equal(typeof handlers.puck, 'function');
    assert.equal(typeof handlers.score, 'function');
    assert.equal(typeof handlers.reset, 'function');
    assert.equal(typeof handlers.join, 'function');
    assert.equal(typeof handlers.leave, 'function');

    handlers.join('peer-1');
    assert.deepEqual(peers['peer-1'], {
        x: 500,
        y: 200,
        color: '#ff0055'
    });

    handlers.move({ x: 24, y: 42, color: '#00ffcc' }, 'peer-1');
    assert.deepEqual(peers['peer-1'], {
        x: 24,
        y: 42,
        color: '#00ffcc'
    });

    handlers.puck({ x: 120, y: 80, vx: 200, vy: -100 }, 'peer-1');
    assert.deepEqual(puckEvents, [{ x: 120, y: 80, vx: 200, vy: -100 }]);

    handlers.score({ left: 1, right: 0 }, 'peer-1');
    assert.deepEqual(scoreEvents, [{ left: 1, right: 0 }]);

    handlers.reset({}, 'peer-1');
    assert.equal(resetEvents.length, 1);

    sendMove({ x: 5, y: 9 });
    assert.deepEqual(sent.move, [{ x: 5, y: 9 }]);

    sendPuck({ x: 1, y: 2 });
    assert.deepEqual(sent.puck, [{ x: 1, y: 2 }]);

    sendScore({ left: 2, right: 1 });
    assert.deepEqual(sent.score, [{ left: 2, right: 1 }]);

    sendReset({});
    assert.deepEqual(sent.reset, [{}]);

    handlers.leave('peer-1');
    assert.equal(peers['peer-1'], undefined);
});

test('registers Trystero callbacks and keeps peer boxes in sync (v0.20+ object API)', () => {
    const sent = {};
    const actions = {};
    const room = {
        makeAction(name) {
            sent[name] = [];
            actions[name] = {
                send: (data) => sent[name].push(data),
                onMessage: null
            };
            return actions[name];
        },
        onPeerJoin: null,
        onPeerLeave: null
    };
    const peers = {};
    const puckEvents = [];

    const { sendMove, sendPuck } = connectMultiplayer(room, peers, {
        onPuck: (data) => puckEvents.push(data)
    });

    assert.equal(typeof actions.move.onMessage, 'function');
    assert.equal(typeof actions.puck.onMessage, 'function');
    assert.equal(typeof room.onPeerJoin, 'function');
    assert.equal(typeof room.onPeerLeave, 'function');

    room.onPeerJoin('peer-2');
    assert.deepEqual(peers['peer-2'], {
        x: 500,
        y: 200,
        color: '#ff0055'
    });

    actions.move.onMessage({ x: 50, y: 80, color: '#ff00ff' }, { peerId: 'peer-2' });
    assert.deepEqual(peers['peer-2'], {
        x: 50,
        y: 80,
        color: '#ff00ff'
    });

    actions.puck.onMessage({ x: 200, y: 150 }, { peerId: 'peer-2' });
    assert.deepEqual(puckEvents, [{ x: 200, y: 150 }]);

    sendMove({ x: 12, y: 34 });
    assert.deepEqual(sent.move, [{ x: 12, y: 34 }]);

    sendPuck({ vx: 100, vy: 50 });
    assert.deepEqual(sent.puck, [{ vx: 100, vy: 50 }]);

    room.onPeerLeave('peer-2');
    assert.equal(peers['peer-2'], undefined);
});
