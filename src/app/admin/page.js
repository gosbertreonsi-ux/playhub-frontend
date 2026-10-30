'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { UploadCloud, LockKeyhole, Trash2, LogOut, ArrowLeft, Film, Image as ImageIcon } from 'lucide-react';

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:5001').replace(/\/+$/, '').replace(/\/api$/, '');
const field = 'w-full rounded-xl border border-[#34463b] bg-[#141d19] px-3 py-3 text-sm text-white outline-none focus:border-[#bb2c43]';
const panel = 'rounded-2xl border border-[#304237] bg-[#101813] p-5';
const action = 'rounded-xl bg-[#b71d31] px-5 py-3 font-bold text-white transition hover:bg-[#d62b43] disabled:opacity-50';

export default function AdminDashboard() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [videos, setVideos] = useState([]);
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('');
  const [length, setLength] = useState('');
  const [price, setPrice] = useState('0');
  const [videoProvider, setVideoProvider] = useState('local_file');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');

  const loadVideos = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/api/videos`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Video API returned ${response.status}`);
      const result = await response.json();
      if (!Array.isArray(result)) throw new Error('Unexpected video response');
      setVideos(result);
    } catch (err) { setError(err.message); }
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/admin/session', { cache: 'no-store' }).then(r => r.json()).then(data => {
      if (mounted) { setAuthenticated(data.authenticated === true); setChecking(false); }
    }).catch(() => { if (mounted) setChecking(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => { if (authenticated) loadVideos(); }, [authenticated, loadVideos]);

  async function login(event) {
    event.preventDefault(); setAuthError(''); setBusy(true);
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok || !result.authenticated) throw new Error(result.error || 'Login failed');
      setAuthenticated(true); setPassword('');
    } catch (err) { setAuthError(err.message); } finally { setBusy(false); }
  }

  async function logout() {
    await fetch('/api/admin/session', { method: 'DELETE' });
    setAuthenticated(false); setVideos([]);
  }

  // Video files retain the existing Supabase bucket path. Storage RLS still needs a secure policy.
  async function upload(file, folder) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const name = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('terabyte-media').upload(name, file, {
      cacheControl: '3600', upsert: false,
    });
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabase.storage.from('terabyte-media').getPublicUrl(name);
    return data.publicUrl;
  }

  async function publish(event) {
    event.preventDefault(); setBusy(true); setError(''); setUploadMessage('');
    try {
      if (!title.trim() || !channel.trim()) throw new Error('Title and channel are required');
      if (+price < 0 || !Number.isFinite(+price)) throw new Error('Invalid price');
      let source = videoUrl.trim();
      if (videoProvider === 'local_file') {
        if (!videoFile) throw new Error('Select a video file');
        setUploadMessage('Uploading video to Supabase...');
        source = await upload(videoFile, 'hd-streams');
      } else if (!source) throw new Error('Provide the media URL');
      let thumb = '';
      if (thumbnailFile) {
        setUploadMessage('Uploading thumbnail...');
        thumb = await upload(thumbnailFile, 'thumbnails');
      }
      setUploadMessage('Publishing metadata...');
      const payload = {
        id: `vid_${crypto.randomUUID()}`, title: title.trim(), channel: channel.trim(),
        length: length.trim() || 'Premium', price: String(price || '0'),
        desc: source, thumb, uploadedAt: new Date().toISOString(),
      };
      const response = await fetch('/api/admin/videos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Publish failed');
      setTitle(''); setChannel(''); setLength(''); setPrice('0');
      setVideoUrl(''); setVideoFile(null); setThumbnailFile(null); setUploadMessage('Published successfully');
      await loadVideos();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function deleteVideo(id) {
    if (!window.confirm('Permanently remove this video from the catalog?')) return;
    setError('');
    try {
      const response = await fetch(`/api/admin/videos/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Delete failed');
      await loadVideos();
    } catch (err) { setError(err.message); }
  }

  if (checking) return <main className="grid min-h-screen place-items-center bg-[#0b0d0d] text-white">Checking admin session...</main>;
  if (!authenticated) return (
    <main className="grid min-h-screen place-items-center bg-[#0b0d0d] px-4 text-white">
      <form onSubmit={login} className={`${panel} w-full max-w-md space-y-5`}>
        <div className="flex items-center gap-3 text-xl font-bold"><LockKeyhole className="text-[#df3951]" /> LeeHub Admin</div>
        <p className="text-sm text-[#b8c5bb]">Sign in with your server-configured admin password.</p>
        <input className={field} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Admin password" required />
        {authError && <p role="alert" className="text-sm text-[#ff8d9b]">{authError}</p>}
        <button disabled={busy} className={`${action} w-full`}>{busy ? 'Checking...' : 'Sign in'}</button>
      </form>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#0b0d0d] px-4 py-6 text-white md:px-10">
      <header className="mx-auto mb-8 flex max-w-7xl items-center justify-between gap-3 border-b border-[#304237] pb-5">
        <div><h1 className="text-2xl font-black">LEEHUB <span className="text-[#d53b51]">STUDIO</span></h1><p className="text-xs text-[#9fb3a5]">Existing Supabase catalog management</p></div>
        <div className="flex gap-3"><a href="/" className="rounded-lg border border-[#34463b] p-3" aria-label="Home"><ArrowLeft size={17} /></a><button onClick={logout} className="flex items-center gap-2 rounded-lg border border-[#34463b] px-3"><LogOut size={16} /> Logout</button></div>
      </header>
      {error && <p role="alert" className="mx-auto mb-5 max-w-7xl rounded-xl border border-[#9e3446] bg-[#34131b] p-3 text-[#ffb7bf]">{error}</p>}
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(320px,440px)_1fr]">
        <section className={panel}>
          <h2 className="mb-5 flex items-center gap-2 text-lg font-bold"><UploadCloud size={19} className="text-[#df3951]" /> Publish video</h2>
          <form onSubmit={publish} className="space-y-4">
            <label className="block text-sm">Video title<input className={`${field} mt-2`} value={title} onChange={e => setTitle(e.target.value)} required /></label>
            <label className="block text-sm">Channel / Creator<input className={`${field} mt-2`} value={channel} onChange={e => setChannel(e.target.value)} required /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">Duration<input className={`${field} mt-2`} placeholder="2h 15m" value={length} onChange={e => setLength(e.target.value)} /></label>
              <label className="block text-sm">Price (TZS)<input className={`${field} mt-2`} type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} required /></label>
            </div>
            <label className="block text-sm">Source type<select className={`${field} mt-2`} value={videoProvider} onChange={e => setVideoProvider(e.target.value)}><option value="local_file">Upload video file</option><option value="mp4">Direct / YouTube URL</option><option value="vimeo">Vimeo URL</option><option value="bunny">Bunny Stream URL</option></select></label>
            {videoProvider === 'local_file'
              ? <label className="block text-sm">Video file<input className={`${field} mt-2`} type="file" accept="video/*" onChange={e => setVideoFile(e.target.files?.[0] || null)} /></label>
              : <label className="block text-sm">Video URL<input className={`${field} mt-2`} type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://..." /></label>}
            <label className="block text-sm"><span className="flex items-center gap-2"><ImageIcon size={16} /> Cover thumbnail</span><input className={`${field} mt-2`} type="file" accept="image/*" onChange={e => setThumbnailFile(e.target.files?.[0] || null)} /></label>
            {uploadMessage && <p className="text-sm text-[#a2d9b3]" role="status">{uploadMessage}</p>}
            <button className={`${action} w-full`} disabled={busy}>{busy ? 'Working...' : 'Publish to LeeHub'}</button>
          </form>
        </section>
        <section className={panel}>
          <div className="mb-5 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold"><Film size={19} className="text-[#df3951]" /> Published videos</h2><span className="rounded-lg bg-[#233a2b] px-3 py-1 text-sm">{videos.length}</span></div>
          {videos.length === 0 ? <p className="text-[#a8b9ad]">No videos returned by the backend.</p> : <div className="space-y-3">
            {videos.map(video => <article className="flex items-center gap-3 rounded-xl border border-[#304237] bg-[#152219] p-3" key={video.id}>
              {video.thumb && !video.thumb.startsWith('linear') ? <img src={video.thumb} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" /> : <div className="h-16 w-24 shrink-0 rounded-lg bg-[#2d3c30]" />}
              <div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{video.title}</h3><p className="truncate text-xs text-[#b4c4b7]">{video.channel} • {video.length}</p><p className="text-xs text-[#f08e9a]">{Number(video.price) > 0 ? `TZS ${Number(video.price).toLocaleString()}` : 'Free'}</p></div>
              <button className="rounded-lg border border-[#7e3441] p-2 text-[#ffacb6] hover:bg-[#54242f]" aria-label={`Delete ${video.title}`} onClick={() => deleteVideo(video.id)}><Trash2 size={17} /></button>
            </article>)}
          </div>}
        </section>
      </div>
    </main>
  );
}
