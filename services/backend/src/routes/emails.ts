import express from 'express';
import { esClient } from '../elastic/client';

const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q) : '';

    // ✅ Proper Elastic 8+ structure
    const result = await esClient.search({
      index: 'emails',
      body: {
        query: q
          ? { multi_match: { query: q, fields: ['subject', 'body']}}
          : {match_all : {}},              
       sort: [{ date: { order: 'desc' } }],
      },
    });

    const emails = result.body.hits.hits.map((hit: any) => hit._source);
    res.json({ ok: true, hits: emails });
  } catch (err: any) {
    console.error('❌ Error performing search:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
