"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.esClient = void 0;
exports.ensureEmailIndex = ensureEmailIndex;
const opensearch_1 = require("@opensearch-project/opensearch");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.esClient = new opensearch_1.Client({
    node: process.env.ELASTIC_URL || 'http://localhost:9200',
    ssl: { rejectUnauthorized: false },
});
async function ensureEmailIndex() {
    const indexName = 'emails';
    try {
        const exists = await exports.esClient.indices.exists({ index: indexName });
        if (!exists.body) {
            await exports.esClient.indices.create({
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
        }
        else {
            console.log('ℹ️ Index already exists:', indexName);
        }
    }
    catch (err) {
        console.error('❌ Error ensuring index:', err);
    }
}
