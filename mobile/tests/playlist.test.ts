import test from "node:test";
import assert from "node:assert/strict";
import { packQueue } from "../src/lib/playlist";
import { fitClip } from "../src/lib/animation";
import { retryTransfer, uploadQueue } from "../src/lib/upload";
import { ApiError } from "../src/lib/api";
test("queue preserves ordering, exact exposure times and static image bytes", () => {
  const a = fitClip("A", [new Uint8Array(2048).fill(28)], 1);
  const b = fitClip("B", [new Uint8Array(2048).fill(224)], 1);
  const data = packQueue([
    { id: "a", clip: a, seconds: 300 },
    { id: "b", clip: b, seconds: 7 },
  ]);
  assert.equal(new TextDecoder().decode(data.slice(0, 4)), "CBQ1");
  assert.equal(data[4], 2);
  assert.equal(data[5] + 256 * data[6], 300);
  assert.deepEqual(data.slice(7, 7 + a.bytes.length), a.bytes);
  const pos = 7 + a.bytes.length;
  assert.equal(data[pos] + 256 * data[pos + 1], 7);
  assert.deepEqual(data.slice(pos + 2), b.bytes);
  assert.throws(() => packQueue([]));
  assert.throws(() => packQueue([{ id: "a", clip: a, seconds: 301 }]));
  assert.throws(() =>
    packQueue(
      Array.from({ length: 33 }, () => ({ id: "a", clip: a, seconds: 1 })),
    ),
  );
  assert.throws(() =>
    packQueue([
      { id: "a", clip: { ...a, bytes: new Uint8Array(307200) }, seconds: 1 },
    ]),
  );
});
test("transient failures retry; authentication and cancellation do not", async () => {
  let calls = 0;
  assert.equal(
    await retryTransfer(
      async () => {
        if (++calls < 3) throw new Error("offline");
        return 42;
      },
      () => {},
      () => false,
      async () => {},
    ),
    42,
  );
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(
    retryTransfer(
      async () => {
        calls++;
        throw new ApiError(401, "pair");
      },
      () => {},
      () => false,
      async () => {},
    ),
    /pair/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    retryTransfer(
      async () => 42,
      () => {},
      () => true,
      async () => {},
    ),
    /cancelado/,
  );
});
test("lost acknowledgement after an accepted block is retried without advancing twice", async () => {
  const original = global.fetch;
  const data = Uint8Array.from({ length: 1600 }, (_, i) => i % 256);
  let received = 0,
    dropped = false,
    finished = false;
  const written: number[] = [];
  global.fetch = async (url, options) => {
    const path = String(url).split("/api/")[1];
    const body = options?.body ? JSON.parse(String(options.body)) : null;
    let value: unknown = {};
    if (path === "info") value = { animationApi: 2, version: "1.3.0" };
    if (path === "animation/start") value = { upload: "abc", received };
    if (path === "animation/chunk") {
      const bytes = Buffer.from(body.data, "base64");
      if (body.offset === received) {
        written.push(...bytes);
        received += bytes.length;
      } else assert.equal(body.offset + bytes.length, received);
      if (!dropped) {
        dropped = true;
        throw new Error("response lost");
      }
      value = { received };
    }
    if (path === "animation/finish") finished = true;
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await uploadQueue(
      "192.168.1.96:8080",
      "test",
      data,
      () => {},
      () => false,
    );
  } finally {
    global.fetch = original;
  }
  assert.deepEqual(Uint8Array.from(written), data);
  assert.equal(finished, true);
});
