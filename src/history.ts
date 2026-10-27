import type { SceneElement } from "./types.ts";

const LIMIT = 100;

/** Snapshot undo stack. Element arrays are immutable, so snapshots share structure. */
export class History {
  private past: SceneElement[][] = [];
  private future: SceneElement[][] = [];

  record(before: SceneElement[]) {
    this.past.push(before);
    if (this.past.length > LIMIT) this.past.shift();
    this.future = [];
  }

  undo(current: SceneElement[]): SceneElement[] | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(current);
    return prev;
  }

  redo(current: SceneElement[]): SceneElement[] | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(current);
    return next;
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }
}
