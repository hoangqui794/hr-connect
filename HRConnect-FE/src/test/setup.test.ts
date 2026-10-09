import { describe, expect, it } from 'vitest';

describe('MF02 test environment', () => {
  it('provides browser storage and DOM matchers', () => {
    window.localStorage.setItem('mf02-test', 'ready');

    expect(window.localStorage.getItem('mf02-test')).toBe('ready');
    expect(document.body).toBeInTheDocument();
  });
});
