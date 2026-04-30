import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/qr/render", () => ({
  renderGost56042Qr: vi.fn(),
}));

import { buildInvoiceQrIfEligible } from "../../src/qr/eligibility";
import { renderGost56042Qr } from "../../src/qr/render";
import { TRANSPARENT_QR_FALLBACK } from "../../src/qr/transparent-fallback";

const renderMock = vi.mocked(renderGost56042Qr);

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
} as any;

const VALID_INPUT = {
  lang: "ru" as const,
  deal: { memo: "Оплата по счёту", invoiceNumber: "42" },
  calculation: { currencyCode: "RUB", totalAmount: "1000" },
  organization: { inn: "7707083893", kpp: "770701001", name: "ООО Ромашка" },
  organizationRequisite: {
    bic: "044525225",
    accountNo: "40702810400000000001",
    corrAccount: "30101810400000000225",
    institutionName: "ПАО Сбербанк",
  },
};

beforeEach(() => {
  renderMock.mockReset();
  renderMock.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  logger.warn.mockReset();
});

describe("buildInvoiceQrIfEligible", () => {
  it("renders QR for valid Russian RUB invoice", async () => {
    const result = await buildInvoiceQrIfEligible(VALID_INPUT, { logger });
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(result).not.toBe(TRANSPARENT_QR_FALLBACK);
    expect(result.format).toBe("image/png");
  });

  it("falls back when lang=en", async () => {
    const result = await buildInvoiceQrIfEligible(
      { ...VALID_INPUT, lang: "en" },
      { logger },
    );
    expect(renderMock).not.toHaveBeenCalled();
    expect(result).toBe(TRANSPARENT_QR_FALLBACK);
  });

  it("falls back when currency is not RUB", async () => {
    const result = await buildInvoiceQrIfEligible(
      {
        ...VALID_INPUT,
        calculation: { ...VALID_INPUT.calculation, currencyCode: "USD" },
      },
      { logger },
    );
    expect(renderMock).not.toHaveBeenCalled();
    expect(result).toBe(TRANSPARENT_QR_FALLBACK);
  });

  it("falls back when bic is missing", async () => {
    const result = await buildInvoiceQrIfEligible(
      {
        ...VALID_INPUT,
        organizationRequisite: {
          ...VALID_INPUT.organizationRequisite,
          bic: null,
        },
      },
      { logger },
    );
    expect(renderMock).not.toHaveBeenCalled();
    expect(result).toBe(TRANSPARENT_QR_FALLBACK);
  });

  it("falls back when bic doesn't start with 04", async () => {
    const result = await buildInvoiceQrIfEligible(
      {
        ...VALID_INPUT,
        organizationRequisite: {
          ...VALID_INPUT.organizationRequisite,
          bic: "000000000",
        },
      },
      { logger },
    );
    expect(renderMock).not.toHaveBeenCalled();
    expect(result).toBe(TRANSPARENT_QR_FALLBACK);
  });

  it("falls back when accountNo is not 20 digits", async () => {
    const result = await buildInvoiceQrIfEligible(
      {
        ...VALID_INPUT,
        organizationRequisite: {
          ...VALID_INPUT.organizationRequisite,
          accountNo: "1234567890",
        },
      },
      { logger },
    );
    expect(renderMock).not.toHaveBeenCalled();
    expect(result).toBe(TRANSPARENT_QR_FALLBACK);
  });

  it("falls back when corrAccount is missing", async () => {
    const result = await buildInvoiceQrIfEligible(
      {
        ...VALID_INPUT,
        organizationRequisite: {
          ...VALID_INPUT.organizationRequisite,
          corrAccount: null,
        },
      },
      { logger },
    );
    expect(renderMock).not.toHaveBeenCalled();
    expect(result).toBe(TRANSPARENT_QR_FALLBACK);
  });

  it("falls back when inn is missing", async () => {
    const result = await buildInvoiceQrIfEligible(
      {
        ...VALID_INPUT,
        organization: { ...VALID_INPUT.organization, inn: null },
      },
      { logger },
    );
    expect(renderMock).not.toHaveBeenCalled();
    expect(result).toBe(TRANSPARENT_QR_FALLBACK);
  });

  it("falls back when inn is invalid length", async () => {
    const result = await buildInvoiceQrIfEligible(
      {
        ...VALID_INPUT,
        organization: { ...VALID_INPUT.organization, inn: "1" },
      },
      { logger },
    );
    expect(renderMock).not.toHaveBeenCalled();
    expect(result).toBe(TRANSPARENT_QR_FALLBACK);
  });

  it("falls back and logs warn when render throws", async () => {
    renderMock.mockRejectedValueOnce(new Error("boom"));
    const result = await buildInvoiceQrIfEligible(VALID_INPUT, { logger });
    expect(result).toBe(TRANSPARENT_QR_FALLBACK);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
