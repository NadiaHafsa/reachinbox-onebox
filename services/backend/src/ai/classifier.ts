import fetch from 'node-fetch';

export async function categorizeEmail(subject: string, body: string) {
  const prompt = `
  You are an email assistant. Categorize the following email into one of these:
  [Interested, Meeting Booked, Not Interested, Spam, Out of Office].

  Subject: ${subject}
  Body: ${body}

  Reply ONLY with one label.
  `;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + process.env.GEMINI_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  // response.json() has an unknown shape from Gemini/OpenAI — cast to any for safe access
  const data: any = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  // Default fallback
  return text || 'Uncategorized';
}
