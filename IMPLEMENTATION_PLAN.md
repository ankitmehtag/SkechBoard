# Implementation Plan: Excalidraw-inspired clone

Built from the findings in `REVERSE_ENGINEERING.md` (section numbers in brackets below refer to it).
The project folder was empty, so the stack is React 18, TypeScript and Vite, as the brief asks.

## Dependencies

- `react` and `react-dom`
- `roughjs`: hand-drawn strokes [§5]. It is the one non-framework dependency; reproducing its look by hand is a lot of code.
- Dev only: `vite`, `@vitejs/plugin-react`, `typescript`, `eslint` with the TypeScript and react-hooks plugins.

Not added:

- **perfect-freehand**: freedraw is smoothed with quadratic midpoints instead.
- **A state library**: React state plus refs is enough.
- **An ID library**: `crypto.randomUUID` covers it.

## Architecture

```
src/
  types.ts        Element union (rectangle|ellipse|diamond|arrow|line|freedraw|text|image), AppState, Tool
  geometry.ts     bounds, hit-testing, handle positions, resize math, scene↔screen transforms
  render.ts       canvas renderer: roughjs drawables cached by (id, version); selection overlay; grid-free
  scene.ts        pure element ops: create, update, duplicate, delete, z-order
  history.ts      undo/redo stack of element-array snapshots (pushed on gesture end)
  storage.ts      localStorage autosave/restore (keys mirror §8: `excalidraw`, `excalidraw-state`, `excalidraw-theme`)
  exporters.ts    JSON save/load (.excalidraw), PNG (offscreen canvas), SVG (rough.svg)
  App.tsx         state owner, pointer + keyboard handling, layout of islands
  components/
    Toolbar.tsx         top-center island [§2]; bottom bar under 730px wide [§6]
    PropertiesPanel.tsx left island [§3]
    MainMenu.tsx        hamburger dropdown [§7]
    BottomBar.tsx       zoom and undo/redo islands [§2]
    HelpDialog.tsx      shortcuts modal [§7]
    TextEditor.tsx      overlaid textarea for text editing [§10]
    WelcomeScreen.tsx   empty-canvas hints [§2]
    icons.tsx           inline SVG icons
  styles.css      tokens on :root; dark theme via [data-theme=dark]
```

Rendering:

- One `<canvas>` sized to the viewport times `devicePixelRatio`.
- The canvas is redrawn in `requestAnimationFrame` whenever the scene, selection or viewport changes.
- In dark theme the canvas gets `filter: invert(93%) hue-rotate(180deg)` [§5].

## Key measurements and rules [§2, §3, §4]

| Token | Value |
|-------|-------|
| Primary | `#6965db` |
| Primary-light (active tool / option) | `#e0dfff` |
| Island | white, radius 8px, soft shadow |
| Tool button | 36×36 |
| Toolbar island height | ≈44px |
| Edge gutter | 16px |
| Properties island width | ≈200px, scrolls |
| Stroke palette | `#1e1e1e #e03131 #2f9e44 #1971c2 #f08c00` |
| Background palette | `transparent #ffc9c9 #b2f2bb #a5d8ff #ffec99` |
| Stroke widths | 1 / 2 / 4 |
| Roughness | 0 / 1 / 2 |

Interaction rules:

- **Selection box**: primary-coloured, padded 4px, square corner handles, rotation handle omitted (MVP).
- **Shortcuts**: the tool keys from the observed table, plus:
  - Delete/Backspace
  - Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y
  - Ctrl+C, Ctrl+V, Ctrl+D, Ctrl+A
  - Ctrl+0 (reset zoom), Ctrl +/- (zoom)
  - Ctrl+S (save JSON), Ctrl+O (open), Ctrl+Shift+E (export PNG)
  - Space+drag to pan, Escape, `?` for help, Q to lock the tool
- **After drawing**: the tool reverts to selection unless locked [§10].
- **Pan and zoom**: wheel pans, Ctrl+wheel zooms at the cursor (10%–3000%).

## Priorities

**MVP (this pass):**

- full-screen canvas
- tools: selection, hand, rectangle, diamond, ellipse, arrow, line, freehand, text, image, eraser
- move, 8-handle resize, delete, Shift+click multi-select, marquee selection
- properties: stroke, background, fill style, stroke width, stroke style, sloppiness, edges, opacity, layers, duplicate and delete actions
- pan, zoom, undo/redo, copy/paste/duplicate (in-app clipboard plus the system clipboard as JSON)
- JSON import/export, PNG/SVG export, localStorage autosave
- welcome screen, help dialog, main menu with theme toggle and canvas background, responsive bottom toolbar

**Advanced (deferred):**

- rotation
- arrow binding to shapes
- multi-point lines
- sticky notes and frames
- the library sidebar
- collaboration
- the command palette
- find on canvas
- text inside containers
- an IndexedDB image store: images are kept as data URLs inside elements instead, which can exceed localStorage limits for large images

## Verification

- `tsc -b`, `eslint`, `vite build`
- A small assert-based self-check for the geometry hit-testing and resize math (`npm run test`, run with node)
- A browser smoke test through REA `capture-browser-scenario` against `vite preview`. It can click tools, menus and the help dialog, but cannot drag on the canvas.

## Verification results (2026-10-26)

- `npm run typecheck`, `npm run lint` and `npm run build` are clean. The bundle is 212 KB of JS, 70 KB gzipped.
- `npm test` passes the geometry self-check.
- `scripts/e2e.mjs` passes 25/25 against `vite preview` in Chrome 155, driving gestures through CDP:
  - draw every shape tool and add text
  - move, resize, undo/redo, duplicate, delete
  - marquee selection, eraser, zoom
  - copy/paste, image paste, PNG/SVG/JSON export
  - JSON import, and rejecting a malformed file
  - autosave across a reload
  - help dialog, dark theme, bottom toolbar at 390 px with no horizontal scroll
  - no uncaught page errors
- **REA parity run** `ev_6af74699…`: the same scenario REA ran on excalidraw.com (`docs/rea/scenario-clone-parity.json`, minus the "More tools" step) completes 14/14 steps on the clone. The accessible names (`Rectangle`, `main-menu-trigger`) match the reference.
- **Not tested:**
  - the native file pickers behind the image tool and Open. They share code with the paste and drop paths, which were tested.
  - real touch input
  - Firefox and Safari
  - pinch-zoom: Ctrl+wheel is implemented, touch pinch is not
