// services/backend/src/elastic/client.ts
import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";
dotenv.config();

export const esClient = new Client({
  node: process.env.ELASTIC_URL || "http://localhost:9200",
});

/**
 * Ensures the "emails" index exists in Elasticsearch.
 * Creates it with the proper mappings if not found.
 */
export async function ensureEmailIndex(): Promise<void> {
  const indexName = "emails";

  try {
    const existsResponse = await esClient.indices.exists({ index: indexName });
    const exists =
      typeof existsResponse === "boolean"
        ? existsResponse
        : (existsResponse as any).body ?? existsResponse;

    if (!exists) {
      await esClient.indices.create({
        index: indexName,
        mappings: {
          properties: {
            subject: { type: "text" },
            body: { type: "text" },
            accountId: { type: "keyword" },
            folder: { type: "keyword" },
            from: { type: "keyword" },
            to: { type: "keyword" },
            date: { type: "date" },
            aiCategory: { type: "keyword" },
            indexedAt: { type: "date" },
          },
        },
      });
      console.log(`✅ Created Elasticsearch index: ${indexName}`);
    } else {
      console.log(`ℹ️ Index already exists: ${indexName}`);
    }
  } catch (error) {
    console.error("❌ Error ensuring Elasticsearch index:", error);
  }
}

/**
 * Index a single email document in Elasticsearch.
 */
export async function indexEmail(email: any): Promise<void> {
  try {
    await esClient.index({
      index: "emails",
      id: email.id || undefined,
      document: email, // ✅ correct key for ES 8+
    });

    // Optional: refresh index in development for immediate visibility
    await esClient.indices.refresh({ index: "emails" });

    console.log(`📩 Indexed email: ${email.subject || "(no subject)"}`);
  } catch (error) {
    console.error("❌ Error indexing email:", error);
  }
}
