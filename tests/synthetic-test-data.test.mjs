import assert from "node:assert/strict";
import test from "node:test";
import {
  SYNTHETIC_TEST_THOUGHTS,
  SYNTHETIC_TEST_TOTAL,
  syntheticThoughtId,
} from "../app/lib/synthetic-test-data.ts";

test("approved synthetic dataset keeps all 96 unique thoughts", () => {
  assert.equal(SYNTHETIC_TEST_TOTAL, 96);
  assert.equal(new Set(SYNTHETIC_TEST_THOUGHTS.map((item) => item.number)).size, 96);
  assert.equal(new Set(SYNTHETIC_TEST_THOUGHTS.map((item) => item.content)).size, 96);
  assert.deepEqual(
    [...SYNTHETIC_TEST_THOUGHTS.map((item) => item.number)].sort((a, b) => a - b),
    Array.from({ length: 96 }, (_, index) => index + 1),
  );
});

test("processing order interleaves themes while IDs preserve original numbers", () => {
  assert.deepEqual(
    SYNTHETIC_TEST_THOUGHTS.slice(0, 10).map((item) => item.number),
    [1, 13, 22, 29, 39, 48, 58, 67, 74, 84],
  );
  assert.equal(syntheticThoughtId(7), "synthetic-007");
  assert.equal(syntheticThoughtId(96), "synthetic-096");
});
