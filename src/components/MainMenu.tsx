import { useEffect, useRef } from "react";
import type { Theme } from "../types.ts";
import { Icons } from "./icons.tsx";

// Canvas background swatches (REVERSE_ENGINEERING.md §7).
export const CANVAS_BACKGROUNDS = ["#ffffff", "#f8f9fa", "#f5faff", "#fffce8", "#fdf8f6"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: Theme;
  canvasBackground: string;
  onOpen: () => void;
  onSave: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onHelp: () => void;
  onReset: () => void;
  onTheme: (t: Theme) => void;
  onCanvasBackground: (c: string) => void;
}

export function MainMenu(p: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const { open, onOpenChange } = p;
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onOpenChange(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open, onOpenChange]);

  const item = (label: string, Icon: () => JSX.Element, action: () => void, shortcut?: string) => (
    <button
      className="menu-item"
      role="menuitem"
      onClick={() => {
        p.onOpenChange(false);
        action();
      }}
    >
      <Icon />
      <span>{label}</span>
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  );

  return (
    <div className="main-menu" ref={ref}>
      <button className="island icon-btn" aria-label="Main menu" aria-expanded={p.open} data-testid="main-menu-trigger" onClick={() => p.onOpenChange(!p.open)}>
        <Icons.menu />
      </button>
      {p.open && (
        <div className="island dropdown" role="menu">
          {item("Open", Icons.folder, p.onOpen, "Ctrl+O")}
          {item("Save to...", Icons.save, p.onSave, "Ctrl+S")}
          {item("Export PNG", Icons.exportImage, p.onExportPNG, "Ctrl+Shift+E")}
          {item("Export SVG", Icons.exportImage, p.onExportSVG)}
          {item("Help", Icons.help, p.onHelp, "?")}
          {item("Reset the canvas", Icons.trash, p.onReset, "Ctrl+Del")}
          <hr />
          <div className="menu-row">
            <span>Theme</span>
            <div className="segmented">
              <button aria-label="Light theme" aria-pressed={p.theme === "light"} className={p.theme === "light" ? "active" : ""} onClick={() => p.onTheme("light")}>
                <Icons.sun />
              </button>
              <button aria-label="Dark theme" aria-pressed={p.theme === "dark"} className={p.theme === "dark" ? "active" : ""} onClick={() => p.onTheme("dark")}>
                <Icons.moon />
              </button>
            </div>
          </div>
          <div className="menu-label">Canvas background</div>
          <div className="prop-row">
            {CANVAS_BACKGROUNDS.map((c) => (
              <button
                key={c}
                className={`swatch ${p.canvasBackground === c ? "active" : ""}`}
                style={{ background: c }}
                aria-label={`Canvas background ${c}`}
                aria-pressed={p.canvasBackground === c}
                onClick={() => p.onCanvasBackground(c)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
