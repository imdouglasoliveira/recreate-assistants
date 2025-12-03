import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel = 'info';
  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.log(chalk.gray(`[DEBUG] ${message}`), data || '');
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.log(chalk.blue(`[INFO] ${message}`), data || '');
    }
  }

  success(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.log(chalk.green(`[SUCCESS] ${message}`), data || '');
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(chalk.yellow(`[WARN] ${message}`), data || '');
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog('error')) {
      console.error(chalk.red(`[ERROR] ${message}`), error || '');
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }
}

export const logger = new Logger();
