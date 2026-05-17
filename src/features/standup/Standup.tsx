import { useEffect, useMemo, useRef, useState } from "react";
import { useVibration } from "@baditaflorin/mesh-common";
import * as Y from "yjs";
import { createRoomSync } from "../sync/yjsRoom";
import { createClockSync } from "../sync/clockSync";
import { maybeFetchTurnCredentials } from "../sync/iceConfig";
import {
  startScanner,
  drawPreview,
  type MarkerEvent,
  type ScannerHandle,
} from "../markers/scanner";

export type Mode = "tap" | "apriltag";

type RosterEntry = { name: string; tagId: number | null };
type Session = {
  currentSpeaker: number | null;
  startedAt: number | null;
  duration: number;
  mode: Mode;
};

type Props = {
  roomId: string;
  myName: string;
  myTagId: number | null;
  duration: number;
  mode: Mode;
  onOpenSettings: () => void;
};

const DONE_TAG = 0;
const EXTEND_TAG = 99;

export function Standup({ roomId, myName, myTagId, duration, mode, onOpenSettings }: Props) {
  const [armed, setArmed] = useState(false);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [session, setSession] = useState<Session>({
    currentSpeaker: null,
    startedAt: null,
    duration,
    mode,
  });
  const [now, setNow] = useState(Date.now());
  const [peers, setPeers] = useState(0);
  const [scannerOn, setScannerOn] = useState(false);
  const [lastMarker, setLastMarker] = useState<number | null>(null);

  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const scannerRef = useRef<ScannerHandle | null>(null);
  const prevSpeakerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const haptic = useVibration();

  const meshHandle = useMemo(() => {
    if (!armed) return null;
    const room = createRoomSync(roomId);
    const clock = createClockSync(room.provider);
    return { room, clock };
  }, [armed, roomId]);

  // Fetch TURN creds on arm.
  useEffect(() => {
    if (!armed) return;
    void maybeFetchTurnCredentials();
  }, [armed]);

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      meshHandle?.clock.destroy();
      meshHandle?.room.provider?.destroy();
      scannerRef.current?.stop();
      scannerRef.current = null;
    };
  }, [meshHandle]);

  // Bind Yjs structures and roster observation.
  useEffect(() => {
    if (!meshHandle) return;
    const doc = meshHandle.room.doc;
    const yRoster = doc.getArray<RosterEntry>("roster");
    const ySession = doc.getMap<Session[keyof Session]>("session");

    const readRoster = () => setRoster(yRoster.toArray());
    const readSession = () =>
      setSession({
        currentSpeaker: (ySession.get("currentSpeaker") as number | null | undefined) ?? null,
        startedAt: (ySession.get("startedAt") as number | null | undefined) ?? null,
        duration: (ySession.get("duration") as number | undefined) ?? duration,
        mode: ((ySession.get("mode") as Mode | undefined) ?? mode) as Mode,
      });

    // Seed if empty.
    if (yRoster.length === 0 && myName.trim()) {
      yRoster.push([{ name: myName.trim(), tagId: myTagId }]);
    } else if (myName.trim()) {
      // Make sure I'm in the roster (idempotent by name+tagId).
      const idx = yRoster.toArray().findIndex((r) => r.name === myName.trim());
      if (idx === -1) {
        yRoster.push([{ name: myName.trim(), tagId: myTagId }]);
      } else {
        const cur = yRoster.get(idx);
        if (cur && cur.tagId !== myTagId) {
          doc.transact(() => {
            yRoster.delete(idx, 1);
            yRoster.insert(idx, [{ name: cur.name, tagId: myTagId }]);
          });
        }
      }
    }
    if (!ySession.has("duration")) ySession.set("duration", duration);
    if (!ySession.has("mode")) ySession.set("mode", mode);

    readRoster();
    readSession();
    yRoster.observe(readRoster);
    ySession.observe(readSession);
    return () => {
      yRoster.unobserve(readRoster);
      ySession.unobserve(readSession);
    };
    // myTagId/myName intentionally only used on init; later changes flow through Settings reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meshHandle]);

  // Push duration/mode changes from settings.
  useEffect(() => {
    if (!meshHandle) return;
    const ySession = meshHandle.room.doc.getMap("session");
    if (ySession.get("duration") !== duration) ySession.set("duration", duration);
    if (ySession.get("mode") !== mode) ySession.set("mode", mode);
  }, [meshHandle, duration, mode]);

  // Animation tick + peer count.
  useEffect(() => {
    if (!meshHandle) return;
    let frame = 0;
    const tick = () => {
      setNow(meshHandle.clock.meshNow());
      setPeers(meshHandle.clock.peerCount());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [meshHandle]);

  // Auto-advance + vibrate on speaker change.
  useEffect(() => {
    if (!meshHandle) return;
    if (session.currentSpeaker === null || session.startedAt === null) {
      prevSpeakerRef.current = null;
      return;
    }
    const elapsed = now - session.startedAt;
    const remainingMs = session.duration * 1000 - elapsed;
    // Vibrate on speaker change.
    if (prevSpeakerRef.current !== session.currentSpeaker) {
      prevSpeakerRef.current = session.currentSpeaker;
      haptic.vibrate([60, 40, 60]);
      chirp(audioCtxRef.current);
    }
    // The "host" (whoever has the smallest awareness id alive — approximated by
    // the first peer in the roster, or just any peer racing fine because the
    // value is the same) advances when remaining <= 0.
    if (remainingMs <= 0) {
      advanceSpeaker(meshHandle.room.doc, session.currentSpeaker);
    }
  }, [meshHandle, now, session]);

  // Scanner lifecycle (apriltag mode + armed).
  useEffect(() => {
    if (!armed || session.mode !== "apriltag") {
      scannerRef.current?.stop();
      scannerRef.current = null;
      setScannerOn(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const h = await startScanner({
          width: 480,
          height: 360,
          onMarker: (m) => onScannedMarker(m, meshHandle?.room.doc ?? null),
          onFrame: (markers) => {
            if (previewRef.current && scannerRef.current) {
              drawPreview(previewRef.current, scannerRef.current.canvas, markers);
            }
          },
        });
        if (cancelled) {
          h.stop();
          return;
        }
        scannerRef.current = h;
        setScannerOn(true);
      } catch (err) {
        console.warn("[scanner] failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, session.mode, meshHandle]);

  function onScannedMarker(m: MarkerEvent, doc: Y.Doc | null) {
    if (!doc) return;
    setLastMarker(m.id);
    const yRoster = doc.getArray<RosterEntry>("roster");
    const ySession = doc.getMap("session");
    if (m.id === DONE_TAG) {
      const cur = (ySession.get("currentSpeaker") as number | null | undefined) ?? null;
      if (cur !== null) advanceSpeaker(doc, cur);
      return;
    }
    if (m.id === EXTEND_TAG) {
      const startedAt = (ySession.get("startedAt") as number | null | undefined) ?? null;
      if (startedAt !== null) {
        ySession.set("startedAt", startedAt + 30000);
      }
      return;
    }
    // Find roster index for this tag id.
    const idx = yRoster.toArray().findIndex((r) => r.tagId === m.id);
    if (idx === -1) return;
    doc.transact(() => {
      ySession.set("currentSpeaker", idx);
      ySession.set("startedAt", Date.now());
    });
  }

  const remainingMs =
    session.startedAt !== null ? session.duration * 1000 - (now - session.startedAt) : 0;
  const remainingS = Math.max(0, Math.ceil(remainingMs / 1000));

  const arm = () => {
    audioCtxRef.current ??= new AudioContext();
    void audioCtxRef.current.resume();
    setArmed(true);
  };

  if (!armed) {
    return (
      <div className="standup-arm">
        <h1>mesh-standup</h1>
        <p>
          Round-robin standup. Each speaker gets a synced countdown across every phone in the room.
          {mode === "apriltag"
            ? " ArUco tag mode: hold up your printed card to claim the floor."
            : null}
        </p>
        <p className="standup-arm-info">
          Joining as <code>{myName || "(no name set)"}</code>
          {myTagId !== null ? (
            <>
              {" "}
              · tag <code>{myTagId}</code>
            </>
          ) : null}
        </p>
        <button
          type="button"
          className="standup-arm-button"
          onClick={arm}
          disabled={!myName.trim()}
        >
          {myName.trim() ? "Connect to standup" : "Set your name first"}
        </button>
        <button type="button" className="standup-arm-secondary" onClick={onOpenSettings}>
          Open settings
        </button>
        <p className="standup-hint">
          Room <code>{roomId}</code> · {session.duration}s slots ·{" "}
          {session.mode === "apriltag" ? "ArUco" : "tap"} mode
        </p>
      </div>
    );
  }

  const currentSpeaker = session.currentSpeaker !== null ? roster[session.currentSpeaker] : null;

  return (
    <div className="standup-stage">
      <div className="standup-hud">
        <span>{peers + 1} phones</span>
        <span aria-hidden="true">·</span>
        <span>{session.mode === "apriltag" ? "ArUco" : "tap"}</span>
        {scannerOn ? (
          <>
            <span aria-hidden="true">·</span>
            <span>scanner live</span>
          </>
        ) : null}
        {lastMarker !== null ? (
          <>
            <span aria-hidden="true">·</span>
            <span>last #{lastMarker}</span>
          </>
        ) : null}
      </div>

      {session.mode === "apriltag" && (
        <canvas
          ref={previewRef}
          className="standup-preview"
          width={240}
          height={180}
          aria-label="ArUco scanner preview"
        />
      )}

      <div className="standup-main">
        <div className="standup-countdown">
          <div className="standup-time">{formatClock(remainingS)}</div>
          <div className="standup-speaker">
            {currentSpeaker ? (
              <>
                <strong>{currentSpeaker.name}</strong>
                {currentSpeaker.tagId !== null ? <span> · tag #{currentSpeaker.tagId}</span> : null}
              </>
            ) : (
              <em>no speaker</em>
            )}
          </div>
        </div>

        <div className="standup-roster">
          {roster.map((r, i) => (
            <div
              key={`${r.name}-${i}`}
              className={
                "standup-roster-row" +
                (i === session.currentSpeaker ? " standup-roster-active" : "")
              }
            >
              <span className="standup-roster-name">{r.name}</span>
              <span className="standup-roster-tag">{r.tagId !== null ? `#${r.tagId}` : "—"}</span>
            </div>
          ))}
        </div>

        {session.mode === "tap" ? (
          <div className="standup-actions">
            <button
              type="button"
              onClick={() => meshHandle && startSpeaker(meshHandle.room.doc, 0)}
              disabled={roster.length === 0}
            >
              Start round
            </button>
            <button
              type="button"
              onClick={() =>
                meshHandle &&
                session.currentSpeaker !== null &&
                advanceSpeaker(meshHandle.room.doc, session.currentSpeaker)
              }
              disabled={session.currentSpeaker === null}
            >
              Skip / next
            </button>
            <button
              type="button"
              onClick={() => {
                if (!meshHandle) return;
                const ySession = meshHandle.room.doc.getMap("session");
                const startedAt = ySession.get("startedAt");
                if (typeof startedAt === "number") {
                  ySession.set("startedAt", startedAt + 30000);
                }
              }}
              disabled={session.startedAt === null}
            >
              +30s
            </button>
          </div>
        ) : (
          <div className="standup-hint-block">
            Hold a tag card up to the camera. Tag {DONE_TAG} skips, tag {EXTEND_TAG} adds 30 s.
          </div>
        )}
      </div>
    </div>
  );
}

function startSpeaker(doc: Y.Doc, idx: number) {
  const ySession = doc.getMap("session");
  doc.transact(() => {
    ySession.set("currentSpeaker", idx);
    ySession.set("startedAt", Date.now());
  });
}

function advanceSpeaker(doc: Y.Doc, fromIdx: number) {
  const ySession = doc.getMap("session");
  const yRoster = doc.getArray<RosterEntry>("roster");
  const len = yRoster.length;
  if (len === 0) {
    doc.transact(() => {
      ySession.set("currentSpeaker", null);
      ySession.set("startedAt", null);
    });
    return;
  }
  const nextIdx = (fromIdx + 1) % len;
  doc.transact(() => {
    ySession.set("currentSpeaker", nextIdx);
    ySession.set("startedAt", Date.now());
  });
}

function chirp(ctx: AudioContext | null) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(660, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.18);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.24);
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
