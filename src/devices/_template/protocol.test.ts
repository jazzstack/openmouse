import assert from "node:assert/strict";
import test from "node:test";

import { buildTemplateReport, decodeTemplateStatus } from "./protocol.ts";

test("buildTemplateReport packs command and payload", () => {
  const report = buildTemplateReport(0x01, new Uint8Array([0x40, 0x1d]));
  assert.equal(report.length, 64);
  assert.equal(report[0], 0x01);
  assert.equal(report[1], 0x40);
  assert.equal(report[2], 0x1d);
});

test("buildTemplateReport rejects oversized payloads", () => {
  assert.throws(() => buildTemplateReport(0x01, new Uint8Array(63)), /too large/);
});

test("decodeTemplateStatus reads little-endian DPI and polling rate", () => {
  const status = decodeTemplateStatus(new Uint8Array([0, 0x40, 0x1d, 8, 0]));
  assert.deepEqual(status, { dpi: 0x1d40, pollingRateHz: 8000 });
});

test("decodeTemplateStatus rejects short reports", () => {
  assert.throws(() => decodeTemplateStatus(new Uint8Array([0, 0])), /Short/);
});
