export function connectMultiplayer(room, peers) {
    const [sendMove, onMove] = room.makeAction('move');

    onMove((data, peerId) => {
        peers[peerId] = data;
    });

    room.onPeerJoin((peerId) => {
        peers[peerId] = {
            x: 100,
            y: 100,
            color: '#ffaa00'
        };
    });

    room.onPeerLeave((peerId) => {
        delete peers[peerId];
    });

    return { sendMove };
}
