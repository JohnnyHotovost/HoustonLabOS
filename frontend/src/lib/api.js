import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("hl_token");
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export function fileUrl(url) {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${BACKEND_URL}${url}`;
}

/**
 * Auth-protected file download. Triggers a browser download by fetching
 * the protected file via axios (Authorization header) and using a blob URL.
 */
export async function downloadFile(url, filename) {
    const path = url.startsWith("http") ? url.replace(/^https?:\/\/[^/]+/, "") : url;
    const requestPath = path.startsWith("/api/") ? path.slice(4) : path;
    const r = await api.get(requestPath, { responseType: "blob" });
    const blobUrl = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export default api;
