import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaScrubber } from '../src/media-scrubber.js';
import { sceneTimeline } from '../src/scene-timeline.js';
import { games } from '../src/content.js';

function harness() {
  let id = 0;
  let hidden = false;
  const pending = new Map();
  class Video extends EventTarget {
    readyState = 4;
    seeking = false;
    time = 0;
    writes = [];
    get currentTime() { return this.time; }
    set currentTime(value) { this.time = value; this.writes.push(value); this.seeking = true; }
    finish() { this.seeking = false; this.dispatchEvent(new Event('seeked')); }
  }
  const video = new Video();
  const scrubber = createMediaScrubber(video, { fps: 24, duration: 4, requestFrame: (fn) => { pending.set(++id, fn); return id; }, cancelFrame: (key) => pending.delete(key), isHidden: () => hidden });
  return { video, scrubber, pending, hide: (value) => { hidden = value; }, flush() { const work = [...pending.values()]; pending.clear(); work.forEach((fn) => fn()); } };
}

test('the requested game order is used everywhere', () => {
  assert.deepEqual(games.map((game) => game.art), ['cod', 'pubg', 'mlbb', 'coc']);
});

test('rapid scrolling coalesces into the latest target while a seek is in flight', () => {
  const h = harness();
  h.scrubber.setProgress(.1); h.flush();
  h.scrubber.setProgress(.3); h.scrubber.setProgress(.6); h.scrubber.setProgress(.9); h.flush();
  assert.equal(h.video.writes.length, 1);
  h.video.finish(); h.flush();
  assert.equal(h.video.writes.length, 2);
  assert.equal(h.video.currentTime, Math.round(.9 * 95) / 24);
});

test('a stationary page schedules no repeating seeks or animation frames', () => {
  const h = harness();
  h.scrubber.setProgress(.5); h.flush(); h.video.finish(); h.flush();
  const count = h.video.writes.length;
  assert.equal(h.pending.size, 0);
  h.scrubber.setProgress(.5); h.flush();
  assert.equal(h.video.writes.length, count);
  assert.equal(h.pending.size, 0);
});

test('reverse scroll and the exact end boundary stay inside real video frames', () => {
  const h = harness();
  h.scrubber.setProgress(10); h.flush();
  assert.equal(h.video.currentTime, 95 / 24);
  h.video.finish(); h.flush();
  h.scrubber.setProgress(-1); h.flush();
  assert.equal(h.video.currentTime, 0);
});

test('scrolling before metadata arrives retains the intended position', () => {
  const h = harness(); h.video.readyState = 0;
  h.scrubber.setProgress(.7); h.flush();
  assert.equal(h.video.writes.length, 0);
  h.video.readyState = 2; h.video.dispatchEvent(new Event('loadeddata')); h.flush();
  assert.equal(h.video.currentTime, Math.round(.7 * 95) / 24);
});

test('background tabs defer work and resume only at the most recent target', () => {
  const h = harness(); h.hide(true);
  h.scrubber.setProgress(.2); h.scrubber.setProgress(.8); h.flush();
  assert.equal(h.video.writes.length, 0);
  h.hide(false); h.scrubber.refresh(); h.flush();
  assert.equal(h.video.currentTime, Math.round(.8 * 95) / 24);
});

test('disposing a scene cancels pending work and detaches media listeners', () => {
  const h = harness(); h.scrubber.setProgress(.5); h.scrubber.destroy(); h.flush();
  h.video.dispatchEvent(new Event('loadeddata')); h.flush();
  assert.equal(h.video.writes.length, 0);
  assert.equal(h.pending.size, 0);
});

const starts = [0, 1000, 3400, 5800, 8200, 10600];
test('the video holds its first frame during entry and its final frame during exit', () => {
  assert.equal(sceneTimeline(800, starts, 1000).scenes[1].video, 0);
  assert.equal(sceneTimeline(1840, starts, 1000).scenes[1].video, .5);
  assert.equal(sceneTimeline(3000, starts, 1000).scenes[1].video, 1);
});

test('crossing a chapter blends only neighbouring scenes and hides double titles', () => {
  const state = sceneTimeline(3040, starts, 1000);
  assert.equal(state.active, 2);
  assert.equal(state.scenes[1].opacity, .5);
  assert.equal(state.scenes[2].opacity, .5);
  assert.ok(state.scenes[1].copy < .1 && state.scenes[2].copy < .1);
  assert.equal(state.scenes.filter((scene) => scene.opacity > 0).length, 2);
});

test('scrolling backward produces the same frame and composition at the same position', () => {
  const before = sceneTimeline(2200, starts, 1000);
  sceneTimeline(5000, starts, 1000);
  assert.deepEqual(sceneTimeline(2200, starts, 1000), before);
});

test('system reduced motion presents one stable scene without transitional zoom', () => {
  const state = sceneTimeline(3040, starts, 1000, true);
  assert.equal(state.scenes.filter((scene) => scene.opacity > 0).length, 1);
  assert.equal(state.veil, 0);
  assert.ok(state.scenes.every((scene) => scene.scale === 1));
});
