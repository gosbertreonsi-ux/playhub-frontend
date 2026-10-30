"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import styles from "./layout-preview.module.css";

type Screen = "entry" | "home" | "watch";
type Video = { id: string | number; title: string; creator: string; tag: string; duration: string; paid: boolean; background: string; thumbnail?: string; description?: string; source?: "demo" | "api" };

const demoVideos: Video[] = [
  { id: 1, title: "Beyond the Horizon", creator: "LeeHub Originals", tag: "Film", duration: "18:24", paid: false, background: "linear-gradient(130deg,#123b27,#04140f,#9c1e30)" },
  { id: 2, title: "City After Dark", creator: "Juma Stories", tag: "Documentary", duration: "12:09", paid: true, background: "linear-gradient(130deg,#551323,#102a1c,#070c0c)" },
  { id: 3, title: "A New Frequency", creator: "Sound Lab", tag: "Music", duration: "04:16", paid: false, background: "linear-gradient(130deg,#06120c,#204c30,#7d1729)" },
  { id: 4, title: "The Road Home", creator: "Maya Films", tag: "Series", duration: "31:07", paid: true, background: "linear-gradient(130deg,#0d1510,#6c1a29,#1f543d)" },
  { id: 5, title: "Under the Surface", creator: "Nuru Studio", tag: "Film", duration: "25:40", paid: true, background: "linear-gradient(130deg,#04140e,#264c36,#a02030)" },
  { id: 6, title: "An Evening in Dar", creator: "Street Views", tag: "Lifestyle", duration: "09:18", paid: false, background: "linear-gradient(130deg,#1b1615,#173c2a,#661320)" },
  { id: 7, title: "New Wave Sessions", creator: "Music Corner", tag: "Music", duration: "06:34", paid: false, background: "linear-gradient(130deg,#07180e,#862038,#213e2c)" },
  { id: 8, title: "The Artist's Journey", creator: "Art House", tag: "Documentary", duration: "16:12", paid: true, background: "linear-gradient(130deg,#11291b,#3a1021,#0b1010)" },
  { id: 9, title: "Night Signals", creator: "LeeHub Originals", tag: "Series", duration: "22:30", paid: true, background: "linear-gradient(130deg,#661322,#0b1913,#31583b)" },
  { id: 10, title: "A Place to Begin", creator: "Open Studio", tag: "Lifestyle", duration: "13:41", paid: false, background: "linear-gradient(130deg,#0c1613,#284e32,#701526)" },
  { id: 11, title: "Sound Without Borders", creator: "Sound Lab", tag: "Music", duration: "05:06", paid: false, background: "linear-gradient(130deg,#173421,#781526,#07120f)" },
  { id: 12, title: "The Last Chapter", creator: "Maya Films", tag: "Film", duration: "42:19", paid: true, background: "linear-gradient(130deg,#401521,#0c2117,#29553c)" },
];
const demoStatuses = [
  { creator: "Asha", video: demoVideos[0] }, { creator: "Kito", video: demoVideos[1] },
  { creator: "Neema", video: demoVideos[2] }, { creator: "Juma", video: demoVideos[3] },
  { creator: "Sifa", video: demoVideos[4] }, { creator: "Beka", video: demoVideos[5] },
  { creator: "Maya", video: demoVideos[6] }, { creator: "Tatu", video: demoVideos[7] },
];

type ApiObject = Record<string, unknown>;
const VIDEO_ENDPOINT = process.env.NEXT_PUBLIC_LEEHUB_VIDEOS_PATH || "/api/videos";
const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:5001").replace(/\/$/, "");
function property(obj: ApiObject, ...keys: string[]): unknown {
  for (const key of keys) if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  return undefined;
}
function str(value: unknown, fallback = ""): string { return typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback; }
function normalizeVideo(raw: unknown, index: number): Video | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as ApiObject;
  const title = str(property(v, "title", "name"));
  if (!title) return null;
  const creatorValue = property(v, "creator", "channel", "author", "uploadedBy");
  const creator = typeof creatorValue === "object" && creatorValue !== null ? str(property(creatorValue as ApiObject, "name", "username"), "LeeHub Creator") : str(creatorValue, "LeeHub Creator");
  const cost = property(v, "price", "priceTzs", "priceTZS");
  const paid = v.isPremium === true || v.isPaid === true || v.premium === true || v.paid === true || (typeof cost === "number" && cost > 0);
  return {
    id: str(property(v, "id", "_id", "uuid"), String(index)), title, creator,
    tag: str(property(v, "category", "genre", "tag", "type"), "Film"),
    duration: str(property(v, "durationFormatted", "duration", "length"), ""),
    paid, background: "linear-gradient(130deg,#04140e,#264c36,#a02030)",
    thumbnail: str(property(v, "thumbnailUrl", "thumbnail_url", "thumbnail", "posterUrl", "poster", "imageUrl", "image")),
    description: str(property(v, "description", "summary")), source: "api"
  };
}
function extractItems(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return null;
  const p = payload as ApiObject;
  for (const candidate of [p.videos, p.items, p.results, p.data]) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === "object") {
      const nested = candidate as ApiObject;
      if (Array.isArray(nested.videos)) return nested.videos;
      if (Array.isArray(nested.items)) return nested.items;
    }
  }
  return null;
}
function videoPoster(v: Video): CSSProperties {
  return { background: v.thumbnail ? `linear-gradient(#0004,#0003), url("${v.thumbnail.replace(/"/g, "%22")}") center / cover` : v.background };
}

type Promotion = { id: string; title: string; label: string; image?: string; href?: string };

// Example promotions. Replace these with the existing admin API when integrating.
// Folder images should be put into frontend/public/ads/.
const folderPromotions: Promotion[] = [
  { id: "launch", title: "Your brand deserves the spotlight", label: "LEEHUB FEATURE", image: "/ads/launch.jpg" },
  { id: "event", title: "New events and premieres", label: "FEATURED EVENT", image: "/ads/event.jpg" },
  { id: "studio", title: "Promote your latest release", label: "CREATOR SPOTLIGHT", image: "/ads/studio.jpg" },
];

function AdvertiserMarquee() {
  const [localAds, setLocalAds] = useState<Promotion[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);
  useEffect(() => () => { objectUrls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  const ads = localAds.length > 0 ? localAds : folderPromotions;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(8);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !ads.length) return;
    const calculate = () => {
      const width = viewport.clientWidth;
      // Match the CSS clamp(255px, 30vw, 430px) and mobile 255px.
      const cardWidth = window.innerWidth <= 600 ? 255 : Math.min(430, Math.max(255, window.innerWidth * 0.30));
      const unit = cardWidth + 16;
      // One whole group must be wider than the viewport, even with a short ad list.
      setCopies(Math.max(1, Math.ceil((width + unit) / (ads.length * unit))));
    };
    const observer = new ResizeObserver(calculate);
    observer.observe(viewport);
    calculate();
    return () => observer.disconnect();
  }, [ads.length]);
  const filledAds = Array.from({ length: copies }, () => ads).flat();
  function addPreviewFiles(files: FileList | null) {
    if (!files) return;
    const items = Array.from(files).filter(f => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024).slice(0, 8);
    const next = items.map((file, idx) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.push(url);
      return { id: `preview-${Date.now()}-${idx}`, title: file.name.replace(/\.[^.]+$/, ""), label: "UPLOAD PREVIEW", image: url };
    });
    setLocalAds(old => [...old, ...next]);
    setUploadOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  }
  return <section className={styles.advertiserSection} aria-label="Advertisements and featured promotions">
    <div className={styles.advertiserHeading}>
      <div><span className={styles.adEyebrow}>SPOTLIGHT / ADVERTISERS</span><h2>Discover something new</h2></div>
      <button type="button" className={styles.adPreviewButton} onClick={() => setUploadOpen(v => !v)} aria-expanded={uploadOpen}>+ Preview ad upload</button>
    </div>
    {uploadOpen && <div className={styles.adUploadBox}>
      <label htmlFor="leehub-ad-files">Select image ads to preview in this browser session (max 5MB each).</label>
      <input ref={fileRef} id="leehub-ad-files" type="file" accept="image/*" multiple onChange={e => addPreviewFiles(e.target.files)} />
      <small>Demo only: files are not uploaded to your server, saved, or published. Real admin publishing comes after backend recovery.</small>
    </div>}
    <div ref={viewportRef} className={styles.advertiserViewport} tabIndex={0} aria-label="Promotional cards scrolling from right to left; hover or focus to pause">
      <div className={styles.advertiserTrack}>
        {[0, 1].map(group => <div className={styles.advertiserGroup} key={group} aria-hidden={group === 1}>
          {filledAds.map((ad, idx) => <div className={styles.advertiserCard} key={`${group}-${ad.id}-${idx}`} aria-hidden={group === 1 || idx >= ads.length}>
          <div className={styles.advertiserVisual}>
            {ad.image && <img src={ad.image} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }} />}
            <div className={styles.advertiserCopy}><span>{ad.label}</span><strong>{ad.title}</strong></div>
          </div>
          {ad.href ? <a href={ad.href} rel="noopener noreferrer sponsored" target="_blank">View promotion ↗</a> : <span className={styles.advertiserCaption}>Featured promotion</span>}
        </div>)}
        </div>)}
      </div>
    </div>
    <p className={styles.advertiserNote}>Sponsored and featured content · Scroll pauses on hover or focus</p>
  </section>;
}

export default function LeeHubLayoutPreview() {
  const [screen, setScreen] = useState<Screen>("entry");
  const [videos, setVideos] = useState<Video[]>(demoVideos);
  const [dataMode, setDataMode] = useState<"loading" | "live" | "demo" | "empty">("loading");
  const [dataError, setDataError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      setDataMode("loading");
      try {
        const endpoint = VIDEO_ENDPOINT.startsWith("/") ? VIDEO_ENDPOINT : `/${VIDEO_ENDPOINT}`;
        const response = await fetch(`${API_BASE}${endpoint}`, { signal: ctrl.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`API returned ${response.status} at ${endpoint}`);
        const items = extractItems(await response.json());
        if (!items) throw new Error("Unrecognized video response shape. Configure NEXT_PUBLIC_LEEHUB_VIDEOS_PATH or the adapter.");
        const normalized = items.map(normalizeVideo).filter((item): item is Video => item !== null);
        setVideos(normalized);
        setDataMode(normalized.length ? "live" : "empty");
        setDataError("");
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setVideos(demoVideos);
        setDataMode("demo");
        setDataError(err instanceof Error ? err.message : "Unable to load videos");
      }
    }
    void load();
    return () => ctrl.abort();
  }, [reload]);
  const statuses = videos.slice(0, 8).map(v => ({ creator: v.creator, video: v }));
  const [selected, setSelected] = useState<Video>(videos[0]);
  const [query, setQuery] = useState("");
  const [relatedQuery, setRelatedQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOffset, setStatusOffset] = useState(0);
  const [relatedOffset, setRelatedOffset] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Mobile money");

  const visibleVideos = useMemo(() => videos.filter(v =>
    (filter === "All" || filter === v.tag || (filter === "Free" && !v.paid) || (filter === "Premium" && v.paid)) &&
    `${v.title} ${v.creator} ${v.tag}`.toLowerCase().includes(query.toLowerCase())
  ), [query, filter]);
  const relatedVideos = useMemo(() => videos.filter(v => v.id !== selected.id &&
    `${v.title} ${v.creator}`.toLowerCase().includes(relatedQuery.toLowerCase())
  ), [relatedQuery, selected.id]);

  function openVideo(video: Video) {
    setSelected(video);
    setScreen("watch");
    setRelatedOffset(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function navigate(next: Screen) {
    setMenuOpen(false);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <div className={styles.shell}>
    <aside className={styles.rail} aria-label="Primary navigation">
      <button className={styles.logo} onClick={() => navigate("home")} aria-label="LeeHub Media home">L</button>
      <button className={styles.railButton} onClick={() => navigate("home")} title="Home" aria-label="Home">⌂</button>
      <div className={styles.menuWrap} onMouseLeave={() => setMenuOpen(false)}>
        <button className={styles.railButton} aria-expanded={menuOpen} onClick={() => setMenuOpen(x => !x)} title="Menu" aria-label="Menu">☷</button>
        {menuOpen && <div className={styles.flyout}>
          <button onClick={() => navigate("home")}>Home</button>
          <button onClick={() => navigate("entry")}>About / Entry</button>
          <button onClick={() => navigate("watch")}>Current video</button>
          <div className={styles.flyoutNote}>Additional categories and account actions will be wired later.</div>
        </div>}
      </div>
      <button className={styles.railButton} onClick={() => navigate("entry")} title="About" aria-label="About">ⓘ</button>
    </aside>

    <div className={styles.workspace}>
      {screen === "entry" ? <main className={styles.entryLayout}>
        <section className={styles.introPanel}>
          <div className={styles.topLine}><span>LEEHUB MEDIA</span><span>INTRO / 01</span></div>
          <div className={styles.introStage}>
            <span className={styles.eyebrow}>WELCOME TO LEEHUB</span>
            <h1>Stories that deserve the screen.</h1>
            <p>Discover original films, music, documentaries, and voices worth hearing.</p>
            <div className={styles.introVideo} role="img" aria-label="Intro video placeholder"><span>▶</span><small>INTRO VIDEO · Replace with existing player</small></div>
            <p className={styles.note}>Your existing introduction and words will appear here. No streaming integration is changed in this prototype.</p>
          </div>
        </section>
        <section className={styles.entrySide}>
          <div className={styles.topLine}><span>ACCESS</span><span>02</span></div>
          <div className={styles.payCard}>
            <span className={styles.eyebrow}>PAYMENT / ACCESS MODAL PLACEHOLDER</span>
            <h2>Choose how to enter.</h2>
            <p>Free content and paid access will be verified by the existing backend when integrated.</p>
            <div className={styles.methodRow}>{["Mobile money", "Card"].map(m => <button key={m} onClick={() => setPaymentMethod(m)} className={paymentMethod === m ? styles.activeMethod : ""}>{m}</button>)}</div>
            <div className={styles.placeholderBox}>{paymentMethod} payment form / original modal goes here</div>
            <button className={styles.fullButton} disabled>Payment integration pending</button>
            <button className={styles.textButton} onClick={() => navigate("home")}>Preview home layout →</button>
            <small>This preview button is for layout testing only. It does not grant paid content access.</small>
          </div>
        </section>
      </main> : <>
        <header className={styles.header}>
          <div className={styles.headerLabel}>{screen === "home" ? "DISCOVER" : "NOW WATCHING"}</div>
          <label className={styles.searchBox}><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search videos, titles or creators" aria-label="Search videos" /></label>
          <button className={styles.aboutPill} onClick={() => navigate("entry")}>ABOUT <span>↗</span></button>
        </header>
        {screen === "home" ? <main className={styles.home}>
          <section className={styles.statusSection} aria-label="Creator video statuses">
            <div className={styles.sectionHeading}><h2>Creator statuses</h2><span>Tap a thumbnail to view</span></div>
            <div className={styles.statusViewport}>
              <div className={styles.statusTrack} style={{ transform: `translateX(-${statusOffset * 104}px)` }}>
                {statuses.map((s,i) => <button key={`${s.creator}-${i}`} className={styles.statusCard} onClick={() => openVideo(s.video)}>
                  <span className={styles.statusPhoto} style={videoPoster(s.video)}><span>▶</span></span><span>{s.creator}</span>
                </button>)}
              </div>
            </div>
            <button className={styles.statusNext} onClick={() => setStatusOffset(x => x >= statuses.length - 3 ? 0 : x + 2)} aria-label="See more statuses">→</button>
          </section>
          <div className={styles.filterRow}><span className={styles.sectionLabel}>FILTER</span>{["All", "Premium", "Free", "Film", "Series", "Music", "Documentary", "Lifestyle"].map(f => <button className={filter === f ? styles.activeFilter : ""} key={f} onClick={() => setFilter(f)}>{f}</button>)}</div>
          <section className={styles.library}>
            <div className={styles.apiNotice} role="status" aria-live="polite">
              {dataMode === "loading" ? "Connecting to local video API…" : dataMode === "live" ? `Live backend connected · ${videos.length} videos` : dataMode === "empty" ? "Connected · No videos published yet" : `Demo content only · ${dataError}`}
              {dataMode === "demo" && <button type="button" onClick={() => setReload(n => n + 1)}>Retry</button>}
            </div>
            <div className={styles.sectionHeading}><h2>Explore videos</h2><span>{visibleVideos.length} videos</span></div>
            <div className={styles.firstRow}><div className={styles.videoGrid}>{visibleVideos.slice(0, 4).map(v => <button key={v.id} className={styles.videoCard} onClick={() => openVideo(v)}>
              <div className={styles.poster} style={videoPoster(v)}><span className={styles.posterPlay}>▶</span><span className={styles.duration}>{v.duration}</span></div>
              <div className={styles.videoInfo}><strong>{v.title}</strong><span>{v.creator}</span><small>{v.paid ? "PREMIUM" : "FREE"} · {v.tag}</small></div>
            </button>)}</div></div>
            <AdvertiserMarquee />
            {visibleVideos.length > 4 && <div className={styles.videoGrid}>{visibleVideos.slice(4).map(v => <button key={v.id} className={styles.videoCard} onClick={() => openVideo(v)}>
              <div className={styles.poster} style={videoPoster(v)}><span className={styles.posterPlay}>▶</span><span className={styles.duration}>{v.duration}</span></div>
              <div className={styles.videoInfo}><strong>{v.title}</strong><span>{v.creator}</span><small>{v.paid ? "PREMIUM" : "FREE"} · {v.tag}</small></div>
            </button>)}</div>}
            {visibleVideos.length === 0 && <p>No matches. Try another search or filter.</p>}
          </section>
        </main> : <main className={styles.watchLayout}>
          <section className={styles.playerColumn}>
            <div className={styles.playerWindow} style={videoPoster(selected)}><span className={styles.giantPlay}>▶</span><small>{selected.paid ? "PREMIUM · Secure playback authorization pending" : "VIDEO PLAYER · Existing player integration pending"}</small></div>
            <div className={styles.watchInfo}><span className={styles.eyebrow}>{selected.tag} / {selected.paid ? "PREMIUM" : "FREE"}</span><h1>{selected.title}</h1><p>By {selected.creator} · {selected.duration}</p><p>{selected.description || "Video metadata loaded. Playback remains disabled until server-side entitlement verification is integrated."}</p></div>
          </section>
          <aside className={styles.relatedColumn}>
            <h2>Up next</h2>
            <label className={styles.searchBox}><span>⌕</span><input value={relatedQuery} onChange={e => {setRelatedQuery(e.target.value);setRelatedOffset(0);}} placeholder="Search related videos" aria-label="Search related videos" /></label>
            <div className={styles.relatedList}>{relatedVideos.slice(relatedOffset, relatedOffset + 4).map(v => <button key={v.id} className={styles.relatedCard} onClick={() => openVideo(v)}><span className={styles.relatedPoster} style={videoPoster(v)}>▶</span><span><strong>{v.title}</strong><small>{v.creator} · {v.duration}</small></span></button>)}</div>
            <div className={styles.relatedActions}><button onClick={() => setRelatedOffset(x => Math.max(0,x-4))} disabled={relatedOffset===0}>← Previous</button><button onClick={() => setRelatedOffset(x => (x+4 >= relatedVideos.length ? 0 : x+4))}>More related →</button></div>
          </aside>
        </main>}
      </>}
    </div>
  </div>;
}
