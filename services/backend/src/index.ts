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

const PORT = process.env.PORT || 10000;
const IMAP_SECRET = process.env.IMAP_SYNC_SECRET || "secret";

// ✅ Health check
app.get("/ping", async (_req, res) => {
  try {
    const es = await esClient.ping();
    res.json({ ok: true, es: !!es });
  } catch (err) {
    console.error("❌ Ping failed:", err);
    res.status(500).json({ ok: false, es: false });
  }
});

// ✅ Root message
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "ReachInbox backend",
    endpoints: ["/ping", "/internal/seed", "/api/emails/search?q="],
  });
});

// ✅ Attach email routes
app.use("/api/emails", emailRoutes);

// ✅ Endpoint for IMAP sync or manual ingestion
app.post("/internal/new-email", async (req, res) => {
  try {
    const auth = req.headers["x-sync-secret"];
    if (auth !== IMAP_SECRET) {
      return res.status(401).json({ error: "unauthorized" });
    }

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

    await esClient.index({
      index: "emails",
      id,
      body: doc,
    });

    await esClient.indices.refresh({ index: "emails" });

    console.log("📨 Indexed new email:", subject);
    return res.json({ ok: true, id, aiCategory });
  } catch (err) {
    console.error("❌ Error in /internal/new-email:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// ✅ Manual seeding route (for Bonsai/OpenSearch or local ES)
app.post("/internal/seed", async (_req, res) => {
  try {
    const sampleEmails = [
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
        subject: "Meeting Booked for Tomorrow",
        body: "Let's confirm our meeting for 10 AM tomorrow via Zoom.",
        from: "client@company.com",
        to: ["demo@example.com"],
        date: new Date(),
        aiCategory: "Meeting Booked",
      },
      {
        id: "103",
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
        id: "104",
        accountId: "demo@example.com",
        folder: "INBOX",
        subject: "Not interested at this time",
        body: "Appreciate your follow-up, but we’ve decided not to proceed right now.",
        from: "ceo@agency.com",
        to: ["demo@example.com"],
        date: new Date(),
        aiCategory: "Not Interested",
      },
      {
        id: "105",
        accountId: "demo@example.com",
        folder: "INBOX",
        subject: "Spam offer",
        body: "You won’t believe this amazing investment opportunity!!!",
        from: "spammer@scam.com",
        to: ["demo@example.com"],
        date: new Date(),
        aiCategory: "Spam",
      },
    ];

    for (const email of sampleEmails) {
      await esClient.index({
        index: "emails",
        id: email.id,
        body: email,
      });
    }

    await esClient.indices.refresh({ index: "emails" });
    res.json({ ok: true, message: "✅ Seeded 5 sample emails successfully" });
  } catch (err) {
    console.error("❌ Seeding error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ✅ Email search endpoint
app.get("/api/emails/search", async (req, res) => {
  try {
    const q = (req.query.q as string) || "";
    const must: any[] = q
      ? [{ multi_match: { query: q, fields: ["subject", "body", "from", "to"], fuzziness: "AUTO" } }]
      : [];

    const response = await esClient.search({
      index: "emails",
      body: {
        query: { bool: { must } },
        size: 50,
        sort: [{ date: { order: "desc" } }],
      },
    });

    const emails = (response.body.hits.hits || []).map((hit: any) => hit._source);
    res.json({ ok: true, hits: emails });
  } catch (err) {
    console.error("❌ Error searching emails:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ✅ Startup
(async () => {
  await ensureEmailIndex();
  app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
})();
