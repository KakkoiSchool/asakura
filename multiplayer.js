export function connectMultiplayer(room, peers) {
    const actionResult = room.makeAction('move');
    let sendMove = () => {};

    if (Array.isArray(actionResult)) {
        // Trystero legacy API: [sendAction, onAction]
        const [send, onMove] = actionResult;
        sendMove = send;
        if (typeof onMove === 'function') {
            onMove((data, peerId) => {
                peers[peerId] = data;
            });
        }
    } else if (actionResult && typeof actionResult === 'object') {
        // Trystero v0.20+ API: { send, onMessage }
        sendMove = (data) => actionResult.send(data);
        actionResult.onMessage = (data, meta) => {
            const peerId = typeof meta === 'string' ? meta : meta?.peerId;
            if (peerId) {
                peers[peerId] = data;
            }
        };
    }

    const onJoin = (peerId) => {
        peers[peerId] = {
            x: 100,
            y: 100,
            color: '#ffaa00'
        };
    };

    const onLeave = (peerId) => {
        delete peers[peerId];
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

    return { sendMove };
}
