import axios from "axios";

const API_BASE = "http://localhost:3000"; // backend URL

export const getEmails = async () => {
  const res = await axios.get(`${API_BASE}/api/emails`);
  return res.data;
};

export const searchEmails = async (query) => {
  const res = await axios.get(`${API_BASE}/api/emails/search`, {
    params: { q: query },
  });
  return res.data;
};
