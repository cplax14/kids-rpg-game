#!/usr/bin/env node
/**
 * Script to process sprite sheets - removes magenta background
 *
 * Usage:
 *   pnpm add sharp
 *   node scripts/process-sprites.js
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processSprites() {
  const inputPath = path.join(__dirname, '../public/assets/sprites/characters/rpg-characters-32x32.png');
  const outputPath = path.join(__dirname, '../public/assets/sprites/characters/rpg-characters-32x32-transparent.png');

  console.log('Processing:', inputPath);

  // Load image and get raw pixel data
  const image = sharp(inputPath);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  // Process pixels - replace magenta (255, 0, 255) with transparent
  const processedData = Buffer.alloc(info.width * info.height * 4);

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const outIdx = (i / info.channels) * 4;

    // Check for magenta
    if (r > 240 && g < 20 && b > 240) {
      // Make transparent
      processedData[outIdx] = 0;
      processedData[outIdx + 1] = 0;
      processedData[outIdx + 2] = 0;
      processedData[outIdx + 3] = 0;
    } else {
      // Copy original
      processedData[outIdx] = r;
      processedData[outIdx + 1] = g;
      processedData[outIdx + 2] = b;
      processedData[outIdx + 3] = info.channels === 4 ? data[i + 3] : 255;
    }
  }

  // Save processed image
  await sharp(processedData, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
    .png()
    .toFile(outputPath);

  console.log('Saved to:', outputPath);
  console.log('Done! Magenta background removed.');
}

processSprites().catch(console.error);
