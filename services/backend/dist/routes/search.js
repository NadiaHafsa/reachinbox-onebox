"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("../elastic/client");
const router = express_1.default.Router();
router.get('/search', async (req, res) => {
    const q = req.query.q || '';
    try {
        const result = await client_1.esClient.search({
            index: "emails",
            body: {
                query: { match_all: {} },
            },
        });
        res.json(result.body.hits);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
