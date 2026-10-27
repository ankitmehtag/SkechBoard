// Assert-based self-check for hit-testing and resize math. Run: npm test
import assert from "node:assert/strict";
import { getBounds, handleAt, hitTest, normalize, resizeBounds, scaleElement } from "../src/geometry.ts";
import type { LinearElement, ShapeElement } from "../src/types.ts";

const style = {
  strokeColor: "#000",
  backgroundColor: "transparent",
  fillStyle: "solid" as const,
  strokeWidth: 2,
  strokeStyle: "solid" as const,
  roughness: 1,
  opacity: 100,
  roundness: false,
  fontSize: 20,
  seed: 1,
  version: 1,
};
const rect: ShapeElement = { ...style, id: "r", type: "rectangle", x: 0, y: 0, width: 100, height: 50 };

// transparent rectangle: outline hits, interior doesn't; filled interior hits
assert.equal(hitTest(rect, [50, 1], 5), true);
assert.equal(hitTest(rect, [50, 25], 5), false);
assert.equal(hitTest({ ...rect, backgroundColor: "#fff" }, [50, 25], 5), true);
assert.equal(hitTest(rect, [200, 200], 5), false);

// ellipse outline
const ell: ShapeElement = { ...rect, type: "ellipse" };
assert.equal(hitTest(ell, [100, 25], 3), true);
assert.equal(hitTest(ell, [50, 25], 3), false);

// line proximity
const line: LinearElement = { ...style, id: "l", type: "line", x: 10, y: 10, width: 100, height: 0, points: [[0, 0], [100, 0]] };
assert.equal(hitTest(line, [60, 12], 3), true);
assert.equal(hitTest(line, [60, 30], 3), false);

// handles
assert.equal(handleAt(getBounds(rect), [104, 54], 4, 6), "se");
assert.equal(handleAt(getBounds(rect), [-4, 25], 4, 6), "w");
assert.equal(handleAt(getBounds(rect), [50, 25], 4, 6), null);

// resize: dragging se corner, free and proportional
assert.deepEqual(resizeBounds({ x1: 0, y1: 0, x2: 100, y2: 50 }, "se", [200, 60], false), { x1: 0, y1: 0, x2: 200, y2: 60 });
assert.deepEqual(resizeBounds({ x1: 0, y1: 0, x2: 100, y2: 50 }, "se", [200, 60], true), { x1: 0, y1: 0, x2: 200, y2: 100 });
// edge handle only moves its own edge
assert.deepEqual(resizeBounds({ x1: 0, y1: 0, x2: 100, y2: 50 }, "n", [999, -10], false), { x1: 0, y1: -10, x2: 100, y2: 50 });

// scale into new bounds, then flip and normalise
const scaled = scaleElement(rect, { x1: 0, y1: 0, x2: 100, y2: 50 }, { x1: 0, y1: 0, x2: 200, y2: 100 });
assert.deepEqual([scaled.x, scaled.y, scaled.width, scaled.height], [0, 0, 200, 100]);
const flipped = normalize({ ...rect, x: 100, width: -100 });
assert.deepEqual([flipped.x, flipped.width], [0, 100]);

// linear normalise rebases points
const nl = normalize({ ...line, points: [[0, 0], [-20, -10]] });
assert.deepEqual([nl.x, nl.y, nl.points], [-10, 0, [[20, 10], [0, 0]]]);

console.log("geometry self-check passed");
