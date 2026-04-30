import { bufferToImageContent, type ImageContent } from "../data-assembly/types";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

export const TRANSPARENT_QR_FALLBACK: ImageContent = bufferToImageContent(
  PNG_BYTES,
  217,
  217,
);
