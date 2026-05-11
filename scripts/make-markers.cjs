#!/usr/bin/env node
/**
 * Generate ArUco marker PNGs (IDs 0..19) plus a printable A4 sheet PDF
 * containing IDs 0..15 in a 4x4 grid, each labeled by ID.
 *
 * Run via `npm run make-markers`. Output:
 *   public/markers/marker-<id>.png  (256x256, black-on-white)
 *   public/marker-sheet.pdf         (A4, 16 markers, labeled)
 *
 * Dictionary: ARUCO_MIP_36h12 (6x6 cells + 1-cell black border per side).
 */

const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const PDFDocument = require("pdfkit");
// eslint-disable-next-line import/no-extraneous-dependencies
const { AR } = require("js-aruco2");

const ROOT = path.resolve(__dirname, "..");
const MARKERS_DIR = path.join(ROOT, "public", "markers");
const SHEET_PDF = path.join(ROOT, "public", "marker-sheet.pdf");

fs.mkdirSync(MARKERS_DIR, { recursive: true });

const dict = new AR.Dictionary("ARUCO_MIP_36h12");

// 6x6 marker cells + 1-cell black border on each side = 8x8 cells total.
const CELLS_PER_SIDE = 8;
const PIXELS_PER_CELL = 32; // 256x256 PNGs
const IMG_SIZE = CELLS_PER_SIDE * PIXELS_PER_CELL;

function bitsForId(id) {
  // js-aruco2 exposes Dictionary.codeList: each id maps to a 36-bit pattern
  // for the 6x6 inner cells, row-major.
  const code = dict.codeList[id];
  if (!code) throw new Error(`No code for id ${id}`);
  // code is a string of 36 chars '0'/'1' OR an array of bits; normalise.
  if (typeof code === "string") {
    return code.split("").map((c) => (c === "1" ? 1 : 0));
  }
  if (Array.isArray(code)) {
    return code.map((b) => (b ? 1 : 0));
  }
  throw new Error("Unexpected code shape");
}

function renderMarkerPng(id, outPath) {
  const bits = bitsForId(id);
  const png = new PNG({ width: IMG_SIZE, height: IMG_SIZE });
  // Init all white.
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 255;
    png.data[i + 1] = 255;
    png.data[i + 2] = 255;
    png.data[i + 3] = 255;
  }
  // For each cell at (cx, cy) determine colour.
  for (let cy = 0; cy < CELLS_PER_SIDE; cy++) {
    for (let cx = 0; cx < CELLS_PER_SIDE; cx++) {
      let isBlack;
      const onBorder =
        cx === 0 || cy === 0 || cx === CELLS_PER_SIDE - 1 || cy === CELLS_PER_SIDE - 1;
      if (onBorder) {
        isBlack = true;
      } else {
        const ix = cx - 1;
        const iy = cy - 1;
        const bit = bits[iy * 6 + ix];
        // ArUco convention: bit=1 means white, bit=0 means black.
        isBlack = bit === 0;
      }
      if (!isBlack) continue;
      for (let py = 0; py < PIXELS_PER_CELL; py++) {
        for (let px = 0; px < PIXELS_PER_CELL; px++) {
          const x = cx * PIXELS_PER_CELL + px;
          const y = cy * PIXELS_PER_CELL + py;
          const idx = (y * IMG_SIZE + x) * 4;
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 255;
        }
      }
    }
  }
  fs.writeFileSync(outPath, PNG.sync.write(png));
}

const ids = Array.from({ length: 20 }, (_, i) => i);
for (const id of ids) {
  const out = path.join(MARKERS_DIR, `marker-${id}.png`);
  renderMarkerPng(id, out);
}
console.log(`Wrote ${ids.length} marker PNGs to ${MARKERS_DIR}`);

// Build the printable sheet PDF: 16 markers (IDs 0..15) in a 4x4 grid on A4.
const doc = new PDFDocument({ size: "A4", margin: 36 });
doc.pipe(fs.createWriteStream(SHEET_PDF));

doc.fontSize(14).text("mesh-standup — ArUco marker sheet (ARUCO_MIP_36h12)", { align: "center" });
doc
  .fontSize(9)
  .fillColor("#555")
  .text(
    "Print at 100% scale. Cut along the cell borders. Hold one tag in front of the camera to claim the floor.",
    {
      align: "center",
    },
  )
  .fillColor("black");

const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
const top = 110;
const usableHeight = doc.page.height - top - doc.page.margins.bottom;
const cols = 4;
const rows = 4;
const cellW = pageWidth / cols;
const cellH = usableHeight / rows;
const markerSize = Math.min(cellW, cellH) - 26; // leave label space

for (let i = 0; i < 16; i++) {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const x = doc.page.margins.left + c * cellW + (cellW - markerSize) / 2;
  const y = top + r * cellH + 4;
  doc.image(path.join(MARKERS_DIR, `marker-${i}.png`), x, y, {
    width: markerSize,
    height: markerSize,
  });
  doc.fontSize(10).text(`ID ${i}`, doc.page.margins.left + c * cellW, y + markerSize + 4, {
    width: cellW,
    align: "center",
  });
}

doc.end();
console.log(`Wrote printable sheet to ${SHEET_PDF}`);
