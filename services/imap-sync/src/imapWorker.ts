// services/imap-sync/src/imapWorker.ts
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import PQueue from 'p-queue';
import pRetry from 'p-retry';

dotenv.config();

const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';
const SYNC_SECRET = process.env.IMAP_SYNC_SECRET || 'supersecret';
const ACCOUNTS_FILE = process.env.ACCOUNTS_JSON || path.resolve(process.cwd(), 'accounts.json');

const queue = new PQueue({ concurrency: 4 }); // limit concurrent indexing requests

type AccountCfg = {
  id: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass?: string;
  // for OAuth add token fields if needed
};

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function postToBackend(emailDoc: any) {
  await axios.post(`${BACKEND}/internal/new-email`, emailDoc, {
    headers: { 'x-sync-secret': SYNC_SECRET, 'content-type': 'application/json' },
    timeout: 10000
  });
}

// Convert ImapFlow message meta + fetched body to your EmailDocument shape
function toEmailDocument(accountId: string, messageUid: number, parsed: any, envelope: any) {
  const messageId = parsed.messageId || envelope?.messageId || parsed.headers?.get('message-id') || `${accountId}-${messageUid}`;
  const from = parsed.from?.text || envelope?.from?.map((f:any)=>f.address).join(',') || '';
  const to = parsed.to?.value?.map((t:any)=>t.address) || envelope?.to?.map((t:any)=>t.address) || [];

  return {
    id: messageId,
    accountId,
    uid: messageUid,
    folder: 'INBOX',
    subject: parsed.subject || envelope?.subject || '',
    body: parsed.text || parsed.html ? parsed.text || parsed.html : '',
    from,
    to,
    date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
    indexedAt: new Date().toISOString()
    // aiCategory: set by backend LLM classifier
  };
}

async function initialSync(client: ImapFlow, accountId: string) {
  // Select INBOX
  await client.mailboxOpen('INBOX');
  const since = daysAgoISO(30); // last 30 days
  // Search using SINCE requires date only (not ISO); ImapFlow supports since as Date
  const dateSince = new Date();
  dateSince.setDate(dateSince.getDate() - 30);

  // Search UIDs
  const searchFilter = ['SINCE', dateSince]; // ImapFlow accepts Date
  const sequence = await client.search(searchFilter);
  console.log(`[${accountId}] initialSync found ${sequence.length} messages in 30d`);

  // For each uid, fetch envelope + body text (plain) in a controlled manner
  for (const uid of sequence) {
    try {
      const { envelope, bodyStructure } = await client.fetchOne(uid, { envelope: true, bodyStructure: true });
      // fetch full body if you want (careful with size); we fetch text only:
      const msg = await client.fetchOne(uid, { source: true }); // returns raw RFC822
      const parsed = await simpleParser(msg.source);
      const doc = toEmailDocument(accountId, uid, parsed, envelope);
      // send to backend with retry (to handle temporary errors)
      await pRetry(() => postToBackend(doc), { retries: 3, factor: 2 });
    } catch (err) {
      console.error(`[${accountId}] initialSync error uid=${uid}`, err);
    }
  }
}

async function handleNewMessage(client: ImapFlow, accountId: string, uid: number) {
  try {
    // fetch raw message
    const msg = await client.fetchOne(uid, { source: true, envelope: true });
    const parsed = await simpleParser(msg.source);
    const doc = toEmailDocument(accountId, uid, parsed, msg.envelope);
    // queue indexing so classification won't block IMAP processing
    await queue.add(() => pRetry(() => postToBackend(doc), { retries: 3 }));
    console.log(`[${accountId}] queued new message uid=${uid} subject="${doc.subject}"`);
  } catch (err) {
    console.error(`[${accountId}] Error handling new message uid=${uid}`, err);
  }
}

async function openConnection(cfg: AccountCfg) {
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
    // optional: socketTimeout etc
  });

  client.on('error', (err) => {
    console.error(`[${cfg.id}] IMAP client error`, err);
  });

  // progressive reconnection is handled below
  await client.connect();

  // initial sync: if mailbox has many messages, you may want to throttle or page
  try {
    await initialSync(client, cfg.id);
  } catch (err) {
    console.error(`[${cfg.id}] initialSync failed`, err);
  }

  // Ensure mailbox open and listen for new messages
  await client.mailboxOpen('INBOX', { readOnly: true });

  // ImapFlow emits 'exists' when new messages arrive
  client.on('exists', async (n) => {
    // 'exists' gives total messages, we need to find the new UID(s). Use mailbox fetch with seq>
    // Simpler: fetch sequence of recent UIDs using search for unseen or since a short time
    try {
      // Search for unseen messages
      const uids = await client.search({ unseen: true });
      for (const uid of uids) {
        // mark as seen? we can index then leave as-is
        await handleNewMessage(client, cfg.id, uid);
      }
    } catch (err) {
      console.error(`[${cfg.id}] exists handler error`, err);
    }
  });

  // Keep alive: ImapFlow handles IDLE automatically; but implement a watchdog to reconnect occasionally
  client.on('close', () => {
    console.warn(`[${cfg.id}] IMAP connection closed`);
  });

  client.on('error', (err) => {
    console.warn(`[${cfg.id}] IMAP Clinet error`,err);
  });

  return client;
}

async function boot() {
  const accountsRaw = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
  const accounts: AccountCfg[] = JSON.parse(accountsRaw);

  const clients: { [id: string]: ImapFlow } = {};

  for (const acc of accounts) {
    // spawn without awaiting to open them in parallel, but add reconnection logic
    (async () => {
      let backoff = 1000;
      while (true) {
        try {
          console.log(`[${acc.id}] connecting to ${acc.host}`);
          const client = await openConnection(acc);
          clients[acc.id] = client;
          console.log(`[${acc.id}] connected and listening`);
          // Block here until the client disconnects (client.disconnect will break out)
          await new Promise<void>((resolve) => {
            client.once('close', () => {
                console.warn(`[${acc.id}] connection closed, will reconnect`);
                resolve();
            });
            client.once('error', (err) => {
                console.error(`[${acc.id}] IMAP client error`, err);
                resolve();
            });
        });

        } catch (err) {
          console.error(`[${acc.id}] connection error:`, err);
        }
        console.log(`[${acc.id}] reconnecting in ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        backoff = Math.min(backoff * 2, 10_000);
      }
    })();
  }

  // optional: expose health endpoint or admin loop
}

if (process.env.TEST_MODE === 'true') {
  // quick fake email generator to test pipeline — posts to backend every 5s
  (async function fakeLoop() {
    let i = 1;
    while (true) {
      const doc = {
        id: `fake-${Date.now()}-${i}`,
        accountId: 'test-fake',
        folder: 'INBOX',
        subject: `Fake email ${i}`,
        body: `This is a fake body ${i}`,
        from: `fake${i}@example.com`,
        to: ['you@example.com'],
        date: new Date().toISOString(),
        indexedAt: new Date().toISOString()
      };
      try {
        await postToBackend(doc);
        console.log('Posted fake email', doc.subject);
      } catch (err) {
        console.error('Fake post error', err);
      }
      i++;
      await new Promise((r) => setTimeout(r, 5000));
    }
  })();
} else {
  boot().catch((e) => { console.error('Fatal', e); process.exit(1); });
}
