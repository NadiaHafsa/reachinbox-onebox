import express from "express";
import { esClient } from "../elastic/client.js";

const router = express.Router();

/**
 * Endpoint for IMAP worker to send new emails for indexing.
 */
router.post("/new-email", async (req, res) => {
  try {
    const email = req.body;

    // ✅ Correct Elasticsearch 8.x syntax
    await esClient.index({
      index: "emails",
      document: email,
    });

    // Optional: make immediately searchable in dev
    await esClient.indices.refresh({ index: "emails" });

    console.log(`📩 Indexed new email: ${email.subject || "(no subject)"}`);
    res.json({ ok: true });
  } catch (error: any) {
    console.error("❌ Error indexing new email:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
