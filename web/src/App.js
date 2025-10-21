import React, { useEffect, useState } from "react";
import { getEmails, searchEmails } from "./api";

function App() {
  const [emails, setEmails] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    try {
      const data = await getEmails();
      setEmails(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return loadEmails();
    const results = await searchEmails(query);
    setEmails(results);
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>📧 Real-Time AI Email Onebox</h2>

      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emails..."
          style={{ padding: "8px", width: "300px" }}
        />
        <button type="submit" style={{ marginLeft: "10px" }}>
          Search
        </button>
      </form>

      <ul style={{ marginTop: "2rem" }}>
        {emails.length === 0 && <p>No emails found.</p>}
        {emails.map((email) => (
          <li key={email.id} style={{ marginBottom: "1rem" }}>
            <strong>{email.subject}</strong>
            <p>{email.body}</p>
            <small>
              From: {email.from} | Category: {email.aiCategory}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
