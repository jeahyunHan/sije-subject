import { HttpException } from '@nestjs/common';
import { DOMAIN_ERROR_DEFINITIONS } from './domain-error.catalog';
import { DomainErrorCode, DomainErrorStage } from './domain-error-code';

export type DomainErrorDetails = Record<string, unknown>;

export interface DomainErrorResponse {
  statusCode: number;
  code: DomainErrorCode;
  stage: DomainErrorStage;
  message: string;
  details?: DomainErrorDetails;
}

export class DomainException extends HttpException {
  constructor(
    code: DomainErrorCode,
    details?: DomainErrorDetails,
    message?: string,
  ) {
    const definition = DOMAIN_ERROR_DEFINITIONS[code];
    const response: DomainErrorResponse = {
      statusCode: definition.status,
      code,
      stage: definition.stage,
      message: message ?? definition.message,
      ...(details ? { details } : {}),
    };

    super(response, definition.status);
  }
}

export function domainException(
  code: DomainErrorCode,
  details?: DomainErrorDetails,
  message?: string,
) {
  return new DomainException(code, details, message);
}
