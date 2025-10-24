"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("../elastic/client");
const router = express_1.default.Router();
router.get('/search', async (req, res) => {
    try {
        const q = req.query.q ? String(req.query.q) : '';
        // ✅ Proper Elastic 8+ structure
        const result = await client_1.esClient.search({
            index: 'emails',
            query: q
                ? {
                    multi_match: {
                        query: q,
                        fields: ['subject', 'body', 'from', 'to'],
                        fuzziness: 'AUTO',
                    },
                }
                : { match_all: {} },
            sort: [{ date: { order: 'desc' } }],
            size: 50,
        });
        const emails = result.hits.hits.map((hit) => hit._source);
        res.json({ ok: true, results: emails });
    }
    catch (err) {
        console.error('❌ Error performing search:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});
exports.default = router;
