import { useEffect, useState } from "react";
import api from "../../lib/api";
import { ImageOff } from "lucide-react";

/**
 * Auth-protected <img> replacement.
 * Fetches via axios (Bearer token + cookie) and renders a blob URL.
 */
export default function AuthImage({ src, alt = "", className = "", ...rest }) {
    const [url, setUrl] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let revoke = null;
        let cancelled = false;
        setError(false);
        setUrl(null);

        if (!src) return;

        // Convert absolute backend URL back to axios path so the interceptor adds auth header.
        const path = src.replace(/^https?:\/\/[^/]+/, "");
        const requestPath = path.startsWith("/api/") ? path.slice(4) : path;

        api.get(requestPath, { responseType: "blob" })
            .then((r) => {
                if (cancelled) return;
                const blobUrl = URL.createObjectURL(r.data);
                revoke = blobUrl;
                setUrl(blobUrl);
            })
            .catch(() => {
                if (!cancelled) setError(true);
            });

        return () => {
            cancelled = true;
            if (revoke) URL.revokeObjectURL(revoke);
        };
    }, [src]);

    if (error) {
        return (
            <div className={`flex items-center justify-center bg-zinc-900 text-zinc-600 ${className}`} {...rest}>
                <ImageOff className="h-6 w-6" />
            </div>
        );
    }
    if (!url) {
        return <div className={`bg-zinc-900 animate-pulse ${className}`} {...rest} />;
    }
    return <img src={url} alt={alt} className={className} {...rest} />;
}
