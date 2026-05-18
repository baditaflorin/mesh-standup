import { useEffect, useState } from "react";
import { MeshShell } from "@baditaflorin/mesh-common";
import { Standup, type Mode } from "./features/standup/Standup";
import { SettingsExtras } from "./features/settings/SettingsExtras";
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

function openSettingsFab(): void {
  const fab = document.querySelector<HTMLButtonElement>(".mesh-settings-fab");
  fab?.click();
}

export function App() {
  const [roomId, setRoomId] = useState(() => readString(STORAGE.room, "default"));
  const [name, setName] = useState(() => readString(STORAGE.name, ""));
  const [tagId, setTagId] = useState<number | null>(() => readMaybeNumber(STORAGE.tagId));
  const [duration, setDuration] = useState(() => readNumber(STORAGE.duration, 60));
  const [mode, setMode] = useState<Mode>(() => (readString(STORAGE.mode, "tap") as Mode) || "tap");

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
    <MeshShell
      config={appConfig}
      roomId={roomId}
      onRoomChange={setRoomId}
      settingsExtras={
        <SettingsExtras
          name={name}
          onNameChange={setName}
          tagId={tagId}
          onTagIdChange={setTagId}
          duration={duration}
          onDurationChange={setDuration}
          mode={mode}
          onModeChange={setMode}
        />
      }
    >
      <Standup
        roomId={roomId}
        myName={name}
        myTagId={tagId}
        duration={duration}
        mode={mode}
        onOpenSettings={openSettingsFab}
      />
    </MeshShell>
  );
}
