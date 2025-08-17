import { Event, Filter } from '../../types';

function matchPrefix(value: string, needle: string): boolean {
  return value.startsWith(needle);
}

function matchIdOrAuthor(field: string, arr?: string[]): boolean {
  if (!arr || !arr.length) return true;
  for (const item of arr) {
    const s = String(item);
    if (s.length === 64) {
      if (field === s) return true;
    } else if (matchPrefix(field, s)) {
      return true;
    }
  }
  return false;
}

function matchKinds(kind: number, kinds?: number[]): boolean {
  if (!kinds || !kinds.length) return true;
  return kinds.includes(kind);
}

function matchTime(created_at: number, f: Filter): boolean {
  if (f.since && created_at < f.since) return false;
  if (f.until && created_at > f.until) return false;
  return true;
}

function matchTags(tags: string[][], f: any): boolean {
  const check = (letter: string, values?: string[]) => {
    if (!values || !values.length) return true;
    for (const v of values) {
      const exact = v.length === 64;
      for (const t of tags) {
        if (t[0] !== letter) continue;
        const val = t[1] || '';
        if (exact ? val === v : val.startsWith(v)) return true;
      }
    }
    return false;
  };
  return check('e', (f as any)['#e']) && check('p', (f as any)['#p']);
}

export function eventMatchesFilter(event: Event, filter: any): boolean {
  if (!matchKinds(event.kind, filter.kinds)) return false;
  if (!matchIdOrAuthor(event.id, filter.ids)) return false;
  if (!matchIdOrAuthor(event.pubkey, filter.authors)) return false;
  if (!matchTime(event.created_at, filter)) return false;
  if (!matchTags(event.tags || [], filter)) return false;
  return true;
}
