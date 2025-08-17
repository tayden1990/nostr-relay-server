"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventMatchesFilter = eventMatchesFilter;
function matchPrefix(value, needle) {
    return value.startsWith(needle);
}
function matchIdOrAuthor(field, arr) {
    if (!arr || !arr.length)
        return true;
    for (const item of arr) {
        const s = String(item);
        if (s.length === 64) {
            if (field === s)
                return true;
        }
        else if (matchPrefix(field, s)) {
            return true;
        }
    }
    return false;
}
function matchKinds(kind, kinds) {
    if (!kinds || !kinds.length)
        return true;
    return kinds.includes(kind);
}
function matchTime(created_at, f) {
    if (f.since && created_at < f.since)
        return false;
    if (f.until && created_at > f.until)
        return false;
    return true;
}
function matchTags(tags, f) {
    const check = (letter, values) => {
        if (!values || !values.length)
            return true;
        for (const v of values) {
            const exact = v.length === 64;
            for (const t of tags) {
                if (t[0] !== letter)
                    continue;
                const val = t[1] || '';
                if (exact ? val === v : val.startsWith(v))
                    return true;
            }
        }
        return false;
    };
    return check('e', f['#e']) && check('p', f['#p']);
}
function eventMatchesFilter(event, filter) {
    if (!matchKinds(event.kind, filter.kinds))
        return false;
    if (!matchIdOrAuthor(event.id, filter.ids))
        return false;
    if (!matchIdOrAuthor(event.pubkey, filter.authors))
        return false;
    if (!matchTime(event.created_at, filter))
        return false;
    if (!matchTags(event.tags || [], filter))
        return false;
    return true;
}
