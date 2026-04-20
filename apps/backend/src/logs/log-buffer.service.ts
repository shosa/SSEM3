import { Injectable, ConsoleLogger } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface LogEntry {
  timestamp: string;
  level: string;
  context: string;
  message: string;
}

@Injectable()
export class LogBufferService extends ConsoleLogger {
  private readonly buffer: LogEntry[] = [];
  private readonly maxSize = 500;
  readonly stream$ = new Subject<LogEntry>();

  private push(level: string, message: any, context?: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: context ?? '',
      message: String(message),
    };
    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) this.buffer.shift();
    this.stream$.next(entry);
  }

  override log(message: any, context?: string) {
    super.log(message, context);
    this.push('LOG', message, context);
  }

  override warn(message: any, context?: string) {
    super.warn(message, context);
    this.push('WARN', message, context);
  }

  override error(message: any, trace?: string, context?: string) {
    super.error(message, trace, context);
    this.push('ERROR', message, context);
  }

  override verbose(message: any, context?: string) {
    super.verbose(message, context);
    this.push('VERBOSE', message, context);
  }

  override debug(message: any, context?: string) {
    super.debug(message, context);
    this.push('DEBUG', message, context);
  }

  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }
}
