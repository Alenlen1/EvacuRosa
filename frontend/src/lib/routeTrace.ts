/** Animate only the stroke; never interpolate or change routed coordinates. */
export function traceRoutePaths(
  paths: (SVGPathElement | null | undefined)[],
  reducedMotion: boolean,
  onComplete: () => void = () => {},
): () => void {
  let completed = false;
  const complete = () => {
    if (completed) return;
    completed = true;
    onComplete();
  };
  if (reducedMotion) {
    complete();
    return () => {};
  }
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
  if (!animations.length) complete();
  else
    void Promise.all(animations.map((animation) => animation.finished)).then(
      complete,
      () => {},
    );
  return () => {
    animations.forEach((animation) => animation.cancel());
    // Cancelling the stroke animation reveals the full underlying route.
    complete();
  };
}

let nextMaskId = 0;

/** Reveal a dashed stroke through an animated mask, preserving its dash pattern. */
export function traceDashedRoutePaths(
  paths: (SVGPathElement | null | undefined)[],
  reducedMotion: boolean,
): () => void {
  if (reducedMotion) return () => {};
  const masks: SVGPathElement[] = [];
  const restore: (() => void)[] = [];
  for (const path of paths) {
    const svg = path?.ownerSVGElement;
    if (!path || !svg) continue;
    try {
      const box = path.getBBox();
      const padding = Number(path.getAttribute("stroke-width") ?? 8) + 2;
      const document = path.ownerDocument;
      const namespace = "http://www.w3.org/2000/svg";
      const mask = document.createElementNS(namespace, "mask");
      const reveal = document.createElementNS(namespace, "path");
      mask.id = `route-approach-reveal-${++nextMaskId}`;
      mask.setAttribute("maskUnits", "userSpaceOnUse");
      mask.setAttribute("x", String(box.x - padding));
      mask.setAttribute("y", String(box.y - padding));
      mask.setAttribute("width", String(box.width + 2 * padding));
      mask.setAttribute("height", String(box.height + 2 * padding));
      reveal.setAttribute("d", path.getAttribute("d") ?? "");
      reveal.setAttribute("fill", "none");
      reveal.setAttribute("stroke", "white");
      reveal.setAttribute("stroke-width", String(padding));
      reveal.setAttribute("stroke-linecap", "round");
      mask.appendChild(reveal);
      svg.appendChild(mask);
      const previous = path.getAttribute("mask");
      path.setAttribute("mask", `url(#${mask.id})`);
      masks.push(reveal);
      restore.push(() => {
        if (previous === null) path.removeAttribute("mask");
        else path.setAttribute("mask", previous);
        mask.remove();
      });
    } catch {
      // Detached or unsupported SVG paths remain fully visible.
    }
  }
  const cleanup = () => restore.splice(0).forEach((remove) => remove());
  const stop = traceRoutePaths(masks, false, cleanup);
  return () => {
    stop();
    cleanup();
  };
}
