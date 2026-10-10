/** Animate only the stroke; never interpolate or change routed coordinates. */
export function traceRoutePaths(
  paths: (SVGPathElement | null | undefined)[],
  reducedMotion: boolean,
): () => void {
  if (reducedMotion) return () => {};
  const animations: Animation[] = [];
  for (const path of paths) {
    if (
      !path ||
      typeof path.getTotalLength !== "function" ||
      typeof path.animate !== "function"
    )
      continue;
    try {
      const length = path.getTotalLength();
      if (!Number.isFinite(length) || length <= 0) continue;
      animations.push(
        path.animate(
          [
            {
              strokeDasharray: `${length} ${length}`,
              strokeDashoffset: length,
            },
            { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0 },
          ],
          { duration: 1400, easing: "ease-in-out", fill: "none" },
        ),
      );
    } catch {
      // Unsupported renderers or detached paths still show the complete route.
    }
  }
  return () => animations.forEach((animation) => animation.cancel());
}
