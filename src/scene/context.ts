/** Observe WebGL availability without coupling renderer lifecycle to React state. */
export function observeWebGLContext(canvas: EventTarget, onAvailability: (available: boolean) => void) {
  const lost = (event: Event) => { event.preventDefault(); onAvailability(false); };
  const restored = () => onAvailability(true);
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  return () => {
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
  };
}
