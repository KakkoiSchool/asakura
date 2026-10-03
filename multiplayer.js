function bindAction(room, name, onMessage) {
    const actionResult = room.makeAction(name);
    let sendFn = () => {};

    if (Array.isArray(actionResult)) {
        // Trystero legacy API: [sendAction, onAction]
        const [send, on] = actionResult;
        sendFn = send;
        if (typeof on === 'function' && typeof onMessage === 'function') {
            on((data, peerId) => {
                onMessage(data, peerId);
            });
        }
    } else if (actionResult && typeof actionResult === 'object') {
        // Trystero v0.20+ API: { send, onMessage }
        sendFn = (data) => actionResult.send(data);
        if (typeof onMessage === 'function') {
            actionResult.onMessage = (data, meta) => {
                const peerId = typeof meta === 'string' ? meta : meta?.peerId;
                onMessage(data, peerId);
            };
        }
    }

    return sendFn;
}

export function connectMultiplayer(room, peers, callbacks = {}) {
    const sendMove = bindAction(room, 'move', (data, peerId) => {
        peers[peerId] = {
            ...(peers[peerId] || {}),
            ...data
        };
        if (callbacks.onMove) callbacks.onMove(data, peerId);
    });

    const sendPuck = bindAction(room, 'puck', (data, peerId) => {
        if (callbacks.onPuck) callbacks.onPuck(data, peerId);
    });

    const sendScore = bindAction(room, 'score', (data, peerId) => {
        if (callbacks.onScore) callbacks.onScore(data, peerId);
    });

    const sendReset = bindAction(room, 'reset', (data, peerId) => {
        if (callbacks.onReset) callbacks.onReset(data, peerId);
    });

    const onJoin = (peerId) => {
        peers[peerId] = {
            x: 500,
            y: 200,
            color: '#ff0055'
        };
        if (callbacks.onPeerJoin) callbacks.onPeerJoin(peerId);
    };

    const onLeave = (peerId) => {
        delete peers[peerId];
        if (callbacks.onPeerLeave) callbacks.onPeerLeave(peerId);
    };

    if (typeof room.onPeerJoin === 'function') {
        room.onPeerJoin(onJoin);
    } else {
        room.onPeerJoin = onJoin;
    }

    if (typeof room.onPeerLeave === 'function') {
        room.onPeerLeave(onLeave);
    } else {
        room.onPeerLeave = onLeave;
    }

    return { sendMove, sendPuck, sendScore, sendReset };
}
