import { HttpStatus } from '@nestjs/common';
import { DomainErrorCode, DomainErrorStage } from './domain-error-code';

export interface DomainErrorDefinition {
  status: HttpStatus;
  stage: DomainErrorStage;
  message: string;
}

export const DOMAIN_ERROR_DEFINITIONS: Record<
  DomainErrorCode,
  DomainErrorDefinition
> = {
  [DomainErrorCode.ORDER_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    stage: 'ORDER_READ',
    message: '발주서를 찾을 수 없습니다.',
  },
  [DomainErrorCode.ORDER_ALREADY_EXISTS]: {
    status: HttpStatus.CONFLICT,
    stage: 'ORDER_CREATE',
    message: '이미 존재하는 발주서 관리번호입니다.',
  },
  [DomainErrorCode.ORDER_CREATE_FORBIDDEN]: {
    status: HttpStatus.FORBIDDEN,
    stage: 'ORDER_CREATE',
    message: '주문자만 발주서를 생성할 수 있습니다.',
  },
  [DomainErrorCode.ORDER_CREATE_INVALID_PAYLOAD]: {
    status: HttpStatus.BAD_REQUEST,
    stage: 'ORDER_CREATE',
    message: '발주서 생성 요청 값이 올바르지 않습니다.',
  },
  [DomainErrorCode.ORDER_CONFIRM_FORBIDDEN]: {
    status: HttpStatus.FORBIDDEN,
    stage: 'ORDER_CONFIRM',
    message: '소싱팀만 발주서를 확정할 수 있습니다.',
  },
  [DomainErrorCode.ORDER_CONFIRM_INVALID_STATUS]: {
    status: HttpStatus.CONFLICT,
    stage: 'ORDER_CONFIRM',
    message: '검토 대기 상태의 발주서만 확정할 수 있습니다.',
  },
  [DomainErrorCode.ORDER_NOT_CHANGEABLE]: {
    status: HttpStatus.CONFLICT,
    stage: 'CHANGE_REQUEST_CREATE',
    message: '확정 또는 생산중 상태의 발주서만 변경 요청할 수 있습니다.',
  },
  [DomainErrorCode.ORDER_COMPLETED_NOT_CHANGEABLE]: {
    status: HttpStatus.CONFLICT,
    stage: 'CHANGE_REQUEST_CREATE',
    message: '완료된 발주서는 변경 요청할 수 없습니다.',
  },

  [DomainErrorCode.CHANGE_REQUEST_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    stage: 'CHANGE_REQUEST_REVIEW',
    message: '변경 요청을 찾을 수 없습니다.',
  },
  [DomainErrorCode.CHANGE_REQUEST_CREATE_FORBIDDEN]: {
    status: HttpStatus.FORBIDDEN,
    stage: 'CHANGE_REQUEST_CREATE',
    message: '주문자만 변경 요청을 생성할 수 있습니다.',
  },
  [DomainErrorCode.CHANGE_REQUEST_REVIEW_FORBIDDEN]: {
    status: HttpStatus.FORBIDDEN,
    stage: 'CHANGE_REQUEST_REVIEW',
    message: '소싱팀만 변경 요청을 승인 또는 반려할 수 있습니다.',
  },
  [DomainErrorCode.CHANGE_REQUEST_EMPTY_CHANGES]: {
    status: HttpStatus.BAD_REQUEST,
    stage: 'CHANGE_REQUEST_CREATE',
    message: '변경 항목은 1개 이상이어야 합니다.',
  },
  [DomainErrorCode.CHANGE_REQUEST_INVALID_CHANGES]: {
    status: HttpStatus.BAD_REQUEST,
    stage: 'CHANGE_REQUEST_CREATE',
    message: '변경 항목 값이 올바르지 않습니다.',
  },
  [DomainErrorCode.CHANGE_REQUEST_INVALID_QUERY]: {
    status: HttpStatus.BAD_REQUEST,
    stage: 'CHANGE_REQUEST_REVIEW',
    message: '변경 요청 조회 조건이 올바르지 않습니다.',
  },
  [DomainErrorCode.CHANGE_REQUEST_QUANTITY_NOT_INCREASED]: {
    status: HttpStatus.BAD_REQUEST,
    stage: 'CHANGE_REQUEST_CREATE',
    message: '변경 요청 수량은 현재 수량보다 커야 합니다.',
  },
  [DomainErrorCode.CHANGE_REQUEST_DUE_DATE_TOO_SOON]: {
    status: HttpStatus.BAD_REQUEST,
    stage: 'CHANGE_REQUEST_CREATE',
    message: '변경 요청 납기일은 최소 연장 일수를 만족해야 합니다.',
  },
  [DomainErrorCode.CHANGE_REQUEST_PENDING_EXISTS]: {
    status: HttpStatus.CONFLICT,
    stage: 'CHANGE_REQUEST_CREATE',
    message: '동일 발주서에 대기 중인 변경 요청이 있습니다.',
  },
  [DomainErrorCode.CHANGE_REQUEST_PENDING_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    stage: 'CHANGE_REQUEST_REVIEW',
    message: '해당 발주서에 대기 중인 변경 요청이 없습니다.',
  },
  [DomainErrorCode.CHANGE_REQUEST_NOT_PENDING]: {
    status: HttpStatus.CONFLICT,
    stage: 'CHANGE_REQUEST_REVIEW',
    message: '대기 상태의 변경 요청만 처리할 수 있습니다.',
  },
  [DomainErrorCode.CHANGE_REQUEST_ALREADY_CLOSED]: {
    status: HttpStatus.CONFLICT,
    stage: 'CHANGE_REQUEST_REVIEW',
    message: '이미 승인 또는 반려된 변경 요청입니다.',
  },
  [DomainErrorCode.CHANGE_REQUEST_REVIEW_COMMENT_REQUIRED]: {
    status: HttpStatus.BAD_REQUEST,
    stage: 'CHANGE_REQUEST_REVIEW',
    message: '승인 또는 반려 시 검토 의견은 필수입니다.',
  },

  [DomainErrorCode.ORDER_VERSION_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    stage: 'ORDER_HISTORY_READ',
    message: '요청한 발주서 버전을 찾을 수 없습니다.',
  },
  [DomainErrorCode.ORDER_HISTORY_INVALID_QUERY]: {
    status: HttpStatus.BAD_REQUEST,
    stage: 'ORDER_HISTORY_READ',
    message: '발주서 이력 조회 조건이 올바르지 않습니다.',
  },
  [DomainErrorCode.ORDER_VERSION_AS_OF_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    stage: 'ORDER_HISTORY_READ',
    message: '해당 시점에 유효한 발주서 버전이 없습니다.',
  },
  [DomainErrorCode.ORDER_VERSION_COMPARE_TARGET_NOT_FOUND]: {
    status: HttpStatus.NOT_FOUND,
    stage: 'ORDER_VERSION_COMPARE',
    message: '비교할 발주서 버전을 찾을 수 없습니다.',
  },

  [DomainErrorCode.APPROVAL_TRANSACTION_FAILED]: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    stage: 'APPROVAL_TRANSACTION',
    message:
      '변경 요청 승인 처리 중 오류가 발생하여 모든 변경사항을 롤백했습니다.',
  },
};
