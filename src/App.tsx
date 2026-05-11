import { useEffect, useState } from "react";
import { Standup, type Mode } from "./features/standup/Standup";
import { SettingsDrawer } from "./features/settings/SettingsDrawer";
import { appConfig } from "./shared/config";

const STORAGE = {
  room: `${appConfig.storagePrefix}:room`,
  name: `${appConfig.storagePrefix}:name`,
  tagId: `${appConfig.storagePrefix}:tagId`,
  duration: `${appConfig.storagePrefix}:duration`,
  mode: `${appConfig.storagePrefix}:mode`,
};

function readString(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}
function readNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
function readMaybeNumber(key: string): number | null {
  const raw = localStorage.getItem(key);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function App() {
  const [roomId, setRoomId] = useState(() => readString(STORAGE.room, "default"));
  const [name, setName] = useState(() => readString(STORAGE.name, ""));
  const [tagId, setTagId] = useState<number | null>(() => readMaybeNumber(STORAGE.tagId));
  const [duration, setDuration] = useState(() => readNumber(STORAGE.duration, 60));
  const [mode, setMode] = useState<Mode>(() => (readString(STORAGE.mode, "tap") as Mode) || "tap");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE.room, roomId);
  }, [roomId]);
  useEffect(() => {
    localStorage.setItem(STORAGE.name, name);
  }, [name]);
  useEffect(() => {
    if (tagId === null) localStorage.removeItem(STORAGE.tagId);
    else localStorage.setItem(STORAGE.tagId, String(tagId));
  }, [tagId]);
  useEffect(() => {
    localStorage.setItem(STORAGE.duration, String(duration));
  }, [duration]);
  useEffect(() => {
    localStorage.setItem(STORAGE.mode, mode);
  }, [mode]);

  return (
    <div className="app-root">
      <Standup
        roomId={roomId}
        myName={name}
        myTagId={tagId}
        duration={duration}
        mode={mode}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <button
        type="button"
        className="settings-fab"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
      >
        ⚙
      </button>

      <div className="self-ref">
        <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
          source
        </a>
        <span aria-hidden="true">·</span>
        <a href={appConfig.paypalUrl} target="_blank" rel="noreferrer">
          tip ♥
        </a>
        <span aria-hidden="true">·</span>
        <span>
          v{appConfig.version} · {appConfig.commit}
        </span>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomId={roomId}
        onRoomChange={setRoomId}
        name={name}
        onNameChange={setName}
        tagId={tagId}
        onTagIdChange={setTagId}
        duration={duration}
        onDurationChange={setDuration}
        mode={mode}
        onModeChange={setMode}
      />
    </div>
  );
}
