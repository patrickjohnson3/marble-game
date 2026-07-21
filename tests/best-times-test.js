import assert from "node:assert/strict";
import {
  bestTimeLabel,
  formatRunTime,
  loadBestTime,
  recordBestTime,
} from "../core/best-times.js";

function storageWith(value = null) {
  return {
    value,
    getItem() {
      return this.value;
    },
    setItem(_key, nextValue) {
      this.value = nextValue;
    },
  };
}

assert.equal(formatRunTime(null), "--");
assert.equal(formatRunTime(12345), "12.3s");
assert.equal(bestTimeLabel(null), "best --");

const storage = storageWith();

assert.equal(loadBestTime(storage, "level-1"), null);
assert.equal(recordBestTime(storage, "level-1", 12000), 12000);
assert.equal(loadBestTime(storage, "level-1"), 12000);
assert.equal(recordBestTime(storage, "level-1", 15000), 12000);
assert.equal(recordBestTime(storage, "level-1", 9000), 9000);
assert.equal(loadBestTime(storage, "level-1"), 9000);

console.log("Best time tests passed.");
