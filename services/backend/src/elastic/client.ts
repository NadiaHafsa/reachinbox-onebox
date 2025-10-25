import { Client } from '@opensearch-project/opensearch';
import dotenv from 'dotenv';
dotenv.config();

export const esClient = new Client({
  node: process.env.ELASTIC_URL || 'http://localhost:9200',
  ssl: { rejectUnauthorized: false },
});

export async function ensureEmailIndex() {
  const indexName = 'emails';
  try {
    const exists = await esClient.indices.exists({ index: indexName });
    if (!exists.body) {
      await esClient.indices.create({
        index: indexName,
        body: {
          mappings: {
            properties: {
              subject: { type: 'text' },
              body: { type: 'text' },
              accountId: { type: 'keyword' },
              folder: { type: 'keyword' },
              from: { type: 'text' },
              to: { type: 'keyword' },
              date: { type: 'date' },
              aiCategory: { type: 'keyword' },
              indexedAt: { type: 'date' },
            },
          },
        },
      });
      console.log('✅ Created OpenSearch index:', indexName);
    } else {
      console.log('ℹ️ Index already exists:', indexName);
    }
  } catch (err) {
    console.error('❌ Error ensuring index:', err);
  }
}
