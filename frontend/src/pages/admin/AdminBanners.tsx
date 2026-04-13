import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImageIcon, Upload, Trash2, Eye, EyeOff, Plus, X,
  GripVertical, Link, Type, CheckCircle, AlertCircle,
} from 'lucide-react';
import api from '../../api/axios';
import { useToast } from '../../components/ui/Toast';

interface Banner {
  id: number;
  title: string | null;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean | number;
  created_at: string;
}

export const AdminBanners = () => {
  const { toast } = useToast();
  const [banners, setBanners]   = useState<Banner[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Upload form state
  const [title,    setTitle]    = useState('');
  const [linkUrl,  setLinkUrl]  = useState('');
  const [order,    setOrder]    = useState('0');
  const [file,     setFile]     = useState<File | null>(null);
  const [preview,  setPreview]  = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const { data } = await api.get('/banners');
      setBanners(data.banners);
    } catch { toast('Failed to load banners', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleFile = (f: File) => {
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) { toast('Please select an image', 'error'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      if (title)   fd.append('title',      title);
      if (linkUrl) fd.append('link_url',   linkUrl);
      fd.append('sort_order', order);
      await api.post('/banners', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast('Banner uploaded!', 'success');
      setShowForm(false);
      setTitle(''); setLinkUrl(''); setOrder('0'); setFile(null); setPreview(null);
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Upload failed', 'error');
    } finally { setUploading(false); }
  };

  const toggleActive = async (b: Banner) => {
    try {
      await api.patch(`/banners/${b.id}`, { is_active: b.is_active ? 0 : 1 });
      setBanners(prev => prev.map(x => x.id === b.id ? { ...x, is_active: x.is_active ? 0 : 1 } : x));
    } catch { toast('Failed to update', 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this banner?')) return;
    try {
      await api.delete(`/banners/${id}`);
      setBanners(prev => prev.filter(b => b.id !== id));
      toast('Banner deleted', 'warning');
    } catch { toast('Failed to delete', 'error'); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Banner Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">Upload images displayed as carousel on customer home screen</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl shadow-brand hover:opacity-90 transition-opacity"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Banner'}
        </button>
      </div>

      {/* Upload form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-brand-100 shadow-lg p-5 space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Upload className="w-4 h-4 text-brand-500" /> Upload New Banner
            </h3>

            {/* Drop zone */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-all group"
            >
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="preview" className="max-h-48 max-w-full mx-auto rounded-xl object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-xl transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 text-xs text-white font-semibold bg-black/50 px-3 py-1 rounded-full transition-opacity">
                      Click to change
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-500">Drop image here or click to browse</p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP — max 5 MB • Recommended: 800×300px</p>
                </>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            </div>

            {/* Meta fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1.5">
                  <Type className="w-3.5 h-3.5" /> Caption (optional)
                </label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Summer Sale 20% Off"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-400 transition-all" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1.5">
                  <Link className="w-3.5 h-3.5" /> Link URL (optional)
                </label>
                <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-400 transition-all" />
              </div>
            </div>
            <div className="w-28">
              <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1.5">
                <GripVertical className="w-3.5 h-3.5" /> Sort Order
              </label>
              <input type="number" min="0" value={order} onChange={e => setOrder(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-400 transition-all" />
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Upload Banner
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banners grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <ImageIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">No banners yet</p>
          <p className="text-xs text-slate-400 mt-1">Upload your first banner to show on the customer home screen</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {banners.map((b, i) => (
            <motion.div key={b.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden group"
            >
              {/* Image */}
              <div className="relative">
                <img
                  src={b.image_url} alt={b.title || 'Banner'}
                  className={`w-full h-40 object-cover transition-opacity ${b.is_active ? 'opacity-100' : 'opacity-40'}`}
                  onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/800x300/e2e8f0/94a3b8?text=Image+not+found'; }}
                />
                {/* Overlay badge */}
                <div className="absolute top-2 left-2">
                  {b.is_active ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-400 text-white px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" /> Hidden
                    </span>
                  )}
                </div>
                <div className="absolute top-2 right-2">
                  <span className="text-[10px] font-bold bg-black/50 text-white px-2 py-0.5 rounded-full">
                    #{b.sort_order}
                  </span>
                </div>
              </div>

              {/* Info + actions */}
              <div className="p-3 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {b.title || <span className="text-slate-400 italic">No caption</span>}
                  </p>
                  {b.link_url && (
                    <p className="text-xs text-brand-500 truncate mt-0.5">{b.link_url}</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActive(b)} title={b.is_active ? 'Hide' : 'Show'}
                    className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors
                      ${b.is_active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                    {b.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleDelete(b.id)} title="Delete"
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
