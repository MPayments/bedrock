import { promisify } from "node:util";

import * as libre from "libreoffice-convert";

import type { PdfConverterPort } from "../service";

const convertAsync = promisify(libre.convert);

export function createLibreOfficeConvertAdapter(): PdfConverterPort {
  return {
    async convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
      const pdfBuffer = await convertAsync(docxBuffer, ".pdf", undefined);
      return pdfBuffer;
    },
  };
}
