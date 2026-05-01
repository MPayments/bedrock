import QRCode from "qrcode";

export interface GostQrOptions {
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  width?: number;
  margin?: number;
}

export async function renderGost56042Qr(
  payload: string,
  options: GostQrOptions = {},
): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: options.errorCorrectionLevel ?? "M",
    width: options.width ?? 400,
    margin: options.margin ?? 4,
    type: "png",
  });
}
