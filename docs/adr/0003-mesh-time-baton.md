---
status: accepted
date: 2026-05-12
---

# 0003 — Mesh-time baton vs local setTimeout

## Context

A round-robin standup timer needs to advance speakers automatically when their
slot ends. The naive way is `setTimeout(advance, duration)` on the host
phone — but the standup is multi-phone, peers join late, and any phone can
"be the host." We need a baton-pass that:

1. Looks identical on every phone, including phones that join mid-standup.
2. Survives reload of any single phone.
3. Vibrates every phone in the room at the moment of pass.

## Decision

The session record in Yjs holds:

```ts
{ currentSpeaker: number | null, startedAt: number | null, duration: number, mode }
```

`startedAt` is set to `Date.now()` on the phone that starts/advances the
speaker. Every phone renders `remaining = duration*1000 - (meshNow() - startedAt)`.
`meshNow()` is the median-offset clock-sync from `clockSync.ts`, so phones agree
to ~10–30 ms.

**Auto-advance:** every phone checks `remaining <= 0` on its animation tick.
If true, every phone races to call `advanceSpeaker(...)` — Yjs CRDT will reconcile
the writes (last-write-wins on each map key); the new `startedAt` is whatever
the last write was, which is fine because all writes are within milliseconds of
each other.

**Vibration / chime:** each phone tracks `prevSpeaker` in a ref. When the
session's `currentSpeaker` changes (whether by manual button, ArUco scan, or
auto-advance), every phone notices and triggers `navigator.vibrate(...)` + a
short audio chirp.

## Consequences

- A phone joining mid-standup sees the correct remaining time after the first
  clock-sync round (~3 s).
- Every phone in the room vibrates within the clock-sync precision on every
  baton-pass — a real "the floor just changed" sensation.
- Multiple phones writing `advanceSpeaker` near-simultaneously is safe: Yjs
  reconciles. The cost is a brief flicker as `startedAt` settles on the
  last write.
- A phone with a wildly wrong system clock would skew its `meshNow`; the
  median over peers suppresses that, but two phones with bad clocks could
  pull the median off. In practice this hasn't happened.

## Alternatives considered

- **Single host owns the timer; others mirror.** Simpler, but if the host
  drops out the timer stops. We picked the leaderless approach.
- **Server-authoritative timer.** Out of scope — `mesh-standup` is Mode A,
  zero backend.
