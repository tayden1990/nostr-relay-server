"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueAuthChallenge = issueAuthChallenge;
exports.handleAuthResponse = handleAuthResponse;
exports.isAuthed = isAuthed;
exports.getAuthedPubkey = getAuthedPubkey;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const authMap = new WeakMap();
function issueAuthChallenge(ws) {
    const challenge = crypto_1.default.randomBytes(16).toString('hex');
    authMap.set(ws, { challenge, authed: false });
    // Server-initiated AUTH challenge per NIP-42
    ws.send(JSON.stringify(["AUTH", challenge]));
    return challenge;
}
async function handleAuthResponse(ws, evt) {
    try {
        const state = authMap.get(ws);
        if (!state)
            return false;
        // Expect kind 22242 event with tags including ["challenge", state.challenge]
        if (!evt || evt.kind !== 22242)
            return false;
        const { verifyEvent } = await Promise.resolve().then(() => __importStar(require('nostr-tools')));
        const ok = verifyEvent(evt);
        if (!ok)
            return false;
        const tags = evt.tags || [];
        const challengeTag = tags.find(t => t[0] === 'challenge');
        if (!challengeTag || challengeTag[1] !== state.challenge)
            return false;
        authMap.set(ws, { ...state, pubkey: evt.pubkey, authed: true });
        (0, logger_1.logInfo)(`AUTH success for ${evt.pubkey}`);
        ws.send(JSON.stringify(["OK", evt.id || "", true, "auth-accepted"]));
        return true;
    }
    catch (e) {
        (0, logger_1.logError)(`AUTH error: ${e?.message || e}`);
        return false;
    }
}
function isAuthed(ws) {
    const state = authMap.get(ws);
    return !!state?.authed;
}
function getAuthedPubkey(ws) {
    return authMap.get(ws)?.pubkey;
}
