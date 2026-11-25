import assert from 'node:assert/strict';
import { createDemandRenderLoop } from '../lib/campus-render-loop';

const pending = new Map<number, FrameRequestCallback>();
const timers = new Map<number, { callback: () => void; due: number }>();
let nextHandle = 0;
let now = 0;
const driver = {
  requestFrame(callback: FrameRequestCallback) {
    const handle = nextHandle++;
    pending.set(handle, callback);
    return handle;
  },
  cancelFrame(handle: number) {
    pending.delete(handle);
  },
  setTimer(callback: () => void, delay: number) {
    const handle = nextHandle++;
    timers.set(handle, { callback, due: now + delay });
    return handle;
  },
  cancelTimer(handle: number) {
    timers.delete(handle);
  },
  now: () => now,
};
const step = (milliseconds = 1000 / 60) => {
  now += milliseconds;
  for (const [handle, timer] of [...timers]) {
    if (timer.due <= now) {
      timers.delete(handle);
      timer.callback();
    }
  }
  const callbacks = [...pending.values()];
  pending.clear();
  callbacks.forEach((callback) => callback(now));
};
let renders = 0;
let moving = false;
let invalidateDuringRender = false;
const deltas: number[] = [];
const loop = createDemandRenderLoop((_now, delta) => {
  renders++;
  deltas.push(delta);
  if (invalidateDuringRender) {
    invalidateDuringRender = false;
    loop.invalidate();
  }
  return moving;
}, driver);

assert.equal(pending.size, 0, 'An idle scene schedules no work');
loop.invalidate();
loop.invalidate();
loop.invalidate();
assert.equal(
  pending.size,
  1,
  'Multiple input events share the next display frame',
);
step();
assert.equal(renders, 1);
assert.equal(
  pending.size,
  0,
  'The last static image needs no repeated rendering',
);

moving = true;
loop.invalidate();
for (let i = 0; i < 120; i++) step(1000 / 120);
assert.equal(
  renders,
  121,
  'Active motion follows a 120 Hz display without an FPS cap',
);
assert.equal(pending.size, 1);
moving = false;
step();
assert.equal(
  pending.size,
  0,
  'Damping and transitions can finish before sleeping',
);

now += 60_000;
loop.invalidate();
step();
assert.equal(
  deltas.at(-1),
  1 / 60,
  'Waking after idle must not jump the animation clock',
);
moving = true;
loop.invalidate();
step();
step(2000);
assert.equal(
  deltas.at(-1),
  0.05,
  'Long active frames have a bounded simulation delta',
);
loop.setPaused(true);
assert.equal(
  pending.size,
  0,
  'Backgrounding cancels the pending display frame',
);
const beforePause = renders;
loop.invalidate();
step(60_000);
assert.equal(renders, beforePause, 'Scene changes do not render a hidden page');
loop.setPaused(false);
assert.equal(
  pending.size,
  1,
  'Returning to the page refreshes the scene immediately',
);
moving = false;
step();
assert.equal(deltas.at(-1), 1 / 60);
assert.equal(pending.size, 0);

invalidateDuringRender = true;
loop.invalidate();
step();
assert.equal(pending.size, 1, 'A controls change during rendering is not lost');
step();
assert.equal(
  pending.size,
  0,
  'Reentrant invalidation does not create an endless loop',
);
loop.invalidate();
const staleCallback = [...pending.values()][0];
loop.dispose();
assert.equal(pending.size, 0, 'Disposal cancels pending GPU work');
const beforeDispose = renders;
staleCallback(now + 16);
loop.invalidate();
loop.setPaused(false);
assert.equal(
  renders,
  beforeDispose,
  'A late callback cannot render a disposed scene',
);
assert.equal(pending.size, 0);

let navigationRenders = 0;
let navigatingCamera = false;
let navigationElapsed = 0;
const navigationLoop = createDemandRenderLoop((_now, delta, elapsed) => {
  navigationRenders++;
  navigationElapsed += elapsed;
  assert(
    delta <= 0.05,
    'Low FPS must not remove the controls delta safety bound',
  );
  return navigatingCamera;
}, driver);
navigationLoop.setIdleFrameRate(15);
step();
assert.equal(
  pending.size,
  0,
  'A static route does not keep a high-frequency RAF loop',
);
assert.equal(
  timers.size,
  1,
  'A timer wakes the next low-rate navigation frame',
);
const beforeNavigation = navigationRenders;
const beforeElapsed = navigationElapsed;
for (let i = 0; i < 120; i++) step(1000 / 120);
assert(
  navigationRenders - beforeNavigation >= 13 &&
    navigationRenders - beforeNavigation <= 15,
  'An idle route renders around 15 FPS on a 120 Hz display',
);
assert(
  navigationElapsed - beforeElapsed > 0.85,
  'Route animation advances with real elapsed time instead of the capped controls delta',
);

navigatingCamera = true;
navigationLoop.invalidate();
assert.equal(timers.size, 0, 'Dragging immediately cancels the idle timer');
assert.equal(
  pending.size,
  1,
  'Dragging schedules the next display frame without waiting',
);
const beforeDrag = navigationRenders;
for (let i = 0; i < 120; i++) step(1000 / 120);
assert.equal(
  navigationRenders - beforeDrag,
  120,
  'Dragging a route resumes full refresh rate',
);
navigatingCamera = false;
step();
assert.equal(pending.size, 0);
assert.equal(
  timers.size,
  1,
  'Navigation returns to low FPS when camera motion finishes',
);
navigationLoop.setPaused(true);
assert.equal(timers.size, 0, 'Backgrounding cancels the low-rate timer too');
const beforeHidden = navigationRenders;
step(60_000);
assert.equal(navigationRenders, beforeHidden);
navigationLoop.setPaused(false);
const beforeResumeElapsed = navigationElapsed;
step();
assert(
  Math.abs(navigationElapsed - beforeResumeElapsed - 1 / 60) < 1e-9,
  'Returning from the background must not jump the route animation forward',
);
assert.equal(timers.size, 1);
navigationLoop.setIdleFrameRate(0);
step();
assert.equal(pending.size, 0);
assert.equal(
  timers.size,
  0,
  'Clearing navigation returns to complete idle sleep',
);
navigationLoop.setIdleFrameRate(15);
step();
const staleTimer = [...timers.values()][0].callback;
navigationLoop.dispose();
assert.equal(timers.size, 0, 'Disposal cancels a pending navigation timer');
staleTimer();
assert.equal(pending.size, 0, 'A late idle timer cannot wake a disposed scene');

console.log(
  'Rendering regressions passed: idle sleep, 15 FPS navigation, real-time animation, instant input wakeup, 120 Hz motion, clock reset, background pause/resume and timer disposal.',
);
