import { describe, it, expect } from 'vitest';
import { add, isPrime } from './math';

describe('Math Utils', () => {
  describe('add', () => {
    it('should add two numbers correctly', () => {
      expect(add(1, 2)).toBe(3);
      expect(add(-1, 1)).toBe(0);
    });
  });

  describe('isPrime', () => {
    it('should return false for numbers <= 1', () => {
      expect(isPrime(1)).toBe(false);
      expect(isPrime(0)).toBe(false);
      expect(isPrime(-5)).toBe(false);
    });

    it('should return true for prime numbers', () => {
      expect(isPrime(2)).toBe(true);
      expect(isPrime(3)).toBe(true);
      expect(isPrime(5)).toBe(true);
      expect(isPrime(7)).toBe(true);
      expect(isPrime(11)).toBe(true);
      expect(isPrime(13)).toBe(true);
    });

    it('should return false for non-prime numbers', () => {
      expect(isPrime(4)).toBe(false);
      expect(isPrime(6)).toBe(false);
      expect(isPrime(8)).toBe(false);
      expect(isPrime(9)).toBe(false);
      expect(isPrime(10)).toBe(false);
    });
  });
});
