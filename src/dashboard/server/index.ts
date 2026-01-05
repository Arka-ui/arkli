import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import { apiRouter } from './api.js';
import { log } from '../../utils/logger.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for local dev
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Serve Static Client
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '../client/dist');

app.use(express.static(clientDist));

app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
});

// Socket.io for Terminal Streaming / Realtime status
io.on('connection', (socket) => {
    log.info('[Dashboard] Client connected');

    socket.on('disconnect', () => {
        log.info('[Dashboard] Client disconnected');
    });

    // Example: Subscribe to logs
    // In real impl, we'd hook into winston logger to stream logs to socket
});

const PORT = 4000;

server.listen(PORT, () => {
    log.info(`[Dashboard] Server running at http://localhost:${PORT}`);
});

export { io };
