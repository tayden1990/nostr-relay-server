"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.infoNip11 = void 0;
const nip11_1 = require("../relay/nips/nip11");
const infoNip11 = (req, res) => {
    const nip11Info = (0, nip11_1.getNip11Info)();
    res.json(nip11Info);
};
exports.infoNip11 = infoNip11;
