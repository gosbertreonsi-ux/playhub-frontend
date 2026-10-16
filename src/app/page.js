'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Search,
  Compass,
  Film,
  Lock,
  AlertCircle,
  RefreshCw,
  Clock,
  X,
  Minimize2,
  Maximize2,
  ArrowRight,
} from 'lucide-react';

// Placeholder thumbnail: self-contained SVG so it never depends on an external host
const FALLBACK_THUMB =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225">
       <rect width="100%" height="100%" fill="#18181b"/>
       <text x="50%" y="50%" fill="#52525b" font-family="sans-serif" font-size="16"
         text-anchor="middle" dominant-baseline="middle">No thumbnail</text>
     </svg>`
  );

// Film-grain texture, tiled over the whole app (self-contained SVG filter, no image request)
const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Height of the fixed hero banner. The banner and the scroll spacer below it must match.
const BANNER_HEIGHT = 'h-[320px] md:h-[420px]';

const FILTER_CHIPS = ['All', 'Premium', 'Free', 'Movies', 'Series', 'Live'];
const MOBILE_OPERATORS = ['mpesa', 'tigopesa', 'airtel', 'halopesa'];

export default function PlayHubHome() {
  // STATE VARIABLES

  // Navigation and core content
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSiteLocked, setIsSiteLocked] = useState(true);
  const [activeChip, setActiveChip] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Paywall form
  const [paymentMethod, setPaymentMethod] = useState('momo');
  const [selectedOp, setSelectedOp] = useState('mpesa');
  const [momoPhone, setMomoPhone] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardNum, setCardNum] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [payError, setPayError] = useState('');
  const [payStatusText, setPayStatusText] = useState('Pay with M-Pesa');

  // Site-wide payment verification / polling
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState(null);

  // Per-video (PPV) payment verification / polling
  const [isCheckingPpv, setIsCheckingPpv] = useState(false);
  const [currentPpvTxId, setCurrentPpvTxId] = useState(null);
  const [ppvStatusText, setPpvStatusText] = useState('Pay to Unlock Video');

  // Lightbox / video player
  const [activeVideo, setActiveVideo] = useState(null);
  const [isPpvLocked, setIsPpvLocked] = useState(false);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);

  const mainRef = useRef(null);

  // BACKEND URL
  const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:5001/api';
  const BACKEND_API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

  // DATA FETCHING
  const fetchCloudVideos = async () => {
    let dbVideos = [];
    let localVideos = [];

    // Try the backend first
    try {
      const res = await fetch(`${BACKEND_API_URL}/videos`);
      if (res.ok) dbVideos = await res.json();
    } catch (err) {
      console.warn('Backend link offline, falling back to cache repositories.');
    }

    // Read the local cache
    try {
      const rawAdmin = window.localStorage.getItem('playhub_admin_videos');
      const rawHome = window.localStorage.getItem('playhub_home_feed_videos');
      const chosenRaw = rawHome || rawAdmin;
      if (chosenRaw) localVideos = JSON.parse(chosenRaw);
    } catch (e) {
      console.error('Local feed stream reading block:', e);
    }

    // Merge both sources, de-duplicated by id
    const compositeMap = new Map();
    [...localVideos, ...dbVideos].forEach((item) => {
      if (item && item.id) compositeMap.set(item.id, item);
    });

    // NORMALIZE: AdminDashboard saves videos as { thumb, length, desc, ... }
    // while this screen reads { thumbnailUrl, duration, videoUrl, ... }
    const normalized = Array.from(compositeMap.values()).map((v) => {
      const thumbIsUsableUrl = v.thumb && !v.thumb.startsWith('linear');
      return {
        ...v,
        thumbnailUrl: v.thumbnailUrl || (thumbIsUsableUrl ? v.thumb : null),
        duration: v.duration || v.length || '0:00',
        videoUrl: v.videoUrl || v.desc || '',
      };
    });

    // Newest first
    const finalSynchronizedFeed = normalized.sort(
      (a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
    );

    setVideos(finalSynchronizedFeed);
    setLoading(false);
  };

  // FETCH CLOUD VIDEOS ON MOUNT
  useEffect(() => {
    fetchCloudVideos();
  }, []);

  // POLL SITE-WIDE PAYMENT STATUS
  useEffect(() => {
    if (!currentTransactionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_API_URL}/api/payments/status/${currentTransactionId}`);
        const data = await res.json();

        if (data.status === 'completed' || data.status === 'success') {
          clearInterval(interval);
          setIsCheckingPayment(false);
          setCurrentTransactionId(null);
          setIsSiteLocked(false);
          setPayStatusText('Pay with M-Pesa');
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          clearInterval(interval);
          setIsCheckingPayment(false);
          setCurrentTransactionId(null);
          setPayError('Payment was not completed. Please try again.');
          setPayStatusText('Pay with M-Pesa');
        }
      } catch (err) {
        console.error('Payment status poll failed:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentTransactionId]);

  // POLL PER-VIDEO (PPV) PAYMENT STATUS
  useEffect(() => {
    if (!currentPpvTxId || !activeVideo) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_API_URL}/api/payments/status/${currentPpvTxId}`);
        const data = await res.json();

        if (data.status === 'completed' || data.status === 'success') {
          clearInterval(interval);
          window.localStorage.setItem(`playhub_ppv_paid_${activeVideo.id}`, '1');
          setIsCheckingPpv(false);
          setCurrentPpvTxId(null);
          setIsPpvLocked(false);
          setPpvStatusText('Pay to Unlock Video');
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          clearInterval(interval);
          setIsCheckingPpv(false);
          setCurrentPpvTxId(null);
          setPpvStatusText(`Pay TSh ${parseInt(activeVideo.price).toLocaleString()} to Unlock`);
        }
      } catch (err) {
        console.error('PPV status poll failed:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentPpvTxId, activeVideo]);

  // PAYWALL FORM HANDLERS
  const handleOperatorSwitch = (e, networkKey) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCheckingPayment) return;
    setSelectedOp(networkKey);
  };

  const handleMethodTabSwitch = (e, methodKey) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCheckingPayment) return;
    setPaymentMethod(methodKey);
    setPayError('');
  };

  const handlePhoneInput = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 9);
    setMomoPhone(val);
  };

  const handleCardNumInput = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 19);
    const spaced = v.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNum(spaced);
  };

  const handleCardExpInput = (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
    setCardExp(v);
  };

  // VIDEO ACCESS CHECK
  const handleVerifyVideoAccess = (video) => {
    if (isSiteLocked) return;

    const ppvStorageKey = `playhub_ppv_paid_${video.id}`;
    const isVideoPurchased = window.localStorage.getItem(ppvStorageKey) === '1';
    const cleanPrice = parseInt(video.price);
    const isFree = isNaN(cleanPrice) || cleanPrice <= 0;

    setActiveVideo(video);
    setIsMiniPlayer(false);

    if (!isFree && !isVideoPurchased) {
      setIsPpvLocked(true);
      setPpvStatusText(`Pay TSh ${cleanPrice.toLocaleString()} to Unlock`);
    } else {
      setIsPpvLocked(false);
    }
  };

  // CLOSE VIDEO PLAYER
  const handleCloseVideo = () => {
    setActiveVideo(null);
    setIsPpvLocked(false);
    setIsCheckingPpv(false);
    setCurrentPpvTxId(null);
    setIsMiniPlayer(false);
  };

  // SITE GATE PAYMENT
  const handleSiteGateSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isCheckingPayment) return;
    setPayError('');

    // Validate the form
    if (paymentMethod === 'momo') {
      const cleanPhone = momoPhone.replace(/\D/g, '');
      if (cleanPhone.length !== 9) {
        setPayError('Enter a valid 9-digit Tanzanian mobile number (e.g., 740 462 193).');
        return;
      }
    } else {
      const cleanCardNum = cardNum.replace(/\s+/g, '');
      const cleanCardExp = cardExp.trim();
      const cleanCardCvc = cardCvc.replace(/\D/g, '');

      if (cardName.trim().length < 2) {
        setPayError('Enter the name on the card.');
        return;
      }
      if (cleanCardNum.length < 13 || cleanCardNum.length > 19) {
        setPayError('Enter a valid card number.');
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(cleanCardExp)) {
        setPayError('Expiry must be in MM/YY format (e.g., 08/27).');
        return;
      }
      if (cleanCardCvc.length < 3) {
        setPayError('Enter a valid CVC.');
        return;
      }
    }

    setIsCheckingPayment(true);
    setPayStatusText('Initiating Push Request...');

    try {
      const response = await fetch(`${BACKEND_API_URL}/payments/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: paymentMethod,
          phone: `255${momoPhone}`,
          operator: selectedOp,
          amount: 20000,
          currency: 'TZS',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Gateway connection timeout.');

      setCurrentTransactionId(data.transactionId);
      setPayStatusText('Enter PIN prompt on your phone...');
    } catch (err) {
      setPayError(err.message || 'Payment initiation failed. Please check network.');
      setIsCheckingPayment(false);
    }
  };

  // PPV PAYMENT
  const handleProcessLocalPPV = async (video) => {
    if (isCheckingPpv) return;
    setIsCheckingPpv(true);
    setPpvStatusText('Initiating Push Request...');

    try {
      const response = await fetch(`${BACKEND_API_URL}/payments/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'momo',
          phone: `255${momoPhone || '740000000'}`,
          operator: selectedOp,
          amount: parseInt(video.price),
          currency: 'TZS',
          videoId: video.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Gateway communication failure.');

      setCurrentPpvTxId(data.transactionId);
      setPpvStatusText('Enter PIN on phone...');
    } catch (err) {
      alert(err.message || 'Video access payment request failed.');
      setPpvStatusText(`Pay TSh ${parseInt(video.price).toLocaleString()} to Unlock`);
      setIsCheckingPpv(false);
    }
  };

  // RELATIVE TIME
  const getTimeAgo = (isoString) => {
    if (!isoString) return 'just now';

    const mins = Math.round((Date.now() - new Date(isoString).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins === 1) return '1m ago';
    if (mins < 60) return `${mins}m ago`;

    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;

    return `${Math.round(hrs / 24)}d ago`;
  };

  // FILTERING LOGIC
  const filteredVideos = videos.filter((v) => {
    const textQuery = searchQuery.toLowerCase();
    const chipQuery = activeChip.toLowerCase();

    const matchesSearch =
      !searchQuery ||
      v.title?.toLowerCase().includes(textQuery) ||
      v.channel?.toLowerCase().includes(textQuery);

    let matchesChip = true;
    if (activeChip === 'Premium') {
      matchesChip = parseInt(v.price) > 0;
    } else if (activeChip === 'Free') {
      matchesChip = parseInt(v.price) <= 0 || !v.price;
    } else if (activeChip !== 'All') {
      matchesChip =
        v.title?.toLowerCase().includes(chipQuery) ||
        v.channel?.toLowerCase().includes(chipQuery);
    }

    return matchesSearch && matchesChip;
  });

  return (
    // Root frame
    <div className="h-screen w-full bg-[#07070a] text-[#f8fafc] font-sans antialiased selection:bg-[#ef4444]/30 overflow-hidden relative">
      {/* FIXED CINEMATIC HERO BANNER: one div, pinned, never scrolls */}
      <div
        className={`fixed top-0 inset-x-0 z-0 w-full ${BANNER_HEIGHT} overflow-hidden bg-neutral-950`}
      >
        <div
          className="absolute inset-0 z-20 pointer-events-none opacity-[0.015]"
          style={{ backgroundImage: NOISE_BG }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070709] via-transparent to-[#070709]/80 z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070709]/90 via-[#070709]/40 to-transparent z-10 pointer-events-none" />

        <video
          autoPlay
          loop
          muted
          playsInline
          src="/11.mp4"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-60"
        />

        <div className="absolute inset-0 z-20 flex flex-col justify-end p-6 md:p-10 space-y-3.5 max-w-xl">
          <div className="space-y-1.5">
            <span className="text-[10px] text-amber-400 font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
              Trending Cinema
            </span>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white leading-none">
              THE DAR EXPEDITION
            </h1>
            <p className="text-xs text-neutral-400 font-medium leading-relaxed line-clamp-2 md:line-clamp-none">
              Stream feature-length Tanzanian cinematic assets instantly. Experience high-definition
              action and documentaries cleared seamlessly via local mobile money channels.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button className="bg-white hover:bg-neutral-200 text-black text-xs font-black px-5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-lg">
              <Play size={13} className="fill-current" /> Watch Trailer
            </button>
            <button className="bg-white/10 hover:bg-white/15 border border-white/5 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer">
              More Info
            </button>
          </div>
        </div>
      </div>

      {/* FILM GRAIN: persistent, tiled, sits above the background but below the UI */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none opacity-[0.16] mix-blend-overlay"
        style={{ backgroundImage: NOISE_BG, backgroundRepeat: 'repeat' }}
      />

      {/* FLOATING MINIMAL NAV */}
      <nav className="fixed top-0 inset-x-0 z-40 flex items-center justify-between gap-4 px-6 py-4 bg-gradient-to-b from-black/85 via-black/30 to-transparent pointer-events-none">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0 select-none pointer-events-auto">
          <svg
            viewBox="0 0 512 512"
            className="h-9 w-9 shrink-0 drop-shadow-[0_0_10px_rgba(59,130,246,0.65)]"
            aria-label="PlayHub"
          >
            <defs>
              <linearGradient id="ph-nav-bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#1d4ed8" />
                <stop offset="0.55" stopColor="#0b1b4d" />
                <stop offset="1" stopColor="#05070f" />
              </linearGradient>
              <linearGradient id="ph-nav-fg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="1" stopColor="#a9c4ff" />
              </linearGradient>
            </defs>
            <circle cx="256" cy="256" r="248" fill="url(#ph-nav-bg)" />
            <circle
              cx="256"
              cy="256"
              r="240"
              fill="none"
              stroke="#3b82f6"
              strokeOpacity="0.45"
              strokeWidth="4"
            />
            <path
              fill="url(#ph-nav-fg)"
              fillRule="evenodd"
              d="M168 120 H280 A100 100 0 0 1 280 320 H250 V392 H168 Z M240 170 V270 L330 220 Z"
            />
          </svg>
          <span className="text-xl font-black tracking-wider text-white">PLAYHUB</span>
        </div>

        {/* Search */}
        <div className="relative max-w-md w-full hidden md:block pointer-events-auto">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search premium videos, channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-[#ef4444] backdrop-blur-md"
          />
        </div>

        {/* Explore button and avatar */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <button className="p-2 text-neutral-300 hover:text-white rounded-xl hover:bg-white/10">
            <Compass className="h-5 w-5" />
          </button>
          <div className="h-8 w-px bg-white/10" />
          <div className="h-8 w-8 rounded-full bg-neutral-700 border border-neutral-600 flex items-center justify-center text-xs font-bold text-white select-none">
            PH
          </div>
        </div>
      </nav>

      {/* FLOATING FILTER CHIPS */}
      <div className="fixed top-[66px] inset-x-0 z-30 flex justify-center px-4 pointer-events-none">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pointer-events-auto max-w-full bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl px-2 py-1.5 shadow-xl">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setActiveChip(chip)}
              className={`px-3.5 py-1.5 text-[11px] font-bold rounded-xl whitespace-nowrap border ${
                activeChip === chip
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-transparent text-neutral-300 border-transparent hover:text-white hover:bg-white/10'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN SCROLL REGION */}
      <main
        ref={mainRef}
        className={`relative z-10 h-screen w-full scroll-smooth ${
          isSiteLocked ? 'overflow-hidden' : 'overflow-y-scroll'
        }`}
      >
        {/* Transparent spacer: lets the fixed banner show through untouched */}
        <div className={`${BANNER_HEIGHT} w-full pointer-events-none`} />

        {/* Solid card surface: this is what visually covers the banner */}
        <div className="bg-[#08080c] rounded-t-3xl min-h-[calc(100vh-1px)]">
          <div className="w-full px-4 sm:px-6 pt-14 pb-16">
            {loading ? (
              // Loading state
              <div className="flex justify-center mt-24">
                <span className="text-[10px] tracking-[0.3em] text-neutral-600 uppercase">
                  Loading streams…
                </span>
              </div>
            ) : filteredVideos.length === 0 ? (
              // Empty state
              <div className="text-center px-6 mt-24">
                <Film className="h-8 w-8 text-neutral-700 mx-auto mb-2" />
                <p className="text-xs text-neutral-500">No media streams match your filters.</p>
              </div>
            ) : (
              // Video grid
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-8 max-w-[1800px] mx-auto">
                {filteredVideos.map((video) => {
                  const itemPrice = parseInt(video.price);
                  const isPremium = !isNaN(itemPrice) && itemPrice > 0;

                  return (
                    <div
                      key={video.id}
                      onClick={() => handleVerifyVideoAccess(video)}
                      className="group cursor-pointer flex flex-col"
                    >
                      {/* Thumbnail */}
                      <div
                        className="relative w-full aspect-video rounded-2xl overflow-hidden bg-neutral-900 bg-center bg-cover ring-1 ring-white/10"
                        style={{
                          backgroundImage: `url(${video.thumbnailUrl || FALLBACK_THUMB})`,
                        }}
                      >
                        {/* Premium / Free badge */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          {isPremium ? (
                            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-md backdrop-blur-md uppercase tracking-wider">
                              Premium
                            </span>
                          ) : (
                            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md backdrop-blur-md uppercase tracking-wider">
                              Free
                            </span>
                          )}
                        </div>

                        {/* Duration */}
                        <div className="absolute bottom-2.5 right-2.5 bg-black/75 px-1.5 py-0.5 rounded text-[11px] font-bold text-neutral-200 tracking-tight">
                          {video.duration || '0:00'}
                        </div>

                        {/* Play button on hover */}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                          <div className="h-14 w-14 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                            <Play className="h-6 w-6 fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Title, channel and time */}
                      <div className="flex items-start gap-3 mt-3">
                        <div className="h-10 w-10 shrink-0 rounded-full bg-neutral-700 border border-neutral-600 flex items-center justify-center text-xs font-bold text-white select-none">
                          {(video.channel || 'PH').slice(0, 2).toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-bold text-[15px] leading-snug text-neutral-100 group-hover:text-white tracking-tight line-clamp-2">
                            {video.title}
                          </h3>
                          <p className="text-[13px] text-neutral-400 mt-1 font-medium truncate">
                            {video.channel || 'PlayHub Streamer'}
                          </p>
                          <div className="flex items-center gap-1.5 text-[12px] text-neutral-500 font-semibold mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock size={11} /> {getTimeAgo(video.uploadedAt)}
                            </span>
                            {isPremium && (
                              <>
                                <span className="text-neutral-600">·</span>
                                <span className="text-amber-400 font-extrabold">
                                  TSh {parseInt(video.price).toLocaleString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* VIDEO LIGHTBOX PLAYER */}
      {activeVideo && (
        <div
          className={
            isMiniPlayer
              ? 'fixed bottom-4 right-4 z-50 w-64 sm:w-80 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-[#27272a] bg-[#0e0e11]'
              : 'fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-md'
          }
        >
          <div
            className={
              isMiniPlayer
                ? 'w-full flex flex-col'
                : 'bg-[#0e0e11] border border-[#27272a] w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]'
            }
          >
            {/* Player header */}
            <div
              className={
                isMiniPlayer
                  ? 'flex items-center justify-between px-2.5 py-2 bg-neutral-900/80'
                  : 'flex items-center justify-between p-4 border-b border-[#27272a] bg-neutral-900/40'
              }
            >
              <div className="truncate pr-4">
                {!isMiniPlayer && (
                  <span className="text-[10px] bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                    Theater View
                  </span>
                )}
                <h2
                  className={
                    isMiniPlayer
                      ? 'text-[11px] font-bold text-white truncate'
                      : 'text-sm font-bold text-white truncate mt-1 tracking-tight'
                  }
                >
                  {activeVideo.title}
                </h2>
              </div>

              <div
                className={
                  isMiniPlayer ? 'flex items-center gap-1 shrink-0' : 'flex items-center gap-2 shrink-0'
                }
              >
                {/* Minimize / expand */}
                <button
                  onClick={() => setIsMiniPlayer(!isMiniPlayer)}
                  className={
                    isMiniPlayer
                      ? 'h-6 w-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white cursor-pointer'
                      : 'h-8 w-8 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl flex items-center justify-center cursor-pointer'
                  }
                  title={isMiniPlayer ? 'Expand' : 'Minimize: keep watching while you browse'}
                >
                  {isMiniPlayer ? <Maximize2 size={12} /> : <Minimize2 size={14} />}
                </button>

                {/* Close */}
                <button
                  onClick={handleCloseVideo}
                  className={
                    isMiniPlayer
                      ? 'h-6 w-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-300 hover:text-white cursor-pointer'
                      : 'h-8 w-8 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl flex items-center justify-center cursor-pointer'
                  }
                  title="Close"
                >
                  <X size={isMiniPlayer ? 12 : 16} />
                </button>
              </div>
            </div>

            {/* Player body */}
            <div
              className={
                isMiniPlayer
                  ? 'aspect-video bg-black relative'
                  : 'flex-1 bg-black relative flex items-center justify-center aspect-video min-h-[300px]'
              }
            >
              {isPpvLocked ? (
                isMiniPlayer ? (
                  // Locked video in the mini player
                  <button
                    onClick={() => setIsMiniPlayer(false)}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center p-3 cursor-pointer"
                  >
                    <Lock size={16} className="text-amber-400" />
                    <span className="text-[10px] text-neutral-300 font-semibold">
                      Locked — tap to expand & unlock
                    </span>
                  </button>
                ) : (
                  // Locked video in the full player: pay-per-view panel
                  <div className="absolute inset-0 bg-[#0e0e11]/90 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto z-10">
                    <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                      <Lock size={20} />
                    </div>

                    <div>
                      <h3 className="text-base font-black text-white tracking-tight">
                        Pay-Per-View Locked Asset
                      </h3>
                      <p className="text-xs text-neutral-400 mt-1.5 leading-normal">
                        This specific video item requires an individual standalone micro-payment
                        access token to unlock viewing credentials.
                      </p>
                    </div>

                    <div className="bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-center w-full">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">
                        Video Pricing Fee
                      </span>
                      <p className="text-xl font-black text-amber-400 mt-0.5">
                        TSh {parseInt(activeVideo.price).toLocaleString()}
                      </p>
                    </div>

                    <button
                      disabled={isCheckingPpv}
                      onClick={() => handleProcessLocalPPV(activeVideo)}
                      className={`w-full font-extrabold py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer
                        ${
                          isCheckingPpv
                            ? 'bg-neutral-800 text-neutral-500 border border-white/5 shadow-none cursor-not-allowed'
                            : 'bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/10'
                        }`}
                    >
                      {isCheckingPpv && (
                        <RefreshCw size={12} className="animate-spin text-amber-500" />
                      )}
                      {isCheckingPpv
                        ? ppvStatusText
                        : `Pay TSh ${parseInt(activeVideo.price).toLocaleString()} to Unlock`}
                    </button>
                  </div>
                )
              ) : activeVideo.videoUrl?.trim().startsWith('<iframe') ? (
                // Embedded player (iframe code)
                <div
                  className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
                  dangerouslySetInnerHTML={{ __html: activeVideo.videoUrl }}
                />
              ) : (
                // Direct video file
                <video
                  src={activeVideo.videoUrl}
                  controls
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* GATEWAY ENTRY PAYWALL CONTROLLER */}
      {isSiteLocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-hidden">
          {/* Backdrop video and shading */}
          <div className="absolute inset-0 w-full h-full z-0 overflow-hidden pointer-events-none select-none">
            <div className="absolute inset-0 bg-gradient-to-t from-[#03060c] via-black/20 to-[#03060c] z-20" />
            <div
              className="absolute inset-0 bg-black/40 z-0
                [background:radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.65)_60%)]"
            />
            <video
              autoPlay
              loop
              muted
              playsInline
              src="/11.mp4"
              className="w-full h-full object-cover object-center opacity-40"
            />
          </div>

          {/* Spotlight beams and drifting fog */}
          <style>{`
            @keyframes ph-fog-drift {
              0%   { transform: translate3d(-3%, 0, 0) scale(1.05); opacity: .85; }
              50%  { transform: translate3d(3%, -2%, 0) scale(1.12); opacity: 1; }
              100% { transform: translate3d(-3%, 0, 0) scale(1.05); opacity: .85; }
            }
            @keyframes ph-beam-breathe {
              0%, 100% { opacity: .7; }
              50%      { opacity: 1; }
            }
          `}</style>

          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
            {/* Beam 1 */}
            <div
              className="absolute -top-10 left-[14%] w-[26%] h-full"
              style={{
                background:
                  'conic-gradient(from 180deg at 50% 0%, transparent 168deg, rgba(120,175,235,0.42) 180deg, transparent 192deg)',
                filter: 'blur(18px)',
                animation: 'ph-beam-breathe 7s ease-in-out infinite',
              }}
            />
            {/* Beam 2 */}
            <div
              className="absolute -top-10 left-[37%] w-[26%] h-full"
              style={{
                background:
                  'conic-gradient(from 180deg at 50% 0%, transparent 170deg, rgba(150,200,250,0.5) 180deg, transparent 190deg)',
                filter: 'blur(16px)',
                animation: 'ph-beam-breathe 9s ease-in-out infinite 1.5s',
              }}
            />
            {/* Beam 3 */}
            <div
              className="absolute -top-10 left-[60%] w-[26%] h-full"
              style={{
                background:
                  'conic-gradient(from 180deg at 50% 0%, transparent 168deg, rgba(100,160,225,0.4) 180deg, transparent 192deg)',
                filter: 'blur(18px)',
                animation: 'ph-beam-breathe 8s ease-in-out infinite 3s',
              }}
            />
            {/* Fog */}
            <div
              className="absolute inset-[-10%]"
              style={{
                background:
                  'radial-gradient(ellipse 55% 45% at 50% 20%, rgba(70,130,200,0.38), transparent 70%), radial-gradient(ellipse 40% 35% at 22% 45%, rgba(40,90,160,0.30), transparent 70%), radial-gradient(ellipse 40% 35% at 78% 42%, rgba(40,90,160,0.28), transparent 70%)',
                filter: 'blur(30px)',
                animation: 'ph-fog-drift 22s ease-in-out infinite',
              }}
            />
          </div>

          {/* Glass card */}
          <div className="w-full max-w-[400px] bg-[#0a1220]/0 border border-[#3b82f6]/10 backdrop-blur-2xl rounded-3xl p-6 shadow-[0_0_10px_-10px_rgba(59,130,246,0.10)] space-y-5 z-30 border-t-[#93c5fd]/10">
            {/* Card header: logo, title and free-entry button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg
                  viewBox="0 0 512 512"
                  className="h-9 w-9 shrink-0 drop-shadow-[0_0_10px_rgba(59,130,246,0.65)]"
                  aria-label="PlayHub"
                >
                  <defs>
                    <linearGradient id="ph-logo-bg" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#1d4ed8" />
                      <stop offset="0.55" stopColor="#0b1b4d" />
                      <stop offset="1" stopColor="#05070f" />
                    </linearGradient>
                    <linearGradient id="ph-logo-fg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#ffffff" />
                      <stop offset="1" stopColor="#a9c4ff" />
                    </linearGradient>
                  </defs>
                  <circle cx="256" cy="256" r="248" fill="url(#ph-logo-bg)" />
                  <circle
                    cx="256"
                    cy="256"
                    r="240"
                    fill="none"
                    stroke="#3b82f6"
                    strokeOpacity="0.45"
                    strokeWidth="4"
                  />
                  <path
                    fill="url(#ph-logo-fg)"
                    fillRule="evenodd"
                    d="M168 120 H280 A100 100 0 0 1 280 320 H250 V392 H168 Z M240 170 V270 L330 220 Z"
                  />
                </svg>

                <span className="font-bold text-sm tracking-tight text-white">
                  Premium Access Gate
                </span>

                {/* FREE ACCESS BUTTON FOR NOW */}
                <button
                  onClick={() => setIsSiteLocked(false)}
                  aria-label="Free entry"
                  className="group relative flex h-8 w-8 items-center justify-center rounded-xl bg-[#0c1626] border border-[#1b2c47] text-[#aaa] hover:text-white hover:border-[#3b82f6] focus-visible:border-[#3b82f6] transition-all duration-200"
                >
                  <ArrowRight size={16} />

                  {/* Message bubble: always visible, pops upward */}
                  <style>{`
                    @keyframes ph-bubble-float {
                      0%, 100% { transform: translateY(0); }
                      50%      { transform: translateY(-4px); }
                    }
                  `}</style>

                  <span className="absolute bottom-full left-1/2 z-30 mb-2.5 -translate-x-1/2">
                    <span
                      className="relative block whitespace-nowrap rounded-xl border border-[#3b82f6]/50 bg-[#0a1220] px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-sky-300 shadow-[0_0_16px_rgba(59,130,246,0.5)] group-hover:text-white group-hover:border-[#60a5fa]"
                      style={{ animation: 'ph-bubble-float 2.2s ease-in-out infinite' }}
                    >
                      Click here · Free Entry 
                      {/* Little tail pointing down at the button */}
                      <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[#3b82f6]/50 bg-[#0a1220]" />
                    </span>
                  </span>
                </button>
              </div>
            </div>

            {/* Fee box */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 text-center relative overflow-hidden backdrop-blur-sm">
              <p className="text-[11px] font-bold text-[#aaa] uppercase tracking-widest">
                Handshake Passcode Fee
              </p>
              <h2 className="text-3xl font-black text-white mt-1 flex items-center justify-center gap-1">
                
                <span className="text-xs font-semibold text-[#888] uppercase tracking-normal"></span>
              </h2>
            </div>

            {/* Payment method tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/50 border border-white/5 rounded-xl backdrop-blur-sm">
              <button
                disabled={isCheckingPayment}
                onClick={(e) => handleMethodTabSwitch(e, 'momo')}
                className={`py-2.5 text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1.5 ${
                  isCheckingPayment ? 'opacity-40 cursor-not-allowed' : ''
                } ${
                  paymentMethod === 'momo'
                    ? 'bg-[#3b82f6] text-white shadow-md'
                    : 'text-[#aaa] hover:text-white'
                }`}
              >
                Mobile Money
              </button>
              <button
                disabled={isCheckingPayment}
                onClick={(e) => handleMethodTabSwitch(e, 'card')}
                className={`py-2.5 text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-1.5 ${
                  isCheckingPayment ? 'opacity-40 cursor-not-allowed' : ''
                } ${
                  paymentMethod === 'card'
                    ? 'bg-[#3b82f6] text-white shadow-md'
                    : 'text-[#aaa] hover:text-white'
                }`}
              >
                Credit Card
              </button>
            </div>

            {/* Payment form */}
            <form onSubmit={handleSiteGateSubmit} className="space-y-4">
              {paymentMethod === 'momo' ? (
                // Mobile money fields
                <div className="space-y-3">
                  <label className="text-[10px] text-[#aaa] font-bold uppercase tracking-widest block">
                    Select Mobile Operator
                  </label>

                  <div className="grid grid-cols-4 gap-1.5">
                    {MOBILE_OPERATORS.map((op) => (
                      <button
                        key={op}
                        disabled={isCheckingPayment}
                        type="button"
                        onClick={(e) => handleOperatorSwitch(e, op)}
                        className={`py-2 text-[10px] font-extrabold rounded-lg border uppercase tracking-wider cursor-pointer ${
                          isCheckingPayment ? 'opacity-40 cursor-not-allowed' : ''
                        } ${
                          selectedOp === op
                            ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-white'
                            : 'border-white/5 bg-black/20 text-[#aaa] hover:text-white'
                        }`}
                      >
                        {op.replace('pesa', '')}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs text-[#aaa] mb-1.5 font-bold tracking-tight">
                      Tanzanian Mobile Number
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-xs font-bold text-[#666]">
                        +255
                      </span>
                      <input
                        disabled={isCheckingPayment}
                        type="tel"
                        placeholder="740 462 193"
                        value={momoPhone}
                        onChange={handlePhoneInput}
                        className="w-full bg-black/40 border border-[#3b82f6]/20 rounded-xl py-3 pl-14 pr-4 text-xs text-white font-semibold outline-none focus:border-[#3b82f6] focus:bg-black/60 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                // Credit card fields
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[#aaa] mb-1.5 font-bold tracking-tight">
                      Cardholder Name
                    </label>
                    <input
                      disabled={isCheckingPayment}
                      type="text"
                      placeholder="John Doe"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="w-full bg-black/40 border border-[#3b82f6]/20 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#3b82f6] focus:bg-black/60 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#aaa] mb-1.5 font-bold tracking-tight">
                      Card Number
                    </label>
                    <input
                      disabled={isCheckingPayment}
                      type="text"
                      placeholder="4000 1234 5678 9010"
                      value={cardNum}
                      onChange={handleCardNumInput}
                      className="w-full bg-black/40 border border-[#3b82f6]/20 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#3b82f6] focus:bg-black/60 disabled:opacity-50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#aaa] mb-1.5 font-bold tracking-tight">
                        Expiry Date
                      </label>
                      <input
                        disabled={isCheckingPayment}
                        type="text"
                        placeholder="MM/YY"
                        value={cardExp}
                        onChange={handleCardExpInput}
                        className="w-full bg-black/40 border border-[#3b82f6]/20 rounded-xl px-4 py-2.5 text-xs text-white text-center outline-none focus:border-[#3b82f6] focus:bg-black/60 disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-[#aaa] mb-1.5 font-bold tracking-tight">
                        CVC
                      </label>
                      <input
                        disabled={isCheckingPayment}
                        type="password"
                        placeholder="123"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="w-full bg-black/40 border border-[#3b82f6]/20 rounded-xl px-4 py-2.5 text-xs text-white text-center outline-none focus:border-[#3b82f6] focus:bg-black/60 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Error message */}
              {payError && (
                <p className="text-[#7fb2ff] text-xs font-bold text-center bg-[#7fb2ff]/10 p-2.5 rounded-xl border border-[#7fb2ff]/20 tracking-tight flex items-center justify-center gap-1.5">
                  <AlertCircle size={13} /> {payError}
                </p>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isCheckingPayment}
                className={`w-full text-white font-extrabold py-3.5 rounded-xl text-xs tracking-wider uppercase shadow-lg flex items-center justify-center gap-2 cursor-pointer
                  ${
                    isCheckingPayment
                      ? 'bg-[#101c30] text-neutral-400 border border-white/5 shadow-none cursor-not-allowed'
                      : 'bg-[#3b82f6] shadow-blue-500/30'
                  }`}
              >
                {isCheckingPayment && <RefreshCw size={13} className="animate-spin text-white" />}
                {payStatusText}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}