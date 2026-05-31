import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

/**
 * Authentication uses httpOnly cookies set by the backend (`access_token`).
 * `withCredentials: true` ensures the browser sends the cookie on every request.
 * We deliberately DO NOT persist the JWT in localStorage to avoid XSS exfiltration.
 */
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

export default api;
