import test from 'node:test';
import assert from 'node:assert/strict';
import { connectMultiplayer } from '../multiplayer.js';

test('registers Trystero callbacks and keeps peer boxes in sync', () => {
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
