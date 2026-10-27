# Reverse Engineering: excalidraw.com

Target: https://excalidraw.com/ (captured 2026-10-26, Chrome 155, Windows).
Tooling: REA `rea-agents@6.8.0` CLI, run against a locally launched Chrome on loopback CDP port 9333.
The REA MCP server timed out at session start, so every REA call went through the CLI, which is REA's documented fallback.

Each finding below carries one of three labels:

- **[OBS]** REA observed it directly. The Evidence ID is given.
- **[INF]** Inferred from REA evidence, for example measuring pixels in a screenshot.
- **[SRC]** Not observed by REA. Comes from the public Excalidraw source (MIT, github.com/excalidraw/excalidraw) or general knowledge. Treat as an assumption.

## 1. REA runs

| # | Command | Result | Evidence |
|---|---------|--------|----------|
| 1 | `list-browser-targets` | 1 eligible page: "Excalidraw Whiteboard" | `ev_65cb455d…` |
| 2 | `inspect-web-page` (accessibility text, storage keys, 2 s window) | 385 DOM nodes, 213 accessibility nodes, 9 scripts, 6 localStorage keys | `ev_174f5bc8…` |
| 3 | `capture-web-screenshot` | welcome screen, 1784×985 device pixels | `ev_9aaab5b8…` → `docs/rea/01-welcome.png` |
| 4 | `capture-browser-scenario` (connect mode, 17 steps, seeded localStorage) | all steps completed; select, tool panel, main menu, more tools, help dialog | `ev_a573d2be…` → `docs/rea/02..06`, input `docs/rea/scenario-desktop.json` |
| 5 | `capture-browser-scenario` (launch mode, headless, 390×844) | **failed** with `execution_failure` / `cleanup_incomplete`; per REA guidance, not retried | none |
| 6 | `analyze-web-bundle` | partial: 5 scripts, Vite runtime inferred, 28 dynamic imports; the main 2.2 MB chunk hit the 30 s per-script deadline | `ev_e3efb552…` |
| 7 | `capture-browser-scenario` (connect mode, dark theme seeded, 390×844 viewport) | mobile and dark layout plus main menu | `ev_259bbcc2…` → `docs/rea/07,08`, input `docs/rea/scenario-mobile-dark.json` |

For run 7, the 390×844 viewport was set by a small agent-written CDP script (`Emulation.setDeviceMetricsOverride`), not by REA. REA only performed the scenario and the screenshots.

What REA could not do here:

- **No drag.** Scenario actions are limited to goto, click, fill, press, select_option, check, uncheck, wait_for, request and wait_for_timeout. REA could not exercise drawing, resizing or dragging on the canvas. Those behaviours below are [SRC] or [INF].
- **No CSS text.** REA retains script sources and resource metadata. The stylesheet `assets/index-D0I-IbtP.css` (209 KB) was listed but its contents were not retained, so design tokens are [INF] from pixels or [SRC].
- **No pre-attach activity.** Network and console activity from before attach is unavailable (REA limitation text).

## 2. Layout and component hierarchy

Screenshot DPR is 1.25: the 1784 px screenshot width is 1427 CSS px. Pixel measurements below are converted to CSS px [INF].

```
App (full viewport)
├─ <canvas class="static">            bottom layer: committed elements        [SRC]
├─ <canvas class="interactive">       top layer: selection, handles, pointer  [OBS] css locator worked
├─ Top-left island: hamburger "main-menu-trigger" (36×36 button)            [OBS]
│   └─ MainMenu dropdown (≈224 px wide)                                     [OBS] 04-main-menu.png
├─ Top-center island "Shapes" toolbar (height ≈44, button ≈36)              [OBS]/[INF]
│   lock · | · hand · selection · rectangle · diamond · ellipse · arrow · line · draw · text · sticky note · eraser · | · more-tools (⋮)
│   └─ "More tools" dropdown: Insert image (9), Frame (F), Web Embed, Draw to shape (Shift+X),
│        Laser pointer (K), Bucket fill (B), Lasso selection; Generate: Text to diagram, Mermaid, Wireframe to code  [OBS]
├─ Hint text under toolbar (≈12 px grey), changes with context                [OBS]
├─ Left properties island (≈200 px wide, scrolls), shown when a shape tool is active or an element is selected  [OBS]
├─ Top-right: "Try Excalidraw+" promo, Share (primary purple), library sidebar toggle  [OBS]
├─ Bottom-left islands: zoom [− 100% +], undo/redo                          [OBS]
├─ Bottom-right: encryption badge, Help "?"                                 [OBS]
└─ Welcome screen (empty canvas only): logo, storage notice, Open/Help/Live collab/Sign up, hand-drawn hint arrows  [OBS]
```

Accessibility names observed [OBS, `ev_174f5bc8`]: regions "Shapes" and "Canvas actions". The tool buttons expose their names with shortcut descriptions:

| Tool | Shortcut |
|------|----------|
| Keep selected tool active after drawing | Q |
| Hand (panning tool) | H |
| Selection | V or 1 |
| Rectangle | R or 2 |
| Diamond | D or 3 |
| Ellipse | O or 4 |
| Arrow | A or 5 |
| Line | L or 6 |
| Draw | P or 7 |
| Text | T or 8 |
| Sticky note | N |
| Eraser | E or 0 |
| Insert image | 9 |

Canvas actions: "Zoom out", "Reset zoom", "Zoom in", "Undo", "Redo", "Help".

Each tool button shows a tiny shortcut letter in its bottom-right corner [OBS, screenshot].

## 3. Properties panel (selected rectangle) [OBS, 02-selected-properties.png]

Sections, in order:

1. **Stroke**: swatches `#1e1e1e #e03131 #2f9e44 #1971c2 #f08c00`, plus a larger "current colour" swatch that opens a picker.
2. **Background**: swatches transparent (checkerboard) `#ffc9c9 #b2f2bb #a5d8ff #ffec99`, plus the current colour.
3. **Fill**: hachure, cross-hatch, solid. Shown only when the background is not transparent; it is absent in 03-rectangle-tool.png.
4. **Stroke width**: thin, bold, extra bold. Values 1, 2, 4 are [SRC].
5. **Stroke style**: solid, dashed, dotted.
6. **Sloppiness**: architect, artist, cartoonist (roughness 0, 1, 2 [SRC]).
7. **Edges**: sharp, round.
8. **Opacity**: slider 0–100.
9. **Layers**: send to back, send backward, bring forward, bring to front.
10. **Actions**: duplicate, delete, link and so on (cut off at the bottom of the screenshot).

The active option has a light-lavender background (≈`#e0dfff`) with a dark-indigo icon [INF].
The seeded hex values `#ffc9c9` and `#a5d8ff` matched the second and fourth background swatches exactly [OBS].

## 4. Selection visuals [OBS, 02]

- A single selection draws a thin purple (≈`#6965db`) bounding box offset a few pixels outside the shape.
- Eight handles: four corners are shown as small rounded squares, and the edge handles are hidden at this size.
- A rotation handle is drawn as a circle centred above the box.
- The hint text changes to "Enter to add text, Ctrl+↑↓ to create a flowchart".

## 5. Rendering style

- Shapes are sketchy, hand-drawn strokes: doubled, slightly offset lines. Rounded rectangles use roughness 1 [OBS]. The roughjs library is [SRC].
- Text uses a hand-written font, "Excalifont" (fontFamily 5) [OBS rendering, SRC name].
- **Dark theme** [OBS 07/08]: the UI turns dark (≈`#121212` canvas, ≈`#232329` islands). Element colours are *inverted*: pink `#ffc9c9` shows as dark red and light blue shows as dark blue, consistent with a CSS `filter: invert(93%) hue-rotate(180deg)` on the canvas [SRC].

## 6. Responsive behaviour [OBS 07/08, 390×844]

- The toolbar moves to the **bottom**: hand, select, draw, eraser, the current shape (a group), arrow, text and ⋮.
- Picking a shape opens a small popover with rectangle, diamond and ellipse.
- A compact row sits above it: a fill swatch, a stroke swatch and a "sliders" button that opens the properties.
- Undo and redo sit at the bottom right.
- The top-left hamburger and top-right sidebar toggle remain. The zoom controls and Excalidraw+ promo are hidden.
- The main menu becomes a near full-height popover with the same items.

## 7. Menus, dialogs and shortcuts

- **Main menu** [OBS 04]: Open (Ctrl+O), Save to…, Export image… (Ctrl+Shift+E), Live collaboration…, Command palette (Ctrl+/), Find on canvas (Ctrl+F), Help (?), Reset the canvas; external links; Preferences ›; Theme (light, dark, system); Language; Canvas background swatches `#ffffff #f8f9fa #f5faff #fffce8 #fdf8f6` (the hex values are [SRC], the swatch count is [OBS]).
- **Help dialog** [OBS 06], opened with `Shift+?`: a modal about 1200 px wide on a dimmed backdrop, with link buttons (Documentation, Blog, Issue, YouTube) and two shortcut tables.
  - Tools: H, V/1, R/2, D/3, O/4, A/5, L/6, P/7, T/8, N, 9, E/0.
  - Editor: Space+drag or Wheel+drag to move the canvas, Ctrl+Delete reset, Delete, Ctrl+X/C/V, Ctrl+Shift+V paste as plain text, Ctrl+A, Shift+click to add to selection, Ctrl+click deep select, and more.
- **Escape** closes menus and dialogs and clears the selection [OBS: each Escape step returned to the base state in the next screenshot].

## 8. Persistence [OBS, `ev_174f5bc8`, `ev_a573d2be`]

- localStorage keys: `excalidraw` (elements), `excalidraw-state` (appState), `excalidraw-theme`, `i18nextLng`, `version-files`, `version-dataState`.
- Seeding `excalidraw` with a JSON array of elements made the app render them on load. This confirms the elements are stored as a plain JSON array.
- The element fields used are listed in `docs/rea/scenario-desktop.json`.
- No IndexedDB databases were listed during the window. Images are stored elsewhere [SRC: IndexedDB, created lazily].

## 9. Build and runtime [OBS/INF, `ev_e3efb552`]

- Bundle runtime is Vite (medium confidence).
- Entry chunk `index-*.js` is 2.2 MB, plus `roundRect`, `workbox-window` (PWA service worker) and a lazily loaded `mermaid-to-excalidraw` chunk that dynamically imports diagram chunks (dagre, flowDiagram, erDiagram and others).

## 10. Interactions not observable through REA ([SRC] / assumptions)

- **Drawing**: pointer-down to pointer-up creates the shape. Shift keeps proportions or snaps angles. Alt draws from the centre. Afterwards the tool reverts to selection unless the lock (Q) is on.
- **Arrow and line**: drag for two points; clicking adds multi-point segments.
- **Freehand**: pressure-like smoothing (the perfect-freehand library).
- **Selection**: a click on a filled interior, or near the stroke of a transparent shape, selects. Dragging on empty space draws a marquee. Shift+click toggles.
- **Resize**: 8 handles; Shift keeps the aspect ratio.
- **Rotation**: drag the rotation handle.
- **Pan and zoom**: Space+drag, the middle mouse button, wheel to pan, Ctrl+wheel to zoom at the cursor, Ctrl+0 to reset, Shift+1 to zoom to fit.
- **Text**: double-click on the canvas creates a text element through an overlaid textarea editor.
- **Eraser**: drag over elements; they fade, then are deleted on pointer-up.
