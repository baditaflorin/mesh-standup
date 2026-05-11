import { useEffect, useState } from "react";
import {
  loadSignalingUrl,
  loadTurnTokenUrl,
  resetIceServers,
  saveSignalingUrl,
  saveTurnTokenUrl,
} from "../sync/iceConfig";
import { appConfig } from "../../shared/config";
import type { Mode } from "../standup/Standup";

type Props = {
  open: boolean;
  onClose: () => void;
  roomId: string;
  onRoomChange: (next: string) => void;
  name: string;
  onNameChange: (next: string) => void;
  tagId: number | null;
  onTagIdChange: (next: number | null) => void;
  duration: number;
  onDurationChange: (next: number) => void;
  mode: Mode;
  onModeChange: (next: Mode) => void;
};

export function SettingsDrawer({
  open,
  onClose,
  roomId,
  onRoomChange,
  name,
  onNameChange,
  tagId,
  onTagIdChange,
  duration,
  onDurationChange,
  mode,
  onModeChange,
}: Props) {
  const [signaling, setSignaling] = useState(loadSignalingUrl());
  const [tokenUrl, setTokenUrl] = useState(loadTurnTokenUrl());

  useEffect(() => {
    if (open) {
      setSignaling(loadSignalingUrl());
      setTokenUrl(loadTurnTokenUrl());
    }
  }, [open]);

  if (!open) return null;

  const baseUrl = import.meta.env.BASE_URL;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <label>
          <span>Room ID</span>
          <input value={roomId} onChange={(e) => onRoomChange(e.target.value)} />
        </label>

        <label>
          <span>Your name</span>
          <input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Alex" />
        </label>

        <label>
          <span>Your tag ID (printed marker number)</span>
          <input
            type="number"
            min={1}
            max={98}
            value={tagId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") onTagIdChange(null);
              else onTagIdChange(Number(v));
            }}
            placeholder="e.g. 1"
          />
        </label>

        <label>
          <span>Slot duration (seconds)</span>
          <input
            type="number"
            min={10}
            max={600}
            step={5}
            value={duration}
            onChange={(e) => onDurationChange(Math.max(10, Number(e.target.value) || 60))}
          />
        </label>

        <label>
          <span>Mode</span>
          <select value={mode} onChange={(e) => onModeChange(e.target.value as Mode)}>
            <option value="tap">Tap (buttons advance)</option>
            <option value="apriltag">ArUco (camera scans tags)</option>
          </select>
        </label>

        <a
          className="standup-pdf-link"
          href={`${baseUrl}marker-sheet.pdf`}
          target="_blank"
          rel="noreferrer"
        >
          Download printable marker sheet (PDF)
        </a>

        <p className="settings-help">
          Tag IDs 1–98 bind to roster slots. Tag <code>0</code> = "I'm done / next." Tag{" "}
          <code>99</code> = "extend 30 s." The mapping from tag to roster slot lives in the per-peer
          Yjs roster entry — set your tag here and tell the room.
        </p>

        <hr />

        <h3>Self-hosted infra (advanced)</h3>
        <p className="settings-help">
          Override the default signaling and TURN endpoints. Leave blank to use the built-in
          defaults (<code>{appConfig.signalingUrl}</code> and <code>{appConfig.turnTokenUrl}</code>
          ).
        </p>

        <label>
          <span>Signaling URL</span>
          <input
            value={signaling}
            onChange={(e) => setSignaling(e.target.value)}
            placeholder={appConfig.signalingUrl}
          />
        </label>

        <label>
          <span>TURN credentials URL</span>
          <input
            value={tokenUrl}
            onChange={(e) => setTokenUrl(e.target.value)}
            placeholder={appConfig.turnTokenUrl}
          />
        </label>

        <div className="settings-actions">
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl(signaling);
              saveTurnTokenUrl(tokenUrl);
              onClose();
              location.reload();
            }}
          >
            Save and reload
          </button>
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl("");
              saveTurnTokenUrl("");
              resetIceServers();
              onClose();
              location.reload();
            }}
          >
            Reset to defaults
          </button>
        </div>

        <hr />

        <footer className="settings-footer">
          <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
            source on github
          </a>
          <span>
            v{appConfig.version} · {appConfig.commit}
          </span>
        </footer>
      </div>
    </div>
  );
}
