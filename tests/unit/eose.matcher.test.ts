/// <reference types="jest" />
import { eventMatchesFilter } from '../../src/relay/events/match';

describe('eventMatchesFilter', () => {
  const base = { id: 'x'.repeat(64), kind: 1, pubkey: 'p'.repeat(64), created_at: 1, content: '', tags: [['e','abcd'],['p','pkey1']] };
  it('matches #e exact', () => {
    expect(eventMatchesFilter(base as any, { '#e': ['abcd'] })).toBe(true);
    expect(eventMatchesFilter(base as any, { '#e': ['abce'] })).toBe(false);
  });
  it('matches #e prefix', () => {
    expect(eventMatchesFilter(base as any, { '#e': ['abc'] })).toBe(true);
    expect(eventMatchesFilter(base as any, { '#e': ['abe'] })).toBe(false);
  });
  it('matches authors prefix and ids exact', () => {
    expect(eventMatchesFilter(base as any, { authors: ['p'.repeat(4)] })).toBe(true);
    expect(eventMatchesFilter(base as any, { ids: ['x'.repeat(64)] })).toBe(true);
  });
});
