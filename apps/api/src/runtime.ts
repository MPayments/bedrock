import { createAppContext, parseEnv } from "./context";

export const env = parseEnv();

export const ctx = createAppContext(env);
