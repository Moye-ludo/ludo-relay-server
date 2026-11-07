const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let waitingPlayer = null;

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    console.log("New client connected.");

    // Simple 2-player FIFO matchmaking queue
    if (!waitingPlayer) {
        waitingPlayer = ws;
        ws.send(JSON.stringify({ type: "WAITING" }));
        console.log("Player waiting in queue...");
    } else {
        const p1 = waitingPlayer;
        const p2 = ws;
        waitingPlayer = null;

        p1.opponent = p2;
        p2.opponent = p1;

        console.log("Match paired! Assigning Player 1 and Player 2.");
        p1.send(JSON.stringify({ type: "START_MATCH", player_id: 0 }));
        p2.send(JSON.stringify({ type: "START_MATCH", player_id: 1 }));
    }

    // Direct relay between the two paired players
    ws.on('message', (message) => {
        if (ws.opponent && ws.opponent.readyState === WebSocket.OPEN) {
            ws.opponent.send(message.toString());
        }
    });

    ws.on('close', () => {
        console.log("Client disconnected.");
        if (waitingPlayer === ws) {
            waitingPlayer = null;
        }
        if (ws.opponent) {
            if (ws.opponent.readyState === WebSocket.OPEN) {
                ws.opponent.send(JSON.stringify({ type: "DISCONNECTED" }));
            }
            ws.opponent.opponent = null;
        }
    });
});

// Send ping every 25s to keep mobile WebSocket connections alive
setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 25000);

console.log(`Ludo WebSocket relay running on port ${PORT}`);
