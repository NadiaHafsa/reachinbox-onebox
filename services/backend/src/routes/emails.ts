import express from 'express';
import { esClient } from '../elastic/client';

const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q) : '';

    // ✅ Proper Elastic 8+ structure
    const result = await esClient.search({
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

    const emails = result.hits.hits.map((hit: any) => hit._source);
    res.json({ ok: true, results: emails });
  } catch (err: any) {
    console.error('❌ Error performing search:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
