import { describe, expect, it } from "vitest";

import { formatGost56042Payload } from "../../src/qr/gost-r-56042";

const VALID_BIC = "044525225";
const VALID_ACC = "40702810400000000001";
const VALID_CORR = "30101810400000000225";

describe("formatGost56042Payload", () => {
  it("emits exact payload for full input", () => {
    const result = formatGost56042Payload({
      name: "ООО Ромашка",
      personalAcc: VALID_ACC,
      bankName: "ПАО Сбербанк",
      bic: VALID_BIC,
      correspAcc: VALID_CORR,
      sum: "1234.50",
      payeeINN: "7707083893",
      kpp: "770701001",
      purpose: "Оплата по счёту №42",
      docNo: "42",
      docDate: "29.04.2026",
    });

    expect(result).toBe(
      [
        "ST00012",
        "Name=ООО Ромашка",
        `PersonalAcc=${VALID_ACC}`,
        "BankName=ПАО Сбербанк",
        `BIC=${VALID_BIC}`,
        `CorrespAcc=${VALID_CORR}`,
        "Sum=123450",
        "PayeeINN=7707083893",
        "KPP=770701001",
        "Purpose=Оплата по счёту №42",
        "DocNo=42",
        "DocDate=29.04.2026",
      ].join("|"),
    );
  });

  it("omits optional keys when undefined", () => {
    const result = formatGost56042Payload({
      name: "ООО Ромашка",
      personalAcc: VALID_ACC,
      bankName: "Сбер",
      bic: VALID_BIC,
      correspAcc: VALID_CORR,
    });

    expect(result).toBe(
      `ST00012|Name=ООО Ромашка|PersonalAcc=${VALID_ACC}|BankName=Сбер|BIC=${VALID_BIC}|CorrespAcc=${VALID_CORR}`,
    );
    expect(result).not.toContain("Sum=");
    expect(result).not.toContain("Purpose=");
    expect(result).not.toContain("PayeeINN=");
  });

  it("includes Sum=0 when sum equals 0", () => {
    const result = formatGost56042Payload({
      name: "Org",
      personalAcc: VALID_ACC,
      bankName: "Bank",
      bic: VALID_BIC,
      correspAcc: VALID_CORR,
      sum: 0,
    });
    expect(result).toContain("|Sum=0");
  });

  it("normalizes string sum with comma to kopecks", () => {
    const result = formatGost56042Payload({
      name: "Org",
      personalAcc: VALID_ACC,
      bankName: "Bank",
      bic: VALID_BIC,
      correspAcc: VALID_CORR,
      sum: "1234,50",
    });
    expect(result).toContain("|Sum=123450");
  });

  it("normalizes numeric fractional sum to kopecks", () => {
    const result = formatGost56042Payload({
      name: "Org",
      personalAcc: VALID_ACC,
      bankName: "Bank",
      bic: VALID_BIC,
      correspAcc: VALID_CORR,
      sum: 1234.5,
    });
    expect(result).toContain("|Sum=123450");
  });

  it("starts with ST00012 prefix", () => {
    const result = formatGost56042Payload({
      name: "X",
      personalAcc: VALID_ACC,
      bankName: "Y",
      bic: VALID_BIC,
      correspAcc: VALID_CORR,
    });
    expect(result.startsWith("ST00012|")).toBe(true);
  });

  it("encodes Cyrillic in UTF-8 (multi-byte)", () => {
    const result = formatGost56042Payload({
      name: "Тест",
      personalAcc: VALID_ACC,
      bankName: "Банк",
      bic: VALID_BIC,
      correspAcc: VALID_CORR,
    });
    expect(Buffer.byteLength(result, "utf-8")).toBeGreaterThan(result.length);
  });

  it("truncates Purpose longer than 210 chars", () => {
    const long = "А".repeat(250);
    const result = formatGost56042Payload({
      name: "X",
      personalAcc: VALID_ACC,
      bankName: "Y",
      bic: VALID_BIC,
      correspAcc: VALID_CORR,
      purpose: long,
    });
    const purposeMatch = /Purpose=([^|]*)/.exec(result);
    expect(purposeMatch).not.toBeNull();
    expect([...(purposeMatch?.[1] ?? "")].length).toBe(210);
  });

  it("strips | and = from values", () => {
    const result = formatGost56042Payload({
      name: "Org|Co=Sub",
      personalAcc: VALID_ACC,
      bankName: "Bank",
      bic: VALID_BIC,
      correspAcc: VALID_CORR,
      purpose: "pay|me=now",
    });
    expect(result).toContain("Name=Org Co Sub");
    expect(result).toContain("Purpose=pay me now");
  });

  it("throws on missing mandatory name", () => {
    expect(() =>
      formatGost56042Payload({
        name: "",
        personalAcc: VALID_ACC,
        bankName: "B",
        bic: VALID_BIC,
        correspAcc: VALID_CORR,
      }),
    ).toThrow(/name is required/);
  });

  it("throws on invalid bic", () => {
    expect(() =>
      formatGost56042Payload({
        name: "X",
        personalAcc: VALID_ACC,
        bankName: "B",
        bic: "123",
        correspAcc: VALID_CORR,
      }),
    ).toThrow(/BIC must be 9 digits/);
  });

  it("throws on non-numeric personalAcc", () => {
    expect(() =>
      formatGost56042Payload({
        name: "X",
        personalAcc: "abc",
        bankName: "B",
        bic: VALID_BIC,
        correspAcc: VALID_CORR,
      }),
    ).toThrow(/PersonalAcc must be 20 digits/);
  });

  it("throws on invalid correspAcc length", () => {
    expect(() =>
      formatGost56042Payload({
        name: "X",
        personalAcc: VALID_ACC,
        bankName: "B",
        bic: VALID_BIC,
        correspAcc: "301",
      }),
    ).toThrow(/CorrespAcc must be 20 digits/);
  });

  it("throws on invalid PayeeINN length", () => {
    expect(() =>
      formatGost56042Payload({
        name: "X",
        personalAcc: VALID_ACC,
        bankName: "B",
        bic: VALID_BIC,
        correspAcc: VALID_CORR,
        payeeINN: "1",
      }),
    ).toThrow(/PayeeINN must be 10 or 12 digits/);
  });

  it("throws on invalid KPP length", () => {
    expect(() =>
      formatGost56042Payload({
        name: "X",
        personalAcc: VALID_ACC,
        bankName: "B",
        bic: VALID_BIC,
        correspAcc: VALID_CORR,
        kpp: "123",
      }),
    ).toThrow(/KPP must be 9 digits/);
  });

  it("throws on negative sum", () => {
    expect(() =>
      formatGost56042Payload({
        name: "X",
        personalAcc: VALID_ACC,
        bankName: "B",
        bic: VALID_BIC,
        correspAcc: VALID_CORR,
        sum: -1,
      }),
    ).toThrow(/non-negative/);
  });

  it("throws on NaN sum", () => {
    expect(() =>
      formatGost56042Payload({
        name: "X",
        personalAcc: VALID_ACC,
        bankName: "B",
        bic: VALID_BIC,
        correspAcc: VALID_CORR,
        sum: "abc",
      }),
    ).toThrow(/not a number/);
  });
});
