import { createConsoleLogger } from "@bedrock/kernel";

export type Env = {
    DATABASE_URL: string;
    TB_ADDRESS: string;
    TB_CLUSTER_ID: string;
};

export function createAppContext(env: Env) {
    const logger = createConsoleLogger({ service: "bedrock-api" });
    return {
        env,
        logger,
    };
}

export type AppContext = ReturnType<typeof createAppContext>;