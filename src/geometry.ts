import type { LinearElement, Point, SceneElement, Viewport } from "./types.ts";

export interface Bounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const screenToScene = (sx: number, sy: number, v: Viewport): Point => [
  sx / v.zoom - v.scrollX,
  sy / v.zoom - v.scrollY,
];

export const getBounds = (el: SceneElement): Bounds => ({
  x1: Math.min(el.x, el.x + el.width),
  y1: Math.min(el.y, el.y + el.height),
  x2: Math.max(el.x, el.x + el.width),
  y2: Math.max(el.y, el.y + el.height),
});

export const getCommonBounds = (els: SceneElement[]): Bounds | null => {
  if (!els.length) return null;
  return els.map(getBounds).reduce((a, b) => ({
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
    x2: Math.max(a.x2, b.x2),
    y2: Math.max(a.y2, b.y2),
  }));
};

const distToSegment = ([px, py]: Point, [ax, ay]: Point, [bx, by]: Point) => {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const nearPolyline = (p: Point, pts: Point[], tol: number) => {
  for (let i = 1; i < pts.length; i++) if (distToSegment(p, pts[i - 1], pts[i]) <= tol) return true;
  return pts.length === 1 && Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) <= tol;
};

/** Filled interiors are hit anywhere; transparent shapes only near their outline (as observed in Excalidraw). */
export const hitTest = (el: SceneElement, [px, py]: Point, tol: number): boolean => {
  const b = getBounds(el);
  if (px < b.x1 - tol || px > b.x2 + tol || py < b.y1 - tol || py > b.y2 + tol) return false;
  const filled = el.backgroundColor !== "transparent";
  switch (el.type) {
    case "text":
    case "image":
      return true;
    case "arrow":
    case "line":
    case "freedraw":
      return nearPolyline([px - el.x, py - el.y], (el as LinearElement).points, tol + el.strokeWidth);
    case "rectangle": {
      if (filled) return true;
      const c: Point[] = [[b.x1, b.y1], [b.x2, b.y1], [b.x2, b.y2], [b.x1, b.y2], [b.x1, b.y1]];
      return nearPolyline([px, py], c, tol);
    }
    case "diamond": {
      const cx = (b.x1 + b.x2) / 2;
      const cy = (b.y1 + b.y2) / 2;
      const c: Point[] = [[cx, b.y1], [b.x2, cy], [cx, b.y2], [b.x1, cy], [cx, b.y1]];
      if (nearPolyline([px, py], c, tol)) return true;
      const hw = (b.x2 - b.x1) / 2 || 1;
      const hh = (b.y2 - b.y1) / 2 || 1;
      return filled && Math.abs(px - cx) / hw + Math.abs(py - cy) / hh <= 1;
    }
    case "ellipse": {
      const rx = (b.x2 - b.x1) / 2 || 1;
      const ry = (b.y2 - b.y1) / 2 || 1;
      const nx = (px - (b.x1 + rx)) / rx;
      const ny = (py - (b.y1 + ry)) / ry;
      const d = Math.hypot(nx, ny);
      if (filled) return d <= 1 + tol / Math.min(rx, ry);
      return Math.abs(d - 1) * Math.min(rx, ry) <= tol;
    }
  }
};

export const handlePositions = (b: Bounds, pad: number): Record<Handle, Point> => {
  const x1 = b.x1 - pad, y1 = b.y1 - pad, x2 = b.x2 + pad, y2 = b.y2 + pad;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return { nw: [x1, y1], n: [mx, y1], ne: [x2, y1], e: [x2, my], se: [x2, y2], s: [mx, y2], sw: [x1, y2], w: [x1, my] };
};

export const handleAt = (b: Bounds, p: Point, pad: number, size: number): Handle | null => {
  const hs = handlePositions(b, pad);
  for (const h of Object.keys(hs) as Handle[]) {
    if (Math.abs(p[0] - hs[h][0]) <= size && Math.abs(p[1] - hs[h][1]) <= size) return h;
  }
  return null;
};

/** New bounds after dragging `handle` of `start` to `p`. `keepRatio` = Shift. Flipping past the opposite edge is allowed. */
export const resizeBounds = (start: Bounds, handle: Handle, [px, py]: Point, keepRatio: boolean): Bounds => {
  let { x1, y1, x2, y2 } = start;
  if (handle.includes("w")) x1 = px;
  if (handle.includes("e")) x2 = px;
  if (handle.includes("n")) y1 = py;
  if (handle.includes("s")) y2 = py;
  if (keepRatio && handle.length === 2) {
    const ratio = (start.x2 - start.x1) / (start.y2 - start.y1 || 1);
    const w = x2 - x1;
    const h = y2 - y1;
    if (Math.abs(w) / Math.abs(ratio) > Math.abs(h)) {
      const nh = (Math.abs(w) / ratio) * Math.sign(h || 1);
      if (handle.includes("n")) y1 = y2 - nh; else y2 = y1 + nh;
    } else {
      const nw = Math.abs(h) * ratio * Math.sign(w || 1);
      if (handle.includes("w")) x1 = x2 - nw; else x2 = x1 + nw;
    }
  }
  return { x1, y1, x2, y2 };
};

/** Map an element from one bounds box into another (used for single and multi-element resize). */
export const scaleElement = <T extends SceneElement>(el: T, from: Bounds, to: Bounds): T => {
  const sx = (to.x2 - to.x1) / (from.x2 - from.x1 || 1);
  const sy = (to.y2 - to.y1) / (from.y2 - from.y1 || 1);
  const next = {
    ...el,
    x: to.x1 + (el.x - from.x1) * sx,
    y: to.y1 + (el.y - from.y1) * sy,
    width: el.width * sx,
    height: el.height * sy,
  };
  if ("points" in el) (next as LinearElement).points = el.points.map(([x, y]) => [x * sx, y * sy]);
  if (el.type === "text") (next as SceneElement).fontSize = Math.max(4, el.fontSize * Math.abs(sy));
  return next;
};

/** Normalise negative width/height (from flips) so x,y is always the top-left. Linear points are rebased. */
export const normalize = <T extends SceneElement>(el: T): T => {
  if ("points" in el) {
    const xs = el.points.map((p) => p[0]);
    const ys = el.points.map((p) => p[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    return {
      ...el,
      x: el.x + minX,
      y: el.y + minY,
      width: Math.max(...xs) - minX,
      height: Math.max(...ys) - minY,
      points: el.points.map(([x, y]) => [x - minX, y - minY] as Point),
    };
  }
  const b = getBounds(el);
  return { ...el, x: b.x1, y: b.y1, width: b.x2 - b.x1, height: b.y2 - b.y1 };
};

export const intersects = (a: Bounds, b: Bounds) => a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1;
export const contains = (outer: Bounds, inner: Bounds) =>
  inner.x1 >= outer.x1 && inner.x2 <= outer.x2 && inner.y1 >= outer.y1 && inner.y2 <= outer.y2;
