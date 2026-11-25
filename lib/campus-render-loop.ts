type FrameDriver = {
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
  setTimer: (callback: () => void, delay: number) => number;
  cancelTimer: (handle: number) => void;
  now: () => number;
};

/** Sleep without motion, with an optional low frame rate for ambient animation. */
export function createDemandRenderLoop(
  render: (
    now: number,
    deltaSeconds: number,
    elapsedSeconds: number,
  ) => boolean,
  driver: FrameDriver = {
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    setTimer: (callback, delay) => window.setTimeout(callback, delay),
    cancelTimer: (handle) => window.clearTimeout(handle),
    now: () => performance.now(),
  },
) {
  let handle: number | null = null;
  let timer: number | null = null;
  let idleFrameRate = 0;
  let lastTime: number | null = null;
  let rendering = false;
  let dirty = false;
  let paused = false;
  let disposed = false;

  const cancelIdleFrame = () => {
    if (timer !== null) driver.cancelTimer(timer);
    timer = null;
  };

  const invalidate = () => {
    if (disposed) return;
    dirty = true;
    // Input interrupts the idle timer and gets the very next display frame.
    cancelIdleFrame();
    if (!paused && !rendering && handle === null)
      handle = driver.requestFrame(draw);
  };

  const draw = (now: number) => {
    handle = null;
    if (disposed || paused) return;
    const elapsed =
      lastTime === null ? 1 / 60 : Math.max(0, (now - lastTime) / 1000);
    const delta = Math.min(elapsed, 0.05);
    lastTime = now;
    dirty = false;
    rendering = true;
    let moving: boolean;
    try {
      moving = render(now, delta, elapsed);
    } finally {
      rendering = false;
    }
    if (moving || dirty) invalidate();
    else if (!disposed && !paused && idleFrameRate > 0) {
      // Do not poll at the display rate while waiting for an ambient frame.
      const delay = Math.max(0, 1000 / idleFrameRate - (driver.now() - now));
      timer = driver.setTimer(() => {
        timer = null;
        invalidate();
      }, delay);
    } else lastTime = null;
  };

  return {
    invalidate,
    setIdleFrameRate(value: number) {
      if (disposed) return;
      const next = Number.isFinite(value) ? Math.max(0, value) : 0;
      if (idleFrameRate === next) return;
      idleFrameRate = next;
      invalidate();
    },
    setPaused(value: boolean) {
      if (disposed || paused === value) return;
      paused = value;
      lastTime = null;
      cancelIdleFrame();
      if (handle !== null) driver.cancelFrame(handle);
      handle = null;
      if (!paused) invalidate();
    },
    dispose() {
      disposed = true;
      cancelIdleFrame();
      if (handle !== null) driver.cancelFrame(handle);
      handle = null;
    },
  };
}
