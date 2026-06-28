import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const bootstrapSource = fs.readFileSync(
  new URL("../public/theme-bootstrap.js", import.meta.url),
  "utf8"
);

test("uses the stable dark default without a stored preference", () => {
  const result = runBootstrap();

  assert.equal(result.dataset.theme, "dark");
  assert.deepEqual(result.classes, ["dark"]);
  assert.equal(result.style.colorScheme, "dark");
});

test("restores an explicit light preference", () => {
  const result = runBootstrap({ storedMode: "light" });

  assert.equal(result.dataset.theme, "light");
  assert.deepEqual(result.classes, ["light"]);
  assert.equal(result.style.colorScheme, "light");
});

test("ignores invalid stored values", () => {
  const result = runBootstrap({ storedMode: "system" });

  assert.equal(result.dataset.theme, "dark");
  assert.deepEqual(result.classes, ["dark"]);
});

test("keeps dark mode when browser storage is unavailable", () => {
  const result = runBootstrap({ storageUnavailable: true });

  assert.equal(result.dataset.theme, "dark");
  assert.deepEqual(result.classes, ["dark"]);
});

function runBootstrap({
  storedMode = null,
  storageUnavailable = false,
} = {}) {
  const classes = new Set();
  const root = {
    classList: {
      toggle(className, force) {
        if (force) {
          classes.add(className);
        } else {
          classes.delete(className);
        }
      },
    },
    dataset: {},
    style: {},
  };
  const localStorage = {
    getItem() {
      if (storageUnavailable) {
        throw new Error("Storage is unavailable.");
      }

      return storedMode;
    },
  };

  vm.runInNewContext(bootstrapSource, {
    document: { documentElement: root },
    window: { localStorage },
  });

  return {
    classes: [...classes].sort(),
    dataset: root.dataset,
    style: root.style,
  };
}
