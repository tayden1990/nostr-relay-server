"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEventId = validateEventId;
exports.validateMessageSize = validateMessageSize;
exports.validateFileSize = validateFileSize;
exports.validateStringLength = validateStringLength;
exports.validateJsonFormat = validateJsonFormat;
function validateEventId(eventId) {
    return typeof eventId === 'string' && eventId.length > 0;
}
function validateMessageSize(message, maxSize) {
    return message.length <= maxSize;
}
function validateFileSize(fileSize, maxFileSize) {
    return fileSize <= maxFileSize;
}
function validateStringLength(input, minLength, maxLength) {
    return input.length >= minLength && input.length <= maxLength;
}
function validateJsonFormat(jsonString) {
    try {
        JSON.parse(jsonString);
        return true;
    }
    catch {
        return false;
    }
}
