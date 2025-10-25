"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("../elastic/client");
const router = express_1.default.Router();
router.post("/internal/new-email", async (req, res) => {
    try {
        const doc = req.body; // ✅ Fix missing variable
        await client_1.esClient.index({
            index: "emails",
            body: doc,
        });
        res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: String(err) });
    }
});
exports.default = router;
