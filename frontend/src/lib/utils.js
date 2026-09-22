import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// FastAPI's validation errors put `detail` as a list of {msg, loc, type, ...}
// objects instead of a string. Passing that straight to toast() or a string
// method (.toLowerCase(), etc.) crashes — this always returns a safe string.
export function getErrorMessage(err, fallback = 'Something went wrong') {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    const joined = detail.map(d => (typeof d === 'string' ? d : d?.msg) || JSON.stringify(d)).join('; ');
    return joined || fallback;
  }
  if (typeof detail === 'string' && detail.trim()) return detail;
  return fallback;
}
