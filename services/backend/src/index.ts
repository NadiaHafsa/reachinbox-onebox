// services/backend/src/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { esClient, ensureEmailIndex } from "./elastic/client";
import { classifyEmail } from "./ai";
import emailRoutes from "./routes/emails";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const IMAP_SECRET = process.env.IMAP_SYNC_SECRET || "secret";

// ✅ Health check
app.get("/ping", async (_req, res) => {
  try {
    const es = await esClient.ping();
    res.json({ ok: true, es: !!es });
  } catch {
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
app.use("/api/emails", emailRoutes);

// ✅ Ingestion endpoint for IMAP worker
app.post("/internal/new-email", async (req, res) => {
  try {
    const auth = req.headers["x-sync-secret"];
    if (auth !== IMAP_SECRET) return res.status(401).json({ error: "unauthorized" });

    const { id, accountId, folder, subject, body, from, to, date } = req.body;
    if (!id || !subject)
      return res.status(400).json({ error: "missing id or subject" });

    const aiCategory = await classifyEmail(`${subject}\n${body || ""}`);

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
    await esClient.index({
      index: "emails",
      id,
      document: doc,
    });

    // Optional: refresh immediately in dev
    await esClient.indices.refresh({ index: "emails" });

    // Optional logging for demo
    if (aiCategory === "Interested") {
      console.log("🔥 Interested lead detected:", subject, "from", from);
    }

    return res.json({ ok: true, id, aiCategory });
  } catch (err) {
    console.error("❌ Error in /internal/new-email:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// ✅ Search endpoint
app.get("/api/emails/search", async (req, res) => {
  try {
    const q = (req.query.q as string) || "";
    const must: any[] = [];
    if (q) {
      must.push({ multi_match: { query: q, fields: ["subject", "body"], fuzziness: "AUTO" } });
    }

    const body = {
      query: { bool: { must } },
      size: 50,
      sort: [{ date: { order: "desc" } }],
    };

  // The elastic client types are strict; cast the search body to `any` to allow our dynamic query
  const r = await esClient.search({ 
    index: "emails", 
    query: {match_all:{}},
   });
    const hits = r.hits.hits.map((h: any) => h._source);
    res.json({ ok: true, hits });
  } catch (err) {
    console.error("❌ Error searching emails:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ✅ Suggest-reply stub
app.post("/api/emails/:id/suggest-reply", async (req, res) => {
  try {
    const id = req.params.id;
    const r = await esClient.get({ index: "emails", id });
    const src = r._source as any;
    const suggested = `Hi ${src.from || "there"},\n\nThanks for your message regarding "${src.subject}". I'd be happy to schedule a call — what times work for you this week?\n\nBest,\nYour Name`;
    res.json({ ok: true, suggestion: suggested });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ✅ Initialize
(async () => {
  await ensureEmailIndex();
  app.get("/", (req, res) => {
  res.send(`
    <h1>🚀 Real-Time Email Onebox Backend</h1>
    <p>Status: <strong>Running</strong></p>
    <p>Try the health check:</p>
    <pre><a href="/ping">/ping</a></pre>
    <p>Or test the API:</p>
    <pre><a href="/api/emails/search?q=">/api/emails/search?q=</a></pre>
  `);
});
app.post("/internal/seed", async (req, res) => {
  try {
    const emails = [
      {
        id: "101",
        accountId: "demo@example.com",
        folder: "INBOX",
        subject: "Interested in your product",
        body: "Hey, I saw your outreach and would like to know more about your service.",
        from: "lead1@gmail.com",
        to: ["demo@example.com"],
        date: new Date(),
        aiCategory: "Interested",
      },
      {
        id: "102",
        accountId: "demo@example.com",
        folder: "INBOX",
        subject: "Out of office reply",
        body: "I am currently out of the office until Monday.",
        from: "user2@gmail.com",
        to: ["demo@example.com"],
        date: new Date(),
        aiCategory: "Out of Office",
      },
      {
        id: "103",
        accountId: "demo@example.com",
        folder: "INBOX",
        subject: "Not interested at this time",
        body: "Appreciate your follow-up, but we’ve decided not to proceed right now.",
        from: "ceo@agency.com",
        to: ["demo@example.com"],
        date: new Date(),
        aiCategory: "Not Interested",
      },
    ];

    for (const email of emails) {
      await esClient.index({
        index: "emails",
        id: email.id,
        document: email,
      });
    }

    await esClient.indices.refresh({ index: "emails" });
    res.json({ ok: true, message: "Seeded sample emails" });
  } catch (err) {
    console.error("❌ Seeding error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

  app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
})();
