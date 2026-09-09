import test from 'node:test';
import assert from 'node:assert/strict';
import { connectMultiplayer } from '../multiplayer.js';

test('registers Trystero callbacks and keeps peer boxes in sync (legacy tuple API)', () => {
    const handlers = {};
    const sent = [];
    const room = {
        makeAction(name) {
            assert.equal(name, 'move');
            return [
                (data) => sent.push(data),
                (handler) => { handlers.move = handler; }
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

    const { sendMove } = connectMultiplayer(room, peers);

    assert.equal(typeof handlers.move, 'function');
    assert.equal(typeof handlers.join, 'function');
    assert.equal(typeof handlers.leave, 'function');

    handlers.join('peer-1');
    assert.deepEqual(peers['peer-1'], {
        x: 100,
        y: 100,
        color: '#ffaa00'
    });

    handlers.move({ x: 24, y: 42, color: '#00ffcc' }, 'peer-1');
    assert.deepEqual(peers['peer-1'], {
        x: 24,
        y: 42,
        color: '#00ffcc'
    });

    sendMove({ x: 5, y: 9 });
    assert.deepEqual(sent, [{ x: 5, y: 9 }]);

    handlers.leave('peer-1');
    assert.equal(peers['peer-1'], undefined);
});

test('registers Trystero callbacks and keeps peer boxes in sync (v0.20+ object API)', () => {
    const sent = [];
    const actionObj = {
        send: (data) => sent.push(data),
        onMessage: null
    };
    const room = {
        makeAction(name) {
            assert.equal(name, 'move');
            return actionObj;
        },
        onPeerJoin: null,
        onPeerLeave: null
    };
    const peers = {};

    const { sendMove } = connectMultiplayer(room, peers);

    assert.equal(typeof actionObj.onMessage, 'function');
    assert.equal(typeof room.onPeerJoin, 'function');
    assert.equal(typeof room.onPeerLeave, 'function');

    room.onPeerJoin('peer-2');
    assert.deepEqual(peers['peer-2'], {
        x: 100,
        y: 100,
        color: '#ffaa00'
    });

    actionObj.onMessage({ x: 50, y: 80, color: '#ff00ff' }, { peerId: 'peer-2' });
    assert.deepEqual(peers['peer-2'], {
        x: 50,
        y: 80,
        color: '#ff00ff'
    });

    sendMove({ x: 12, y: 34 });
    assert.deepEqual(sent, [{ x: 12, y: 34 }]);

    room.onPeerLeave('peer-2');
    assert.equal(peers['peer-2'], undefined);
});
