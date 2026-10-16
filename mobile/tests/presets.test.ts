import { test } from "node:test";
import assert from "node:assert/strict";
import { presets } from "../src/lib/presets";
import { defaults, validateSettings } from "../src/lib/model";
test("every style fits 64x32 and preserves brightness, coins and content", () => {
  for (const preset of presets) {
    const original = {
      ...defaults,
      brightness: 80,
      coins: [2, 0],
      message: "HOLA",
      mode: "text" as const,
    };
    const next = { ...original, ...preset.settings };
    assert.equal(validateSettings(next), null);
    assert.equal(next.brightness, 80);
    assert.deepEqual(next.coins, [2, 0]);
    assert.equal(next.message, "HOLA");
    assert.equal(next.mode, "text");
    const h = next.font === "compact" ? 10 : 14;
    assert.ok(next.top + h <= next.bottom);
    assert.ok(next.bottom + h <= 32);
  }
});
