import { useEffect } from 'react';

// No react-helmet-async in this project — declarative React Router mode
// (BrowserRouter + Routes, not the data router) has no built-in head
// management, so this sets document.title and upserts the description/
// canonical tags directly rather than adding a dependency for it.
const CANONICAL_ORIGIN = 'https://cardamomspicescentre.com';

const upsertMeta = (name, content) => {
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const upsertCanonical = (href) => {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

// This is an SPA — meta tags set via JS persist across client-side
// navigation unless the next page explicitly changes them. A page that
// doesn't pass `robots` must actively clear any noindex tag a previous
// page left behind, not just skip setting one.
const setRobots = (content) => {
  const el = document.head.querySelector('meta[name="robots"]');
  if (content) {
    if (el) {
      el.setAttribute('content', content);
    } else {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    }
  } else if (el) {
    el.remove();
  }
};

export const useDocumentHead = ({ title, description, path, robots }) => {
  useEffect(() => {
    if (title) document.title = title;
    if (description) upsertMeta('description', description);
    if (path) upsertCanonical(`${CANONICAL_ORIGIN}${path}`);
    setRobots(robots);
  }, [title, description, path, robots]);
};
