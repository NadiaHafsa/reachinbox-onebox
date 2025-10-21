// services/backend/src/ai.ts
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// For demonstration, you can use OpenAI or Gemini
const API_URL = "https://api.openai.com/v1/chat/completions"; // or Gemini endpoint
const API_KEY = process.env.OPENAI_API_KEY; // or GEMINI_API_KEY

export async function classifyEmail(text: string): Promise<string> {
  try {
    const prompt = `
You are an email classifier. 
Categorize the following email into one of the labels:
["Interested", "Meeting Booked", "Not Interested", "Spam", "Out of Office"].
Return only the label.

Email:
${text}
`;

    const response = await axios.post(
      API_URL,
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 10,
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const category = response.data.choices[0].message.content.trim();
    return category;
  } catch (err) {
    console.error("AI classification error:", err);
    return "Uncategorized";
  }
}
