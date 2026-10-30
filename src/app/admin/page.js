"use client";

import React, { useEffect, useState } from "react";

import {
  ArrowLeft,
  UploadCloud,
  ShieldAlert,
  Trash2,
  FileVideo,
  Image as ImageIcon,
  Layers,
  Tv,
  Clock,
  LogOut,
  RefreshCw,
  Lock,
  Coins,
} from "lucide-react";

import { supabase } from "../utils/supabase";

const BASE_URL = (
  process.env.NEXT_PUBLIC_BACKEND_API_URL ||
  "http://localhost:5001"
)
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

const BACKEND_API_URL = `${BASE_URL}/api`;

const fallbackThumbnail =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225"><rect width="400" height="225" fill="#142A1D"/><text x="200" y="115" fill="#88988e" text-anchor="middle" font-family="Arial">No thumbnail</text></svg>'
  );

function normalizeVideos(items) {
  return (Array.isArray(items) ? items : []).map((video) => ({
    ...video,
    thumb: video.thumb || video.thumbnailUrl || "",
    desc: video.desc || video.videoUrl || "",
    length: video.length || video.duration || "",
    price: video.price ?? "0",
  }));
}

export default function AdminDashboard() {
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [videos, setVideos] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("");
  const [length, setLength] = useState("");
  const [price, setPrice] = useState("0");

  const [videoProvider, setVideoProvider] = useState("local_file");
  const [videoUrl, setVideoUrl] = useState("");
  const [rawFileObject, setRawFileObject] = useState(null);
  const [videoFileName, setVideoFileName] = useState("");
  const [pendingThumb, setPendingThumb] = useState("");

  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const inputClass =
    "w-full rounded-xl border border-[#26382D] bg-[#101813] px-4 py-3 text-sm text-white outline-none transition focus:border-[#B71D31]";

  const panelClass =
    "rounded-2xl border border-[#26382D] bg-[#111A14] p-5";

  async function checkSession() {
    try {
      const response = await fetch("/api/admin/session", {
        cache: "no-store",
      });

      const data = await response.json();

      setIsAuthenticated(data.authenticated === true);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  }

  async function fetchUploadedVideos() {
    setListLoading(true);

    try {
      const response = await fetch(`${BACKEND_API_URL}/videos`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const data = await response.json();
      setVideos(normalizeVideos(data));
    } catch (error) {
      console.warn("Backend video feed unavailable:", error.message);

      // Existing project fallback for locally cached metadata.
      try {
        const raw =
          localStorage.getItem("playhub_home_feed_videos") ||
          localStorage.getItem("playhub_admin_videos");

        setVideos(normalizeVideos(raw ? JSON.parse(raw) : []));
      } catch {
        setVideos([]);
      }
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUploadedVideos();
    }
  }, [isAuthenticated]);

  async function handleAdminLogin(event) {
    event.preventDefault();
    setAuthError("");
    setLoginLoading(true);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: passcode,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.authenticated) {
        throw new Error(data.error || "Invalid password");
      }

      setPasscode("");
      setIsAuthenticated(true);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/admin/session", {
        method: "DELETE",
      });
    } finally {
      setIsAuthenticated(false);
      setPasscode("");
      setVideos([]);
    }
  }

  function handleVideoFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setRawFileObject(file);
    setVideoFileName(
      `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`
    );
    setVideoProvider("local_file");
  }

  function handleThumbnailChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please select a valid image");
      return;
    }

    const reader = new FileReader();

    reader.onload = (result) => {
      const image = new window.Image();

      image.onload = () => {
        const canvas = document.createElement("canvas");
        const width = 480;

        canvas.width = width;
        canvas.height = Math.round(
          width * (image.height / image.width)
        );

        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        setPendingThumb(canvas.toDataURL("image/jpeg", 0.7));
      };

      image.src = result.target.result;
    };

    reader.readAsDataURL(file);
  }

  function compileVideoSource(uploadedUrl) {
    if (videoProvider === "local_file") {
      return uploadedUrl || "";
    }

    const source = videoUrl.trim();

    if (source.startsWith("<iframe")) {
      return source;
    }

    if (videoProvider === "vimeo") {
      try {
        const parsed = new URL(source);
        const id = parsed.pathname.split("/").filter(Boolean).pop();

        if (
          !["vimeo.com", "www.vimeo.com", "player.vimeo.com"]
            .includes(parsed.hostname) ||
          !/^\d+$/.test(id)
        ) {
          return source;
        }

        return `https://player.vimeo.com/video/${id}`;
      } catch {
        return source;
      }
    }

    return source;
  }

  async function handlePublishSubmit(event) {
    event.preventDefault();

    if (isPublishing) return;

    setUploadError("");
    setUploadSuccess("");
    setUploadProgress(0);

    if (!title.trim() || !channel.trim()) {
      setUploadError("Title and channel are required.");
      return;
    }

    if (
      videoProvider === "local_file" &&
      !rawFileObject
    ) {
      setUploadError("Select a video file.");
      return;
    }

    if (
      videoProvider !== "local_file" &&
      !videoUrl.trim()
    ) {
      setUploadError("Enter the video URL.");
      return;
    }

    const parsedPrice = Number(price);

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setUploadError("Enter a valid price.");
      return;
    }

    setIsPublishing(true);

    try {
      let finalVideoUrl = videoUrl.trim();

      if (videoProvider === "local_file") {
        // This is the original direct-storage upload path.
        // It requires correctly configured Supabase Storage RLS.
        const extension =
          rawFileObject.name.split(".").pop() || "mp4";

        const filename = `${crypto.randomUUID()}.${extension}`;
        const storagePath = `hd-streams/${filename}`;

        const { error } = await supabase.storage
          .from("terabyte-media")
          .upload(storagePath, rawFileObject, {
            cacheControl: "3600",
            upsert: false,
            contentType: rawFileObject.type,
          });

        if (error) throw error;

        const { data } = supabase.storage
          .from("terabyte-media")
          .getPublicUrl(storagePath);

        finalVideoUrl = data.publicUrl;
        setUploadProgress(80);
      }

      const video = {
        id: `vid_${crypto.randomUUID()}`,
        title: title.trim(),
        channel: channel.trim(),
        length: length.trim() || "0:00",
        price: String(parsedPrice),
        thumb:
          pendingThumb ||
          "linear-gradient(135deg,#142A1D,#0B0D0D)",
        desc: compileVideoSource(finalVideoUrl),
        uploadedAt: new Date().toISOString(),
      };

      const response = await fetch("/api/admin/videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(video),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to publish video");
      }

      // Preserve original project's local metadata cache.
      // Cloud records remain the authoritative shared feed.
      const raw =
        localStorage.getItem("playhub_admin_videos");

      const cached = raw ? JSON.parse(raw) : [];

      const updated = [
        video,
        ...cached.filter((item) => item.id !== video.id),
      ];

      try {
        localStorage.setItem(
          "playhub_admin_videos",
          JSON.stringify(updated)
        );
        localStorage.setItem(
          "playhub_home_feed_videos",
          JSON.stringify(updated)
        );
      } catch {
        console.warn("Local cache capacity exceeded");
      }

      setUploadProgress(100);
      setUploadSuccess("Video successfully published.");

      setTitle("");
      setChannel("");
      setLength("");
      setPrice("0");
      setVideoUrl("");
      setRawFileObject(null);
      setVideoFileName("");
      setPendingThumb("");

      await fetchUploadedVideos();
    } catch (error) {
      setUploadError(error.message || "Publishing failed.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleDeleteVideo(id) {
    if (!window.confirm("Delete this video permanently?")) {
      return;
    }

    setDeletingId(id);
    setUploadError("");

    try {
      const response = await fetch(
        `/api/admin/videos/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Delete failed");
      }

      setVideos((current) =>
        current.filter((item) => item.id !== id)
      );

      for (const key of [
        "playhub_admin_videos",
        "playhub_home_feed_videos",
      ]) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;

          const items = JSON.parse(raw);

          localStorage.setItem(
            key,
            JSON.stringify(
              items.filter((item) => item.id !== id)
            )
          );
        } catch {
          console.warn("Could not update local cache");
        }
      }

      await fetchUploadedVideos();
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setDeletingId(null);
    }
  }

  const totalListedPrice = videos.reduce(
    (sum, item) => sum + (Number(item.price) || 0),
    0
  );

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0B0D0D] text-white">
        <RefreshCw className="animate-spin mr-3" />
        Checking admin session...
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0B0D0D] text-white px-4">
        <form
          onSubmit={handleAdminLogin}
          className="w-full max-w-md rounded-3xl border border-[#28412F] bg-[#142A1D] p-8 space-y-5 shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-[#B71D31]" size={30} />

            <div>
              <h1 className="text-2xl font-black">
                LeeHub Admin
              </h1>
              <p className="text-sm text-gray-400">
                Secure control panel
              </p>
            </div>
          </div>

          <label className="block text-sm text-gray-300">
            Administrator password
          </label>

          <input
            type="password"
            value={passcode}
            onChange={(event) =>
              setPasscode(event.target.value)
            }
            placeholder="Enter your admin password"
            className={inputClass}
            autoComplete="current-password"
            required
          />

          {authError && (
            <p className="text-sm text-red-400">
              {authError}
            </p>
          )}

          <button
            disabled={loginLoading}
            type="submit"
            className="w-full rounded-xl bg-[#B71D31] py-3 font-bold text-white hover:bg-[#D2253C] disabled:opacity-50"
          >
            {loginLoading ? "Verifying..." : "Sign In"}
          </button>

          <div className="flex justify-between text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Lock size={13} />
              Protected access
            </span>

            <a href="/" className="hover:text-white">
              Return home
            </a>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0D0D] text-white">
      <header className="sticky top-0 z-30 border-b border-[#28412F] bg-[#0B0D0D]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-tight">
              LeeHub <span className="text-[#B71D31]">Media</span>
            </h1>

            <p className="text-xs text-gray-400">
              Administrator Control Panel
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="flex items-center gap-2 rounded-xl border border-[#28412F] px-3 py-2 text-sm hover:bg-[#142A1D]"
            >
              <ArrowLeft size={16} />
              Home
            </a>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl bg-[#B71D31] px-4 py-2 text-sm font-bold"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-black">
            Broadcast Studio
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            Manage video uploads, premium content and published media.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <section className="lg:col-span-5">
            <form
              onSubmit={handlePublishSubmit}
              className={`${panelClass} space-y-5`}
            >
              <h3 className="flex items-center gap-2 text-lg font-bold">
                <UploadCloud className="text-[#B71D31]" />
                Publish Video
              </h3>

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Video title
                </label>

                <input
                  className={inputClass}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter video title"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Channel
                  </label>

                  <input
                    className={inputClass}
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    placeholder="Creator"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Duration
                  </label>

                  <input
                    className={inputClass}
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    placeholder="1h 30m"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    TSh
                  </label>

                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Video source
                </label>

                <select
                  className={inputClass}
                  value={videoProvider}
                  onChange={(e) => setVideoProvider(e.target.value)}
                >
                  <option value="local_file">
                    Upload from computer
                  </option>
                  <option value="mp4">
                    YouTube / Video URL
                  </option>
                  <option value="vimeo">
                    Vimeo
                  </option>
                  <option value="bunny">
                    Bunny Stream
                  </option>
                </select>
              </div>

              {videoProvider === "local_file" ? (
                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Video file
                  </label>

                  <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#35543B] bg-[#0B0D0D] p-5 text-center hover:border-[#B71D31]">
                    <FileVideo size={28} className="text-[#B71D31]" />

                    <span className="text-sm text-gray-400">
                      {videoFileName ||
                        "Click to select a video"}
                    </span>

                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Video URL or embed source
                  </label>

                  <input
                    className={inputClass}
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://..."
                    required
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Video thumbnail
                </label>

                <label className="relative flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#35543B] bg-[#0B0D0D] hover:border-[#B71D31]">
                  {pendingThumb ? (
                    <img
                      src={pendingThumb}
                      alt="Selected thumbnail"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <ImageIcon size={30} />
                      <span className="text-sm">
                        Choose cover image
                      </span>
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    className="hidden"
                  />
                </label>
              </div>

              {uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-[#28412F]">
                    <div
                      className="h-full bg-[#B71D31] transition-all"
                      style={{
                        width: `${uploadProgress}%`,
                      }}
                    />
                  </div>

                  <p className="text-xs text-gray-400">
                    {uploadProgress === 100
                      ? "Publishing completed"
                      : "Processing video..."}
                  </p>
                </div>
              )}

              {uploadError && (
                <p className="rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
                  {uploadError}
                </p>
              )}

              {uploadSuccess && (
                <p className="rounded-xl border border-green-800 bg-green-950/30 p-3 text-sm text-green-300">
                  {uploadSuccess}
                </p>
              )}

              <button
                type="submit"
                disabled={isPublishing}
                className="w-full rounded-xl bg-[#B71D31] px-5 py-4 font-bold hover:bg-[#D2253C] disabled:opacity-50"
              >
                {isPublishing
                  ? "Publishing..."
                  : "Publish Video"}
              </button>
            </form>
          </section>

          <section className="space-y-6 lg:col-span-7">
            <div className={`${panelClass} grid grid-cols-2 gap-4`}>
              <div>
                <p className="text-sm text-gray-400">
                  Published videos
                </p>

                <div className="mt-2 flex items-center gap-3">
                  <Tv className="text-[#B71D31]" />

                  <span className="text-3xl font-black">
                    {videos.length}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400">
                  Combined listed prices
                </p>

                <div className="mt-2 flex items-center gap-3">
                  <Coins className="text-[#B71D31]" />

                  <span className="text-2xl font-black">
                    TSh {totalListedPrice.toLocaleString()}
                  </span>
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  Not actual payment revenue
                </p>
              </div>
            </div>

            <div className={panelClass}>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <Layers className="text-[#B71D31]" />
                  Published Video Feed
                </h3>

                <button
                  onClick={fetchUploadedVideos}
                  disabled={listLoading}
                  className="rounded-xl border border-[#35543B] p-2 hover:bg-[#142A1D]"
                  title="Refresh videos"
                >
                  <RefreshCw
                    size={17}
                    className={listLoading ? "animate-spin" : ""}
                  />
                </button>
              </div>

              {videos.length === 0 ? (
                <p className="rounded-xl bg-[#0B0D0D] p-8 text-center text-sm text-gray-400">
                  No videos available.
                </p>
              ) : (
                <div className="max-h-[650px] space-y-3 overflow-y-auto">
                  {videos.map((video) => (
                    <div
                      key={video.id}
                      className="flex items-center gap-4 rounded-xl border border-[#26382D] bg-[#0B0D0D] p-3"
                    >
                      <img
                        src={
                          video.thumb &&
                          !video.thumb.startsWith("linear")
                            ? video.thumb
                            : fallbackThumbnail
                        }
                        alt={video.title}
                        className="h-16 w-24 shrink-0 rounded-lg object-cover"
                        onError={(event) => {
                          event.currentTarget.src = fallbackThumbnail;
                        }}
                      />

                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-bold">
                          {video.title}
                        </h4>

                        <p className="mt-1 truncate text-xs text-gray-400">
                          {video.channel}
                        </p>

                        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                          <Clock size={12} />
                          {video.length || "Unknown"}

                          <span>·</span>

                          <span className="font-semibold text-[#E15565]">
                            {Number(video.price) > 0
                              ? `TSh ${Number(video.price).toLocaleString()}`
                              : "Free"}
                          </span>
                        </p>
                      </div>

                      <button
                        onClick={() => handleDeleteVideo(video.id)}
                        disabled={deletingId === video.id}
                        className="rounded-xl p-3 text-gray-400 hover:bg-[#B71D31]/20 hover:text-red-400 disabled:opacity-40"
                        title="Delete video"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}