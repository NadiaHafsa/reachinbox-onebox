import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Box,
  Typography,
  TextField,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";

interface Email {
  subject: string;
  from: string;
  aiCategory: string;
  date: string;
  body?: string;
}

const App: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("All");

  const fetchEmails = async () => {
    try {
      setLoading(true);
      console.log("🔍 Fetching from:", `${process.env.REACT_APP_API_URL}/emails/search?q=${query}`);
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/emails/search?q=${query}`);
      const hits = res.data.results || res.data.hits?.hits?.map((h: any) => h._source) || [];
      let filtered = hits;

      if (category !== "All") {
        filtered = hits.filter((email: Email) => email.aiCategory === category);
      }

      setEmails(filtered);
    } catch (err) {
      console.error("❌ Error fetching emails:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  if (emails.length > 0 && category !== "All") {
    const filtered = emails.filter(
      (email) => email.aiCategory === category
    );
    setEmails(filtered);
  } else if (category === "All") {
    fetchEmails();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [category]);


  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      fetchEmails();
    }
  };

  const handleCategoryChange = (e: any) => {
  const newCategory = e.target.value;
  setCategory(newCategory);

  // Re-filter immediately based on selected category
  if (emails.length > 0) {
    if (newCategory === "All") {
      setEmails(emails);
    } else {
      setEmails((prev) =>
        prev.filter((email) => email.aiCategory === newCategory)
      );
    }
  } else {
    // If no emails loaded yet, refetch
    fetchEmails();
  }
};


  return (
    <Box sx={{ p: 4, background: "#f9fafb", minHeight: "100vh" }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        📧 Real-Time Email Onebox
      </Typography>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <TextField
          fullWidth
          label="Search emails..."
          variant="outlined"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearch}
        />

        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>AI Category</InputLabel>
          <Select value={category} label="AI Category" onChange={handleCategoryChange}>
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="Interested">Interested</MenuItem>
            <MenuItem value="Out of Office">Out of Office</MenuItem>
            <MenuItem value="Work">Work</MenuItem>
            <MenuItem value="General">General</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Email List */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        emails.map((email, i) => (
          <Card key={i} sx={{ mb: 2, boxShadow: 2, borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6">{email.subject}</Typography>
              <Typography variant="body2" color="text.secondary">
                From: {email.from}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {email.body?.slice(0, 120)}...
              </Typography>
              <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <Chip label={email.aiCategory || "Uncategorized"} color="primary" variant="outlined" />
                <Typography variant="caption" color="text.secondary">
                  {new Date(email.date).toLocaleString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))
      )}

      {emails.length === 0 && !loading && (
        <Typography color="text.secondary" align="center" sx={{ mt: 6 }}>
          No emails found.
        </Typography>
      )}
    </Box>
  );
};

export default App;
