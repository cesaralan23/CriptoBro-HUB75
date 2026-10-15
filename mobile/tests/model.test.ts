import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  localAddress,
  validateSettings,
  demoQuotes,
} from "../src/lib/model";
import { SerialQueue } from "../src/lib/api";
import { frame } from "../src/lib/render";
test("only local IPv4 endpoints can receive a pairing token", () => {
  assert.equal(localAddress("192.168.1.96"), "192.168.1.96:8080");
  assert.equal(localAddress("http://10.0.0.2:8081/"), "10.0.0.2:8081");
  for (const ip of [
    "8.8.8.8",
    "192.168.1.999",
    "172.32.0.1",
    "example.com",
    "192.168.1.1:99999",
    "http://192.168.1.1/evil",
  ])
    assert.throws(() => localAddress(ip));
});
test("reject dangerous brightness, overflowing text, invalid coins and unsupported glyphs", () => {
  assert.equal(validateSettings(defaults), null);
  for (const update of [
    { brightness: 81 },
    { brightness: -1 },
    { coins: [] },
    { coins: [0, 0] },
    { font: "classic", bottom: 20 },
    { inset: 3 },
    { message: "Ñ" },
    { priceColor: "bad" },
    { interval: 0 },
  ])
    assert.ok(validateSettings({ ...defaults, ...update } as typeof defaults));
});
test("serialized writes preserve order after a failed network request", async () => {
  const queue = new SerialQueue(),
    order: number[] = [];
  const a = queue.run(async () => {
    await new Promise((r) => setTimeout(r, 20));
    order.push(1);
    throw new Error("offline");
  });
  const b = queue.run(async () => {
    order.push(2);
    return "saved";
  });
  await assert.rejects(a);
  assert.equal(await b, "saved");
  assert.deepEqual(order, [1, 2]);
});
test("preview preserves margins and has only complete 2x2 text blocks", () => {
  const p = frame({ ...defaults, showLogo: false }, demoQuotes[0], 0, 2);
  assert.equal(p.length, 64 * 32);
  for (let y = 0; y < 32; y++)
    for (const x of [0, 1, 62, 63]) assert.equal(p[y * 64 + x], "000000");
  for (let y = 0; y < 32; y += 2)
    for (let x = 0; x < 64; x += 2) {
      const c = p[y * 64 + x];
      assert.equal(p[y * 64 + x + 1], c);
      assert.equal(p[(y + 1) * 64 + x], c);
      assert.equal(p[(y + 1) * 64 + x + 1], c);
    }
});
test("logo follows carousel position instead of covering a fixed viewport", () => {
  const s = { ...defaults, mode: "text" as const, message: "", coins: [0] };
  const a = frame(s, demoQuotes[0], 0, 2),
    b = frame(s, demoQuotes[0], 0, 22);
  assert.ok(a[16 * 64 + 10] !== "000000");
  assert.equal(b[16 * 64 + 10], "000000");
  assert.ok(b[16 * 64 + 30] !== "000000");
});
