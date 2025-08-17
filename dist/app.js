"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = __importDefault(require("ws"));
const handler_1 = require("./ws/handler");
const health_1 = require("./http/health");
const prom_client_1 = __importDefault(require("prom-client"));
const info_nip11_1 = require("./http/info-nip11");
const repository_1 = require("./storage/postgres/repository");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const wss = new ws_1.default.Server({ server });
// Middleware
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health check endpoint
app.get('/health', health_1.healthCheck);
// Prometheus metrics
const collectDefaultMetrics = prom_client_1.default.collectDefaultMetrics;
collectDefaultMetrics();
app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', prom_client_1.default.register.contentType);
    res.send(await prom_client_1.default.register.metrics());
});
// NIP-11 info endpoint
app.get('/.well-known/nostr.json', info_nip11_1.infoNip11);
// Setup WebSocket handling
(0, handler_1.setupWebSocket)(wss);
// Start the server
const PORT = Number(process.env.PORT || 8080);
server.listen(PORT, () => {
    console.log(`Relay server is running on http://0.0.0.0:${PORT}`);
});
// Background: scheduled cleanup of expired events every 10 minutes
if (process.env.DATABASE_URL) {
    const repo = new repository_1.PostgresRepository(process.env.DATABASE_URL);
    const sweep = async () => {
        try {
            await repo.pool.query('DELETE FROM nostr_events WHERE expires_at IS NOT NULL AND expires_at <= EXTRACT(EPOCH FROM NOW())');
        }
        catch {
            // ignore errors
        }
    };
    setInterval(sweep, 10 * 60 * 1000);
}
