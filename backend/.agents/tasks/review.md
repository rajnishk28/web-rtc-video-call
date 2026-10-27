# TURN/STUN ICE config and Socket.IO 1:1 signaling for the backend

This change adds a TURN/STUN ICE-server configuration path and a Socket.IO signaling layer to the Express backend so the frontend can negotiate a 1:1 WebRTC call. ICE servers are built from environment variables in the config module and exposed at `GET /api/ice-servers`; the signaling service is rewritten to manage 2-person rooms with `created`/`joined`/`peer-joined`/`ready`/`room-full` semantics and to relay `offer`/`answer`/`ice-candidate` with server-derived `from` fields. The change is mostly additive: a new controller, a new route, an `iceServers` block on the existing config, and a full rewrite of `socketService.js`. `.env.example` and `README.md` are updated; `package.json` is untouched.

**Watch for:** a self-reference edge case when the same socket calls `create-or-join` twice on a room it already occupies — the server emits `peer-joined` and `ready` back to that socket with its own id. Non-blocking; the happy path and all spec'd flows work.

**Verdict**: APPROVED

## High-level view

ICE config builds STUN from `STUN_URLS` (Google's two public servers by default) into a single `{ urls: [...] }` object, then pushes the TURN object only when `TURN_URL` is truthy, with `username`/`credential` spread in only when non-empty — so an unset `TURN_URL` omits the entry entirely and no empty values ever reach `RTCPeerConnection`.

The ice-servers surface is a thin controller returning `{ iceServers }` from the shared config, mounted at `/api/ice-servers` in `app.js` before `notFoundHandler`/`errorHandler`, which stay last; the health route and error middleware are unchanged.

Signaling is rewritten around a module-level `rooms` map (`roomId -> Set<socketId>`) plus a reverse `socketRoom` map for O(1) disconnect lookup. It enforces a 2-participant cap, relays SDP/candidates with `from` set by the server rather than the client, and funnels both `leave-room` and `disconnect` through one cleanup routine that emits `peer-left` to survivors and deletes empty rooms.

Room lifecycle handles the spec'd flows correctly — third joiner gets `room-full` and is not added, the remaining peer gets `peer-left` on leave or abrupt disconnect. The one gap is re-entrant `create-or-join` from the same socket, which the size-1 branch mis-handles as a real join.

Config, docs, and deps are clean: `.env.example` lists the four TURN/STUN vars with comments, `README.md` documents the endpoint, the 12-event signaling table, room rules, and a coturn docker command, and `package.json`/`package-lock.json` are unchanged with no throwaway `socket.io-client` leaked in.

<details>
<summary>Issues (1)</summary>

1. **Self-reference on duplicate `create-or-join`** — likely. If the same socket emits `create-or-join` on a room it already occupies, the `size === 1` branch treats that socket as the "existing peer": `participants.add(self)` is a no-op, `existingPeer` resolves to the same socket, and the server emits `peer-joined { peerId: selfId }` and `ready { peers: [selfId] }` back to it. A frontend that re-emits `create-or-join` on re-render or retry could then address an offer to its own id. Add a guard at the top of `create-or-join` — if `participants` already has `socket.id`, no-op (or emit an error) instead of re-running the join branch. Non-blocking for this spec, but cheap to close.

</details>

<details>
<summary>Details</summary>

### ICE servers built from env, STUN defaults, TURN omitted when blank

`src/config/index.js` parses `STUN_URLS` (comma-separated, trimmed, `Boolean`-filtered) with Google's two STUN servers as the default and pushes one `{ urls: [...] }` object. The TURN object is pushed only inside `if (process.env.TURN_URL)` — a truthy check, not a defined check — so `TURN_URL=` (empty) omits the whole entry. `username`/`credential` are spread in only when truthy via `...(TURN_USERNAME && { username })`, so a TURN entry with a blank username or credential omits that key rather than shipping an empty string.

### Signaling rewrite: rooms, relay, and cleanup

State is two module-level maps — `rooms` (`roomId -> Set<socketId>`) and `socketRoom` (`socketId -> roomId`) for O(1) disconnect lookup — with no use of Socket.IO's own room membership, so participant truth lives in the maps deterministically. `create-or-join` branches on room absence/size: create emits `created`; size 1 emits `joined` to the joiner, `peer-joined { peerId }` to the existing peer, and `ready` to the joiner; size 2 emits `room-full` and does not add. `offer`/`answer`/`ice-candidate` relay through `io.to(to).emit(...)` with `from` set to `socket.id` by the server.

Worth keeping: the relay derives `from` from the actual socket rather than trusting a client-supplied field, so a client cannot spoof another peer's id in `from`. `leave-room` and `disconnect` both funnel through `removeSocketFromRoom`, which deletes the socket from the set and the `socketRoom` index, emits `peer-left { peerId }` to each remaining peer, and deletes the room once empty. The smoke test asserts `created`, `joined`+`ready`, `peer-joined`, the three relay events with `description`/`candidate` and correct `from`, `room-full` for a third peer, `leave-room` -> `peer-left`, and abrupt disconnect -> `peer-left`.

### Room lifecycle edge case: re-entrant create-or-join

The one behavioral gap. A single socket that emits `create-or-join` on a room it already occupies hits the `size === 1` branch because its own id is the sole occupant: `participants.add(self)` is a no-op, `existingPeer` resolves to `self`, and the server emits `peer-joined { peerId: selfId }` and `ready { peers: [selfId] }` back to the same client. A frontend that re-emits `create-or-join` on re-render or retry could then target an offer at its own id. This is outside the stated spec — which describes first/second/third-peer flows, not same-peer-twice — and the frontend is out of scope, so it isn't blocking, but a one-line guard (`if (participants.has(socket.id)) return`) closes it.

### Test coverage

The smoke test covers the full happy path (create -> join -> ready -> peer-joined) and the spec'd edge cases (`room-full` on third join, `leave-room` -> `peer-left`, abrupt disconnect -> `peer-left`), plus the three relay events' payload shape. Not directly asserted: deletion of an empty room after both peers leave — the code does it, but the map is module-private and the test can't observe it — and the re-entrant `create-or-join` case above. The TURN path isn't exercised at runtime, but ICE config construction is verified for both STUN-only and STUN+TURN.

### Config, docs, and dependencies

`.env.example` lists the four TURN/STUN vars with the spec's comments; `README.md` documents the ICE config, `/api/ice-servers`, the 12-event signaling table, room rules, and a coturn command. `package.json`/`package-lock.json` are unchanged — a grep confirms the throwaway `socket.io-client` smoke-test client did not leak into either. Cross-cutting checks hold: ES modules throughout, frontend untouched, `socketService.js` uses `utils/logger.js`, and error middleware stays registered last. (The workspace isn't under git, so there's no commit-level diff — the review was produced by reading the files directly against `plan.md`.)

</details>

<details>
<summary>File map</summary>

- `src/config/index.js` — added `iceServers` array (STUN default + optional TURN) onto `serverConfig`.
- `src/controllers/iceServersController.js` — new; `getIceServers` returns `{ iceServers }` from config.
- `src/routes/iceServersRoutes.js` — new; `GET /` wired to the controller.
- `src/app.js` — imported and mounted `iceServersRouter` at `/api/ice-servers` (before error middleware).
- `src/services/socketService.js` — rewritten; 2-person room signaling with relay + cleanup, logger instead of `console.log`.
- `.env.example` — added `STUN_URLS`/`TURN_*` vars with comments.
- `README.md` — documented ICE config, `/api/ice-servers`, the signaling event table, room rules, and coturn.
- `package.json` — unchanged.

Full diff: not available — the `web-rtc` workspace is not a git repository, so changes were verified by reading the files directly.
</details>
