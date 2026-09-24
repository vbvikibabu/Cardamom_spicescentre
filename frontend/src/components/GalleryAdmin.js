import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Star, ChevronUp, ChevronDown, Eye, EyeOff, Trash2, Pencil, Upload, Play } from 'lucide-react';
import { getErrorMessage } from '../lib/utils';
import { GALLERY_CATEGORIES } from '@/lib/gallery';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const ACCEPT_STRING = '.jpg,.jpeg,.png,.webp,.mp4,.mov';
const INPUT = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white';
const ICON_BTN = 'w-9 h-9 inline-flex items-center justify-center rounded-lg border border-border bg-white text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed';

const MAX_BATCH = 10;
const BLANK_FORM = { files: [], category: 'sourcing', caption: '', alt_text: '', featured: false };

const GalleryAdmin = ({ token }) => {
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK_FORM);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [editing, setEditing] = useState(null); // { id, category, caption, alt_text }

  const load = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/gallery`, authHeaders);
      setItems(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load gallery'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const multiple = form.files.length > 1;
  const isVideoFile = form.files.length === 1 && form.files[0].type.startsWith('video/');

  const onFileChange = (e) => {
    let files = Array.from(e.target.files || []);
    if (files.length > MAX_BATCH) {
      toast.error(`Up to ${MAX_BATCH} files at a time — using the first ${MAX_BATCH}.`);
      files = files.slice(0, MAX_BATCH);
    }
    // Caption, alt text and featured only make sense for a single file.
    setForm((f) => ({
      ...f,
      files,
      ...(files.length > 1 ? { caption: '', alt_text: '', featured: false } : {}),
      ...(files.length === 1 && files[0].type.startsWith('video/') ? { featured: false } : {}),
    }));
  };

  const upload = async (e) => {
    e.preventDefault();
    const formEl = e.target;
    if (form.files.length === 0) { toast.error('Choose at least one photo or video.'); return; }
    setUploading(true);
    let done = 0;
    const failed = [];
    for (const file of form.files) {
      setProgress(`Uploading ${done + failed.length + 1} of ${form.files.length}…`);
      const body = new FormData();
      body.append('file', file);
      body.append('category', form.category);
      body.append('caption', multiple ? '' : form.caption);
      body.append('alt_text', multiple ? '' : form.alt_text);
      body.append('featured', !multiple && form.featured && !isVideoFile ? 'true' : 'false');
      try {
        await axios.post(`${API_URL}/api/admin/gallery`, body, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        done += 1;
      } catch (err) {
        failed.push(`${file.name}: ${getErrorMessage(err, 'failed')}`);
      }
    }
    setUploading(false);
    setProgress('');
    if (done) toast.success(`${done} added to gallery${multiple ? ' — use Edit to add captions' : ''}`);
    failed.forEach((m) => toast.error(m));
    // Reset even after a partial failure so a retry doesn't re-upload the files that succeeded.
    setForm({ ...BLANK_FORM, category: form.category });
    formEl.reset();
    await load();
  };

  const call = async (fn, okMsg) => {
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Something went wrong'));
    }
  };

  const toggleFeatured = (item) =>
    call(() => axios.put(`${API_URL}/api/admin/gallery/${item.id}/featured`, { value: !item.featured }, authHeaders));

  const toggleActive = (item) =>
    call(() => axios.put(`${API_URL}/api/admin/gallery/${item.id}/active`, { value: !item.active }, authHeaders));

  const remove = (item) => {
    if (!window.confirm('Delete this item permanently?')) return;
    call(() => axios.delete(`${API_URL}/api/admin/gallery/${item.id}`, authHeaders), 'Deleted');
  };

  const move = (category, index, delta) => {
    const ids = items.filter((i) => i.category === category).map((i) => i.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    call(() => axios.post(`${API_URL}/api/admin/gallery/reorder`, { category, ids }, authHeaders));
  };

  const saveEdit = (e) => {
    e.preventDefault();
    const { id, category, caption, alt_text } = editing;
    call(async () => {
      await axios.put(`${API_URL}/api/admin/gallery/${id}`, { category, caption, alt_text }, authHeaders);
      setEditing(null);
    }, 'Saved');
  };

  if (loading) {
    return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* ── Upload ── */}
      <form onSubmit={upload} className="border border-primary rounded-xl p-4 md:p-6 bg-primary/5 space-y-4">
        <h3 className="font-semibold text-foreground">Add photo or video</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Files * (JPG, PNG, WEBP, MP4, MOV — max 50MB each, up to 10 at a time)</label>
            <input type="file" multiple accept={ACCEPT_STRING} onChange={onFileChange} className={INPUT} data-testid="gallery-file-input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Category *</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={INPUT} data-testid="gallery-category-input">
              {GALLERY_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          {multiple && (
            <p className="md:col-span-2 text-xs text-muted-foreground">
              {form.files.length} files selected. They all go into the same category; add captions and alt text afterwards with the Edit button.
            </p>
          )}
          {!multiple && (<>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Caption</label>
            <input type="text" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} className={INPUT} data-testid="gallery-caption-input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Alt text</label>
            <input type="text" value={form.alt_text} onChange={(e) => setForm({ ...form, alt_text: e.target.value })} className={INPUT} data-testid="gallery-alt-input" />
            <p className="text-[11px] text-muted-foreground mt-1">
              Alt text is used by Google Images and screen readers. If left blank, the caption is used instead.
            </p>
          </div>
          </>)}
        </div>
        <label className={`flex items-center gap-2 text-sm ${isVideoFile ? 'text-muted-foreground' : 'text-foreground'}`}>
          <input
            type="checkbox"
            checked={form.featured && !isVideoFile && !multiple}
            disabled={isVideoFile || multiple}
            onChange={(e) => setForm({ ...form, featured: e.target.checked })}
          />
          Feature this photo in the home page strip {isVideoFile && '(photos only)'}{multiple && '(single uploads only — use the star afterwards)'}
        </label>
        <button type="submit" disabled={uploading} className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 w-full md:w-auto">
          <Upload size={16} /> {uploading ? progress : (form.files.length > 1 ? `Upload ${form.files.length} files` : 'Upload')}
        </button>
      </form>

      {/* ── Grid grouped by category ── */}
      {GALLERY_CATEGORIES.map((cat) => {
        const list = items.filter((i) => i.category === cat.key);
        return (
          <div key={cat.key}>
            <h3 className="font-semibold text-foreground mb-3">{cat.label} <span className="text-muted-foreground font-normal text-sm">({list.length})</span></h3>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing here yet.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {list.map((item, index) => (
                  <div key={item.id} className={`rounded-xl border overflow-hidden bg-white ${item.active ? 'border-border' : 'border-dashed border-border opacity-60'}`}>
                    <div className="relative aspect-square bg-muted">
                      <img src={item.media_type === 'video' ? item.poster_url : item.media_url} alt={item.alt_text || item.caption || ''} loading="lazy" className="w-full h-full object-cover" />
                      {item.media_type === 'video' && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="bg-black/55 text-white rounded-full p-2"><Play size={18} fill="currentColor" /></span>
                        </span>
                      )}
                      {item.featured && (
                        <span className="absolute top-2 left-2 bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"><Star size={10} fill="currentColor" /> Featured</span>
                      )}
                      {!item.active && (
                        <span className="absolute top-2 right-2 bg-gray-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Hidden</span>
                      )}
                    </div>
                    <div className="p-2 space-y-2">
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{item.caption || 'No caption'}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" className={ICON_BTN} aria-label="Move earlier" disabled={index === 0} onClick={() => move(cat.key, index, -1)}><ChevronUp size={16} /></button>
                        <button type="button" className={ICON_BTN} aria-label="Move later" disabled={index === list.length - 1} onClick={() => move(cat.key, index, 1)}><ChevronDown size={16} /></button>
                        <button type="button" className={ICON_BTN} aria-label={item.featured ? 'Remove featured' : 'Set featured'} title={item.media_type === 'video' ? 'Only photos can be featured' : 'Featured'} disabled={item.media_type === 'video' || (!item.active && !item.featured)} onClick={() => toggleFeatured(item)}>
                          <Star size={16} className={item.featured ? 'text-yellow-500' : ''} fill={item.featured ? 'currentColor' : 'none'} />
                        </button>
                        <button type="button" className={ICON_BTN} aria-label={item.active ? 'Hide' : 'Show'} onClick={() => toggleActive(item)}>{item.active ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                        <button type="button" className={ICON_BTN} aria-label="Edit" onClick={() => setEditing({ id: item.id, category: item.category, caption: item.caption, alt_text: item.alt_text })}><Pencil size={16} /></button>
                        <button type="button" className={`${ICON_BTN} text-red-600`} aria-label="Delete" onClick={() => remove(item)}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Edit dialog ── */}
      {editing && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setEditing(null)}>
          <form onSubmit={saveEdit} onClick={(e) => e.stopPropagation()} className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-foreground">Edit item</h3>
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className={INPUT}>
                {GALLERY_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Caption</label>
              <input type="text" value={editing.caption} onChange={(e) => setEditing({ ...editing, caption: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Alt text</label>
              <input type="text" value={editing.alt_text} onChange={(e) => setEditing({ ...editing, alt_text: e.target.value })} className={INPUT} />
              <p className="text-[11px] text-muted-foreground mt-1">Alt text is used by Google Images and screen readers. If left blank, the caption is used instead.</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 bg-primary text-white px-4 py-3 rounded-lg text-sm font-semibold">Save</button>
              <button type="button" onClick={() => setEditing(null)} className="flex-1 border border-border px-4 py-3 rounded-lg text-sm font-semibold">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default GalleryAdmin;
