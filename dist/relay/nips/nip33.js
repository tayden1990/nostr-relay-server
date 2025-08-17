"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nip33Handler = void 0;
const validate_1 = require("../events/validate");
const ingest_1 = require("../events/ingest");
const nip33Handler = (event) => {
    // Validate the incoming event
    const isValid = (0, validate_1.validateEvent)(event);
    if (!isValid) {
        throw new Error('Invalid event');
    }
    // Handle the event according to NIP-33 rules by ingesting
    (0, ingest_1.ingestEvent)(event);
};
exports.nip33Handler = nip33Handler;
