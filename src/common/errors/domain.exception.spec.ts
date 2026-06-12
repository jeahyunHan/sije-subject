import { HttpStatus } from '@nestjs/common';
import { DOMAIN_ERROR_DEFINITIONS } from './domain-error.catalog';
import { DomainErrorCode } from './domain-error-code';
import { DomainException, DomainErrorResponse } from './domain.exception';
import {
  CHANGE_REQUEST_FLOW_ERRORS,
  ORDER_FLOW_ERRORS,
  ORDER_HISTORY_FLOW_ERRORS,
} from './error-flow';

describe('DomainException', () => {
  it('maps every domain error code to a definition', () => {
    const codes = Object.values(DomainErrorCode);

    expect(Object.keys(DOMAIN_ERROR_DEFINITIONS).sort()).toEqual(
      [...codes].sort(),
    );
  });

  it('builds a standard error response from the catalog', () => {
    const exception = new DomainException(
      DomainErrorCode.CHANGE_REQUEST_PENDING_EXISTS,
      { orderNo: 'PO-2025-0001' },
    );
    const response = exception.getResponse() as DomainErrorResponse;

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(response).toEqual({
      statusCode: HttpStatus.CONFLICT,
      code: DomainErrorCode.CHANGE_REQUEST_PENDING_EXISTS,
      stage: 'CHANGE_REQUEST_CREATE',
      message: '동일 발주서에 대기 중인 변경 요청이 있습니다.',
      details: { orderNo: 'PO-2025-0001' },
    });
  });

  it('groups errors by request flow', () => {
    expect(ORDER_FLOW_ERRORS.confirm).toContain(
      DomainErrorCode.ORDER_CONFIRM_INVALID_STATUS,
    );
    expect(CHANGE_REQUEST_FLOW_ERRORS.create).toContain(
      DomainErrorCode.ORDER_COMPLETED_NOT_CHANGEABLE,
    );
    expect(CHANGE_REQUEST_FLOW_ERRORS.create).toContain(
      DomainErrorCode.CHANGE_REQUEST_QUANTITY_NOT_INCREASED,
    );
    expect(CHANGE_REQUEST_FLOW_ERRORS.create).toContain(
      DomainErrorCode.CHANGE_REQUEST_DUE_DATE_TOO_SOON,
    );
    expect(CHANGE_REQUEST_FLOW_ERRORS.approve).toContain(
      DomainErrorCode.APPROVAL_TRANSACTION_FAILED,
    );
    expect(ORDER_HISTORY_FLOW_ERRORS.compareVersions).toContain(
      DomainErrorCode.ORDER_VERSION_COMPARE_TARGET_NOT_FOUND,
    );
  });
});
