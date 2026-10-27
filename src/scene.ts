import type { ElementStyle, SceneElement, Tool } from "./types.ts";

export const FONT_FAMILY = `"Kalam", "Comic Sans MS", cursive`;
export const LINE_HEIGHT = 1.25;

export const DEFAULT_STYLE: ElementStyle = {
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  roundness: true,
  fontSize: 20,
};

export const SHAPE_TOOLS: Tool[] = ["rectangle", "diamond", "ellipse", "arrow", "line", "freedraw", "text"];

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
export const newId = () => crypto.randomUUID();

/** Shallow-merge `patch` and bump version so the render cache invalidates. */
export const updateElement = <T extends SceneElement>(el: T, patch: Partial<T>): T => ({
  ...el,
  ...patch,
  version: el.version + 1,
});

let measureCtx: CanvasRenderingContext2D | null = null;
export const measureText = (text: string, fontSize: number) => {
  measureCtx ??= document.createElement("canvas").getContext("2d")!;
  measureCtx.font = `${fontSize}px ${FONT_FAMILY}`;
  const lines = text.split("\n");
  const width = Math.max(1, ...lines.map((l) => measureCtx!.measureText(l).width));
  return { width, height: lines.length * fontSize * LINE_HEIGHT };
};

/** Copies with fresh ids/seeds, offset by (dx, dy). */
export const duplicateElements = (els: SceneElement[], dx: number, dy: number): SceneElement[] =>
  els.map((el) => ({ ...el, id: newId(), seed: randomSeed(), x: el.x + dx, y: el.y + dy, version: 1 }));

export const reorder = (
  elements: SceneElement[],
  ids: Set<string>,
  op: "back" | "backward" | "forward" | "front",
): SceneElement[] => {
  const picked = elements.filter((e) => ids.has(e.id));
  const rest = elements.filter((e) => !ids.has(e.id));
  if (op === "back") return [...picked, ...rest];
  if (op === "front") return [...rest, ...picked];
  const next = [...elements];
  // Move each selected element one slot, iterating from the side it moves towards so neighbours don't collide.
  const order = op === "forward" ? [...next.keys()].reverse() : [...next.keys()];
  for (const i of order) {
    const j = op === "forward" ? i + 1 : i - 1;
    if (j < 0 || j >= next.length || !ids.has(next[i].id) || ids.has(next[j].id)) continue;
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const ELEMENT_TYPES = new Set(["rectangle", "ellipse", "diamond", "arrow", "line", "freedraw", "text", "image"]);
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);

/** Trust boundary for files, clipboard and localStorage: drop anything that isn't a well-formed element. */
export const sanitizeElements = (input: unknown): SceneElement[] => {
  if (!Array.isArray(input)) return [];
  return input.flatMap((raw): SceneElement[] => {
    if (!raw || typeof raw !== "object") return [];
    const e = raw as Record<string, unknown>;
    if (typeof e.id !== "string" || !ELEMENT_TYPES.has(e.type as string)) return [];
    if (![e.x, e.y, e.width, e.height].every(isNum)) return [];
    if ("points" in e && !(Array.isArray(e.points) && e.points.every((p) => Array.isArray(p) && isNum(p[0]) && isNum(p[1])))) return [];
    if (e.type === "image" && !(typeof e.dataURL === "string" && e.dataURL.startsWith("data:image/"))) return [];
    if (e.type === "text" && typeof e.text !== "string") return [];
    if (["arrow", "line", "freedraw"].includes(e.type as string) && !Array.isArray(e.points)) return [];
    return [{ ...DEFAULT_STYLE, seed: randomSeed(), version: 1, ...e } as SceneElement];
  });
};
