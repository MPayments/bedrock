import {
  LoggerToken,
  createConsoleLogger,
  defineProvider,
  type ConsoleLoggerOptions,
  type ConsoleLoggerSink,
  type Logger,
  type Provider,
  type Token,
} from "@bedrock/core";

export { createConsoleLogger, type ConsoleLoggerOptions, type ConsoleLoggerSink };

export function createConsoleLoggerProvider(options: {
  provide?: Token<Logger>;
  config?: ConsoleLoggerOptions;
} = {}): Provider<Logger> {
  return defineProvider({
    provide: options.provide ?? LoggerToken,
    useValue: createConsoleLogger(options.config),
    scope: "singleton",
  });
}
