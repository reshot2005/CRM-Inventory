import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorResponse } from '../types/api-response.type';

interface ValidationErrorBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

interface StructuredErrorBody {
  code?: string;
  message?: string;
  details?: Record<string, string[]>;
}

function isValidationErrorBody(body: unknown): body is ValidationErrorBody {
  return typeof body === 'object' && body !== null && 'message' in body;
}

function isStructuredErrorBody(body: unknown): body is StructuredErrorBody {
  return typeof body === 'object' && body !== null && 'code' in body;
}

function extractValidationDetails(
  messages: string[],
): Record<string, string[]> {
  const details: Record<string, string[]> = {};

  for (const msg of messages) {
    const field = msg.split(' ')[0] ?? 'general';
    if (!details[field]) {
      details[field] = [];
    }
    details[field].push(msg);
  }

  return details;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: number;
    let errorResponse: ApiErrorResponse;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (isStructuredErrorBody(body)) {
        errorResponse = {
          success: false,
          error: {
            code: body.code ?? `HTTP_${status}`,
            message: body.message ?? exception.message,
            ...(body.details ? { details: body.details } : {}),
          },
          timestamp: new Date().toISOString(),
        };
      } else if (isValidationErrorBody(body)) {
        const messages = Array.isArray(body.message)
          ? body.message
          : [body.message ?? exception.message];

        const isValidationError =
          status === HttpStatus.BAD_REQUEST && Array.isArray(body.message);

        errorResponse = {
          success: false,
          error: {
            code: isValidationError ? 'VALIDATION_ERROR' : `HTTP_${status}`,
            message: isValidationError
              ? 'Validation failed'
              : messages[0] ?? exception.message,
            ...(isValidationError
              ? { details: extractValidationDetails(messages) }
              : {}),
          },
          timestamp: new Date().toISOString(),
        };
      } else {
        errorResponse = {
          success: false,
          error: {
            code: `HTTP_${status}`,
            message:
              typeof body === 'string' ? body : exception.message,
          },
          timestamp: new Date().toISOString(),
        };
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;

      const errorMessage =
        exception instanceof Error ? exception.message : 'Unknown error';
      const errorStack =
        exception instanceof Error ? exception.stack : undefined;

      this.logger.error(
        `Unhandled exception: ${errorMessage}`,
        errorStack,
      );

      errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        timestamp: new Date().toISOString(),
      };
    }

    response.status(status).json(errorResponse);
  }
}
