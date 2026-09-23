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

export const useDocumentHead = ({ title, description, path }) => {
  useEffect(() => {
    if (title) document.title = title;
    if (description) upsertMeta('description', description);
    if (path) upsertCanonical(`${CANONICAL_ORIGIN}${path}`);
  }, [title, description, path]);
};
