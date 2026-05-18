import type { Mode } from "../standup/Standup";

type Props = {
  name: string;
  onNameChange: (next: string) => void;
  tagId: number | null;
  onTagIdChange: (next: number | null) => void;
  duration: number;
  onDurationChange: (next: number) => void;
  mode: Mode;
  onModeChange: (next: Mode) => void;
};

export function SettingsExtras({
  name,
  onNameChange,
  tagId,
  onTagIdChange,
  duration,
  onDurationChange,
  mode,
  onModeChange,
}: Props) {
  const baseUrl = import.meta.env.BASE_URL;

  return (
    <>
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
    </>
  );
}
