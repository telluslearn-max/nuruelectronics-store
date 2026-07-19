import sharp from "sharp";
import { mkdirSync } from "node:fs";

const outDir = "/home/user/nuruelectronics-store/public/icons";
mkdirSync(outDir, { recursive: true });

const baseSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0a0a0a"/>
  <path d="M20 46V18h6l14 19V18h6v28h-6L26 27v19h-6z" fill="#f5f5f7"/>
  <rect x="42" y="40" width="6" height="6" fill="#d4472e"/>
</svg>
`;

// Maskable variant: solid square background (no rounded corners, since OS applies its own mask)
// with the logo artwork scaled down and centered so it sits within the ~80% safe zone.
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#0a0a0a"/>
  <g transform="translate(32 32) scale(0.68) translate(-32 -32)">
    <path d="M20 46V18h6l14 19V18h6v28h-6L26 27v19h-6z" fill="#f5f5f7"/>
    <rect x="42" y="40" width="6" height="6" fill="#d4472e"/>
  </g>
</svg>
`;

async function run() {
  await sharp(Buffer.from(baseSvg)).resize(192, 192).png().toFile(`${outDir}/icon-192.png`);
  await sharp(Buffer.from(baseSvg)).resize(512, 512).png().toFile(`${outDir}/icon-512.png`);
  await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toFile(`${outDir}/icon-512-maskable.png`);
  console.log("done");
}

run();
