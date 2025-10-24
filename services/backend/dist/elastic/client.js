"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.esClient = void 0;
exports.ensureEmailIndex = ensureEmailIndex;
exports.indexEmail = indexEmail;
// services/backend/src/elastic/client.ts
const elasticsearch_1 = require("@elastic/elasticsearch");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.esClient = new elasticsearch_1.Client({
    node: process.env.ELASTIC_URL || "http://localhost:9200",
});
/**
 * Ensures the "emails" index exists in Elasticsearch.
 * Creates it with the proper mappings if not found.
 */
async function ensureEmailIndex() {
    const indexName = "emails";
    try {
        const existsResponse = await exports.esClient.indices.exists({ index: indexName });
        const exists = typeof existsResponse === "boolean"
            ? existsResponse
            : existsResponse.body ?? existsResponse;
        if (!exists) {
            await exports.esClient.indices.create({
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
        }
        else {
            console.log(`ℹ️ Index already exists: ${indexName}`);
        }
    }
    catch (error) {
        console.error("❌ Error ensuring Elasticsearch index:", error);
    }
}
/**
 * Index a single email document in Elasticsearch.
 */
async function indexEmail(email) {
    try {
        await exports.esClient.index({
            index: "emails",
            id: email.id || undefined,
            document: email, // ✅ correct key for ES 8+
        });
        // Optional: refresh index in development for immediate visibility
        await exports.esClient.indices.refresh({ index: "emails" });
        console.log(`📩 Indexed email: ${email.subject || "(no subject)"}`);
    }
    catch (error) {
        console.error("❌ Error indexing email:", error);
    }
}
