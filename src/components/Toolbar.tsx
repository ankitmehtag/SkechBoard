import type { Tool } from "../types.ts";
import { Icons } from "./icons.tsx";

export const TOOLS: { tool: Tool; label: string; keys: string[] }[] = [
  { tool: "hand", label: "Hand (panning tool)", keys: ["h"] },
  { tool: "selection", label: "Selection", keys: ["v", "1"] },
  { tool: "rectangle", label: "Rectangle", keys: ["r", "2"] },
  { tool: "diamond", label: "Diamond", keys: ["d", "3"] },
  { tool: "ellipse", label: "Ellipse", keys: ["o", "4"] },
  { tool: "arrow", label: "Arrow", keys: ["a", "5"] },
  { tool: "line", label: "Line", keys: ["l", "6"] },
  { tool: "freedraw", label: "Draw", keys: ["p", "7"] },
  { tool: "text", label: "Text", keys: ["t", "8"] },
  { tool: "image", label: "Insert image", keys: ["9"] },
  { tool: "eraser", label: "Eraser", keys: ["e", "0"] },
];

interface Props {
  tool: Tool;
  locked: boolean;
  onTool: (tool: Tool) => void;
  onToggleLock: () => void;
}

export function Toolbar({ tool, locked, onTool, onToggleLock }: Props) {
  return (
    <div className="island toolbar" role="toolbar" aria-label="Shapes">
      <button
        className={`tool-btn ${locked ? "active" : ""}`}
        aria-pressed={locked}
        aria-label="Keep selected tool active after drawing"
        title="Keep selected tool active after drawing — Q"
        onClick={onToggleLock}
      >
        {locked ? <Icons.lock /> : <Icons.unlock />}
      </button>
      <div className="divider" />
      {TOOLS.map(({ tool: t, label, keys }) => {
        const Icon = Icons[t];
        const hint = keys.map((k) => k.toUpperCase()).join(" or ");
        return (
          <button
            key={t}
            className={`tool-btn ${tool === t ? "active" : ""}`}
            aria-pressed={tool === t}
            aria-label={label}
            title={`${label} — ${hint}`}
            data-testid={`toolbar-${t}`}
            onClick={() => onTool(t)}
          >
            <Icon />
            <span className="tool-key">{keys[0].toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}
