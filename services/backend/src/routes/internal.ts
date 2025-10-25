import express from "express";
import { esClient } from "../elastic/client";
const router = express.Router();

router.post("/internal/new-email", async (req, res) => {
  try {
    const doc = req.body; // ✅ Fix missing variable
    await esClient.index({
      index: "emails",
      body: doc,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
