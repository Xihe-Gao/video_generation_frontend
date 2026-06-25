const apiEndpoint = window.API_URL || "https://ltx-gateway.fly.dev";
const pollIntervalMs = 5000;
const DEFAULT_IMAGE = "./materials/song.png";
const DEFAULT_AUDIO = "./materials/song.mp3";

const statusBadge  = document.querySelector("#statusBadge");
const logOutput    = document.querySelector("#logOutput");

const videoPreview = document.querySelector("#videoPreview");
const downloadVideo = document.querySelector("#downloadVideo");
const progressTrack = document.querySelector("#progressTrack");
const progressFill  = document.querySelector("#progressFill");
const heroVideoA   = document.querySelector("#heroVideoA");
const heroVideoB   = document.querySelector("#heroVideoB");

// ---------------------------------------------------------------------------
// Auth state — runs after auth.js initialises Clerk
// ---------------------------------------------------------------------------
window.addEventListener("load", async () => {
  await window.clerkReady;

  const isPlayground = !!document.getElementById("generalForm");
  if (!isPlayground) return; // home page — skip playground-specific setup

  const isLoggedIn = !!window._currentUser;

  // Show/hide guest API key fields
  const guestFieldIds = ["passcodeFieldGeneral", "passcodeFieldAvatar"];
  guestFieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = isLoggedIn;
  });

  if (isLoggedIn) {
    document.getElementById("authNotice") && (document.getElementById("authNotice").hidden = false);
    document.getElementById("creditEstimate") && (document.getElementById("creditEstimate").hidden = false);
    loadCreditBalance();
    updateCreditEstimate(activeMode);

    // Seed prompt from URL ?prompt=...
    const urlPrompt = new URLSearchParams(location.search).get("prompt");
    if (urlPrompt) {
      const pf = document.getElementById("prompt-general");
      if (pf) pf.value = urlPrompt;
    }
  }
});

async function loadCreditBalance() {
  try {
    const token = await window.getAuthToken();
    const r = await fetch(`${apiEndpoint}/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    const el = document.getElementById("creditBalance");
    if (el) el.textContent = d.credits_balance;
  } catch {}
}

function updateCreditEstimate(mode) {
  if (!window._currentUser) return;
  const duration = Number(document.getElementById(`duration-${mode}`)?.value || 9);
  const width    = Number(document.getElementById(`width-${mode}`)?.value  || 1280);
  const height   = Number(document.getElementById(`height-${mode}`)?.value || 720);
  // mirrors credits.py: ceil(duration * (w*h / 921600))
  const cost = Math.max(1, Math.ceil(duration * (width * height) / 921600));
  const el   = document.getElementById("creditCost");
  if (el) el.textContent = cost;
}

const RESOLUTION_PRESETS = {
  landscape: { w: 1280, h: 720 },
  portrait:  { w: 720,  h: 1280 },
};

// ---------------------------------------------------------------------------
// Mode tabs (General / Avatar)
// ---------------------------------------------------------------------------
let activeMode = "general";
const modeTabs = document.querySelectorAll(".mode-tab");
const modePanels = {
  general: document.querySelector('[data-mode-panel="general"]'),
  avatar:  document.querySelector('[data-mode-panel="avatar"]'),
};

modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const mode = tab.dataset.mode;
    if (mode === activeMode) return;
    activeMode = mode;
    modeTabs.forEach((t) => {
      const isActive = t.dataset.mode === mode;
      t.classList.toggle("active", isActive);
      t.setAttribute("aria-selected", String(isActive));
    });
    Object.entries(modePanels).forEach(([m, panel]) => {
      panel.hidden = m !== mode;
    });
  });
});

// ---------------------------------------------------------------------------
// Per-mode state (image/audio object URLs, audio duration)
// ---------------------------------------------------------------------------
const state = {
  general: { imageUrl: DEFAULT_IMAGE, audioDuration: null },
  avatar:  { imageUrl: DEFAULT_IMAGE, audioDuration: null },
};

function el(mode, id) {
  return document.querySelector(`#${id}-${mode}`);
}

function getValue(mode, id) {
  return el(mode, id).value.trim();
}

function getNumber(mode, id) {
  return Number(el(mode, id).value);
}

function getOptionalNumber(mode, id) {
  const value = el(mode, id).value.trim();
  return value === "" ? null : Number(value);
}

function getChecked(mode, id) {
  const node = el(mode, id);
  return node ? node.checked : false;
}

// ---------------------------------------------------------------------------
// Progress bar (shared)
// ---------------------------------------------------------------------------
let _progressTimer = null;

function startProgress(estimatedSeconds) {
  clearInterval(_progressTimer);
  progressFill.classList.remove("done");
  progressFill.style.width = "0%";
  progressTrack.hidden = false;
  const start = Date.now();
  const ms = estimatedSeconds * 1000;
  _progressTimer = setInterval(() => {
    const t = (Date.now() - start) / ms;
    // easeOut: 90 * (1 - e^(-3t)), approaches 90% asymptotically
    const pct = 90 * (1 - Math.exp(-3 * t));
    progressFill.style.width = `${Math.min(pct, 90)}%`;
  }, 300);
}

function completeProgress() {
  clearInterval(_progressTimer);
  progressFill.classList.add("done");
  progressFill.style.width = "100%";
  setTimeout(() => { progressTrack.hidden = true; progressFill.style.width = "0%"; progressFill.classList.remove("done"); }, 1200);
}

function resetProgress() {
  clearInterval(_progressTimer);
  progressTrack.hidden = true;
  progressFill.style.width = "0%";
  progressFill.classList.remove("done");
}

// ---------------------------------------------------------------------------
// Hero video crossfade (unchanged)
// ---------------------------------------------------------------------------
const heroVideoClips = [
  "./videos/clip_1.mp4",
  "./videos/clip_2.mp4",
  "./videos/clip_3.mp4",
  "./videos/clip_4.mp4",
];
let currentHeroClip = 0;
let heroFront = heroVideoA;
let heroBack  = heroVideoB;
let heroCrossfading = false;

function crossfadeToNext() {
  if (heroCrossfading) return;
  heroCrossfading = true;
  currentHeroClip = (currentHeroClip + 1) % heroVideoClips.length;
  heroBack.src = heroVideoClips[currentHeroClip];
  heroBack.style.zIndex = "1";
  heroBack.play().then(() => {
    heroBack.style.opacity = "1";
    heroFront.style.opacity = "0";
    setTimeout(() => {
      heroFront.style.zIndex = "0";
      [heroFront, heroBack] = [heroBack, heroFront];
      heroCrossfading = false;
      attachHeroListeners(heroFront);
    }, 1300);
  }).catch(() => { heroCrossfading = false; });
}

function attachHeroListeners(video) {
  function onTimeUpdate() {
    if (video.duration > 0 && video.duration - video.currentTime < 1.5) {
      video.removeEventListener("timeupdate", onTimeUpdate);
      crossfadeToNext();
    }
  }
  video.addEventListener("timeupdate", onTimeUpdate);
  video.addEventListener("ended", crossfadeToNext, { once: true });
}

if (heroVideoA) attachHeroListeners(heroVideoA);

document.querySelectorAll(".example-card video").forEach((video) => {
  const card = video.closest(".example-card");
  card.addEventListener("mouseenter", () => video.play().catch(() => {}));
  card.addEventListener("mouseleave", () => {
    video.pause();
    video.currentTime = 0;
  });
});

document.querySelectorAll(".example-card[data-prompt]").forEach((card) => {
  card.addEventListener("click", () => {
    const promptField = el("general", "prompt");
    if (promptField) promptField.value = card.dataset.prompt;
  });
});

// ---------------------------------------------------------------------------
// Per-mode wiring: duration slider, resolution preset, image/audio upload
// ---------------------------------------------------------------------------
function setupFormMode(mode, { hasAudio }) {
  const durationRange = el(mode, "durationRange");
  const durationNum = el(mode, "duration");
  durationRange.addEventListener("input", () => { durationNum.value = durationRange.value; updateCreditEstimate(mode); });
  durationNum.addEventListener("input", () => { durationRange.value = durationNum.value; updateCreditEstimate(mode); });

  const resolutionPreset = el(mode, "resolutionPreset");
  const widthInput = el(mode, "width");
  const heightInput = el(mode, "height");
  resolutionPreset.addEventListener("change", () => {
    const val = resolutionPreset.value;
    if (val === "custom") {
      widthInput.removeAttribute("readonly");
      heightInput.removeAttribute("readonly");
    } else {
      const { w, h } = RESOLUTION_PRESETS[val];
      widthInput.value = w;
      heightInput.value = h;
      widthInput.setAttribute("readonly", "");
      heightInput.setAttribute("readonly", "");
    }
    updateCreditEstimate(mode);
  });
  widthInput.addEventListener("input", () => updateCreditEstimate(mode));
  heightInput.addEventListener("input", () => updateCreditEstimate(mode));

  const imageInput = el(mode, "imageInput");
  const uploadLabel = el(mode, "uploadLabel");
  const imageDropZone = el(mode, "imageDropZone");
  const imageChooseBtn = el(mode, "imageChooseBtn");

  uploadLabel.addEventListener("click", () => imageInput.click());
  imageChooseBtn.addEventListener("click", () => imageInput.click());

  imageDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadLabel.style.borderColor = "var(--gold)";
  });
  imageDropZone.addEventListener("dragleave", () => { uploadLabel.style.borderColor = ""; });
  imageDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadLabel.style.borderColor = "";
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      imageInput.files = dt.files;
      imageInput.dispatchEvent(new Event("change"));
    }
  });

  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    const s = state[mode];
    if (!file) {
      uploadLabel.value = "";
      if (s.imageUrl && s.imageUrl !== DEFAULT_IMAGE) URL.revokeObjectURL(s.imageUrl);
      s.imageUrl = DEFAULT_IMAGE;
      return;
    }
    uploadLabel.value = file.name;
    if (s.imageUrl && s.imageUrl !== DEFAULT_IMAGE) URL.revokeObjectURL(s.imageUrl);
    s.imageUrl = URL.createObjectURL(file);
  });

  if (!hasAudio) return;

  // Avatar-only: audio upload, match-audio toggle, prompt-enhance auto-check
  const audioInput = el(mode, "audioInput");
  const audioUploadLabel = el(mode, "audioUploadLabel");
  const audioDropZone = el(mode, "audioDropZone");
  const audioChooseBtn = el(mode, "audioChooseBtn");
  const matchAudio = el(mode, "matchAudio");
  const durationField = el(mode, "durationField");
  const promptEnhance = el(mode, "promptEnhance");

  function applyMatchAudio() {
    const hasAudioLoaded = state[mode].audioDuration !== null;
    if (matchAudio.checked && hasAudioLoaded) {
      const capped = Math.min(state[mode].audioDuration, 20);
      durationRange.value = capped;
      durationNum.value = parseFloat(capped.toFixed(1));
    }
    durationField.classList.toggle("disabled", matchAudio.checked && hasAudioLoaded);
  }

  function loadAudioDuration(src) {
    const a = new Audio();
    a.preload = "metadata";
    a.addEventListener("loadedmetadata", () => {
      state[mode].audioDuration = a.duration;
      applyMatchAudio();
    }, { once: true });
    a.src = src;
  }

  matchAudio.addEventListener("change", applyMatchAudio);

  audioUploadLabel.addEventListener("click", () => audioInput.click());
  audioChooseBtn.addEventListener("click", () => audioInput.click());

  audioInput.addEventListener("change", () => {
    const file = audioInput.files?.[0];
    if (!file) {
      audioUploadLabel.value = "";
      state[mode].audioDuration = null;
      matchAudio.checked = false;
      applyMatchAudio();
      return;
    }
    audioUploadLabel.value = file.name;
    matchAudio.checked = true;
    loadAudioDuration(URL.createObjectURL(file));
  });

  audioDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    audioUploadLabel.style.borderColor = "var(--gold)";
  });
  audioDropZone.addEventListener("dragleave", () => { audioUploadLabel.style.borderColor = ""; });
  audioDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    audioUploadLabel.style.borderColor = "";
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      audioInput.files = dt.files;
      audioUploadLabel.value = file.name;
      matchAudio.checked = true;
      loadAudioDuration(URL.createObjectURL(file));
    }
  });
}

if (document.getElementById("generalForm")) {
  setupFormMode("general", { hasAudio: true });
  setupFormMode("avatar",  { hasAudio: true });
}

// ---------------------------------------------------------------------------
// Submit handling (shared logic, parameterized by mode)
// ---------------------------------------------------------------------------
function buildPayload(mode, imageBase64, audioBase64) {
  const duration = getNumber(mode, "duration");
  if (duration > 20) {
    throw new Error("Duration must be 20 seconds or less.");
  }

  const payload = {
    prompt: getValue(mode, "prompt"),
    duration,
    height: getNumber(mode, "height"),
    width: getNumber(mode, "width"),
    fps: getNumber(mode, "fps"),
    seed: getOptionalNumber(mode, "seed"),
    negative_prompt: getValue(mode, "negativePrompt"),
    workflow: mode,
    verbose: true,
    ...(imageBase64 ? { image_base64: imageBase64 } : {}),
  };

  payload.prompt_enhance = getChecked(mode, "promptEnhance");
  payload.upscale        = getChecked(mode, "upscale");
  if (audioBase64) payload.audio_base64 = audioBase64;

  return payload;
}

async function handleSubmit(mode, event) {
  event.preventDefault();

  // Determine auth mode: Clerk JWT or guest API key
  const isLoggedIn   = !!window._currentUser;
  const guestPasscode = getValue(mode, "passcode");
  if (!isLoggedIn && !guestPasscode) {
    setStatus("error", "Error");
    appendLog("\nError: Sign in or enter an API key");
    return;
  }

  const imageInput = el(mode, "imageInput");
  const audioInput = el(mode, "audioInput");
  const file = imageInput.files?.[0];
  const audioFile = audioInput?.files?.[0];

  if (mode === "avatar" && !audioFile) {
    setStatus("error", "Error");
    appendLog("\nError: Avatar mode requires an audio file");
    return;
  }

  // If audio is selected but duration hasn't loaded yet, wait for it (up to 3s)
  if (audioFile && state[mode].audioDuration === null) {
    await new Promise((resolve) => {
      const a = new Audio();
      a.preload = "metadata";
      a.addEventListener("loadedmetadata", () => {
        state[mode].audioDuration = a.duration;
        resolve();
      }, { once: true });
      a.addEventListener("error", resolve, { once: true });
      a.src = URL.createObjectURL(audioFile);
      setTimeout(resolve, 3000);
    });
  }

  setBusy(mode, true);
  resetVideoLinks();
  resetProgress();

  try {
    setStatus("running", "Running");
    const imageBase64 = file ? await fileToBase64(file) : null;
    const audioBase64 = audioFile ? await fileToBase64(audioFile) : null;
    const payload = buildPayload(mode, imageBase64, audioBase64);

    const tSubmit = Date.now();

    // Build auth headers + choose endpoint
    // pollGetHeaders is a function (not object) so token is refreshed each poll iteration
    let generateUrl, pollGetHeaders, generateHeaders;
    if (isLoggedIn) {
      const token = await window.getAuthToken();
      generateUrl     = `${apiEndpoint}/user/videos/generate`;
      generateHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      pollGetHeaders  = async () => ({ Authorization: `Bearer ${await window.getAuthToken()}` });
    } else {
      generateUrl     = `${apiEndpoint}/v1/videos/generate`;
      generateHeaders = { "Content-Type": "application/json", "X-API-Key": guestPasscode };
      pollGetHeaders  = async () => ({ "X-API-Key": guestPasscode });
    }

    writeLog("POST generate", payload);
    const createResponse = await fetch(generateUrl, {
      method: "POST",
      headers: generateHeaders,
      body: JSON.stringify(payload),
    });

    const createData = await readJson(createResponse);
    if (!createResponse.ok) {
      throw new Error(createData.detail || createData.error || `Generate request failed: ${createResponse.status}`);
    }

    const jobId = createData.job_id;
    if (!jobId) throw new Error("Generate response did not include job_id.");

    // Show credit deduction
    if (createData.credits_cost != null) {
      appendLog(`\nCredits deducted: ${createData.credits_cost} (remaining: ${createData.credits_remaining})`);
      const balEl = document.getElementById("creditBalance");
      if (balEl && createData.credits_remaining != null) balEl.textContent = createData.credits_remaining;
    }

    startProgress(createData.estimated_s || 120);
    setStatus("running", "Running");
    appendLog(`\njob_id: ${jobId}\n`);

    const pollUrl = isLoggedIn
      ? `${apiEndpoint}/user/videos/${encodeURIComponent(jobId)}`
      : `${apiEndpoint}/v1/videos/${encodeURIComponent(jobId)}`;
    const result = await pollUntilDone(pollUrl, pollGetHeaders);
    showCompletedVideo(result.url);
    const wallClock = ((Date.now() - tSubmit) / 1000).toFixed(1);
    if (result.timing) {
      const t = result.timing;
      const parts = [`download: ${t.download_s}s`, `generate: ${t.generate_s}s`];
      if (t.upscale_s != null) parts.push(`upscale: ${t.upscale_s}s${t.sr_fps ? ` (${t.sr_fps} fps)` : ""}`);
      parts.push(`upload: ${t.upload_s}s`, `total: ${t.total_s}s`);
      const coldStart = (wallClock - t.total_s).toFixed(1);
      appendLog(`\n⏱ ${parts.join("  |  ")}`);
      appendLog(`\n⏱ wall clock: ${wallClock}s  (cold start + queue: ~${coldStart}s)`);
    }
    enableSaveLog();
  } catch (error) {
    const message = normalizeFetchError(error);
    setStatus("error", "Error");
    resetProgress();
    appendLog(`\nError: ${message}`);
    enableSaveLog();
  } finally {
    setBusy(mode, false);
  }
}

if (document.getElementById("generalForm")) {
  document.querySelector("#generalForm").addEventListener("submit", (e) => handleSubmit("general", e));
  document.querySelector("#avatarForm").addEventListener("submit", (e) => handleSubmit("avatar", e));
}

async function pollUntilDone(url, getHeaders) {
  while (true) {
    await wait(pollIntervalMs);
    const headers  = await getHeaders();
    const response = await fetch(url, { headers });
    const data     = await readJson(response);
    writeLog(`GET status`, data);

    if (!response.ok) throw new Error(data.detail || data.error || `Status ${response.status}`);
    if (data.status === "completed") {
      if (!data.url && !data.video_url) throw new Error("Completed but no video URL returned.");
      return { ...data, url: data.url || data.video_url };
    }
    if (data.status === "failed") throw new Error(data.error || "Remote job failed.");
    setStatus("running", "Running");
  }
}

function showCompletedVideo(videoUrl) {
  videoPreview.src = videoUrl;

  downloadVideo.dataset.src = videoUrl;
  downloadVideo.classList.remove("disabled");

  completeProgress();
  setStatus("done", "Done");
  appendLog(`\nvideo_url: ${videoUrl}`);
}

const saveLogBtn = document.querySelector("#saveLog");

function enableSaveLog() {
  if (!saveLogBtn) return;
  saveLogBtn.disabled = false;
  saveLogBtn.classList.remove("disabled");
}

if (saveLogBtn) saveLogBtn.addEventListener("click", () => {
  const text = logOutput ? logOutput.textContent : "";
  if (!text) return;
  const blob = new Blob([text], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `frameforge_log_${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});



downloadVideo.addEventListener("click", async (e) => {
  e.preventDefault();
  const src = downloadVideo.dataset.src;
  if (!src || downloadVideo.classList.contains("disabled")) return;
  try {
    const resp = await fetch(src);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "output_ia2v.mp4";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  } catch {
    window.open(src, "_blank");
  }
});

function setStatus(kind, label) {
  statusBadge.className = `result-badge ${kind}`;
  statusBadge.textContent = label;
}

function setBusy(mode, isBusy) {
  const submitButton = el(mode, "submitButton");
  submitButton.disabled = isBusy;
  submitButton.textContent = isBusy ? "Generating..." : "Generate video";
}

function resetVideoLinks() {
  delete downloadVideo.dataset.src;
  downloadVideo.classList.add("disabled");
}

function writeLog(label, value) {
  logOutput.textContent = `${label}\n${JSON.stringify(redactImage(value), null, 2)}`;
}

function appendLog(text) {
  logOutput.textContent += text;
}

function redactImage(value) {
  if (!value || typeof value !== "object") return value;
  return {
    ...value,
    image_base64: value.image_base64 ? `[base64:${value.image_base64.length} chars]` : value.image_base64,
    audio_base64: value.audio_base64 ? `[base64:${value.audio_base64.length} chars]` : value.audio_base64,
  };
}

async function urlToBase64(url) {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return fileToBase64(blob);
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatJobStatus(status) {
  const currentStatus = status || "unknown";
  if (currentStatus === "processing") {
    return "Current status: processing, it could take up to 3 mins";
  }
  return `Current status: ${currentStatus}`;
}

function normalizeFetchError(error) {
  const message = error.message || String(error);
  if (message === "Failed to fetch") {
    return "The browser could not reach the API. This is usually caused by CORS: the Modal API must allow OPTIONS preflight and return Access-Control-Allow-Origin for this frontend domain.";
  }
  return message;
}
