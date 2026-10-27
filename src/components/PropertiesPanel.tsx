import type { ReactNode } from "react";
import type { ElementStyle } from "../types.ts";
import { Icons, type IconName } from "./icons.tsx";

// Palettes observed on excalidraw.com (REVERSE_ENGINEERING.md §3).
const STROKES = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00"];
const BACKGROUNDS = ["transparent", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99"];
const FONT_SIZES: [number, string][] = [[16, "S"], [20, "M"], [28, "L"], [36, "XL"]];

export type LayerOp = "back" | "backward" | "forward" | "front";

interface Props {
  style: ElementStyle;
  /** Element types the panel applies to (selected elements, or the active tool's type). */
  types: Set<string>;
  hasSelection: boolean;
  onChange: (patch: Partial<ElementStyle>) => void;
  onLayer: (op: LayerOp) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <fieldset className="prop-section">
    <legend>{title}</legend>
    <div className="prop-row">{children}</div>
  </fieldset>
);

function Options<T extends string | number | boolean>({
  value,
  options,
  onPick,
}: {
  value: T;
  options: [T, IconName | string, string][];
  onPick: (v: T) => void;
}) {
  return options.map(([v, icon, label]) => {
    const Icon = Icons[icon as IconName];
    return (
      <button key={String(v)} className={`prop-btn ${value === v ? "active" : ""}`} aria-pressed={value === v} aria-label={label} title={label} onClick={() => onPick(v)}>
        {Icon ? <Icon /> : icon}
      </button>
    );
  });
}

function ColorRow({ value, colors, label, onPick }: { value: string; colors: string[]; label: string; onPick: (c: string) => void }) {
  return (
    <>
      {colors.map((c) => (
        <button
          key={c}
          className={`swatch ${c === "transparent" ? "transparent" : ""} ${value === c ? "active" : ""}`}
          style={c === "transparent" ? undefined : { background: c }}
          aria-label={`${label} ${c}`}
          aria-pressed={value === c}
          onClick={() => onPick(c)}
        />
      ))}
      <span className="swatch-divider" />
      <label className={`swatch current ${value === "transparent" ? "transparent" : ""}`} style={value === "transparent" ? undefined : { background: value }} title={`Custom ${label.toLowerCase()} colour`}>
        <input type="color" value={value === "transparent" ? "#ffffff" : value} onChange={(e) => onPick(e.target.value)} aria-label={`Custom ${label.toLowerCase()} colour`} />
      </label>
    </>
  );
}

export function PropertiesPanel({ style, types, hasSelection, onChange, onLayer, onDuplicate, onDelete }: Props) {
  const onlyText = [...types].every((t) => t === "text");
  const hasFillable = [...types].some((t) => ["rectangle", "ellipse", "diamond"].includes(t));
  const hasStroked = [...types].some((t) => t !== "text" && t !== "image");
  const hasEdges = [...types].some((t) => ["rectangle", "arrow", "line"].includes(t));
  const hasRough = [...types].some((t) => !["text", "image", "freedraw"].includes(t));
  const hasText = types.has("text");
  const hasImageOnly = [...types].every((t) => t === "image");

  return (
    <div className="island properties" role="region" aria-label="Element properties">
      {!hasImageOnly && (
        <Section title={onlyText ? "Text colour" : "Stroke"}>
          <ColorRow value={style.strokeColor} colors={STROKES} label="Stroke" onPick={(strokeColor) => onChange({ strokeColor })} />
        </Section>
      )}
      {hasFillable && (
        <Section title="Background">
          <ColorRow value={style.backgroundColor} colors={BACKGROUNDS} label="Background" onPick={(backgroundColor) => onChange({ backgroundColor })} />
        </Section>
      )}
      {hasFillable && style.backgroundColor !== "transparent" && (
        <Section title="Fill">
          <Options value={style.fillStyle} onPick={(fillStyle) => onChange({ fillStyle })} options={[["hachure", "hachure", "Hachure"], ["cross-hatch", "crossHatch", "Cross-hatch"], ["solid", "solid", "Solid"]]} />
        </Section>
      )}
      {hasStroked && (
        <Section title="Stroke width">
          <Options value={style.strokeWidth} onPick={(strokeWidth) => onChange({ strokeWidth })} options={[[1, "strokeThin", "Thin"], [2, "strokeBold", "Bold"], [4, "strokeExtra", "Extra bold"]]} />
        </Section>
      )}
      {hasRough && (
        <Section title="Stroke style">
          <Options value={style.strokeStyle} onPick={(strokeStyle) => onChange({ strokeStyle })} options={[["solid", "solidLine", "Solid"], ["dashed", "dashedLine", "Dashed"], ["dotted", "dottedLine", "Dotted"]]} />
        </Section>
      )}
      {hasRough && (
        <Section title="Sloppiness">
          <Options value={style.roughness} onPick={(roughness) => onChange({ roughness })} options={[[0, "architect", "Architect"], [1, "artist", "Artist"], [2, "cartoonist", "Cartoonist"]]} />
        </Section>
      )}
      {hasEdges && (
        <Section title="Edges">
          <Options value={style.roundness} onPick={(roundness) => onChange({ roundness })} options={[[false, "sharp", "Sharp"], [true, "round", "Round"]]} />
        </Section>
      )}
      {hasText && (
        <Section title="Font size">
          <Options value={style.fontSize} onPick={(fontSize) => onChange({ fontSize })} options={FONT_SIZES.map(([v, l]) => [v, l, `Font size ${l}`])} />
        </Section>
      )}
      <fieldset className="prop-section">
        <legend>Opacity</legend>
        <input type="range" className="opacity" min={0} max={100} step={10} value={style.opacity} onChange={(e) => onChange({ opacity: Number(e.target.value) })} aria-label="Opacity" title={`${style.opacity}%`} />
        <div className="range-labels">
          <span>0</span>
          <span>100</span>
        </div>
      </fieldset>
      {hasSelection && (
        <>
          <Section title="Layers">
            <button className="prop-btn" onClick={() => onLayer("back")} aria-label="Send to back" title="Send to back — Ctrl+Shift+[">
              <Icons.sendToBack />
            </button>
            <button className="prop-btn" onClick={() => onLayer("backward")} aria-label="Send backward" title="Send backward — Ctrl+[">
              <Icons.sendBackward />
            </button>
            <button className="prop-btn" onClick={() => onLayer("forward")} aria-label="Bring forward" title="Bring forward — Ctrl+]">
              <Icons.bringForward />
            </button>
            <button className="prop-btn" onClick={() => onLayer("front")} aria-label="Bring to front" title="Bring to front — Ctrl+Shift+]">
              <Icons.bringToFront />
            </button>
          </Section>
          <Section title="Actions">
            <button className="prop-btn" onClick={onDuplicate} aria-label="Duplicate" title="Duplicate — Ctrl+D">
              <Icons.duplicate />
            </button>
            <button className="prop-btn" onClick={onDelete} aria-label="Delete" title="Delete">
              <Icons.trash />
            </button>
          </Section>
        </>
      )}
    </div>
  );
}
