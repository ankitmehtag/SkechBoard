import rough from "roughjs";
import { getBounds, getCommonBounds } from "./geometry.ts";
import { freedrawPath, getDrawables, renderScene } from "./render.ts";
import { FONT_FAMILY, LINE_HEIGHT, sanitizeElements } from "./scene.ts";
import type { SceneElement } from "./types.ts";

const FILE_TYPE = "sketchboard";
const EXPORT_PADDING = 20;
const SVG_NS = "http://www.w3.org/2000/svg";

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const serialize = (elements: SceneElement[], canvasBackground: string) =>
  JSON.stringify({ type: FILE_TYPE, version: 1, elements, appState: { canvasBackground } }, null, 2);

export const saveJSON = (elements: SceneElement[], canvasBackground: string) =>
  download(new Blob([serialize(elements, canvasBackground)], { type: "application/json" }), "drawing.sketchboard.json");

export const parseFile = (text: string): { elements: SceneElement[]; canvasBackground?: string } => {
  const data = JSON.parse(text);
  if (data?.type !== FILE_TYPE || !Array.isArray(data.elements)) throw new Error("Not a Sketchboard file");
  const bg = data.appState?.canvasBackground;
  return { elements: sanitizeElements(data.elements), canvasBackground: typeof bg === "string" ? bg : undefined };
};

export const pickFile = (accept: string): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });

export const readAsDataURL = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const exportBounds = (elements: SceneElement[]) => {
  const b = getCommonBounds(elements)!;
  return { x: b.x1 - EXPORT_PADDING, y: b.y1 - EXPORT_PADDING, w: b.x2 - b.x1 + EXPORT_PADDING * 2, h: b.y2 - b.y1 + EXPORT_PADDING * 2 };
};

export const exportPNG = (elements: SceneElement[], background: string, scale = 2) => {
  if (!elements.length) return;
  const { x, y, w, h } = exportBounds(elements);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * scale);
  canvas.height = Math.ceil(h * scale);
  renderScene(canvas.getContext("2d")!, elements, { viewport: { scrollX: -x, scrollY: -y, zoom: 1 }, dpr: scale, width: w, height: h, background });
  canvas.toBlob((blob) => blob && download(blob, "drawing.png"), "image/png");
};

export const buildSVG = (elements: SceneElement[], background: string): SVGSVGElement => {
  const { x, y, w, h } = exportBounds(elements);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  svg.setAttribute("width", String(Math.ceil(w)));
  svg.setAttribute("height", String(Math.ceil(h)));
  const bg = document.createElementNS(SVG_NS, "rect");
  Object.entries({ x, y, width: w, height: h, fill: background }).forEach(([k, v]) => bg.setAttribute(k, String(v)));
  svg.appendChild(bg);
  const rs = rough.svg(svg);

  for (const el of elements) {
    const b = getBounds(el);
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("opacity", String(el.opacity / 100));
    if (el.type === "text") {
      g.setAttribute("transform", `translate(${el.x} ${el.y})`);
      el.text.split("\n").forEach((line, i) => {
        const t = document.createElementNS(SVG_NS, "text");
        t.setAttribute("y", String(i * el.fontSize * LINE_HEIGHT));
        t.setAttribute("dominant-baseline", "text-before-edge");
        t.setAttribute("font-family", FONT_FAMILY);
        t.setAttribute("font-size", String(el.fontSize));
        t.setAttribute("fill", el.strokeColor);
        t.textContent = line; // textContent escapes user text
        g.appendChild(t);
      });
    } else if (el.type === "image") {
      const img = document.createElementNS(SVG_NS, "image");
      Object.entries({ x: b.x1, y: b.y1, width: b.x2 - b.x1, height: b.y2 - b.y1, href: el.dataURL, preserveAspectRatio: "none" }).forEach(
        ([k, v]) => img.setAttribute(k, String(v)),
      );
      g.appendChild(img);
    } else if (el.type === "freedraw") {
      g.setAttribute("transform", `translate(${el.x} ${el.y})`);
      const p = document.createElementNS(SVG_NS, "path");
      Object.entries({ d: freedrawPath(el.points), stroke: el.strokeColor, "stroke-width": el.strokeWidth * 1.5, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }).forEach(
        ([k, v]) => p.setAttribute(k, String(v)),
      );
      g.appendChild(p);
    } else {
      const [tx, ty] = el.type === "arrow" || el.type === "line" ? [el.x, el.y] : [b.x1, b.y1];
      g.setAttribute("transform", `translate(${tx} ${ty})`);
      getDrawables(el).forEach((d) => g.appendChild(rs.draw(d)));
    }
    svg.appendChild(g);
  }
  return svg;
};

export const exportSVG = (elements: SceneElement[], background: string) => {
  if (!elements.length) return;
  const markup = new XMLSerializer().serializeToString(buildSVG(elements, background));
  download(new Blob([markup], { type: "image/svg+xml" }), "drawing.svg");
};
