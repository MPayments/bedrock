import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function loadSeedEnv() {
  const dir = dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: resolve(dir, "../../../../.env") });
}
