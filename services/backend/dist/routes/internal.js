"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_js_1 = require("../elastic/client.js");
const router = express_1.default.Router();
/**
 * Endpoint for IMAP worker to send new emails for indexing.
 */
router.post("/new-email", async (req, res) => {
    try {
        const email = req.body;
        // ✅ Correct Elasticsearch 8.x syntax
        await client_js_1.esClient.index({
            index: "emails",
            document: email,
        });
        // Optional: make immediately searchable in dev
        await client_js_1.esClient.indices.refresh({ index: "emails" });
        console.log(`📩 Indexed new email: ${email.subject || "(no subject)"}`);
        res.json({ ok: true });
    }
    catch (error) {
        console.error("❌ Error indexing new email:", error);
        res.status(500).json({ ok: false, error: error.message });
    }
});
exports.default = router;
