export type Tool =
  | "selection"
  | "hand"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "freedraw"
  | "text"
  | "image"
  | "eraser";

export type FillStyle = "hachure" | "cross-hatch" | "solid";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type Point = [number, number];

/** Style props shared by every element; also the "current item" defaults in AppState. */
export interface ElementStyle {
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  roundness: boolean;
  fontSize: number;
}

interface BaseElement extends ElementStyle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  seed: number;
  /** Bumped on every change; render cache key. */
  version: number;
}

export interface ShapeElement extends BaseElement {
  type: "rectangle" | "ellipse" | "diamond";
}

/** Points are relative to (x, y). width/height are the points' bounding box. */
export interface LinearElement extends BaseElement {
  type: "arrow" | "line" | "freedraw";
  points: Point[];
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
}

export interface ImageElement extends BaseElement {
  type: "image";
  dataURL: string;
}

export type SceneElement = ShapeElement | LinearElement | TextElement | ImageElement;

export interface Viewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export type Theme = "light" | "dark";
