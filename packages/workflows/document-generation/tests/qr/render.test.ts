import { describe, expect, it } from "vitest";

import { renderGost56042Qr } from "../../src/qr/render";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const SAMPLE_PAYLOAD = "ST00012|Name=Test|PersonalAcc=40702810400000000001|BankName=Bank|BIC=044525225|CorrespAcc=30101810400000000225";

describe("renderGost56042Qr", () => {
  it("returns a Buffer", async () => {
    const buf = await renderGost56042Qr(SAMPLE_PAYLOAD);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("emits a valid PNG signature", async () => {
    const buf = await renderGost56042Qr(SAMPLE_PAYLOAD);
    expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  });

  it("higher error correction yields a larger buffer than lower", async () => {
    const low = await renderGost56042Qr(SAMPLE_PAYLOAD, {
      errorCorrectionLevel: "L",
    });
    const high = await renderGost56042Qr(SAMPLE_PAYLOAD, {
      errorCorrectionLevel: "H",
    });
    expect(high.length).toBeGreaterThan(low.length);
  });
});
