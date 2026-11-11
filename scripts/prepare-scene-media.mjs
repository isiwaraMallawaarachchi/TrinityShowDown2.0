import ffmpeg from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.resolve(root, '../../Ref vIdeo');
const output = path.join(root, 'public/media/scenes');
const clips = [
  { id: 'cod', file: 'CODM.mov', start: 2.95, duration: 2.1, focus: .43 },
  { id: 'pubg', file: 'PUBG.mov', start: 2.7, duration: 4, focus: .58 },
  { id: 'mlbb', file: 'MLBB.mov', start: 4.15, duration: 3.6, focus: .5, crop: 'crop=1920:808:0:136' },
  { id: 'coc', file: 'COC.mov', start: 0, duration: 2.5, focus: .56, version: 'opening' },
];
const variants = ['desktop', 'compact', 'portrait'];
const fps = 24;
const only = process.argv[2];
if (only && !clips.some((clip) => clip.id === only)) throw new Error('Unknown clip ID');
const manifest = only ? JSON.parse(await readFile(path.join(root, 'src/scene-media.json'), 'utf8')) : {};
await mkdir(output, { recursive: true });

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { windowsHide: true });
    let error = '';
    child.stderr.on('data', (data) => { error += data; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(error)));
  });
}

for (const clip of clips) {
  if (only && only !== clip.id) continue;
  const duration = Math.floor(clip.duration * fps) / fps;
  manifest[clip.id] = { fps, duration, source: clip.file, start: clip.start, variants: {} };
  // Limit concurrent encoders so development stays responsive.
  for (const variant of variants) {
    const name = `${clip.id}${clip.version ? `-${clip.version}` : ''}-${variant}`;
    const video = path.join(output, `${name}.mp4`);
    const filters = [clip.crop].filter(Boolean);
    if (variant === 'compact') filters.push('scale=1280:-2:flags=lanczos');
    if (variant === 'portrait') filters.push(`crop=trunc(ih*9/16/2)*2:ih:(iw-ow)*${clip.focus}:0`);
    // Gentle grading only: retain game art and effects, lift green in the shadows.
    filters.push('colorbalance=gs=0.025:gm=0.015', 'eq=contrast=1.02:saturation=0.90', 'setsar=1');
    const base = ['-ss', String(clip.start), '-i', path.join(input, clip.file), '-vf', filters.join(',')];
    await run([...base, '-t', String(duration), '-an', '-map_metadata', '-1', '-c:v', 'libx264', '-preset', 'slow', '-crf', variant === 'compact' ? '22' : '20', '-r', String(fps), '-pix_fmt', 'yuv420p', '-g', '4', '-keyint_min', '4', '-sc_threshold', '0', '-bf', '0', '-movflags', '+faststart', '-video_track_timescale', '24000', '-threads', '4', video]);
    const bytes = (await stat(video)).size;
    manifest[clip.id].variants[variant] = { video: `media/scenes/${name}.mp4`, bytes };
    console.log(`${name}: ${(bytes / 1024 / 1024).toFixed(2)} MiB, ${duration.toFixed(3)} s`);
  }
}
await writeFile(path.join(root, 'src/scene-media.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Scene media and manifest ready. Source MOV files are unchanged.');
