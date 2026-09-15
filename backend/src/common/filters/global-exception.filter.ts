import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { randomUUID } from 'crypto';

const DEFAULT_CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const traceId = randomUUID();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Unexpected error.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const bodyRecord = body as Record<string, unknown>;
        message = Array.isArray(bodyRecord.message)
          ? (bodyRecord.message as string[]).join(', ')
          : ((bodyRecord.message as string) ?? message);
        code =
          (bodyRecord.code as string) ?? DEFAULT_CODE_BY_STATUS[status] ?? code;
      }

      if (code === 'INTERNAL_SERVER_ERROR' && DEFAULT_CODE_BY_STATUS[status]) {
        code = DEFAULT_CODE_BY_STATUS[status];
      }
    } else if (exception instanceof Error) {
      this.logger.error(`[${traceId}] ${exception.message}`, exception.stack);
    } else {
      this.logger.error(
        `[${traceId}] Unknown exception`,
        JSON.stringify(exception),
      );
    }

    response.status(status).json({
      success: false,
      error: { code, message },
      traceId,
    });
  }
}
