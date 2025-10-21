// services/backend/src/seed.ts
import { esClient, ensureEmailIndex } from "./elastic/client";

async function seedEmails() {
  await ensureEmailIndex();

  const demoEmails = [
    {
      id: "101",
      accountId: "demo@example.com",
      folder: "INBOX",
      subject: "Interested in your pricing plan",
      body: "Hey team, I reviewed your product and I'm very interested in moving forward. Can we schedule a quick demo?",
      from: "lead@startup.com",
      to: ["demo@example.com"],
      date: new Date(),
      aiCategory: "Interested",
      indexedAt: new Date(),
    },
    {
      id: "102",
      accountId: "demo@example.com",
      folder: "INBOX",
      subject: "Meeting booked for next week",
      body: "Thanks for confirming. Our meeting is booked for Tuesday at 10AM.",
      from: "client@company.com",
      to: ["demo@example.com"],
      date: new Date(),
      aiCategory: "Meeting Booked",
      indexedAt: new Date(),
    },
    {
      id: "103",
      accountId: "demo@example.com",
      folder: "INBOX",
      subject: "Not interested at this time",
      body: "Appreciate your follow-up, but we’ve decided not to proceed right now.",
      from: "ceo@agency.com",
      to: ["demo@example.com"],
      date: new Date(),
      aiCategory: "Not Interested",
      indexedAt: new Date(),
    },
    {
      id: "104",
      accountId: "demo@example.com",
      folder: "INBOX",
      subject: "Out of office reply",
      body: "I'm currently out of office until next Monday. Please reach out to my assistant if urgent.",
      from: "manager@company.com",
      to: ["demo@example.com"],
      date: new Date(),
      aiCategory: "Out of Office",
      indexedAt: new Date(),
    },
    {
      id: "105",
      accountId: "demo@example.com",
      folder: "INBOX",
      subject: "You won’t believe this deal!!!",
      body: "Cheap loans, free vacations, and guaranteed profits! Click now!",
      from: "scammer@spammy.biz",
      to: ["demo@example.com"],
      date: new Date(),
      aiCategory: "Spam",
      indexedAt: new Date(),
    },
  ];

  for (const email of demoEmails) {
    await esClient.index({
      index: "emails",
      id: email.id,
      document: email,
    });
  }

  await esClient.indices.refresh({ index: "emails" });
  console.log("✅ Seeded realistic demo emails successfully!");
}

seedEmails();
