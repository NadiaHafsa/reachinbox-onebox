import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

interface Email {
  id: string;
  subject: string;
  from: string;
  body: string;
  aiCategory: string;
  date: string;
}

const App: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [query, setQuery] = useState("");

  // Fetch emails from backend
  const fetchEmails = async () => {
    try {
      const url = `${process.env.REACT_APP_API_URL}/emails/search?q=${query}`;
      console.log("🔍 Fetching from:", url);
      const res = await axios.get(url);

      // ✅ backend returns { ok: true, hits: [...] }
      const data = res.data?.hits || [];
      console.log("📨 Emails fetched:", data);

      setEmails(data);
    } catch (err) {
      console.error("❌ Error fetching emails:", err);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [query]);

  return (
    <div className="app">
      <header>
        <h1>📬 Real-Time Email Onebox</h1>
        <input
          type="text"
          placeholder="Search emails..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      <main>
        {emails.length === 0 ? (
          <p className="empty">No emails found.</p>
        ) : (
          <ul>
            {emails.map((email) => (
              <li key={email.id} className="email-item">
                <div className="email-header">
                  <strong>{email.subject}</strong>
                  <span className={`tag ${email.aiCategory?.toLowerCase()}`}>
                    {email.aiCategory}
                  </span>
                </div>
                <p className="from">From: {email.from}</p>
                <p className="body">{email.body}</p>
                <small className="date">
                  {new Date(email.date).toLocaleString()}
                </small>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

export default App;
