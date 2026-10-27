import { useEffect, useRef } from "react";
import { TOOLS } from "./Toolbar.tsx";

const EDITOR_SHORTCUTS: [string, string[][]][] = [
  ["Move canvas", [["Space", "drag"], ["Wheel"]]],
  ["Zoom", [["Ctrl", "Wheel"], ["Ctrl", "+/-"]]],
  ["Reset zoom", [["Ctrl", "0"]]],
  ["Delete", [["Delete"]]],
  ["Cut / Copy / Paste", [["Ctrl", "X / C / V"]]],
  ["Duplicate", [["Ctrl", "D"]]],
  ["Select all", [["Ctrl", "A"]]],
  ["Add element to selection", [["Shift", "click"]]],
  ["Undo", [["Ctrl", "Z"]]],
  ["Redo", [["Ctrl", "Shift", "Z"], ["Ctrl", "Y"]]],
  ["Bring forward / Send backward", [["Ctrl", "] / ["]]],
  ["Keep proportions while resizing", [["Shift", "drag"]]],
  ["Lock tool", [["Q"]]],
  ["Save / Open", [["Ctrl", "S / O"]]],
  ["Export PNG", [["Ctrl", "Shift", "E"]]],
  ["Reset the canvas", [["Ctrl", "Delete"]]],
];

const Keys = ({ combos }: { combos: string[][] }) => (
  <span className="keys">
    {combos.map((combo, i) => (
      <span key={i}>
        {i > 0 && <span className="or">or</span>}
        {combo.map((k) => (
          <kbd key={k}>{k}</kbd>
        ))}
      </span>
    ))}
  </span>
);

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="help-title" tabIndex={-1} ref={ref} onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <div className="modal-header">
          <h2 id="help-title">Help</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <h3>Keyboard shortcuts</h3>
        <div className="shortcut-columns">
          <section>
            <h4>Tools</h4>
            {TOOLS.map((t) => (
              <div className="shortcut" key={t.tool}>
                <span>{t.label}</span>
                <Keys combos={t.keys.map((k) => [k.toUpperCase()])} />
              </div>
            ))}
          </section>
          <section>
            <h4>Editor</h4>
            {EDITOR_SHORTCUTS.map(([label, combos]) => (
              <div className="shortcut" key={label}>
                <span>{label}</span>
                <Keys combos={combos} />
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
