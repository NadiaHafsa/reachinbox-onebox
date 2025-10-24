"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// services/backend/src/index.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("./elastic/client");
const ai_1 = require("./ai");
const emails_1 = __importDefault(require("./routes/emails"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const PORT = process.env.PORT || 5000;
const IMAP_SECRET = process.env.IMAP_SYNC_SECRET || "secret";
// ✅ Health check
app.get("/ping", async (_req, res) => {
    try {
        const es = await client_1.esClient.ping();
        res.json({ ok: true, es: !!es });
    }
    catch {
        res.status(500).json({ ok: false, es: false });
    }
});
// Friendly root message to avoid "Cannot GET /" for browser requests
app.get("/", (_req, res) => {
    res.json({
        ok: true,
        message: "ReachInbox backend",
        endpoints: ["/ping", "/api/emails", "/api/emails/search?q=..."],
    });
});
// ✅ Search routes for frontend
app.use("/api/emails", emails_1.default);
// ✅ Ingestion endpoint for IMAP worker
app.post("/internal/new-email", async (req, res) => {
    try {
        const auth = req.headers["x-sync-secret"];
        if (auth !== IMAP_SECRET)
            return res.status(401).json({ error: "unauthorized" });
        const { id, accountId, folder, subject, body, from, to, date } = req.body;
        if (!id || !subject)
            return res.status(400).json({ error: "missing id or subject" });
        const aiCategory = await (0, ai_1.classifyEmail)(`${subject}\n${body || ""}`);
        const doc = {
            id,
            accountId,
            folder: folder || "INBOX",
            subject,
            body: body || "",
            from: from || "",
            to: to || [],
            date: date ? new Date(date) : new Date(),
            aiCategory,
            indexedAt: new Date(),
        };
        // ✅ FIXED: use `document:` (not `body:`) for Elasticsearch v8
        await client_1.esClient.index({
            index: "emails",
            id,
            document: doc,
        });
        // Optional: refresh immediately in dev
        await client_1.esClient.indices.refresh({ index: "emails" });
        // Optional logging for demo
        if (aiCategory === "Interested") {
            console.log("🔥 Interested lead detected:", subject, "from", from);
        }
        return res.json({ ok: true, id, aiCategory });
    }
    catch (err) {
        console.error("❌ Error in /internal/new-email:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
// ✅ Search endpoint
app.get("/api/emails/search", async (req, res) => {
    try {
        const q = req.query.q || "";
        const must = [];
        if (q) {
            must.push({ multi_match: { query: q, fields: ["subject", "body"], fuzziness: "AUTO" } });
        }
        const body = {
            query: { bool: { must } },
            size: 50,
            sort: [{ date: { order: "desc" } }],
        };
        // The elastic client types are strict; cast the search body to `any` to allow our dynamic query
        const r = await client_1.esClient.search({
            index: "emails",
            query: { match_all: {} },
        });
        const hits = r.hits.hits.map((h) => h._source);
        res.json({ ok: true, hits });
    }
    catch (err) {
        console.error("❌ Error searching emails:", err);
        res.status(500).json({ ok: false, error: String(err) });
    }
});
// ✅ Suggest-reply stub
app.post("/api/emails/:id/suggest-reply", async (req, res) => {
    try {
        const id = req.params.id;
        const r = await client_1.esClient.get({ index: "emails", id });
        const src = r._source;
        const suggested = `Hi ${src.from || "there"},\n\nThanks for your message regarding "${src.subject}". I'd be happy to schedule a call — what times work for you this week?\n\nBest,\nYour Name`;
        res.json({ ok: true, suggestion: suggested });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: String(err) });
    }
});
// ✅ Initialize
(async () => {
    await (0, client_1.ensureEmailIndex)();
    app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
})();
