import { DomainErrorCode } from './domain-error-code';

export const ORDER_FLOW_ERRORS = {
  create: [
    DomainErrorCode.ORDER_ALREADY_EXISTS,
    DomainErrorCode.ORDER_CREATE_FORBIDDEN,
    DomainErrorCode.ORDER_CREATE_INVALID_PAYLOAD,
  ],
  confirm: [
    DomainErrorCode.ORDER_NOT_FOUND,
    DomainErrorCode.ORDER_CONFIRM_FORBIDDEN,
    DomainErrorCode.ORDER_CONFIRM_INVALID_STATUS,
  ],
  read: [DomainErrorCode.ORDER_NOT_FOUND],
} as const;

export const CHANGE_REQUEST_FLOW_ERRORS = {
  create: [
    DomainErrorCode.ORDER_NOT_FOUND,
    DomainErrorCode.CHANGE_REQUEST_CREATE_FORBIDDEN,
    DomainErrorCode.ORDER_COMPLETED_NOT_CHANGEABLE,
    DomainErrorCode.ORDER_NOT_CHANGEABLE,
    DomainErrorCode.CHANGE_REQUEST_PENDING_EXISTS,
    DomainErrorCode.CHANGE_REQUEST_EMPTY_CHANGES,
    DomainErrorCode.CHANGE_REQUEST_INVALID_CHANGES,
    DomainErrorCode.CHANGE_REQUEST_QUANTITY_NOT_INCREASED,
    DomainErrorCode.CHANGE_REQUEST_DUE_DATE_TOO_SOON,
  ],
  approve: [
    DomainErrorCode.CHANGE_REQUEST_NOT_FOUND,
    DomainErrorCode.CHANGE_REQUEST_PENDING_NOT_FOUND,
    DomainErrorCode.CHANGE_REQUEST_REVIEW_FORBIDDEN,
    DomainErrorCode.CHANGE_REQUEST_NOT_PENDING,
    DomainErrorCode.CHANGE_REQUEST_ALREADY_CLOSED,
    DomainErrorCode.CHANGE_REQUEST_REVIEW_COMMENT_REQUIRED,
    DomainErrorCode.APPROVAL_TRANSACTION_FAILED,
  ],
  reject: [
    DomainErrorCode.CHANGE_REQUEST_NOT_FOUND,
    DomainErrorCode.CHANGE_REQUEST_PENDING_NOT_FOUND,
    DomainErrorCode.CHANGE_REQUEST_REVIEW_FORBIDDEN,
    DomainErrorCode.CHANGE_REQUEST_NOT_PENDING,
    DomainErrorCode.CHANGE_REQUEST_ALREADY_CLOSED,
    DomainErrorCode.CHANGE_REQUEST_REVIEW_COMMENT_REQUIRED,
  ],
  read: [
    DomainErrorCode.CHANGE_REQUEST_NOT_FOUND,
    DomainErrorCode.CHANGE_REQUEST_INVALID_QUERY,
  ],
} as const;

export const ORDER_HISTORY_FLOW_ERRORS = {
  getVersion: [
    DomainErrorCode.ORDER_NOT_FOUND,
    DomainErrorCode.ORDER_VERSION_NOT_FOUND,
  ],
  getAsOf: [
    DomainErrorCode.ORDER_NOT_FOUND,
    DomainErrorCode.ORDER_HISTORY_INVALID_QUERY,
    DomainErrorCode.ORDER_VERSION_AS_OF_NOT_FOUND,
  ],
  compareVersions: [
    DomainErrorCode.ORDER_NOT_FOUND,
    DomainErrorCode.ORDER_VERSION_COMPARE_TARGET_NOT_FOUND,
  ],
} as const;
