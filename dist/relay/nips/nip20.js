"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nip20Handler = void 0;
const validate_1 = require("../events/validate");
const ingest_1 = require("../events/ingest");
const nip20Handler = async (event) => {
    // Validate the incoming event
    const isValid = (0, validate_1.validateEvent)(event);
    if (!isValid) {
        throw new Error('Invalid event');
    }
    // Ingest the event (storage + publish)
    await (0, ingest_1.ingestEvent)(event);
};
exports.nip20Handler = nip20Handler;
