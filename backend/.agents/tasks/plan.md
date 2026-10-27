# Implementation Plan — WebRTC 1:1 Video Chat Backend (TURN/STUN + Socket.IO signaling)

All paths are relative to `c:/Users/rajni/Desktop/web-rtc/backend` (the backend root). ES modules (`import`/`export`) throughout — do NOT introduce CommonJS. Do NOT touch the frontend. The existing health route and error middleware must stay intact.

## Design decisions (grounded in the code as read)

- **Config shape:** Add `iceServers` onto the existing `serverConfig` object in `src/config/index.js` rather than a new export, so the controller reuses the one import it already has. STUN URLs from `STUN_URLS` are grouped into a single ICE object `{ urls: [...] }` (valid for `RTCPeerConnection` and the common idiom); TURN is a separate object included only when `TURN_URL` is non-empty.
- **TURN inclusion rule:** Include the TURN entry only when `process.env.TURN_URL` is truthy; include `username`/`credential` keys only when their values are truthy, so no empty values ever appear in the array (per the spec).
- **Room state:** Module-level `rooms = new Map()` (`roomId -> Set<socketId>`) plus a reverse `socketRoom = new Map()` (`socketId -> roomId`) for O(1) disconnect cleanup. Max 2 participants per room.
- **No Socket.IO rooms:** All signaling is targeted with `io.to(targetSocketId).emit(...)` driven by the `Set`s, so `socket.join(roomId)` is intentionally NOT called. Participant truth lives in the `Map`, not in Socket.IO room membership — simpler and deterministic.
- **Offer/answer field rename:** The current socket relay uses keys `offer`/`answer`; the spec mandates a `description` key for both. This changes the client contract to `{ to, description }` → relay `{ from, description }`, exactly as specified. Frontend is out of scope.
- **No permanent new deps:** `express`, `cors`, `dotenv`, `socket.io` cover everything. `socket.io-client` is used ONLY for a throwaway signaling smoke test (installed temporarily then removed), never added to `package.json`.
- **Verification reality:** There is no test runner in this project. Verification = `node --check` (syntax), booting the server, `curl`-ing HTTP endpoints, and a throwaway Socket.IO client smoke test. No test framework will be introduced (out of scope).

---

- [ ] 1. Add the `iceServers` config block to `src/config/index.js`.
      Extend `serverConfig` with an `iceServers` array of `{ urls, username?, credential? }` objects. Parse `STUN_URLS` (comma-separated, default `stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302`) into `{ urls: [stun...] }`. When `process.env.TURN_URL` is truthy, push `{ urls: TURN_URL, ...(TURN_USERNAME && { username: TURN_USERNAME }), ...(TURN_CREDENTIAL && { credential: TURN_CREDENTIAL }) }`. Keep existing `port`/`clientOrigin`. Use `dotenv` (already imported).
      Files: `src/config/index.js`
      Verify: from the backend root, `node --check src/config/index.js` passes; then
      `node --input-type=module -e "import('./src/config/index.js').then(m=>console.log(JSON.stringify(m.serverConfig.iceServers)))"` prints a JSON array with one STUN object (urls length 2) and NO TURN object. Then repeat with `TURN_URL=turn:example.com:3478 TURN_USERNAME=u TURN_CREDENTIAL=p node --input-type=module -e "import('./src/config/index.js').then(m=>console.log(JSON.stringify(m.serverConfig.iceServers)))"` and confirm a second object `{ urls:'turn:example.com:3478', username:'u', credential:'p' }` is present.

- [ ] 2. Create the ICE servers API endpoint and register it.
      Create `src/controllers/iceServersController.js` exporting `getIceServers = (req, res) => res.status(200).json({ iceServers: serverConfig.iceServers })` (follow the minimal style of `src/controllers/healthController.js`). Create `src/routes/iceServersRoutes.js` with `Router()`, `router.get('/', getIceServers)`, default export (follow `src/routes/healthRoutes.js`). In `src/app.js`, import the router and mount it at `/api/ice-servers` BEFORE `notFoundHandler`/`errorHandler` (which must stay last). Keep the existing `/api/health` route untouched.
      Files: `src/controllers/iceServersController.js` (create), `src/routes/iceServersRoutes.js` (create), `src/app.js` (modify — add import + mount)
      Verify: `npm install` (if not already) then `node src/server.js & SERVER_PID=$!; sleep 1; curl -s http://localhost:4000/api/ice-servers; echo; curl -s http://localhost:4000/api/health; echo; kill $SERVER_PID` — `/api/ice-servers` returns `{"iceServers":[{"urls":[...]}]}` (STUN only, no TURN) and `/api/health` still returns `{"status":"ok",...}`.

- [ ] 3. Rewrite `src/services/socketService.js` for proper 1:1 signaling.
      Keep the `initializeSocket(httpServer, app)` / `getIo()` signatures and the `Server(httpServer, { cors: { origin: serverConfig.clientOrigin, methods: ['GET','POST'] } })` setup and `app.locals.io = io`. Replace the event logic with room-managed signaling using the module-level maps `rooms` (`Map<roomId, Set<socketId>>`) and `socketRoom` (`Map<socketId, roomId>`). Use the imported logger from `../utils/logger.js` instead of `console.log`. Handlers:
      - `create-or-join` (`roomId`): if room absent/empty → create Set, add `socket.id`, record `socketRoom`, emit `created` to caller. Else if size === 1 → add `socket.id`, record `socketRoom`, emit `joined` to joiner, emit `peer-joined` with `{ peerId: socket.id }` to the existing peer (first Set entry), emit `ready` to joiner. Else (size === 2) → emit `room-full` to that socket (do not add).
      - `offer` (`{ to, description }`): `io.to(to).emit('offer', { from: socket.id, description })`.
      - `answer` (`{ to, description }`): `io.to(to).emit('answer', { from: socket.id, description })`.
      - `ice-candidate` (`{ to, candidate }`): `io.to(to).emit('ice-candidate', { from: socket.id, candidate })`.
      - `leave-room` (`roomId`): call a shared `removeSocketFromRoom(socket, roomId)` that deletes `socket.id` from the room Set, deletes `socketRoom` entry, emits `peer-left` with `{ peerId: socket.id }` to each remaining peer via `io.to(...).emit`, and deletes the room key if empty. Log the leave.
      - `disconnect`: look up `roomId = socketRoom.get(socket.id)`; if present, reuse `removeSocketFromRoom(socket, roomId)` (which emits `peer-left` to remaining peers and cleans up). Log connect/disconnect via logger.
      Files: `src/services/socketService.js`
      Verify: `node --check src/services/socketService.js` passes. Then run the throwaway signaling smoke test (item 7) — OR, to verify this item in isolation: `npm i -D socket.io-client` (temp, removed in item 7), create `scripts/smoke-test-signaling.mjs` that connects 3 clients to a backgrounded server and asserts: A gets `created`; B gets `joined`+`ready` and A gets `peer-joined`; offer/answer/ice-candidate relay with `description`/`candidate` and correct `from`; client C gets `room-full`; B `leave-room` → A gets `peer-left`; abrupt disconnect of one peer in a fresh 2-person room → the other gets `peer-left`. Run `node src/server.js & SERVER_PID=$!; sleep 1; node scripts/smoke-test-signaling.mjs; STATUS=$?; kill $SERVER_PID; exit $STATUS` and confirm it prints `SMOKE TEST PASSED` and exits 0.

- [ ] 4. Update `.env.example` with TURN/STUN variables and comments.
      Replace the file contents with exactly:
      ```
      PORT=4000
      CLIENT_ORIGIN=http://localhost:5173
      # STUN servers (comma-separated, defaults to Google public STUN)
      STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
      # TURN server (required for NAT traversal behind symmetric NATs / firewalls)
      # Leave empty to skip TURN. Set up a coturn instance for production.
      # Example: turn:your-turn-server.com:3478
      TURN_URL=
      TURN_USERNAME=
      TURN_CREDENTIAL=
      ```
      Files: `.env.example`
      Verify: read the file back and confirm it matches the above verbatim (the config test in item 1 already proves the defaults resolve correctly with these unset values).

- [ ] 5. Update `README.md` to document the new backend surface.
      Update the existing `README.md` (keep the Setup and Structure sections) and add/replace: a TURN/STUN section explaining STUN defaults and TURN credentials via `TURN_URL`/`TURN_USERNAME`/`TURN_CREDENTIAL` env vars (skip TURN by leaving them blank); a section for the `GET /api/ice-servers` endpoint and its `{"iceServers":[...]}` response; replace the WebRTC Signaling Events table with the new event set (`create-or-join`, `created`, `joined`, `peer-joined`, `ready`, `room-full`, `offer`, `answer`, `ice-candidate`, `leave-room`, `peer-left`, `disconnect`) showing direction and payload; a Room management note (max 2 participants, in-memory, third joiner gets `room-full`); a brief local coturn section with a docker command, e.g. `docker run --rm --network host coturn/coturn -n --listening-ip=0.0.0.0 --realm=localhost --user=u:p --lt-cred-mech`.
      Files: `README.md`
      Verify: open `README.md` and confirm all six topics are present; no need to boot anything. (Content accuracy for the table is covered by the item 3 smoke test.)

- [ ] 6. Confirm `package.json` needs no dependency changes.
      Verify `express`, `cors`, `dotenv`, `socket.io` are present (they are) and that no new runtime dependency is required for any of the above. Make NO edits to `package.json`.
      Files: `package.json` (read-only check, no modification)
      Verify: `node -e "const p=require('./package.json'); console.log(p.dependencies)"` lists the four deps; confirm `socket.io-client` is NOT in dependencies/devDependencies (it was only ever a throwaway in item 7). Leave `package.json` byte-for-byte as it was.

- [ ] 7. End-to-end verification and cleanup (run after items 1–6).
      From the backend root: run `npm install`; run `node --check` on every changed/new file (`src/config/index.js`, `src/controllers/iceServersController.js`, `src/routes/iceServersRoutes.js`, `src/app.js`, `src/services/socketService.js`) — all pass. Boot the server and curl both endpoints in one shot:
      `node src/server.js & SERVER_PID=$!; sleep 1; echo 'health:'; curl -s http://localhost:4000/api/health; echo; echo 'ice-servers:'; curl -s http://localhost:4000/api/ice-servers; echo; kill $SERVER_PID`
      Expect `{"status":"ok",...}` and `{"iceServers":[{"urls":["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]}]}` (no TURN). Then run the signaling smoke test described in item 3 and confirm `SMOKE TEST PASSED`. Cleanup: `npm uninstall socket.io-client` (removes the temp devDep) and `rm -f scripts/smoke-test-signaling.mjs` (and remove the empty `scripts/` dir). Final check: `git status` shows only the intended source/doc files changed; `package.json` and `package-lock.json` (if any) show no `socket.io-client` entry.
      Files: temporary `scripts/smoke-test-signaling.mjs` (created then deleted)
      Verify: all `node --check` pass, both curl endpoints return the expected JSON, smoke test exits 0, and after cleanup `package.json` is unchanged (confirm with `git diff --stat package.json` showing no change).
