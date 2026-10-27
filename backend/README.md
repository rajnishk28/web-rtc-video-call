# Backend

Node.js + Express API and Socket.IO WebRTC signaling server for a 1:1 video chat
application using TURN and STUN servers for NAT traversal.

## Setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Server runs on `http://localhost:4000`.

## Structure

```
backend/
├── src/
│   ├── server.js          # Entry point - starts HTTP + Socket.IO servers
│   ├── app.js             # Express app config (middleware, routes, error handling)
│   ├── config/            # Environment/config loading (incl. ICE servers)
│   ├── routes/            # Express route definitions
│   ├── controllers/       # Route handler logic
│   ├── services/          # Business logic (socket signaling, etc.)
│   ├── middleware/        # Custom middleware (error handling, auth, etc.)
│   └── utils/             # Shared utilities (logger, helpers)
├── .env.example
├── .gitignore
└── package.json
```

## TURN / STUN configuration

WebRTC peers need ICE servers to find the best network path between them. STUN
servers help peers discover their public IP addresses; a TURN server relays media
when a direct peer-to-peer connection is not possible (symmetric NATs, strict
firewalls).

ICE servers are loaded from environment variables in `src/config/index.js` and
exposed via the [`/api/ice-servers`](#get-apiice-servers) endpoint so the
frontend can pass them straight into a `RTCPeerConnection`:

```js
const { iceServers } = await fetch('/api/ice-servers').then((r) => r.json())
const pc = new RTCPeerConnection({ iceServers })
```

- `STUN_URLS` — comma-separated STUN server URLs. Defaults to Google public
  STUN: `stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302`.
- `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` — a single TURN server and its
  long-term credentials. **Leave `TURN_URL` empty to skip TURN entirely.** The
  TURN entry (and its `username`/`credential` keys) is only added to the ICE
  servers array when `TURN_URL` is set, so no empty values are ever produced.

## API endpoints

### `GET /api/health`

Health check.

```json
{ "status": "ok", "uptime": 12.345 }
```

### `GET /api/ice-servers`

Returns the ICE servers configuration for `RTCPeerConnection`. With only the
default STUN servers configured (no TURN):

```json
{
  "iceServers": [
    { "urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
  ]
}
```

When `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` are set, a second object
is appended:

```json
{
  "iceServers": [
    { "urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    { "urls": "turn:your-turn-server.com:3478", "username": "u", "credential": "p" }
  ]
}
```

## WebRTC Signaling Events

Signaling runs over Socket.IO. Each room holds at most **2 participants** for a
1:1 call. The full event set:

| Event            | Direction      | Payload                                | Description                                              |
|------------------|----------------|----------------------------------------|----------------------------------------------------------|
| `create-or-join` | client→server  | `roomId`                               | Create a new room or join an existing one.               |
| `created`        | server→client  | `roomId`                               | Sent to the first peer when the room is created.        |
| `joined`         | server→client  | `roomId`                               | Sent to the second peer when they join.                  |
| `peer-joined`    | server→client  | `{ peerId }`                           | Sent to the existing peer when the second peer joins.    |
| `ready`          | server→client  | `{ peers: [socketId, ...] }`           | Sent to the second peer once both peers are present.      |
| `room-full`      | server→client  | `roomId`                               | Sent when a third peer tries to join a full room.        |
| `offer`          | client↔client  | `{ to, description }` → `{ from, description }` | Relay an SDP offer to the target peer.          |
| `answer`         | client↔client  | `{ to, description }` → `{ from, description }` | Relay an SDP answer to the target peer.         |
| `ice-candidate`  | client↔client  | `{ to, candidate }` → `{ from, candidate }`     | Relay an ICE candidate to the target peer.     |
| `leave-room`     | client→server  | `roomId`                               | Voluntarily leave a room; remaining peer gets `peer-left`. |
| `peer-left`      | server→client  | `{ peerId }`                           | Sent to the remaining peer when the other peer leaves/disconnects. |
| `disconnect`     | client→server  | —                                      | Socket closed; server cleans up any room it was in.      |

> Note: offer/answer/ice-candidate are relayed by the server — the client sends
> `{ to, description | candidate }` and the server re-emits to the target as
> `{ from, description | candidate }`.

## Room management

- Rooms are tracked **in memory** (`Map<roomId, Set<socketId>>`), so state is
  lost on server restart.
- Maximum of **2 participants** per room (a 1:1 call). A third peer that calls
  `create-or-join` on a full room receives a `room-full` event and is not added.
- Repeating `create-or-join` for a room the socket already occupies is a no-op.
  Joining a different room first leaves the current one so the old peer gets
  `peer-left`.
- SDP/ICE messages are relayed only to the other participant in the same room.
- When a peer leaves (`leave-room`) or disconnects, the remaining peer is
  notified via `peer-left`, and empty rooms are deleted automatically.

## Running a local coturn TURN server

For local development or behind restrictive networks, run a coturn TURN server
with Docker:

```bash
docker run --rm --network host coturn/coturn \
  -n --listening-ip=0.0.0.0 --realm=localhost \
  --user=u:p --lt-cred-mech
```

Then set the credentials in your `.env`:

```
TURN_URL=turn:localhost:3478
TURN_USERNAME=u
TURN_CREDENTIAL=p
```

For production, deploy a dedicated coturn instance with a real domain and
certified long-term credentials. STUN-only is enough when both peers are on
open networks; TURN is required for symmetric NATs and strict firewalls.
