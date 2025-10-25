import express from 'express';
import { esClient } from '../elastic/client';

const router = express.Router();

router.get('/search', async (req, res) => {
  const q = req.query.q || '';
  try {
   const result = await esClient.search({
  index: "emails",
  body: {
    query: { match_all: {} },
  },
});
res.json(result.body.hits);

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
