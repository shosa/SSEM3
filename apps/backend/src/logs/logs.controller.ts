import { Controller, Get, Sse, MessageEvent, Res } from '@nestjs/common';
import { Observable, merge, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';
import { LogBufferService } from './log-buffer.service';

@Controller()
export class LogsController {
  constructor(private readonly logBuffer: LogBufferService) {}

  @Sse('logs')
  streamLogs(@Res() res: Response): Observable<MessageEvent> {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    const history$ = from(this.logBuffer.getBuffer()).pipe(
      map(entry => ({ data: entry } as MessageEvent)),
    );
    const live$ = this.logBuffer.stream$.pipe(
      map(entry => ({ data: entry } as MessageEvent)),
    );
    return merge(history$, live$);
  }
}
