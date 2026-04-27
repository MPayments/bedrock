import { vi, type Mock } from "vitest";

type LoggerMethod = Mock<(...args: unknown[]) => void>;

export interface TestLogger {
  child: Mock<() => TestLogger>;
  debug: LoggerMethod;
  error: LoggerMethod;
  info: LoggerMethod;
  warn: LoggerMethod;
}

export function createTestLogger(): TestLogger {
  const logger: TestLogger = {
    child: vi.fn<() => TestLogger>(),
    debug: vi.fn<(...args: unknown[]) => void>(),
    error: vi.fn<(...args: unknown[]) => void>(),
    info: vi.fn<(...args: unknown[]) => void>(),
    warn: vi.fn<(...args: unknown[]) => void>(),
  };

  logger.child.mockReturnValue(logger);

  return logger;
}
