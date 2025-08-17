"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nip42Handler = void 0;
const validate_1 = require("../events/validate");
const ingest_1 = require("../events/ingest");
const nip42Handler = async (event) => {
    // Validate the incoming event
    const isValid = (0, validate_1.validateEvent)(event);
    if (!isValid) {
        throw new Error('Invalid event');
    }
    // Ingest the event into the relay
    await (0, ingest_1.ingestEvent)(event);
};
exports.nip42Handler = nip42Handler;
