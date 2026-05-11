# Privacy threat model — mesh-standup

## What other peers in the same room can see

- The **roster** — names and tag IDs of every connected peer, stored in the
  shared Yjs document.
- The **session state** — current speaker index, slot start time, slot
  duration, and mode (`tap` / `apriltag`).
- Your phone's wall-clock time (`Date.now()`), published every 1.5 s as part
  of mesh clock sync.
- Your Yjs awareness `clientID` — a per-session 32-bit integer regenerated on
  every page load. Not stable across reloads. Not tied to your account.

That is the entire payload on the wire. No location, no audio, no video, no
identity beyond the name you typed in Settings.

## What stays local

- Your room ID, your name, your tag ID, your slot duration, and your mode
  preference live in `localStorage` and never leave your device until you arm
  and connect.
- The camera frame in ArUco mode is processed locally; only the detected
  marker ID is written into Yjs. Pixels never leave the device.
- Your TURN / signaling URL overrides stay in `localStorage`.

## What the signaling server sees

`signaling-server` (source at https://github.com/baditaflorin/signaling-server)
sees:

- The room name (`mesh-standup:<roomId>`).
- Encrypted SDP offer/answer blobs being relayed between peers.
- The IP address of the peer making the WebSocket connection.

It does **not** see roster entries, session state, or camera frames.

## What the TURN server sees

`coturn-hetzner` (source at https://github.com/baditaflorin/coturn-hetzner)
relays encrypted WebRTC traffic when peers cannot connect directly. It sees:

- The IP addresses of the two peers being relayed.
- Encrypted DTLS-SRTP / DataChannel bytes. It cannot decrypt them.

## Permissions asked

- **Camera (`getUserMedia`)** — only when ArUco mode is enabled and you've
  tapped "Connect to standup." Released as soon as you close the tab or
  switch back to tap mode.
- **Vibration (`navigator.vibrate`)** — best-effort, no permission prompt on
  most browsers.
- **Audio (`AudioContext`)** — created on the "Connect" gesture so iOS Safari
  allows the chime.
