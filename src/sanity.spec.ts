import { describe, it, expect } from 'vitest';

describe('Sanity Check', () => {
  it('should be true', () => {
    expect(true).toBe(true);
  });

  it('should do basic math', () => {
    expect(1 + 1).toBe(2);
  });
});
