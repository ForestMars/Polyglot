export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

export interface LogContext {
  [key: string]: any;
}

class Logger {
  private static instance: Logger;
  private level: LogLevel = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
  private serviceName: string = 'app';
  private readonly logLevels: Record<LogLevel, number> = {
    [LogLevel.ERROR]: 0,
    [LogLevel.WARN]: 1,
    [LogLevel.INFO]: 2,
    [LogLevel.DEBUG]: 3,
    [LogLevel.TRACE]: 4
  };

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public setServiceName(name: string): void {
    this.serviceName = name;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] <= this.logLevels[this.level];
  }

  private formatMessage(level: LogLevel, message: string, context: LogContext = {}): string {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(context).length 
      ? ` ${JSON.stringify(context, null, 2)}` 
      : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${this.serviceName}] ${message}${contextStr}`;
  }

  public error(message: string, error?: Error, context: LogContext = {}): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorContext = error ? { 
        ...context, 
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      } : context;
      
      console.error(this.formatMessage(LogLevel.ERROR, message, errorContext));
    }
  }

  public warn(message: string, context: LogContext = {}): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }
  }

  public info(message: string, context: LogContext = {}): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, context));
    }
  }

  public debug(message: string, context: LogContext = {}): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  public trace(message: string, context: LogContext = {}): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      console.trace(this.formatMessage(LogLevel.TRACE, message, context));
    }
  }
}

export const logger = Logger.getInstance();

// Create a scoped logger factory
export const createLogger = (serviceName: string) => {
  const logger = Logger.getInstance();
  logger.setServiceName(serviceName);
  return logger;
};
