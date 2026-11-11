import test from 'node:test';
import assert from 'node:assert/strict';
import { open, readFile } from 'node:fs/promises';
import { sceneTimeline } from '../src/scene-timeline.js';
import { games } from '../src/content.js';

test('the requested game order is used everywhere', () => {
  assert.deepEqual(games.map((game) => game.art), ['cod', 'pubg', 'mlbb', 'coc']);
});

test('each responsive MP4 can initialize before the media payload is downloaded', async () => {
  const manifest = JSON.parse(await readFile(new URL('../src/scene-media.json', import.meta.url), 'utf8'));
  for (const { art } of games) {
    assert.equal(manifest[art].fps, 24);
    for (const variant of ['desktop', 'compact', 'portrait']) {
      const { video, bytes } = manifest[art].variants[variant];
      const file = await open(new URL('../public/' + video, import.meta.url), 'r');
      try {
        assert.equal((await file.stat()).size, bytes);
        const buffer = Buffer.alloc(64 * 1024);
        const { bytesRead } = await file.read(buffer);
        const types = [];
        for (let offset = 0; offset + 8 <= bytesRead;) {
          const size = buffer.readUInt32BE(offset);
          const type = buffer.toString('ascii', offset + 4, offset + 8);
          assert.ok(size >= 8, `${video}: invalid box size`);
          types.push(type);
          offset += size;
        }
        assert.ok(types.includes('moov') && types.indexOf('mdat') > types.indexOf('moov'),
          `${video}: metadata must precede the media payload`);
      } finally {
        await file.close();
      }
    }
  }
});

const starts = [0, 1000, 2350, 3700, 5050];
test('scrolling blends only neighbouring scenes and hides double titles', () => {
  const state = sceneTimeline(1990, starts, 1000);
  assert.equal(state.active, 2);
  assert.equal(state.scenes[1].opacity, .5);
  assert.equal(state.scenes[2].opacity, .5);
  assert.ok(state.scenes[1].copy < .1 && state.scenes[2].copy < .1);
  assert.equal(state.scenes.filter((scene) => scene.opacity > 0).length, 2);
});

test('scrolling backward restores the same chapter composition', () => {
  const before = sceneTimeline(1900, starts, 1000);
  sceneTimeline(4100, starts, 1000);
  assert.deepEqual(sceneTimeline(1900, starts, 1000), before);
});

test('system reduced motion presents one stable scene without transitional zoom', () => {
  const state = sceneTimeline(1990, starts, 1000, true);
  assert.equal(state.scenes.filter((scene) => scene.opacity > 0).length, 1);
  assert.equal(state.veil, 0);
  assert.ok(state.scenes.every((scene) => scene.scale === 1));
});
