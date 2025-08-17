export function validateEventId(eventId: string): boolean {
    return typeof eventId === 'string' && eventId.length > 0;
}

export function validateMessageSize(message: string, maxSize: number): boolean {
    return message.length <= maxSize;
}

export function validateFileSize(fileSize: number, maxFileSize: number): boolean {
    return fileSize <= maxFileSize;
}

export function validateStringLength(input: string, minLength: number, maxLength: number): boolean {
    return input.length >= minLength && input.length <= maxLength;
}

export function validateJsonFormat(jsonString: string): boolean {
    try {
        JSON.parse(jsonString);
        return true;
    } catch {
        return false;
    }
}