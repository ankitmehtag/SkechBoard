import { sanitizeElements } from "./scene.ts";
import type { SceneElement, Theme, Viewport } from "./types.ts";

// Key names mirror excalidraw.com's localStorage layout (REVERSE_ENGINEERING.md §8), prefixed to avoid clashes.
const KEY_ELEMENTS = "sketchboard";
const KEY_STATE = "sketchboard-state";
const KEY_THEME = "sketchboard-theme";

export interface SavedState {
  viewport: Viewport;
  canvasBackground: string;
}

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const loadScene = (): { elements: SceneElement[]; state: Partial<SavedState>; theme: Theme } => {
  let elements: SceneElement[] = [];
  let state: Partial<SavedState> = {};
  try {
    elements = sanitizeElements(JSON.parse(read(KEY_ELEMENTS) ?? "[]"));
    state = JSON.parse(read(KEY_STATE) ?? "{}") ?? {};
  } catch {
    // corrupt storage: start empty rather than crash
  }
  const theme = read(KEY_THEME) === "dark" ? "dark" : "light";
  return { elements, state, theme };
};

/** Returns false when the write failed (quota exceeded, storage disabled) so the UI can warn. */
export const saveScene = (elements: SceneElement[], state: SavedState, theme: Theme): boolean => {
  try {
    localStorage.setItem(KEY_ELEMENTS, JSON.stringify(elements));
    localStorage.setItem(KEY_STATE, JSON.stringify(state));
    localStorage.setItem(KEY_THEME, theme);
    return true;
  } catch {
    return false;
  }
};
