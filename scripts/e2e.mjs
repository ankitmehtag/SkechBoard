// CDP browser smoke test (REA scenarios cannot drag, so drawing gestures are driven here).
// Needs `npm run build && npm run preview` on :4173 and Chrome started with --remote-debugging-port=9333.
// usage: node scripts/e2e.mjs <absolute outDir for screenshots/downloads>
import fs from "node:fs";

const OUT = process.argv[2];
const base = "http://127.0.0.1:9333";
const tab = await (await fetch(`${base}/json/new?http://localhost:4173/`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pageErrors = [];
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJS = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
const shot = async (name) => fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
const mouse = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, ...extra });
const dragPath = async (pts, modifiers = 0) => {
  await mouse("mousePressed", ...pts[0], { modifiers });
  for (const p of pts.slice(1)) await mouse("mouseMoved", ...p, { modifiers });
  await mouse("mouseReleased", ...pts[pts.length - 1], { modifiers });
  await sleep(120);
};
const drag = (a, b, steps = 8, modifiers = 0) =>
  dragPath(Array.from({ length: steps + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps]), modifiers);
const click = (x, y, modifiers = 0) => dragPath([[x, y]], modifiers);
const key = async (k, code, vk, modifiers = 0, text) => {
  await send("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers, text });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers });
  await sleep(80);
};
const press = (ch) => key(ch, `Key${ch.toUpperCase()}`, ch.toUpperCase().charCodeAt(0), 0, ch);
const CTRL = 2, SHIFT = 8;
const scene = () => evalJS(`JSON.parse(localStorage.getItem("sketchboard")||"[]").map(e=>({type:e.type,x:Math.round(e.x),y:Math.round(e.y),w:Math.round(e.width),h:Math.round(e.height),stroke:e.strokeColor,bg:e.backgroundColor,op:e.opacity,text:e.text}))`);
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await evalJS("localStorage.clear()");
await send("Page.reload");
await sleep(1500);
await shot("01-welcome");

// rectangle
await press("r");
await drag([400, 250], [600, 380]);
await sleep(400);
let s = await scene();
check("draw rectangle", s.length === 1 && s[0].type === "rectangle" && s[0].w === 200 && s[0].h === 130, JSON.stringify(s[0]));
check("tool reverts to selection", await evalJS(`document.querySelector('[data-testid=toolbar-selection]').getAttribute('aria-pressed')`) === "true");

// properties: background + stroke via panel buttons
await evalJS(`document.querySelector('[aria-label="Background #a5d8ff"]').click()`);
await evalJS(`document.querySelector('[aria-label="Stroke #e03131"]').click()`);
await sleep(400);
s = await scene();
check("change bg/stroke on selection", s[0].bg === "#a5d8ff" && s[0].stroke === "#e03131", `${s[0].bg} ${s[0].stroke}`);
await shot("02-rect-selected-panel");

// ellipse, diamond, arrow, line, freedraw
await press("o");
await drag([700, 250], [860, 370]);
await press("d");
await drag([260, 450], [400, 580]);
await press("a");
await drag([620, 320], [700, 300]);
await press("l");
await drag([350, 650], [600, 650]);
await press("p");
await dragPath(Array.from({ length: 30 }, (_, i) => [700 + i * 8, 500 + Math.sin(i / 3) * 40]));
await sleep(400);
s = await scene();
check("all shape tools create elements", ["rectangle", "ellipse", "diamond", "arrow", "line", "freedraw"].every((t) => s.some((e) => e.type === t)), s.map((e) => e.type).join(","));

// text via tool click + typing
await press("t");
await click(900, 200);
await sleep(200);
await send("Input.insertText", { text: "Hello sketch" });
await key("Escape", "Escape", 27);
await sleep(400);
s = await scene();
check("text element", s.some((e) => e.type === "text" && e.text === "Hello sketch"));

// select + move rectangle
await press("v");
await click(500, 300);
await drag([500, 300], [540, 340]);
await sleep(400);
s = await scene();
const r = s.find((e) => e.type === "rectangle");
check("move", r.x === 440 && r.y === 290, `${r.x},${r.y}`);

// resize via se handle (bounds 440..640 x 290..420, pad 6)
await drag([646, 426], [706, 466]);
await sleep(400);
s = await scene();
const r2 = s.find((e) => e.type === "rectangle");
check("resize", r2.w === 260 && r2.h === 170, `${r2.w}x${r2.h}`);

// undo / redo
await key("z", "KeyZ", 90, CTRL);
await sleep(400);
s = await scene();
check("undo restores size", s.find((e) => e.type === "rectangle").w === 200);
await key("z", "KeyZ", 90, CTRL | SHIFT);
await sleep(400);
s = await scene();
check("redo", s.find((e) => e.type === "rectangle").w === 260);

// duplicate + delete
const before = s.length;
await key("d", "KeyD", 68, CTRL);
await sleep(400);
check("duplicate", (await scene()).length === before + 1);
await key("Delete", "Delete", 46);
await sleep(400);
check("delete", (await scene()).length === before);

// multi-select via marquee then opacity
await click(1200, 760);
await drag([240, 420], [420, 610]);
await sleep(200);
const sel = await evalJS(`document.querySelector('[aria-label="Opacity"]') ? 1 : 0`);
check("marquee selects (panel shown)", sel === 1);

// eraser
const n0 = (await scene()).length;
await press("e");
await drag([250, 515], [420, 515], 12);
await sleep(400);
check("eraser removes diamond", (await scene()).length === n0 - 1 && !(await scene()).some((e) => e.type === "diamond"));

// zoom
await key("=", "Equal", 187, CTRL, "=");
await sleep(200);
const zoomText = await evalJS(`document.querySelector('[aria-label="Reset zoom"]').textContent`);
check("zoom in", zoomText === "110%", zoomText);
await key("0", "Digit0", 48, CTRL, "0");

// copy/paste via clipboard events with real clipboardData
await press("v");
await key("a", "KeyA", 65, CTRL);
const pasteOk = await evalJS(`(() => {
  const dt = new DataTransfer();
  document.dispatchEvent(new ClipboardEvent("copy", { clipboardData: dt, bubbles: true }));
  const n = JSON.parse(localStorage.getItem("sketchboard")).length;
  document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  return new Promise(r => setTimeout(() => r([n, JSON.parse(localStorage.getItem("sketchboard")).length]), 600));
})()`);
check("copy + paste", pasteOk[1] === pasteOk[0] * 2, JSON.stringify(pasteOk));
await key("z", "KeyZ", 90, CTRL);
await sleep(400);

// exports (in-page, without downloads)
await send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: OUT.replace(/\//g, "\\") });
await evalJS(`document.querySelector('[data-testid=main-menu-trigger]').click()`);
await sleep(300);
await shot("03-menu");
await evalJS(`[...document.querySelectorAll('.menu-item')].find(b=>b.textContent.includes('Export SVG')).click()`);
await sleep(300);
await evalJS(`document.querySelector('[data-testid=main-menu-trigger]').click()`);
await sleep(200);
await evalJS(`[...document.querySelectorAll('.menu-item')].find(b=>b.textContent.includes('Export PNG')).click()`);
await sleep(300);
await evalJS(`document.querySelector('[data-testid=main-menu-trigger]').click()`);
await sleep(200);
await evalJS(`[...document.querySelectorAll('.menu-item')].find(b=>b.textContent.includes('Save to')).click()`);
await sleep(1200);
const files = fs.readdirSync(OUT);
check("exports downloaded", ["drawing.svg", "drawing.png", "drawing.sketchboard.json"].every((f) => files.includes(f)), files.join(","));

// image paste (same insert path as the image tool, minus the native file picker)
const imgCount = await evalJS(`(async () => {
  const c = document.createElement("canvas"); c.width = 80; c.height = 60;
  const g = c.getContext("2d"); g.fillStyle = "#2f9e44"; g.fillRect(0, 0, 80, 60);
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  const dt = new DataTransfer(); dt.items.add(new File([blob], "x.png", { type: "image/png" }));
  document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  await new Promise(r => setTimeout(r, 800));
  return JSON.parse(localStorage.getItem("sketchboard")).filter(e => e.type === "image" && e.dataURL.startsWith("data:image/png")).length;
})()`);
check("image paste inserts image", imgCount === 1, String(imgCount));
await shot("03b-image");

// JSON import via drop (same parser as Open)
const saved = fs.readFileSync(`${OUT}/drawing.sketchboard.json`, "utf8");
const imported = await evalJS(`(async () => {
  const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(saved)}], "d.json", { type: "application/json" }));
  document.querySelector(".app").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
  await new Promise(r => setTimeout(r, 800));
  return JSON.parse(localStorage.getItem("sketchboard")).map(e => e.type).join(",");
})()`);
check("JSON import via drop", imported === JSON.parse(saved).elements.map((e) => e.type).join(","), imported);
// a malformed file must be rejected without wiping the scene
const rejected = await evalJS(`(async () => {
  const dt = new DataTransfer(); dt.items.add(new File(['{"type":"other"}'], "bad.json", { type: "application/json" }));
  document.querySelector(".app").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 600));
  return [JSON.parse(localStorage.getItem("sketchboard")).length, !!document.querySelector(".toast")];
})()`);
check("bad file rejected, scene kept, toast shown", rejected[0] > 0 && rejected[1], JSON.stringify(rejected));

// autosave survives reload
const countBefore = (await scene()).length;
await send("Page.reload");
await sleep(1500);
const afterReload = await evalJS(`JSON.parse(localStorage.getItem("sketchboard")).length`);
check("autosave + reload", afterReload === countBefore && countBefore > 0, `${countBefore} -> ${afterReload}`);
await shot("04-after-reload");

// help dialog + dark theme
await key("?", "Slash", 191, SHIFT, "?");
await sleep(300);
check("help dialog", await evalJS(`!!document.querySelector('[role=dialog]')`));
await shot("05-help");
await key("Escape", "Escape", 27);
await evalJS(`document.querySelector('[data-testid=main-menu-trigger]').click()`);
await sleep(200);
await evalJS(`document.querySelector('[aria-label="Dark theme"]').click()`);
await key("Escape", "Escape", 27);
await sleep(400);
check("dark theme", (await evalJS(`document.documentElement.dataset.theme`)) === "dark");
await shot("06-dark");

// mobile layout
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await sleep(600);
const tb = await evalJS(`(() => { const r = document.querySelector('.toolbar').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)] })()`);
check("mobile toolbar at bottom", tb[1] > 780, JSON.stringify(tb));
const overflow = await evalJS(`document.documentElement.scrollWidth <= innerWidth`);
check("no horizontal page scroll on mobile", overflow);
await shot("07-mobile-dark");

const errors = pageErrors;
check("no uncaught page errors", !errors.length, errors.join(" | ").slice(0, 300));
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await send("Page.close").catch(() => {});
await fetch(`${base}/json/close/${tab.id}`).catch(() => {});
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
process.exit(0);
