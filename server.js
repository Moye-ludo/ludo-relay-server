const WebSocket = require('ws');

const port = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port }, () => {
    console.log(`Ludo Relay Server running on port ${port}`);
});

let waitingPlayer = null;

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    if (waitingPlayer === null) {
        // First player waiting
        waitingPlayer = ws;
        ws.player_id = 0;
        ws.send(JSON.stringify({ type: 'WAITING' }));
    } else {
        // Second player arrived: Pair them
        const player0 = waitingPlayer;
        const player1 = ws;
        waitingPlayer = null;

        player0.player_id = 0;
        player1.player_id = 1;

        player0.opponent = player1;
        player1.opponent = player0;

        // Send start match with 0 and 1
        player0.send(JSON.stringify({ type: 'START_MATCH', player_id: 0 }));
        player1.send(JSON.stringify({ type: 'START_MATCH', player_id: 1 }));
    }

    ws.on('message', (message) => {
        // Forward ONLY to the opponent, NEVER echo back to the sender
        if (ws.opponent && ws.opponent.readyState === WebSocket.OPEN) {
            ws.opponent.send(message.toString());
        }
    });

    ws.on('close', () => {
        if (waitingPlayer === ws) {
            waitingPlayer = null;
        }
        if (ws.opponent) {
            if (ws.opponent.readyState === WebSocket.OPEN) {
                ws.opponent.send(JSON.stringify({ type: 'DISCONNECTED' }));
            }
            ws.opponent.opponent = null;
        }
    });
});

// Keep-alive ping every 25 seconds so Render does not drop the socket
setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 25000);
