"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetentionPolicy = void 0;
class RetentionPolicy {
    shouldRetain(_event) { return true; }
    cleanUp(events) { return events; }
}
exports.RetentionPolicy = RetentionPolicy;
