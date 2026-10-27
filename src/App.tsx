import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BottomBar } from "./components/BottomBar.tsx";
import { HelpDialog } from "./components/HelpDialog.tsx";
import { MainMenu } from "./components/MainMenu.tsx";
import { PropertiesPanel, type LayerOp } from "./components/PropertiesPanel.tsx";
import { TOOLS, Toolbar } from "./components/Toolbar.tsx";
import { WelcomeScreen } from "./components/WelcomeScreen.tsx";
import { exportPNG, exportSVG, parseFile, pickFile, readAsDataURL, saveJSON } from "./exporters.ts";
import {
  contains,
  getBounds,
  getCommonBounds,
  handleAt,
  handlePositions,
  hitTest,
  normalize,
  resizeBounds,
  scaleElement,
  screenToScene,
  type Bounds,
  type Handle,
} from "./geometry.ts";
import { History } from "./history.ts";
import { HANDLE_SIZE, SELECTION_PAD, renderScene, setImageLoadListener } from "./render.ts";
import {
  DEFAULT_STYLE,
  FONT_FAMILY,
  LINE_HEIGHT,
  SHAPE_TOOLS,
  duplicateElements,
  measureText,
  newId,
  randomSeed,
  reorder,
  sanitizeElements,
  updateElement,
} from "./scene.ts";
import { loadScene, saveScene } from "./storage.ts";
import type { ElementStyle, ImageElement, LinearElement, Point, SceneElement, TextElement, Theme, Tool, Viewport } from "./types.ts";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 30;
const CLIPBOARD_TYPE = "sketchboard/clipboard";
const MOBILE_QUERY = "(max-width: 730px)";

type Drag =
  | { kind: "pan"; sx: number; sy: number; v0: Viewport }
  | { kind: "shape"; id: string; origin: Point }
  | { kind: "linear"; id: string; origin: Point }
  | { kind: "freedraw"; id: string; origin: Point; points: Point[] }
  | { kind: "move"; start: Point; originals: SceneElement[] }
  | { kind: "resize"; handle: Handle; startBounds: Bounds; originals: SceneElement[]; offset: Point }
  | { kind: "marquee"; origin: Point }
  | { kind: "erase" };

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
const isEditableTarget = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

const HINTS: Partial<Record<Tool, string>> = {
  hand: "Drag to move the canvas",
  freedraw: "Click and drag to draw freehand",
  text: "Click anywhere to add text",
  eraser: "Drag over elements to erase them",
  arrow: "Hold Shift to snap the angle",
  line: "Hold Shift to snap the angle",
  rectangle: "Hold Shift to keep proportions, Q keeps the tool active",
  diamond: "Hold Shift to keep proportions, Q keeps the tool active",
  ellipse: "Hold Shift to keep proportions, Q keeps the tool active",
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export default function App() {
  const [initial] = useState(loadScene);
  const [elements, setElementsState] = useState<SceneElement[]>(initial.elements);
  const elementsRef = useRef(elements);
  const setElements = useCallback((next: SceneElement[]) => {
    elementsRef.current = next;
    setElementsState(next);
  }, []);

  const history = useRef(new History()).current;
  const [, setHistoryTick] = useState(0);
  /** Apply a discrete change (property edit, delete, paste...) as one undo step. */
  const commit = useCallback(
    (next: SceneElement[]) => {
      history.record(elementsRef.current);
      setElements(next);
      setHistoryTick((t) => t + 1);
    },
    [history, setElements],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tool, setToolState] = useState<Tool>("selection");
  const [toolLocked, setToolLocked] = useState(false);
  const [style, setStyle] = useState<ElementStyle>(DEFAULT_STYLE);
  const [viewport, setViewport] = useState<Viewport>({ scrollX: 0, scrollY: 0, zoom: 1, ...initial.state.viewport });
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [canvasBackground, setCanvasBackground] = useState(initial.state.canvasBackground ?? "#ffffff");
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobilePropsOpen, setMobilePropsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<Bounds | null>(null);
  const [erasingIds, setErasingIds] = useState<Set<string>>(new Set());
  const erasingRef = useRef(erasingIds);
  erasingRef.current = erasingIds;
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [imageTick, setImageTick] = useState(0);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const gestureStart = useRef<SceneElement[] | null>(null);
  const lastPointer = useRef<Point>([size.w / 2, size.h / 2]);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const selectedRef = useRef(selectedIds);
  selectedRef.current = selectedIds;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const setTool = useCallback((t: Tool) => {
    setToolState(t);
    if (t !== "selection") setSelectedIds(new Set());
  }, []);

  // ---------- rendering ----------
  useEffect(() => setImageLoadListener(() => setImageTick((t) => t + 1)), []);

  useLayoutEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size.w * dpr);
    canvas.height = Math.floor(size.h * dpr);
    const frame = requestAnimationFrame(() =>
      renderScene(canvas.getContext("2d")!, elements, {
        viewport,
        dpr,
        width: size.w,
        height: size.h,
        background: canvasBackground,
        selectedIds: editingId ? undefined : selectedIds,
        erasingIds,
        hiddenId: editingId,
        marquee,
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [elements, viewport, size, canvasBackground, selectedIds, erasingIds, editingId, marquee, imageTick]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // ---------- autosave ----------
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!saveScene(elements, { viewport, canvasBackground }, theme)) showToast("Couldn't save to browser storage — save to a file instead");
    }, 300);
    return () => window.clearTimeout(t);
  }, [elements, viewport, canvasBackground, theme, showToast]);

  // ---------- viewport ----------
  const zoomAt = useCallback((nextZoom: number, [sx, sy]: Point) => {
    setViewport((v) => {
      const zoom = clampZoom(nextZoom);
      const [px, py] = screenToScene(sx, sy, v);
      return { zoom, scrollX: sx / zoom - px, scrollY: sy / zoom - py };
    });
  }, []);

  const zoomStep = useCallback(
    (dir: 1 | -1 | 0) => {
      const center: Point = [size.w / 2, size.h / 2];
      if (dir === 0) zoomAt(1, center);
      else zoomAt(viewportRef.current.zoom * (dir > 0 ? 1.1 : 1 / 1.1), center);
    },
    [size, zoomAt],
  );

  useEffect(() => {
    const canvas = canvasRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(viewportRef.current.zoom * Math.exp(-e.deltaY * 0.01), [e.clientX, e.clientY]);
        return;
      }
      const dx = e.shiftKey ? e.deltaY : e.deltaX;
      const dy = e.shiftKey ? 0 : e.deltaY;
      setViewport((v) => ({ ...v, scrollX: v.scrollX - dx / v.zoom, scrollY: v.scrollY - dy / v.zoom }));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // ---------- element helpers ----------
  const selectedElements = useMemo(() => elements.filter((e) => selectedIds.has(e.id)), [elements, selectedIds]);

  const deleteSelected = useCallback(() => {
    if (!selectedRef.current.size) return;
    commit(elementsRef.current.filter((e) => !selectedRef.current.has(e.id)));
    setSelectedIds(new Set());
  }, [commit]);

  const insertElements = useCallback(
    (els: SceneElement[]) => {
      if (!els.length) return;
      commit([...elementsRef.current, ...els]);
      setSelectedIds(new Set(els.map((e) => e.id)));
      setToolState("selection");
    },
    [commit],
  );

  const duplicateSelected = useCallback(() => {
    const sel = elementsRef.current.filter((e) => selectedRef.current.has(e.id));
    insertElements(duplicateElements(sel, 10, 10));
  }, [insertElements]);

  const insertImage = useCallback(
    async (file: Blob, at: Point) => {
      try {
        const dataURL = await readAsDataURL(file);
        const img = new Image();
        img.src = dataURL;
        await img.decode();
        const scale = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
        const width = img.naturalWidth * scale;
        const height = img.naturalHeight * scale;
        const el: ImageElement = {
          ...style,
          id: newId(),
          type: "image",
          x: at[0] - width / 2,
          y: at[1] - height / 2,
          width,
          height,
          seed: randomSeed(),
          version: 1,
          dataURL,
        };
        insertElements([el]);
      } catch {
        showToast("Couldn't load that image");
      }
    },
    [insertElements, showToast, style],
  );

  const viewportCenter = useCallback((): Point => screenToScene(size.w / 2, size.h / 2, viewportRef.current), [size]);

  const pickTool = useCallback(
    async (t: Tool) => {
      if (t !== "image") return setTool(t);
      setToolState("image");
      const file = await pickFile("image/*");
      setToolState("selection");
      if (file) insertImage(file, viewportCenter());
    },
    [insertImage, setTool, viewportCenter],
  );

  // ---------- text editing ----------
  const startTextEdit = useCallback((el: TextElement) => {
    gestureStart.current = elementsRef.current;
    if (!elementsRef.current.some((e) => e.id === el.id)) setElements([...elementsRef.current, el]);
    setSelectedIds(new Set([el.id]));
    setEditingId(el.id);
  }, [setElements]);

  const finishTextEdit = useCallback(() => {
    if (!editingId) return;
    const el = elementsRef.current.find((e) => e.id === editingId) as TextElement | undefined;
    let next = elementsRef.current;
    if (el && !el.text.trim()) {
      next = next.filter((e) => e.id !== editingId);
      setElements(next);
      setSelectedIds(new Set());
    }
    if (gestureStart.current && next !== gestureStart.current) {
      history.record(gestureStart.current);
      setHistoryTick((t) => t + 1);
    }
    gestureStart.current = null;
    setEditingId(null);
    if (!toolLocked) setToolState("selection");
  }, [editingId, history, setElements, toolLocked]);

  const newTextAt = (p: Point): TextElement => ({
    ...style,
    id: newId(),
    type: "text",
    x: p[0],
    y: p[1] - (style.fontSize * LINE_HEIGHT) / 2,
    width: 1,
    height: style.fontSize * LINE_HEIGHT,
    seed: randomSeed(),
    version: 1,
    text: "",
  });

  // ---------- pointer handling ----------
  const topHit = (p: Point) => {
    const tol = 10 / viewportRef.current.zoom;
    const els = elementsRef.current;
    for (let i = els.length - 1; i >= 0; i--) if (hitTest(els[i], p, tol)) return els[i];
    return null;
  };

  const eraseAt = (p: Point) => {
    const hit = topHit(p);
    if (hit && !erasingRef.current.has(hit.id)) {
      erasingRef.current = new Set(erasingRef.current).add(hit.id);
      setErasingIds(erasingRef.current);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editingId) {
      finishTextEdit();
      return;
    }
    setMenuOpen(false);
    // Suppress compat mousedown so its default focus change doesn't blur a just-opened text editor.
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const v = viewportRef.current;
    const p = screenToScene(e.clientX, e.clientY, v);
    gestureStart.current = elementsRef.current;

    if (e.button === 1 || tool === "hand" || spaceDown) {
      drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, v0: v };
      setPanning(true);
      return;
    }
    if (e.button !== 0) return;

    if (tool === "selection") {
      const selected = elementsRef.current.filter((el) => selectedRef.current.has(el.id));
      const common = getCommonBounds(selected);
      const handle = common && handleAt(common, p, SELECTION_PAD / v.zoom, HANDLE_SIZE / v.zoom);
      if (common && handle) {
        const [hx, hy] = handlePositions(common, 0)[handle];
        drag.current = { kind: "resize", handle, startBounds: common, originals: selected, offset: [hx - p[0], hy - p[1]] };
        return;
      }
      const hit = topHit(p);
      if (hit && e.shiftKey && selectedRef.current.has(hit.id)) {
        const next = new Set(selectedRef.current);
        next.delete(hit.id);
        setSelectedIds(next);
        return;
      }
      if (hit) {
        const ids = e.shiftKey ? new Set(selectedRef.current).add(hit.id) : selectedRef.current.has(hit.id) ? selectedRef.current : new Set([hit.id]);
        setSelectedIds(ids);
        drag.current = { kind: "move", start: p, originals: elementsRef.current.filter((el) => ids.has(el.id)) };
        return;
      }
      if (common && !e.shiftKey && contains(common, { x1: p[0], y1: p[1], x2: p[0], y2: p[1] })) {
        drag.current = { kind: "move", start: p, originals: selected };
        return;
      }
      if (!e.shiftKey) setSelectedIds(new Set());
      drag.current = { kind: "marquee", origin: p };
      return;
    }

    if (tool === "eraser") {
      drag.current = { kind: "erase" };
      eraseAt(p);
      return;
    }

    if (tool === "text") {
      startTextEdit(newTextAt(p));
      return;
    }

    const base = { ...style, id: newId(), x: p[0], y: p[1], width: 0, height: 0, seed: randomSeed(), version: 1 };
    if (tool === "freedraw") {
      setElements([...elementsRef.current, { ...base, type: "freedraw", points: [[0, 0]] }]);
      drag.current = { kind: "freedraw", id: base.id, origin: p, points: [p] };
    } else if (tool === "arrow" || tool === "line") {
      setElements([...elementsRef.current, { ...base, type: tool, points: [[0, 0], [0, 0]] }]);
      drag.current = { kind: "linear", id: base.id, origin: p };
    } else if (tool === "rectangle" || tool === "ellipse" || tool === "diamond") {
      setElements([...elementsRef.current, { ...base, type: tool }]);
      drag.current = { kind: "shape", id: base.id, origin: p };
    }
  };

  const replace = (id: string, fn: (el: SceneElement) => SceneElement) =>
    setElements(elementsRef.current.map((el) => (el.id === id ? fn(el) : el)));

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    lastPointer.current = [e.clientX, e.clientY];
    const d = drag.current;
    const v = viewportRef.current;
    const p = screenToScene(e.clientX, e.clientY, v);
    const canvas = e.currentTarget;

    if (!d) {
      if (tool !== "selection") return;
      const common = getCommonBounds(elementsRef.current.filter((el) => selectedRef.current.has(el.id)));
      const h = common && handleAt(common, p, SELECTION_PAD / v.zoom, HANDLE_SIZE / v.zoom);
      canvas.style.cursor = h ? (h === "n" || h === "s" ? "ns-resize" : h === "e" || h === "w" ? "ew-resize" : h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize") : topHit(p) ? "move" : "";
      return;
    }

    switch (d.kind) {
      case "pan":
        setViewport({ ...d.v0, scrollX: d.v0.scrollX + (e.clientX - d.sx) / v.zoom, scrollY: d.v0.scrollY + (e.clientY - d.sy) / v.zoom });
        break;
      case "shape": {
        let w = p[0] - d.origin[0];
        let h = p[1] - d.origin[1];
        if (e.shiftKey) {
          const s = Math.max(Math.abs(w), Math.abs(h));
          w = s * Math.sign(w || 1);
          h = s * Math.sign(h || 1);
        }
        replace(d.id, (el) => updateElement(el, { width: w, height: h }));
        break;
      }
      case "linear": {
        let dx = p[0] - d.origin[0];
        let dy = p[1] - d.origin[1];
        if (e.shiftKey) {
          const len = Math.hypot(dx, dy);
          const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12);
          dx = len * Math.cos(a);
          dy = len * Math.sin(a);
        }
        replace(d.id, (el) => normalize(updateElement(el as LinearElement, { x: d.origin[0], y: d.origin[1], points: [[0, 0], [dx, dy]] })));
        break;
      }
      case "freedraw": {
        d.points.push(p);
        const pts = d.points.map(([x, y]) => [x - d.origin[0], y - d.origin[1]] as Point);
        replace(d.id, (el) => normalize(updateElement(el as LinearElement, { x: d.origin[0], y: d.origin[1], points: pts })));
        break;
      }
      case "move": {
        const dx = p[0] - d.start[0];
        const dy = p[1] - d.start[1];
        const moved = new Map(d.originals.map((o) => [o.id, { ...o, x: o.x + dx, y: o.y + dy }]));
        setElements(elementsRef.current.map((el) => moved.get(el.id) ?? el));
        break;
      }
      case "resize": {
        const to = resizeBounds(d.startBounds, d.handle, [p[0] + d.offset[0], p[1] + d.offset[1]], e.shiftKey);
        const scaled = new Map(d.originals.map((o) => [o.id, updateElement(scaleElement(o, d.startBounds, to), {})]));
        setElements(elementsRef.current.map((el) => scaled.get(el.id) ?? el));
        break;
      }
      case "marquee": {
        const m = { x1: Math.min(d.origin[0], p[0]), y1: Math.min(d.origin[1], p[1]), x2: Math.max(d.origin[0], p[0]), y2: Math.max(d.origin[1], p[1]) };
        setMarquee(m);
        setSelectedIds(new Set(elementsRef.current.filter((el) => contains(m, getBounds(el))).map((el) => el.id)));
        break;
      }
      case "erase":
        eraseAt(p);
        break;
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    setPanning(false);

    if (d.kind === "shape" || d.kind === "linear" || d.kind === "freedraw") {
      const el = elementsRef.current.find((x) => x.id === d.id);
      const tiny = el && Math.abs(el.width) < 2 && Math.abs(el.height) < 2 && d.kind !== "freedraw";
      if (!el || tiny) {
        setElements(elementsRef.current.filter((x) => x.id !== d.id));
      } else {
        replace(d.id, (x) => normalize(x));
        if (d.kind !== "freedraw") setSelectedIds(new Set([d.id]));
        if (!toolLocked && d.kind !== "freedraw") setToolState("selection");
      }
    } else if (d.kind === "resize") {
      const ids = new Set(d.originals.map((o) => o.id));
      setElements(elementsRef.current.map((el) => (ids.has(el.id) ? normalize(el) : el)));
    } else if (d.kind === "erase") {
      setElements(elementsRef.current.filter((el) => !erasingRef.current.has(el.id)));
      setErasingIds(new Set());
    } else if (d.kind === "marquee") {
      setMarquee(null);
    }

    if (gestureStart.current && elementsRef.current !== gestureStart.current) {
      history.record(gestureStart.current);
      setHistoryTick((t) => t + 1);
    }
    gestureStart.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool !== "selection") return;
    const p = screenToScene(e.clientX, e.clientY, viewportRef.current);
    const hit = topHit(p);
    if (hit?.type === "text") startTextEdit(hit);
    else if (!hit) startTextEdit(newTextAt(p));
  };

  // ---------- undo / redo ----------
  const undo = useCallback(() => {
    const prev = history.undo(elementsRef.current);
    if (prev) {
      setElements(prev);
      setSelectedIds((ids) => new Set(prev.filter((el) => ids.has(el.id)).map((el) => el.id)));
      setHistoryTick((t) => t + 1);
    }
  }, [history, setElements]);

  const redo = useCallback(() => {
    const next = history.redo(elementsRef.current);
    if (next) {
      setElements(next);
      setSelectedIds((ids) => new Set(next.filter((el) => ids.has(el.id)).map((el) => el.id)));
      setHistoryTick((t) => t + 1);
    }
  }, [history, setElements]);

  // ---------- file actions ----------
  const openFile = useCallback(async () => {
    const file = await pickFile(".json,application/json");
    if (!file) return;
    try {
      const data = parseFile(await file.text());
      commit(data.elements);
      if (data.canvasBackground) setCanvasBackground(data.canvasBackground);
      setSelectedIds(new Set());
    } catch {
      showToast("That file isn't a valid Sketchboard drawing");
    }
  }, [commit, showToast]);

  const resetCanvas = useCallback(() => {
    if (!elementsRef.current.length) return;
    if (!window.confirm("Clear the whole canvas? You can undo this.")) return;
    commit([]);
    setSelectedIds(new Set());
  }, [commit]);

  const applyLayer = useCallback((op: LayerOp) => commit(reorder(elementsRef.current, selectedRef.current, op)), [commit]);

  // ---------- keyboard ----------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target) || helpOpen) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.key === " ") {
        setSpaceDown(true);
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSelectedIds(new Set());
        return;
      }
      if (mod) {
        const actions: Record<string, () => void> = {
          z: () => (e.shiftKey ? redo() : undo()),
          y: redo,
          a: () => {
            setToolState("selection");
            setSelectedIds(new Set(elementsRef.current.map((el) => el.id)));
          },
          d: duplicateSelected,
          s: () => saveJSON(elementsRef.current, canvasBackground),
          o: openFile,
          e: () => e.shiftKey && exportPNG(elementsRef.current, canvasBackground),
          "0": () => zoomStep(0),
          "=": () => zoomStep(1),
          "+": () => zoomStep(1),
          "-": () => zoomStep(-1),
          "]": () => applyLayer(e.shiftKey ? "front" : "forward"),
          "[": () => applyLayer(e.shiftKey ? "back" : "backward"),
          "}": () => applyLayer("front"),
          "{": () => applyLayer("back"),
          delete: resetCanvas,
        };
        const action = actions[key];
        if (action) {
          e.preventDefault();
          action();
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key.startsWith("Arrow") && selectedRef.current.size) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key] ?? [0, 0];
        commit(elementsRef.current.map((el) => (selectedRef.current.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el)));
        return;
      }
      if (e.key === "?") {
        setHelpOpen(true);
        return;
      }
      if (key === "q") {
        setToolLocked((l) => !l);
        return;
      }
      const match = TOOLS.find((t) => t.keys.includes(key));
      if (match && !e.altKey) pickTool(match.tool);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [applyLayer, canvasBackground, commit, deleteSelected, duplicateSelected, helpOpen, openFile, pickTool, redo, resetCanvas, undo, zoomStep]);

  // ---------- clipboard & drop ----------
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target) || !selectedRef.current.size) return;
      const els = elementsRef.current.filter((el) => selectedRef.current.has(el.id));
      e.clipboardData?.setData("text/plain", JSON.stringify({ type: CLIPBOARD_TYPE, elements: els }));
      e.preventDefault();
      if (e.type === "cut") deleteSelected();
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const at = screenToScene(...lastPointer.current, viewportRef.current);
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        insertImage(file, at);
        return;
      }
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!text) return;
      e.preventDefault();
      try {
        const data = JSON.parse(text);
        if (data?.type === CLIPBOARD_TYPE) {
          const els = sanitizeElements(data.elements);
          const b = getCommonBounds(els);
          if (b) insertElements(duplicateElements(els, at[0] - (b.x1 + b.x2) / 2, at[1] - (b.y1 + b.y2) / 2));
          return;
        }
      } catch {
        // not our JSON: fall through to plain text
      }
      const { width, height } = measureText(text, style.fontSize);
      insertElements([{ ...newTextAt(at), text, width, height }]);
    };
    window.addEventListener("copy", onCopy);
    window.addEventListener("cut", onCopy);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("cut", onCopy);
      window.removeEventListener("paste", onPaste);
    };
  });

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const at = screenToScene(e.clientX, e.clientY, viewportRef.current);
    if (file.type.startsWith("image/")) return insertImage(file, at);
    try {
      const data = parseFile(await file.text());
      commit(data.elements);
      if (data.canvasBackground) setCanvasBackground(data.canvasBackground);
    } catch {
      showToast("Drop an image or a Sketchboard .json file");
    }
  };

  // ---------- properties ----------
  const panelTypes = useMemo(
    () => (selectedElements.length ? new Set<string>(selectedElements.map((e) => e.type)) : SHAPE_TOOLS.includes(tool) ? new Set<string>([tool]) : null),
    [selectedElements, tool],
  );
  const panelStyle: ElementStyle = selectedElements[0] ?? style;

  const changeStyle = (patch: Partial<ElementStyle>) => {
    setStyle((s) => ({ ...s, ...patch }));
    if (!selectedIds.size) return;
    commit(
      elementsRef.current.map((el) => {
        if (!selectedIds.has(el.id)) return el;
        const next = updateElement(el, patch);
        return next.type === "text" && patch.fontSize ? { ...next, ...measureText(next.text, next.fontSize) } : next;
      }),
    );
  };

  // ---------- text editor overlay ----------
  const editing = editingId ? (elements.find((e) => e.id === editingId) as TextElement | undefined) : undefined;
  const editorStyle: CSSProperties | undefined = editing && {
    left: (editing.x + viewport.scrollX) * viewport.zoom,
    top: (editing.y + viewport.scrollY) * viewport.zoom,
    fontSize: editing.fontSize * viewport.zoom,
    lineHeight: LINE_HEIGHT,
    fontFamily: FONT_FAMILY,
    color: editing.strokeColor,
    opacity: editing.opacity / 100,
    width: Math.max(editing.width + editing.fontSize, 40) * viewport.zoom,
    height: editing.height * viewport.zoom,
  };

  const cursor = panning ? "grabbing" : tool === "hand" || spaceDown ? "grab" : tool === "selection" ? undefined : tool === "text" ? "text" : "crosshair";
  const hint =
    tool === "selection" ? (selectedIds.size ? "Shift+drag a corner to keep proportions, Delete to remove" : "To move canvas, hold Space or scroll while dragging, or use the hand tool") : HINTS[tool];
  const showPanel = panelTypes && !editingId && (!isMobile || mobilePropsOpen);

  return (
    <div className="app" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <canvas
        ref={canvasRef}
        className="canvas"
        style={{ width: size.w, height: size.h, cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        aria-label="Drawing canvas"
      />
      {editing && (
        <textarea
          className="text-editor"
          style={editorStyle}
          autoFocus
          value={editing.text}
          aria-label="Text"
          onChange={(e) => {
            const text = e.target.value;
            replace(editing.id, (el) => updateElement(el as TextElement, { text, ...measureText(text, editing.fontSize) }));
          }}
          onBlur={finishTextEdit}
          onKeyDown={(e) => {
            if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) finishTextEdit();
          }}
        />
      )}

      {!elements.length && tool === "selection" && <WelcomeScreen />}

      <div className="top-bar">
        <MainMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          theme={theme}
          canvasBackground={canvasBackground}
          onOpen={openFile}
          onSave={() => saveJSON(elements, canvasBackground)}
          onExportPNG={() => exportPNG(elements, canvasBackground)}
          onExportSVG={() => exportSVG(elements, canvasBackground)}
          onHelp={() => setHelpOpen(true)}
          onReset={resetCanvas}
          onTheme={setTheme}
          onCanvasBackground={setCanvasBackground}
        />
        <div className="toolbar-wrap">
          <Toolbar tool={tool} locked={toolLocked} onTool={pickTool} onToggleLock={() => setToolLocked((l) => !l)} />
          {hint && <div className="hint">{hint}</div>}
        </div>
      </div>

      {showPanel && (
        <PropertiesPanel
          style={panelStyle}
          types={panelTypes}
          hasSelection={selectedIds.size > 0}
          onChange={changeStyle}
          onLayer={applyLayer}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
        />
      )}

      <BottomBar
        zoom={viewport.zoom}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onZoom={zoomStep}
        onUndo={undo}
        onRedo={redo}
        onHelp={() => setHelpOpen(true)}
        onToggleProperties={isMobile && panelTypes ? () => setMobilePropsOpen((o) => !o) : undefined}
      />

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
