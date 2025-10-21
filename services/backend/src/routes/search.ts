import express from 'express';
import { esClient } from '../elastic/client';

const router = express.Router();

router.get('/search', async (req, res) => {
  const q = req.query.q || '';
  try {
    const result = await esClient.search({
      index: 'emails',
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: 'q',
                fields: ['subject', 'body', 'from', 'to'],
                fuzziness: 'AUTO',
              },
            },
          ],
        },
      },
    });

    res.json(result.hits);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
