import rough from "roughjs";
import type { Drawable, Options } from "roughjs/bin/core";
import { getBounds, getCommonBounds, handlePositions, type Bounds } from "./geometry.ts";
import { FONT_FAMILY, LINE_HEIGHT } from "./scene.ts";
import type { LinearElement, Point, SceneElement, Viewport } from "./types.ts";

const generator = rough.generator();
const drawableCache = new Map<string, { version: number; drawables: Drawable[] }>();
const imageCache = new Map<string, HTMLImageElement>();
let onImageLoad: () => void = () => {};

export const SELECTION_COLOR = "#6965db";
export const HANDLE_SIZE = 8; // screen px
export const SELECTION_PAD = 6; // screen px

export const setImageLoadListener = (cb: () => void) => {
  onImageLoad = cb;
};

export const getImage = (dataURL: string) => {
  let img = imageCache.get(dataURL);
  if (!img) {
    img = new Image();
    img.onload = () => onImageLoad();
    img.src = dataURL;
    imageCache.set(dataURL, img);
  }
  return img;
};

const roughOptions = (el: SceneElement): Options => {
  const dash =
    el.strokeStyle === "dashed" ? [8, 8 + el.strokeWidth] : el.strokeStyle === "dotted" ? [1.5, 6 + el.strokeWidth] : undefined;
  return {
    seed: el.seed,
    stroke: el.strokeColor,
    strokeWidth: el.strokeWidth,
    roughness: el.roughness,
    strokeLineDash: dash,
    disableMultiStroke: !!dash,
    fill: el.backgroundColor === "transparent" ? undefined : el.backgroundColor,
    fillStyle: el.fillStyle,
    fillWeight: el.strokeWidth / 2,
    hachureGap: el.strokeWidth * 4,
    preserveVertices: true,
  };
};

const roundedRectPath = (w: number, h: number) => {
  const r = Math.min(32, Math.min(w, h) * 0.25);
  return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
};

const arrowhead = (points: Point[], strokeWidth: number): Point[] | null => {
  const end = points[points.length - 1];
  const prev = [...points].reverse().find((p) => p[0] !== end[0] || p[1] !== end[1]);
  if (!prev) return null;
  const dist = Math.hypot(end[0] - prev[0], end[1] - prev[1]);
  const size = Math.min(20 + strokeWidth * 2, dist * 0.75);
  const angle = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  const wing = (a: number): Point => [end[0] - size * Math.cos(angle + a), end[1] - size * Math.sin(angle + a)];
  return [wing(0.45), end, wing(-0.45)];
};

/** Rough drawables in element-local coordinates: shapes from their normalised top-left, linear from (x, y). */
export const getDrawables = (el: SceneElement): Drawable[] => {
  const cached = drawableCache.get(el.id);
  if (cached?.version === el.version) return cached.drawables;
  const o = roughOptions(el);
  const w = Math.abs(el.width);
  const h = Math.abs(el.height);
  let drawables: Drawable[] = [];
  switch (el.type) {
    case "rectangle":
      drawables = [el.roundness ? generator.path(roundedRectPath(w, h), o) : generator.rectangle(0, 0, w, h, o)];
      break;
    case "ellipse":
      drawables = [generator.ellipse(w / 2, h / 2, w, h, o)];
      break;
    case "diamond":
      drawables = [generator.polygon([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]], o)];
      break;
    case "line":
    case "arrow": {
      const pts = el.points;
      const lineOpts = { ...o, fill: undefined };
      drawables = [pts.length > 2 && el.roundness ? generator.curve(pts, lineOpts) : generator.linearPath(pts, lineOpts)];
      const head = el.type === "arrow" ? arrowhead(pts, el.strokeWidth) : null;
      if (head) drawables.push(generator.linearPath(head, { ...lineOpts, strokeLineDash: undefined }));
      break;
    }
    default:
      drawables = [];
  }
  drawableCache.set(el.id, { version: el.version, drawables });
  return drawables;
};

/** Smoothed SVG path through freehand points (quadratic curves via midpoints). */
export const freedrawPath = (points: Point[]) => {
  if (points.length < 2) {
    const [x, y] = points[0] ?? [0, 0];
    return `M ${x} ${y} L ${x + 0.01} ${y}`;
  }
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += ` Q ${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last[0]} ${last[1]}`;
};

const rc = (ctx: CanvasRenderingContext2D) => rough.canvas(ctx.canvas);

export const drawElement = (ctx: CanvasRenderingContext2D, el: SceneElement) => {
  const b = getBounds(el);
  ctx.save();
  ctx.globalAlpha *= el.opacity / 100;
  switch (el.type) {
    case "text": {
      ctx.translate(el.x, el.y);
      ctx.font = `${el.fontSize}px ${FONT_FAMILY}`;
      ctx.fillStyle = el.strokeColor;
      ctx.textBaseline = "top";
      el.text.split("\n").forEach((line, i) => ctx.fillText(line, 0, i * el.fontSize * LINE_HEIGHT));
      break;
    }
    case "image": {
      const img = getImage(el.dataURL);
      if (img.complete && img.naturalWidth) ctx.drawImage(img, b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
      break;
    }
    case "freedraw": {
      ctx.translate(el.x, el.y);
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth * 1.5;
      ctx.lineCap = ctx.lineJoin = "round";
      ctx.stroke(new Path2D(freedrawPath(el.points)));
      break;
    }
    case "arrow":
    case "line": {
      ctx.translate(el.x, el.y);
      const canvas = rc(ctx);
      getDrawables(el).forEach((d) => canvas.draw(d));
      break;
    }
    default: {
      ctx.translate(b.x1, b.y1);
      const canvas = rc(ctx);
      getDrawables(el).forEach((d) => canvas.draw(d));
    }
  }
  ctx.restore();
};

export interface RenderOptions {
  viewport: Viewport;
  dpr: number;
  width: number;
  height: number;
  background: string;
  selectedIds?: Set<string>;
  erasingIds?: Set<string>;
  hiddenId?: string | null;
  marquee?: Bounds | null;
}

export const renderScene = (ctx: CanvasRenderingContext2D, elements: SceneElement[], opts: RenderOptions) => {
  const { viewport: v, dpr } = opts;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = opts.background;
  ctx.fillRect(0, 0, opts.width * dpr, opts.height * dpr);
  const z = v.zoom * dpr;
  ctx.setTransform(z, 0, 0, z, v.scrollX * z, v.scrollY * z);

  const view: Bounds = { x1: -v.scrollX, y1: -v.scrollY, x2: opts.width / v.zoom - v.scrollX, y2: opts.height / v.zoom - v.scrollY };
  for (const el of elements) {
    if (el.id === opts.hiddenId) continue;
    const b = getBounds(el);
    if (b.x2 < view.x1 - 50 || b.x1 > view.x2 + 50 || b.y2 < view.y1 - 50 || b.y1 > view.y2 + 50) continue;
    ctx.globalAlpha = opts.erasingIds?.has(el.id) ? 0.2 : 1;
    drawElement(ctx, el);
  }
  ctx.globalAlpha = 1;

  const selected = opts.selectedIds?.size ? elements.filter((e) => opts.selectedIds!.has(e.id)) : [];
  const px = 1 / v.zoom; // one screen pixel in scene units
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = px;
  if (selected.length > 1) {
    ctx.setLineDash([4 * px, 4 * px]);
    for (const el of selected) {
      const b = getBounds(el);
      const p = SELECTION_PAD * px;
      ctx.strokeRect(b.x1 - p, b.y1 - p, b.x2 - b.x1 + 2 * p, b.y2 - b.y1 + 2 * p);
    }
    ctx.setLineDash([]);
  }
  const common = getCommonBounds(selected);
  if (common) {
    const p = SELECTION_PAD * px;
    ctx.strokeRect(common.x1 - p, common.y1 - p, common.x2 - common.x1 + 2 * p, common.y2 - common.y1 + 2 * p);
    const hs = HANDLE_SIZE * px;
    ctx.fillStyle = "#fff";
    for (const [hx, hy] of Object.values(handlePositions(common, p))) {
      ctx.beginPath();
      ctx.roundRect(hx - hs / 2, hy - hs / 2, hs, hs, 2 * px);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (opts.marquee) {
    const m = opts.marquee;
    ctx.fillStyle = "rgba(105, 101, 219, 0.08)";
    ctx.fillRect(m.x1, m.y1, m.x2 - m.x1, m.y2 - m.y1);
    ctx.strokeRect(m.x1, m.y1, m.x2 - m.x1, m.y2 - m.y1);
  }
};

export const isLinear = (el: SceneElement): el is LinearElement => "points" in el;
