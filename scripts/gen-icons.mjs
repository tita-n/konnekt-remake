import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const accent = "#147A57";

/** Flat, geometric K mark. `safe` insets the mark for maskable icons. */
function mark({ safe = false } = {}) {
  const scale = safe ? 0.62 : 0.86;
  const size = 512;
  const cx = size / 2;
  const cy = size / 2;
  const w = 72 * scale * 1.7;
  const h = 230 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${accent}"/>
    <g fill="none" stroke="#ffffff" stroke-width="${Math.round(56 * scale)}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M ${cx - w * 0.72} ${cy - h / 2} V ${cy + h / 2}"/>
      <path d="M ${cx + w * 0.55} ${cy - h / 2} L ${cx - w * 0.32} ${cy + h * 0.02} L ${cx + w * 0.62} ${cy + h / 2}"/>
    </g>
  </svg>`;
}

const out = "public/icons";
await mkdir(out, { recursive: true });

const jobs = [
  { size: 192, name: "icon-192.png", svg: mark() },
  { size: 512, name: "icon-512.png", svg: mark() },
  { size: 180, name: "apple-touch-icon.png", svg: mark() },
  { size: 512, name: "maskable-512.png", svg: mark({ safe: true }) },
  { size: 32, name: "favicon-32.png", svg: mark({ safe: true }) },
];

for (const job of jobs) {
  await sharp(Buffer.from(job.svg)).resize(job.size, job.size).png({ compressionLevel: 9 }).toFile(`${out}/${job.name}`);
}

// A crisp favicon as SVG for modern browsers.
await writeFile(`${out}/favicon.svg`, mark({ safe: true }));

console.log(`Generated ${jobs.length} icons in ${out}/`);
