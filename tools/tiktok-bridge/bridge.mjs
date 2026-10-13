import { randomBytes, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { normalizeEvent } from './normalize.mjs';

const token = randomBytes(24).toString('hex');
const origins = new Set(['https://wonderlytales.vercel.app', 'http://localhost:3000', 'http://localhost:3013']);
if (process.env.STUDIO_ORIGIN) origins.add(new URL(process.env.STUDIO_ORIGIN).origin);
const server = new WebSocketServer({host: '127.0.0.1', port: 21214, maxPayload: 4096,
  verifyClient: ({origin}) => origins.has(origin),
});
server.on('listening', () => console.log(`WonderlyTales TikTok-összekötő fut.\nPárosítási kód: ${token}\nNyisd meg: https://wonderlytales.vercel.app/live-studio\nA kódot a saját stúdiódba másold. Leállítás: Ctrl+C.`));
server.on('error', () => { console.error('Az összekötő nem indult el. Lehet, hogy a 21214-es port már foglalt.'); process.exitCode = 1; });
let active = null;
server.on('connection', ws => {
  let connection = null, started = false, closed = false;
  const send = value => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value)); };
  const status = (connected, message) => send({type: 'status', connected, message});
  const authTimeout = setTimeout(() => ws.close(1008, 'Pairing required'), 10000);
  ws.on('message', async raw => {
    if (started) return;
    let input;
    try { input = JSON.parse(raw.toString()); } catch { ws.close(1008); return; }
    const supplied = Buffer.from(typeof input.token === 'string' ? input.token : '');
    if (input.type !== 'connect' || supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token)) || !/^[a-zA-Z0-9_.]{2,32}$/.test(input.username || '')) {
      status(false, 'Hibás párosítási kód vagy felhasználónév.'); ws.close(1008); return;
    }
    if (active && active.readyState === WebSocket.OPEN) { status(false, 'Egy stúdió már csatlakozott. Előbb bontsd a kapcsolatát.'); ws.close(1008); return; }
    started = true; active = ws; clearTimeout(authTimeout);
    connection = new TikTokLiveConnection(input.username, {processInitialData: false, enableExtendedGiftInfo: true,
      ...(process.env.EULER_STREAM_API_KEY ? {signApiKey: process.env.EULER_STREAM_API_KEY} : {}),
    });
    for (const [event, type] of [[WebcastEvent.CHAT, 'comment'], [WebcastEvent.GIFT, 'gift'], [WebcastEvent.FOLLOW, 'follow']]) {
      connection.on(event, data => { const normalized = normalizeEvent(type, data); if (normalized) send({type: 'event', event: normalized}); });
    }
    connection.on(ControlEvent.DISCONNECTED, () => status(false, 'A TikTok-kapcsolat megszakadt. Csatlakozz újra.'));
    connection.on(ControlEvent.ERROR, () => status(false, 'TikTok-kapcsolati hiba. Ellenőrizd az aktív LIVE-adást, majd csatlakozz újra.'));
    connection.on(WebcastEvent.STREAM_END, () => { status(false, 'A TikTok-adás véget ért.'); void connection?.disconnect(); });
    status(false, 'TikTok-adás keresése…');
    try { await connection.connect(); if (closed) await connection.disconnect(); else status(true, `@${input.username} – kommentek és ajándékok csatlakoztatva`); }
    catch { status(false, 'Nem sikerült kapcsolódni. A fiók legyen élő adásban; a TikTok vagy az aláíró szolgáltatás korlátozása is megakadályozhatja a kapcsolódást.'); ws.close(); }
  });
  ws.on('close', () => { closed = true; clearTimeout(authTimeout); if (active === ws) active = null; void connection?.disconnect().catch(() => {}); });
  ws.on('error', () => ws.close());
});
process.on('SIGINT', () => { for (const client of server.clients) client.close(); server.close(() => process.exit(0)); });
