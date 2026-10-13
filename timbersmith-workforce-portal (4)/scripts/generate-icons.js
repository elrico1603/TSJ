import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const MASTER_ICON = path.join(process.cwd(), 'src', 'assets', 'images', 'icon-1024.png');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const ICONS_DIR = path.join(PUBLIC_DIR, 'icons');

if (!fs.existsSync(MASTER_ICON)) {
  console.error(`Master icon not found at ${MASTER_ICON}`);
  process.exit(1);
}

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

console.log(`Generating icon sizes from ${MASTER_ICON}...`);

const iconConfigs = [
  { size: 72, dest: path.join(ICONS_DIR, 'icon-72x72.png') },
  { size: 96, dest: path.join(ICONS_DIR, 'icon-96x96.png') },
  { size: 128, dest: path.join(ICONS_DIR, 'icon-128x128.png') },
  { size: 144, dest: path.join(ICONS_DIR, 'icon-144x144.png') },
  { size: 152, dest: path.join(ICONS_DIR, 'icon-152x152.png') },
  { size: 192, dest: path.join(ICONS_DIR, 'icon-192x192.png') },
  { size: 384, dest: path.join(ICONS_DIR, 'icon-384x384.png') },
  { size: 512, dest: path.join(ICONS_DIR, 'icon-512x512.png') },
  { size: 180, dest: path.join(PUBLIC_DIR, 'apple-touch-icon.png') },
  { size: 180, dest: path.join(ICONS_DIR, 'apple-touch-icon.png') },
  { size: 32, dest: path.join(PUBLIC_DIR, 'favicon.ico') },
  { size: 32, dest: path.join(PUBLIC_DIR, 'favicon-32x32.png') },
  { size: 16, dest: path.join(PUBLIC_DIR, 'favicon-16x16.png') },
  { size: 32, dest: path.join(ICONS_DIR, 'favicon-32x32.png') },
];

try {
  for (const config of iconConfigs) {
    execSync(`convert "${MASTER_ICON}" -resize ${config.size}x${config.size}! "${config.dest}"`);
  }

  // Maskable icons (with 10% safe zone padding)
  execSync(`convert "${MASTER_ICON}" -resize 154x154! -gravity center -background "#121218" -extent 192x192 "${path.join(ICONS_DIR, 'maskable-192x192.png')}"`);
  execSync(`convert "${MASTER_ICON}" -resize 410x410! -gravity center -background "#121218" -extent 512x512 "${path.join(ICONS_DIR, 'maskable-512x512.png')}"`);

  console.log('Icon generation completed successfully!');
} catch (err) {
  console.warn('Icon generation warning:', err.message);
}
