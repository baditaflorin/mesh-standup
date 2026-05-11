---
status: accepted
date: 2026-05-12
---

# 0002 — Tag-to-roster binding

## Context

The ArUco mode needs a way for the room's camera to know "this tag belongs to
Alex." The dictionary `ARUCO_MIP_36h12` supports IDs 0..249, so we have plenty
of headroom for a 5–25 person team. The question is **where** the binding
between an ID and a person lives, and **when** it is established.

Three options were considered:

1. **Per-meeting host re-binding.** The host taps "this is Alex's tag" each
   meeting. Robust to lost cards, but high friction every standup.
2. **Tag IDs encode peer identity directly.** Doesn't work at this dictionary
   size — peer IDs are 32-bit, tag IDs are 8-bit, and tags are pre-printed.
3. **Tag-to-roster slot binding via settings.** Each peer sets their own tag ID
   in Settings; the ID is stored in their roster entry in the Yjs document.
   Print the marker sheet once, every team member keeps the same card forever.

## Decision

Each peer sets `tagId: number | null` in Settings; on connect, their roster
entry gets `{ name, tagId }`. The wall display's scanner looks up the roster
entry by `tagId` and starts the timer for that slot.

Reserved IDs:

- `0` — "I'm done / next" (skip to next speaker).
- `99` — "extend the current speaker by 30 s."

IDs `1..98` are free for roster binding. The printable sheet (`marker-sheet.pdf`)
contains IDs 0..15, enough for any practical standup. If you need more, run
`npm run make-markers` and edit the script to extend the grid.

## Consequences

- **Print once, use forever.** A team member's tag survives across meetings,
  job changes within the team, and so on — they just keep the same card.
- **Lost card = update Settings.** If you lose your tag, pick a free ID and
  print a new one from the sheet.
- **No central registry.** The binding lives in the Yjs document, so it
  propagates to every phone in the room without a server.
- **Conflict resolution is last-write-wins** at the roster-entry level; if two
  people pick the same tag ID, the second to join wins and the first should
  pick a new ID. We don't try to detect collisions automatically.

## Alternatives considered

- **AprilTag dictionary 36h11 / WASM detector.** Higher Hamming distance,
  better at long range — but the WASM bundle is ~600 KB and the dictionary is
  smaller. `ARUCO_MIP_36h12` ships as ~40 KB of JavaScript and detects fine at
  arm's length.
- **QR codes.** Higher capacity but slower to detect, and the detection
  library is bulkier. Pure marker IDs are what we want.
