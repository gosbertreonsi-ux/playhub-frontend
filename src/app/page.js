
"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Play,
  Search,
  Home,
  Menu,
  X,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Film,
  Lock,
  Clock,
  Info,
  RefreshCw,
  Volume2,
  VolumeX,
  ShieldCheck,
  Clapperboard,
} from "lucide-react";

// =====================================================
// LEEHUB MEDIA — REAL APPLICATION + CINEMATIC PROTOTYPE
// =====================================================

// Existing Express backend. The /api suffix is added once.
const BASE_URL = (
  process.env.NEXT_PUBLIC_BACKEND_API_URL ||
  "http://localhost:5001"
)
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

const VIDEO_API_URL = `${BASE_URL}/api/videos`;

const INTRO_VIDEO = "/11.mp4";

// Advertisement placeholders. These are demo placements,
// not real paid advertisers. Real campaigns will come from
// the admin dashboard in a later phase.
const DEMO_ADS = [
  {
    id: "demo-ad-1",
    title: "Your brand belongs here",
    subtitle: "Advertising space",
    color: "linear-gradient(125deg,#163e29,#07140e,#a71d35)",
  },
  {
    id: "demo-ad-2",
    title: "Reach a new audience",
    subtitle: "LeeHub Media",
    color: "linear-gradient(125deg,#5a1424,#101c17,#1f5538)",
  },
  {
    id: "demo-ad-3",
    title: "Create. Connect. Inspire.",
    subtitle: "Featured placement",
    color: "linear-gradient(125deg,#10291c,#7b1c2f,#07110c)",
  },
];

const FILTERS = [
  "All",
  "Free",
  "Premium",
  "Movies",
  "Series",
  "Music",
  "Documentaries",
];

const FALLBACK_THUMB =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg"
      width="640" height="400" viewBox="0 0 640 400">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#142A1D"/>
          <stop offset=".6" stop-color="#0B0D0D"/>
          <stop offset="1" stop-color="#8E1B2D"/>
        </linearGradient>
      </defs>
      <rect width="640" height="400" fill="url(#bg)"/>
      <circle cx="320" cy="200" r="48"
        fill="#ffffff22" stroke="#ffffff88" stroke-width="2"/>
      <path d="M310 175 L310 225 L350 200 Z" fill="white"/>
      <text x="320" y="310" text-anchor="middle"
        font-family="Arial" font-size="22" fill="#cbd5ce">
        LeeHub Media
      </text>
    </svg>
  `);

// =====================================================
// DATA ADAPTER
// Supports the existing backend schema:
// id, title, channel, length, price, desc, thumb, uploadedAt
// =====================================================

function normalizeVideo(item, index) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const id = String(item.id ?? `video-${index}`);
  const title = String(item.title ?? "Untitled video");

  const channel = String(
    item.channel ??
    item.creator ??
    "LeeHub Creator"
  );

  const price = Number(item.price ?? 0);

  const thumbnail =
    item.thumbnailUrl ||
    item.thumb ||
    item.thumbnail ||
    "";

  const source =
    item.videoUrl ||
    item.desc ||
    item.sourceUrl ||
    "";

  return {
    id,
    title,
    channel,
    duration: String(
      item.duration ||
      item.length ||
      "0:00"
    ),
    category: String(
      item.category ||
      item.genre ||
      "Movies"
    ),
    price: Number.isFinite(price) ? price : 0,
    premium: Number.isFinite(price) && price > 0,
    thumbnail:
      typeof thumbnail === "string" &&
      !thumbnail.startsWith("linear")
        ? thumbnail
        : FALLBACK_THUMB,
    source: typeof source === "string" ? source : "",
    uploadedAt: item.uploadedAt || item.uploaded_at || null,
  };
}

function readLocalVideos() {
  if (typeof window === "undefined") return [];

  try {
    const raw =
      localStorage.getItem("playhub_home_feed_videos") ||
      localStorage.getItem("playhub_admin_videos");

    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeVideos(localItems, cloudItems) {
  const map = new Map();

  for (const video of [...localItems, ...cloudItems]) {
    if (video?.id != null) {
      map.set(String(video.id), video);
    }
  }

  return [...map.values()]
    .map(normalizeVideo)
    .filter(Boolean)
    .sort((a, b) => {
      const first = Date.parse(a.uploadedAt || "") || 0;
      const second = Date.parse(b.uploadedAt || "") || 0;
      return second - first;
    });
}

function getTimeAgo(date) {
  if (!date) return "Recently";

  const difference =
    Date.now() - new Date(date).getTime();

  if (!Number.isFinite(difference) || difference < 0) {
    return "Recently";
  }

  const minutes = Math.floor(difference / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

// =====================================================
// SAFE VIDEO URL HANDLING
// Never execute arbitrary HTML from the database.
// =====================================================

function getPlaybackSource(value) {
  if (!value) return null;

  let source = value.trim();

  // Support existing stored iframe snippets by extracting
  // only their src instead of injecting their HTML.
  if (source.startsWith("<iframe")) {
    const match = source.match(
      /\bsrc\s*=\s*["']([^"']+)["']/i
    );

    if (!match) return null;
    source = match[1];
  }

  try {
    const url = new URL(source, window.location.origin);

    if (!["https:", "http:"].includes(url.protocol)) {
      return null;
    }

    const host = url.hostname.toLowerCase();

    // Only use HTTPS external media in production.
    if (
      window.location.protocol === "https:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    if (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com"
    ) {
      const id = url.searchParams.get("v");

      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
        return {
          type: "iframe",
          src: `https://www.youtube-nocookie.com/embed/${id}`,
        };
      }
    }

    if (host === "youtu.be") {
      const id = url.pathname.slice(1);

      if (/^[A-Za-z0-9_-]{11}$/.test(id)) {
        return {
          type: "iframe",
          src: `https://www.youtube-nocookie.com/embed/${id}`,
        };
      }
    }

    if (
      host === "youtube-nocookie.com" ||
      host === "www.youtube-nocookie.com" ||
      host === "www.youtube.com"
    ) {
      if (url.pathname.startsWith("/embed/")) {
        return { type: "iframe", src: url.href };
      }
    }

    if (
      host === "vimeo.com" ||
      host === "www.vimeo.com" ||
      host === "player.vimeo.com"
    ) {
      const id = url.pathname
        .split("/")
        .filter(Boolean)
        .pop();

      if (/^\d+$/.test(id || "")) {
        return {
          type: "iframe",
          src: `https://player.vimeo.com/video/${id}`,
        };
      }
    }

    if (
      host === "iframe.mediadelivery.net" &&
      url.pathname.startsWith("/embed/")
    ) {
      return {
        type: "iframe",
        src: url.href,
      };
    }

    if (
      /\.(mp4|webm|ogg|mov)$/i.test(url.pathname) ||
      host.endsWith(".supabase.co")
    ) {
      return {
        type: "video",
        src: url.href,
      };
    }
  } catch {
    return null;
  }

  return null;
}

// =====================================================
// SMALL REUSABLE COMPONENTS
// =====================================================

function VideoCard({ video, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(video)}
      className="group min-w-0 text-left"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-[#304036] bg-[#142A1D] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[#B71D31]">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.src = FALLBACK_THUMB;
          }}
        />

        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/35">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-black/40 text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
            <Play size={20} fill="currentColor" />
          </span>
        </div>

        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 text-[10px] font-bold text-white">
          {video.duration}
        </span>

        {video.premium && (
          <span className="absolute left-2 top-2 rounded-full border border-[#C64859] bg-[#641B2A]/90 px-2.5 py-1 text-[10px] font-bold text-white">
            PREMIUM
          </span>
        )}
      </div>

      <div className="space-y-1.5 px-1 pt-3">
        <h3 className="line-clamp-2 text-sm font-bold text-[#F5F3EE] transition-colors group-hover:text-[#F08090]">
          {video.title}
        </h3>

        <p className="truncate text-xs text-[#ADBDAD]">
          {video.channel}
        </p>

        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#98A99A]">
          <span>
            {video.premium
              ? `TSh ${video.price.toLocaleString()}`
              : "Free"}
          </span>
          <span>•</span>
          <span>{getTimeAgo(video.uploadedAt)}</span>
        </div>
      </div>
    </button>
  );
}

function StatusStrip({ videos, onOpen }) {
  const viewportRef = useRef(null);

  const statuses = videos.slice(0, 15);

  function scrollRight() {
    viewportRef.current?.scrollBy({
      left: 320,
      behavior: "smooth",
    });
  }

  if (statuses.length === 0) {
    return null;
  }

  return (
    <section className="relative border-b border-[#304036] pb-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-[0.16em]">
          Creator Stories
        </h2>
        <span className="text-xs text-[#9FB4A3]">
          Select a story to watch
        </span>
      </div>

      <div
        ref={viewportRef}
        className="flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none]"
      >
        {statuses.map((video) => (
          <button
            type="button"
            key={video.id}
            onClick={() => onOpen(video)}
            className="group flex w-[82px] shrink-0 flex-col items-center gap-2"
          >
            <span className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full border-[3px] border-[#B71D31] bg-[#142A1D] p-[3px] transition-transform group-hover:scale-105">
              <img
                src={video.thumbnail}
                alt=""
                className="h-full w-full rounded-full object-cover"
                onError={(event) => {
                  event.currentTarget.src = FALLBACK_THUMB;
                }}
              />
            </span>

            <span className="w-full truncate text-center text-[11px] text-[#E1E8DF]">
              {video.channel}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={scrollRight}
        aria-label="Next creator stories"
        className="absolute right-0 top-[56px] flex h-10 w-10 items-center justify-center rounded-full border border-[#415444] bg-[#142A1D] text-white shadow-xl hover:bg-[#264B34]"
      >
        <ChevronRight size={19} />
      </button>
    </section>
  );
}

function AdvertisementCarousel() {
  // Eight repeated cards per group ensure each group is
  // wider than most viewports. Two identical groups loop.
  const repeated = Array.from(
    { length: 8 },
    (_, index) => DEMO_ADS[index % DEMO_ADS.length]
  );

  return (
    <section className="my-12 overflow-hidden border-y border-[#304036] bg-gradient-to-r from-[#08190F] via-[#101A15] to-[#35121B] py-7">
      <div className="mb-5 flex items-center justify-between px-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#F07887]">
            Advertisements
          </p>
          <h2 className="mt-1 text-xl font-bold">
            Brands &amp; Partnerships
          </h2>
        </div>

        <span className="text-xs text-[#ADBAAD]">
          Promotional spaces
        </span>
      </div>

      <div className="overflow-hidden">
        <div className="leehub-ad-track flex w-max">
          {[0, 1].map((groupIndex) => (
            <div
              key={groupIndex}
              aria-hidden={groupIndex === 1}
              className="flex shrink-0 gap-4 pr-4"
            >
              {repeated.map((ad, index) => (
                <div
                  key={`${groupIndex}-${index}`}
                  className="relative h-[185px] w-[280px] shrink-0 overflow-hidden rounded-2xl border border-[#466049] sm:h-[210px] sm:w-[340px]"
                  style={{ background: ad.color }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/15" />

                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#F8B0BA]">
                      {ad.subtitle}
                    </span>

                    <h3 className="mt-2 max-w-[240px] text-2xl font-black leading-tight text-white">
                      {ad.title}
                    </h3>
                  </div>

                  <span className="absolute right-3 top-3 rounded-full border border-white/30 bg-black/30 px-2 py-1 text-[9px] uppercase text-white">
                    Demo
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 px-2 text-[11px] text-[#9AAE9B]">
        Demonstration placements. Advertiser management
        will be connected to the admin dashboard.
      </p>

      <style jsx>{`
        .leehub-ad-track {
          animation: leehub-marquee 45s linear infinite;
        }

        .leehub-ad-track:hover {
          animation-play-state: paused;
        }

        @keyframes leehub-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .leehub-ad-track {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}

function VideoPlayer({ video }) {
  if (!video) return null;

  if (video.premium) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-2xl border border-[#3E4F41] bg-gradient-to-br from-[#13291C] to-[#080A09] p-6 text-center">
        <Lock size={38} className="text-[#F07887]" />

        <h2 className="text-xl font-black">
          Premium Video
        </h2>

        <p className="max-w-md text-sm text-[#B9C7BB]">
          This video costs TSh{" "}
          {video.price.toLocaleString()}.
          Playback requires verified payment access.
        </p>

        <span className="rounded-full border border-[#A33D4F] bg-[#481923] px-5 py-2.5 text-sm font-bold text-white">
          Payment verification coming next
        </span>
      </div>
    );
  }

  const playback = getPlaybackSource(video.source);

  if (!playback) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-2xl border border-[#3E4F41] bg-[#101912] p-6 text-center">
        <Film size={42} className="text-[#B71D31]" />

        <h2 className="text-lg font-bold">
          Video source unavailable
        </h2>

        <p className="max-w-md text-sm text-[#B9C7BB]">
          The video exists in the catalog, but its
          playback source is missing or unsupported.
        </p>
      </div>
    );
  }

  if (playback.type === "iframe") {
    return (
      <div className="aspect-video overflow-hidden rounded-2xl border border-[#3E4F41] bg-black">
        <iframe
          key={video.id}
          src={playback.src}
          title={video.title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    <div className="aspect-video overflow-hidden rounded-2xl border border-[#3E4F41] bg-black">
      <video
        key={video.id}
        src={playback.src}
        controls
        autoPlay
        playsInline
        className="h-full w-full object-contain"
      />
    </div>
  );
}

// =====================================================
// MAIN APPLICATION
// =====================================================

export default function LeeHubMediaHome() {
  const [screen, setScreen] = useState("entry");

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [selectedVideo, setSelectedVideo] = useState(null);
  const [relatedSearch, setRelatedSearch] = useState("");
  const [relatedPage, setRelatedPage] = useState(0);

  const [menuOpen, setMenuOpen] = useState(false);
  const [introMuted, setIntroMuted] = useState(true);

  const [refreshKey, setRefreshKey] = useState(0);

  const pageRef = useRef(null);

  // Load the same video data used by the original app.
  useEffect(() => {
    let active = true;

    async function loadVideos() {
      setLoading(true);
      setDataError("");

      const cached = readLocalVideos();
      let cloud = [];

      try {
        const response = await fetch(VIDEO_API_URL, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `Video API returned HTTP ${response.status}`
          );
        }

        const result = await response.json();

        if (!Array.isArray(result)) {
          throw new Error(
            "The video API did not return an array"
          );
        }

        cloud = result;
      } catch (error) {
        if (active) {
          setDataError(
            `Cloud feed unavailable: ${error.message}`
          );
        }
      }

      if (active) {
        setVideos(mergeVideos(cached, cloud));
        setLoading(false);
      }
    }

    loadVideos();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  function goTo(screenName) {
    setScreen(screenName);
    setMenuOpen(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openVideo(video) {
    setSelectedVideo(video);
    setRelatedPage(0);
    setRelatedSearch("");
    goTo("watch");
  }

  const visibleVideos = useMemo(() => {
    const query = search.trim().toLowerCase();

    return videos.filter((video) => {
      const searchable =
        `${video.title} ${video.channel} ${video.category}`
          .toLowerCase();

      const matchesSearch =
        !query || searchable.includes(query);

      let matchesFilter = true;

      if (filter === "Free") {
        matchesFilter = !video.premium;
      } else if (filter === "Premium") {
        matchesFilter = video.premium;
      } else if (filter !== "All") {
        const category = video.category.toLowerCase();
        const text = video.title.toLowerCase();

        if (filter === "Movies") {
          matchesFilter =
            category.includes("film") ||
            category.includes("movie");
        } else if (filter === "Documentaries") {
          matchesFilter =
            category.includes("documentary") ||
            text.includes("documentary");
        } else {
          matchesFilter =
            category.includes(filter.toLowerCase());
        }
      }

      return matchesSearch && matchesFilter;
    });
  }, [videos, search, filter]);

  const firstRow = visibleVideos.slice(0, 4);
  const remainingVideos = visibleVideos.slice(4);

  const relatedVideos = useMemo(() => {
    const query = relatedSearch.toLowerCase();

    return videos.filter(
      (video) =>
        video.id !== selectedVideo?.id &&
        `${video.title} ${video.channel}`
          .toLowerCase()
          .includes(query)
    );
  }, [videos, selectedVideo, relatedSearch]);

  const relatedStart = relatedPage * 4;
  const currentRelated = relatedVideos.slice(
    relatedStart,
    relatedStart + 4
  );

  return (
    <div
      ref={pageRef}
      className="min-h-screen bg-[#0B0D0D] font-sans text-[#F5F3EE]"
    >
      {/* ==========================================
          FIXED LEFT NAVIGATION
      ========================================== */}
      <aside className="fixed bottom-0 left-0 top-0 z-50 flex w-[62px] flex-col items-center gap-5 border-r border-[#304036] bg-[#0A110D] px-2 py-6 shadow-2xl md:w-[78px]">
        <button
          type="button"
          onClick={() => goTo("entry")}
          title="LeeHub Media"
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#B71D31] bg-[#203627] text-lg font-black"
        >
          L
        </button>

        <button
          type="button"
          title="Menu"
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-xl border border-[#3B4A3E] bg-[#1A2A20] p-3 hover:bg-[#385642]"
        >
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>

        <button
          type="button"
          title="Discover"
          onClick={() => goTo("home")}
          className="rounded-xl p-3 text-[#C5D1C4] hover:bg-[#203627]"
        >
          <Home size={20} />
        </button>

        <button
          type="button"
          title="About LeeHub"
          onClick={() => goTo("entry")}
          className="rounded-xl p-3 text-[#C5D1C4] hover:bg-[#203627]"
        >
          <Info size={20} />
        </button>

        <button
          type="button"
          title="Movies"
          onClick={() => {
            setFilter("Movies");
            goTo("home");
          }}
          className="rounded-xl p-3 text-[#C5D1C4] hover:bg-[#203627]"
        >
          <Clapperboard size={20} />
        </button>

        {menuOpen && (
          <div className="absolute left-[65px] top-[95px] w-[215px] rounded-xl border border-[#405342] bg-[#142219] p-3 shadow-2xl md:left-[80px]">
            <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-[#B7C5B8]">
              Navigation
            </p>

            {[
              ["Discover", "home"],
              ["About & Entry", "entry"],
              ["Watch", "watch"],
            ].map(([label, destination]) => (
              <button
                type="button"
                key={label}
                onClick={() => {
                  if (
                    destination === "watch" &&
                    !selectedVideo
                  ) {
                    goTo("home");
                  } else {
                    goTo(destination);
                  }
                }}
                className="block w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-[#28422E]"
              >
                {label}
              </button>
            ))}

            <a
              href="/admin"
              className="block rounded-lg px-3 py-3 text-sm text-[#F08090] hover:bg-[#28422E]"
            >
              Admin dashboard
            </a>
          </div>
        )}
      </aside>

      {/* ==========================================
          RIGHT WORKSPACE
      ========================================== */}
      <div className="ml-[62px] min-h-screen md:ml-[78px]">
        {/* HEADER */}
        <header className="sticky top-0 z-40 flex min-h-[84px] flex-wrap items-center gap-4 border-b border-[#304036] bg-[#0B130F]/95 px-4 py-4 backdrop-blur-xl md:px-8">
          <button
            type="button"
            onClick={() => goTo("home")}
            className="shrink-0 text-lg font-black uppercase tracking-[0.14em]"
          >
            LEE<span className="text-[#E53D53]">HUB</span>
          </button>

          <label className="order-3 flex h-11 w-full min-w-0 items-center gap-3 rounded-full border border-[#3B4C40] bg-[#15241A] px-4 md:order-none md:ml-auto md:w-auto md:max-w-[560px] md:flex-1">
            <Search size={19} className="shrink-0 text-[#9FB19F]" />

            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);

                if (screen !== "home") {
                  goTo("home");
                }
              }}
              placeholder="Search movies, creators, documentaries..."
              className="w-full min-w-0 bg-transparent text-sm text-white outline-none placeholder:text-[#819283]"
            />
          </label>

          <button
            type="button"
            onClick={() => goTo("entry")}
            className="ml-auto flex h-11 min-w-[87px] items-center justify-center gap-2 rounded-full border border-[#B71D31] bg-[#351820] px-4 text-xs font-bold hover:bg-[#51212D] md:ml-0"
          >
            About <ArrowRight size={14} />
          </button>
        </header>

        {/* ======================================
            ENTRY SCREEN
        ====================================== */}
        {screen === "entry" && (
          <main className="grid min-h-[calc(100vh-84px)] grid-cols-1 lg:grid-cols-[1.75fr_1fr]">
            <section className="min-w-0 bg-[radial-gradient(ellipse_at_25%_35%,#1E4A33,#07120F_70%)] px-6 py-10 md:px-12 md:py-16">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.22em] text-[#C8D7C7]">
                <span>LeeHub Media</span>
                <span>Tanzania / Worldwide</span>
              </div>

              <div className="mt-12 max-w-[850px]">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#F06B7E]">
                  Watch stories differently
                </p>

                <h1 className="mt-6 max-w-[780px] text-4xl font-black leading-[1.05] tracking-tight md:text-6xl xl:text-7xl">
                  Every story deserves
                  <span className="text-[#EF556B]"> a screen.</span>
                </h1>

                <p className="mt-6 max-w-[580px] text-sm leading-7 text-[#C0CBBF] md:text-base">
                  Discover creators, movies, music, series and
                  documentaries through LeeHub Media. A home
                  for creative stories from Tanzania and beyond.
                </p>

                <div className="relative mt-8 aspect-video overflow-hidden rounded-2xl border border-[#4B5A4C] bg-[#09130F] shadow-2xl">
                  <video
                    src={INTRO_VIDEO}
                    autoPlay
                    loop
                    muted={introMuted}
                    playsInline
                    className="h-full w-full object-cover"
                  />

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  <div className="absolute bottom-4 left-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#F4A3AE]">
                      The LeeHub Experience
                    </p>
                    <h2 className="mt-1 text-lg font-bold">
                      Stories without borders
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIntroMuted(!introMuted)}
                    aria-label={
                      introMuted ? "Unmute" : "Mute"
                    }
                    className="absolute bottom-4 right-4 rounded-full border border-white/30 bg-black/50 p-3 backdrop-blur-md"
                  >
                    {introMuted ? (
                      <VolumeX size={18} />
                    ) : (
                      <Volume2 size={18} />
                    )}
                  </button>
                </div>
              </div>
            </section>

            <aside className="flex flex-col justify-center border-l border-[#60313D] bg-[#160F12] px-7 py-12 md:px-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F07887]">
                Welcome to LeeHub
              </p>

              <h2 className="mt-5 text-3xl font-black leading-tight md:text-4xl">
                Your next great watch starts here.
              </h2>

              <p className="mt-5 text-sm leading-7 text-[#CDBFC2]">
                Browse our video collection, follow creators
                and discover what's new.
              </p>

              <div className="my-8 rounded-2xl border border-[#74414C] bg-[#281C20] p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    size={23}
                    className="shrink-0 text-[#F07887]"
                  />

                  <div>
                    <h3 className="text-sm font-bold">
                      Free and premium content
                    </h3>

                    <p className="mt-2 text-xs leading-6 text-[#CDBFC2]">
                      Free videos can play directly. Premium
                      videos remain locked until secure
                      payment verification is available.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => goTo("home")}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#B71D31] px-6 py-4 text-sm font-black uppercase tracking-wider transition-colors hover:bg-[#D52A42]"
              >
                Explore Videos
                <ArrowRight size={19} />
              </button>

              <p className="mt-5 text-center text-xs leading-6 text-[#B7A8AA]">
                Browsing the catalog does not purchase or
                unlock premium content.
              </p>
            </aside>
          </main>
        )}

        {/* ======================================
            DISCOVERY HOMEPAGE
        ====================================== */}
        {screen === "home" && (
          <main className="mx-auto max-w-[1800px] px-4 py-6 md:px-8">
            {dataError && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#5D4A38] bg-[#261E14] p-3 text-xs text-[#E8CEAC]">
                <span>{dataError}</span>

                <button
                  type="button"
                  onClick={() =>
                    setRefreshKey((value) => value + 1)
                  }
                  className="flex items-center gap-2 rounded-lg bg-[#463527] px-3 py-2 hover:bg-[#604730]"
                >
                  <RefreshCw size={14} />
                  Retry
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-[#ACB9AE]">
                <RefreshCw className="animate-spin" />
                Loading LeeHub videos...
              </div>
            ) : (
              <>
                <StatusStrip
                  videos={videos}
                  onOpen={openVideo}
                />

                <section className="mt-6">
                  <div className="flex items-center gap-2 overflow-x-auto pb-3 [scrollbar-width:none]">
                    <span className="mr-3 shrink-0 text-[11px] font-black uppercase tracking-widest text-[#B9C8B9]">
                      Categories
                    </span>

                    {FILTERS.map((item) => (
                      <button
                        type="button"
                        key={item}
                        onClick={() => setFilter(item)}
                        className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                          filter === item
                            ? "border-[#D03B52] bg-[#B71D31] text-white"
                            : "border-[#3B4D40] bg-[#142219] text-[#C4D0C5] hover:bg-[#28422E]"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="mt-7">
                  <div className="mb-5 flex items-end justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.23em] text-[#F07887]">
                        Discover
                      </p>

                      <h1 className="mt-1 text-2xl font-black">
                        Latest Videos
                      </h1>
                    </div>

                    <span className="text-xs text-[#9FB19F]">
                      {visibleVideos.length} videos
                    </span>
                  </div>

                  {visibleVideos.length === 0 ? (
                    <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border border-[#304036] bg-[#111A14] p-8 text-center">
                      <Film
                        size={30}
                        className="text-[#7E9482]"
                      />
                      <p className="text-sm text-[#ACB9AE]">
                        No videos match your search or filter.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-7 lg:grid-cols-4">
                      {firstRow.map((video) => (
                        <VideoCard
                          key={video.id}
                          video={video}
                          onOpen={openVideo}
                        />
                      ))}
                    </div>
                  )}
                </section>

                <AdvertisementCarousel />

                {remainingVideos.length > 0 && (
                  <section className="pb-14">
                    <h2 className="mb-6 text-xl font-black">
                      More to Explore
                    </h2>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
                      {remainingVideos.map((video) => (
                        <VideoCard
                          key={video.id}
                          video={video}
                          onOpen={openVideo}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </main>
        )}

        {/* ======================================
            VIDEO WATCH SCREEN
        ====================================== */}
        {screen === "watch" && selectedVideo && (
          <main className="mx-auto grid max-w-[1800px] grid-cols-1 gap-8 px-4 py-7 md:px-8 xl:grid-cols-[minmax(0,3fr)_minmax(300px,1.1fr)]">
            <section className="min-w-0">
              <button
                type="button"
                onClick={() => goTo("home")}
                className="mb-5 inline-flex items-center gap-2 text-sm text-[#B9C9BA] hover:text-white"
              >
                <ChevronLeft size={18} />
                Back to Discover
              </button>

              <VideoPlayer video={selectedVideo} />

              <div className="mt-7 border-b border-[#304036] pb-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F07887]">
                  {selectedVideo.category} /{" "}
                  {selectedVideo.premium
                    ? "Premium"
                    : "Free"}
                </p>

                <h1 className="mt-3 text-2xl font-black md:text-4xl">
                  {selectedVideo.title}
                </h1>

                <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#AFBFAF]">
                  <span>{selectedVideo.channel}</span>
                  <span>•</span>
                  <span>{selectedVideo.duration}</span>
                  <span>•</span>
                  <span>
                    {getTimeAgo(selectedVideo.uploadedAt)}
                  </span>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-[#304036] bg-[#122017] p-6">
                <h2 className="font-bold">
                  About this video
                </h2>

                <p className="mt-3 text-sm leading-7 text-[#ACB9AE]">
                  Published by {selectedVideo.channel} on
                  LeeHub Media.
                  {selectedVideo.premium
                    ? " This is premium content and requires verified access."
                    : " This video is available in the free catalog."}
                </p>
              </div>
            </section>

            <aside className="h-fit rounded-2xl border border-[#405443] bg-[#132017] p-5">
              <h2 className="mb-5 text-xl font-black">
                Up Next
              </h2>

              <label className="mb-5 flex items-center gap-3 rounded-xl border border-[#405443] bg-[#0A120C] px-4 py-3">
                <Search
                  size={17}
                  className="text-[#A8BAAA]"
                />

                <input
                  value={relatedSearch}
                  onChange={(event) => {
                    setRelatedSearch(event.target.value);
                    setRelatedPage(0);
                  }}
                  placeholder="Search related videos..."
                  className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[#859687]"
                />
              </label>

              <div className="space-y-4">
                {currentRelated.map((video) => (
                  <button
                    type="button"
                    key={video.id}
                    onClick={() => openVideo(video)}
                    className="group flex w-full items-start gap-3 text-left"
                  >
                    <div className="relative aspect-video w-[110px] shrink-0 overflow-hidden rounded-lg border border-[#405443] bg-[#142A1D]">
                      <img
                        src={video.thumbnail}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.src =
                            FALLBACK_THUMB;
                        }}
                      />

                      <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play
                          size={16}
                          fill="currentColor"
                        />
                      </span>
                    </div>

                    <div className="min-w-0">
                      <h3 className="line-clamp-2 text-sm font-bold group-hover:text-[#F07887]">
                        {video.title}
                      </h3>

                      <p className="mt-2 truncate text-xs text-[#AEBDAE]">
                        {video.channel}
                      </p>

                      <span className="mt-1 block text-[10px] text-[#E88A99]">
                        {video.premium
                          ? "Premium"
                          : "Free"}
                      </span>
                    </div>
                  </button>
                ))}

                {currentRelated.length === 0 && (
                  <p className="py-6 text-sm text-[#AEBDAE]">
                    No related videos found.
                  </p>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#405443] pt-5">
                <button
                  type="button"
                  disabled={relatedPage === 0}
                  onClick={() =>
                    setRelatedPage((value) =>
                      Math.max(0, value - 1)
                    )
                  }
                  className="flex items-center gap-1 rounded-lg border border-[#506653] bg-[#263E2D] px-3 py-2 text-xs disabled:opacity-35"
                >
                  <ChevronLeft size={15} />
                  Previous
                </button>

                <button
                  type="button"
                  disabled={
                    relatedStart + 4 >=
                    relatedVideos.length
                  }
                  onClick={() =>
                    setRelatedPage((value) => value + 1)
                  }
                  className="flex items-center gap-1 rounded-lg border border-[#506653] bg-[#263E2D] px-3 py-2 text-xs disabled:opacity-35"
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </div>
            </aside>
          </main>
        )}

        {/* FOOTER */}
        <footer className="border-t border-[#304036] bg-[#090F0B] px-6 py-7 text-center text-xs text-[#91A592]">
          © {new Date().getFullYear()} LeeHub Media.
          Discover. Create. Inspire.
        </footer>
      </div>
    </div>
  );
}
