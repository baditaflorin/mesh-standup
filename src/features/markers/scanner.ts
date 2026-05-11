/**
 * ArUco marker scanner.
 *
 * Opens the rear camera via getUserMedia, draws each video frame onto an
 * off-screen canvas, and runs the js-aruco2 detector against the resulting
 * ImageData. Detected markers are debounced (1 s per ID) before being
 * delivered to the callback.
 *
 * The dictionary `ARUCO_MIP_36h12` supports IDs 0..249 with 6x6 cells and
 * strong error correction — a good fit for printed paper tags held up to
 * a phone camera in office lighting.
 */

import { AR } from "js-aruco2";

export type MarkerCorner = { x: number; y: number };

export type MarkerEvent = {
  id: number;
  corners: MarkerCorner[];
  at: number;
};

export type ScannerHandle = {
  stop: () => void;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
};

export type ScannerOptions = {
  onMarker: (m: MarkerEvent) => void;
  onFrame?: (markers: MarkerEvent[]) => void;
  width?: number;
  height?: number;
  debounceMs?: number;
};

export async function startScanner(opts: ScannerOptions): Promise<ScannerHandle> {
  const width = opts.width ?? 640;
  const height = opts.height ?? 480;
  const debounceMs = opts.debounceMs ?? 1000;

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width, height },
    audio: false,
  });

  const video = document.createElement("video");
  video.srcObject = stream;
  video.playsInline = true;
  video.muted = true;
  video.setAttribute("playsinline", "");
  await video.play();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("2d canvas context unavailable");
  }

  const detector = new AR.Detector({ dictionaryName: "ARUCO_MIP_36h12" });

  let stopped = false;
  const lastSeen = new Map<number, number>();

  const tick = () => {
    if (stopped) return;
    if (video.videoWidth > 0) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const detected = detector.detect(imgData);
      const now = Date.now();
      const frameMarkers: MarkerEvent[] = detected.map((m) => ({
        id: m.id,
        corners: m.corners,
        at: now,
      }));
      if (opts.onFrame) opts.onFrame(frameMarkers);
      for (const m of frameMarkers) {
        const last = lastSeen.get(m.id) ?? 0;
        if (now - last < debounceMs) continue;
        lastSeen.set(m.id, now);
        opts.onMarker(m);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return {
    video,
    canvas,
    stop: () => {
      stopped = true;
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

/**
 * Draw the detected marker outlines onto a preview canvas.
 * The preview canvas is the on-screen <canvas>; we copy the off-screen
 * frame, then draw a green polygon per detection.
 */
export function drawPreview(
  preview: HTMLCanvasElement,
  source: HTMLCanvasElement,
  markers: MarkerEvent[],
): void {
  const ctx = preview.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(source, 0, 0, preview.width, preview.height);
  ctx.strokeStyle = "#7eff8a";
  ctx.lineWidth = 2;
  ctx.fillStyle = "#7eff8a";
  ctx.font = "14px system-ui";
  const sx = preview.width / source.width;
  const sy = preview.height / source.height;
  for (const m of markers) {
    if (m.corners.length === 0) continue;
    ctx.beginPath();
    const first = m.corners[0];
    if (!first) continue;
    ctx.moveTo(first.x * sx, first.y * sy);
    for (let i = 1; i < m.corners.length; i++) {
      const c = m.corners[i];
      if (!c) continue;
      ctx.lineTo(c.x * sx, c.y * sy);
    }
    ctx.closePath();
    ctx.stroke();
    const cx = m.corners.reduce((s, c) => s + c.x, 0) / m.corners.length;
    const cy = m.corners.reduce((s, c) => s + c.y, 0) / m.corners.length;
    ctx.fillText(`#${m.id}`, cx * sx - 10, cy * sy + 4);
  }
}
