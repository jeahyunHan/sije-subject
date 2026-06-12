import { REQUEST_POLICY } from './request-policy';

describe('REQUEST_POLICY', () => {
  it('defines the minimum due date extension days', () => {
    expect(REQUEST_POLICY.minDueDateExtensionDays).toBeGreaterThanOrEqual(1);
  });
});
