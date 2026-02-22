import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dirnameFromImportMeta = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(dirnameFromImportMeta, "../../../.env");

dotenv.config({ path: envPath });
