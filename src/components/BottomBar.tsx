import { Icons } from "./icons.tsx";

interface Props {
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  onZoom: (dir: 1 | -1 | 0) => void;
  onUndo: () => void;
  onRedo: () => void;
  onHelp: () => void;
  onToggleProperties?: () => void;
}

export function BottomBar({ zoom, canUndo, canRedo, onZoom, onUndo, onRedo, onHelp, onToggleProperties }: Props) {
  return (
    <div className="bottom-bar" role="region" aria-label="Canvas actions">
      <div className="island group zoom-group">
        <button className="icon-btn" aria-label="Zoom out" title="Zoom out — Ctrl+-" onClick={() => onZoom(-1)}>
          <Icons.minus />
        </button>
        <button className="zoom-value" aria-label="Reset zoom" title="Reset zoom — Ctrl+0" onClick={() => onZoom(0)}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="icon-btn" aria-label="Zoom in" title="Zoom in — Ctrl++" onClick={() => onZoom(1)}>
          <Icons.plus />
        </button>
      </div>
      <div className="island group">
        <button className="icon-btn" aria-label="Undo" title="Undo — Ctrl+Z" disabled={!canUndo} onClick={onUndo}>
          <Icons.undo />
        </button>
        <button className="icon-btn" aria-label="Redo" title="Redo — Ctrl+Shift+Z" disabled={!canRedo} onClick={onRedo}>
          <Icons.redo />
        </button>
      </div>
      {onToggleProperties && (
        <button className="island icon-btn mobile-only" aria-label="Element properties" onClick={onToggleProperties}>
          <Icons.sliders />
        </button>
      )}
      <button className="island icon-btn help-btn" aria-label="Help" title="Help — ?" onClick={onHelp}>
        <Icons.help />
      </button>
    </div>
  );
}
