import { pino } from 'pino';

const fatalLogger = pino();

export const exitOnFatal =
  (message: string) =>
  (error: unknown): never => {
    fatalLogger.fatal({ err: error }, message);
    process.exit(1);
  };

export const exitOnUnhandledErrors = () => {
  process.on('unhandledRejection', exitOnFatal('Unhandled promise rejection'));
  process.on('uncaughtException', exitOnFatal('Uncaught exception'));
};
