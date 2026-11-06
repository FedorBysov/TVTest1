/** Coalesce scene invalidations; request additional frames only while motion is active. */
export function createRenderLoop(callbacks: {
  render: () => void;
  advance: (delta: number) => boolean;
  isVisible: () => boolean;
}) {
  let frame: number | null = null;
  let previous: number | null = null;
  let disposed = false;
  const draw = (now: number) => {
    frame = null;
    if (disposed || !callbacks.isVisible()) { previous = null; return; }
    const delta = previous === null ? 0 : Math.min((now - previous) / 1000, .1);
    previous = now;
    const moving = callbacks.advance(delta);
    callbacks.render();
    if (moving) invalidate();
    else previous = null;
  };
  const invalidate = () => {
    if (!disposed && frame === null) frame = requestAnimationFrame(draw);
  };
  return {
    invalidate,
    dispose() {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    },
  };
}
