const form = document.querySelector("#generationForm");
const imageInput = document.querySelector("#imageInput");
const uploadLabel = document.querySelector("#uploadLabel");
const imageDropZone = document.querySelector("#imageDropZone");
const imageChooseBtn = document.querySelector("#imageChooseBtn");
const audioInput = document.querySelector("#audioInput");
const audioUploadLabel = document.querySelector("#audioUploadLabel");
const audioDropZone = document.querySelector("#audioDropZone");
const audioChooseBtn = document.querySelector("#audioChooseBtn");
const submitButton = document.querySelector("#submitButton");
const statusBadge = document.querySelector("#statusBadge");
const logOutput = document.querySelector("#logOutput");
const videoPreview = document.querySelector("#videoPreview");
const downloadVideo = document.querySelector("#downloadVideo");
const promptInput = document.querySelector("#prompt");
const heroVideoA = document.querySelector("#heroVideoA");
const heroVideoB = document.querySelector("#heroVideoB");
const resolutionPreset = document.querySelector("#resolutionPreset");
const widthInput = document.querySelector("#width");
const heightInput = document.querySelector("#height");
const progressTrack = document.querySelector("#progressTrack");
const progressFill = document.querySelector("#progressFill");
const matchAudio = document.querySelector("#matchAudio");
const durationRange = document.querySelector("#durationRange");
const durationNum = document.querySelector("#duration");
const durationField = document.querySelector("#durationField");

const pollIntervalMs = 5000;
const DEFAULT_IMAGE = "./materials/song.png";
const DEFAULT_AUDIO = "./materials/song.mp3";
let currentImageUrl = "";
let currentAudioDuration = null;

// Sync range ↔ number input
durationRange.addEventListener("input", () => { durationNum.value = durationRange.value; });
durationNum.addEventListener("input", () => { durationRange.value = durationNum.value; });

// Match Audio Length toggle
matchAudio.addEventListener("change", applyMatchAudio);

function applyMatchAudio() {
  const hasAudio = currentAudioDuration !== null;
  if (matchAudio.checked && hasAudio) {
    const capped = Math.min(currentAudioDuration, 15);
    durationRange.value = capped;
    durationNum.value = parseFloat(capped.toFixed(1));
  }
  durationField.classList.toggle("disabled", matchAudio.checked && hasAudio);
}

function loadAudioDuration(src) {
  const a = new Audio(src);
  a.addEventListener("loadedmetadata", () => {
    currentAudioDuration = a.duration;
    applyMatchAudio();
  }, { once: true });
}

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

const RESOLUTION_PRESETS = {
  landscape: { w: 1280, h: 720 },
  portrait:  { w: 720,  h: 1280 },
};

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
});

// Show default image preview on load
(async () => {
  try {
    currentImageUrl = DEFAULT_IMAGE;
  } catch {}
})();
const heroVideoClips = [
  "./videos/clip_1.mp4",
  "./videos/clip_2.mp4",
  "./videos/clip_3.mp4",
  "./videos/clip_4.mp4",
];
let currentHeroClip = 0;
// front = currently visible layer, back = hidden layer being preloaded
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

attachHeroListeners(heroVideoA);


document.querySelectorAll(".example-card video").forEach((video) => {
  const card = video.closest(".example-card");
  card.addEventListener("mouseenter", () => video.play().catch(() => {}));
  card.addEventListener("mouseleave", () => {
    video.pause();
    video.currentTime = 0;
  });
});

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
  if (!file) {
    uploadLabel.value = "";
    if (currentImageUrl && currentImageUrl !== DEFAULT_IMAGE) URL.revokeObjectURL(currentImageUrl);
    currentImageUrl = DEFAULT_IMAGE;
    uploadLabel.value = "";
    return;
  }

  uploadLabel.value = file.name;
  if (currentImageUrl && currentImageUrl !== DEFAULT_IMAGE) URL.revokeObjectURL(currentImageUrl);
  currentImageUrl = URL.createObjectURL(file);
});

audioUploadLabel.addEventListener("click", () => audioInput.click());
audioChooseBtn.addEventListener("click", () => audioInput.click());

audioInput.addEventListener("change", () => {
  const file = audioInput.files?.[0];
  if (!file) {
    audioUploadLabel.value = "";
    currentAudioDuration = null;
    applyMatchAudio();
    return;
  }
  audioUploadLabel.value = file.name;
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
    loadAudioDuration(URL.createObjectURL(file));
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!getValue("passcode")) {
    setStatus("error", "Error");
    appendLog("\nError: API key missing");
    return;
  }

  const file = imageInput.files?.[0];
  const audioFile = audioInput.files?.[0];

  setBusy(true);
  resetVideoLinks();
  resetProgress();

  try {
    setStatus("running", "Running");
    const imageBase64 = file ? await fileToBase64(file) : null;
    const audioBase64 = audioFile ? await fileToBase64(audioFile) : null;
    const apiEndpoint = "https://ltx-gateway.fly.dev";
    const passcode = getValue("passcode");
    const payload = buildPayload(imageBase64, audioBase64);

    writeLog("POST /v1/videos/generate", payload);
    const createResponse = await fetch(`${apiEndpoint}/v1/videos/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": passcode,
      },
      body: JSON.stringify(payload),
    });

    const createData = await readJson(createResponse);
    if (!createResponse.ok) {
      throw new Error(createData.error || `Generate request failed: ${createResponse.status}`);
    }

    const jobId = createData.job_id;
    if (!jobId) {
      throw new Error("Generate response did not include job_id.");
    }

    startProgress(createData.estimated_s || 120);
    setStatus("running", "Running");
    appendLog(`\njob_id: ${jobId}\n`);

    const result = await pollUntilComplete(apiEndpoint, jobId, passcode);
    showCompletedVideo(result.url);
  } catch (error) {
    const message = normalizeFetchError(error);
    setStatus("error", "Error");
    resetProgress();
    appendLog(`\nError: ${message}`);
  } finally {
    setBusy(false);
  }
});

function buildPayload(imageBase64, audioBase64) {
  const duration = getNumber("duration");
  if (duration > 15) {
    throw new Error("Duration must be 15 seconds or less.");
  }

  return {
    prompt: getValue("prompt"),
    duration,
    height: getNumber("height"),
    width: getNumber("width"),
    fps: getNumber("fps"),
    seed: getOptionalNumber("seed"),
    ...(imageBase64 ? { image_base64: imageBase64 } : {}),
    ...(audioBase64 ? { audio_base64: audioBase64 } : {}),
    verbose: true,
  };
}

async function pollUntilComplete(apiEndpoint, jobId, passcode) {
  while (true) {
    await wait(pollIntervalMs);

    const response = await fetch(`${apiEndpoint}/v1/videos/${encodeURIComponent(jobId)}`, {
      headers: { "X-API-Key": passcode },
    });
    const data = await readJson(response);

    writeLog(`GET /v1/videos/${jobId}`, data);

    if (!response.ok) {
      throw new Error(data.error || `Status request failed: ${response.status}`);
    }

    if (data.status === "completed") {
      if (!data.url) {
        throw new Error(data.error || "Completed response did not include url.");
      }
      return data;
    }

    if (data.status === "failed") {
      throw new Error(data.error || "Remote job failed.");
    }

    setStatus("running", "Running");
  }
}

function showCompletedVideo(videoUrl) {
  videoPreview.src = videoUrl;

  downloadVideo.href = videoUrl;
  downloadVideo.classList.remove("disabled");

  completeProgress();
  setStatus("done", "Done");
  appendLog(`\nvideo_url: ${videoUrl}`);
}

function setStatus(kind, label) {
  statusBadge.className = `result-badge ${kind}`;
  statusBadge.textContent = label;
}

function setBusy(isBusy) {
  submitButton.disabled = isBusy;
  submitButton.textContent = isBusy ? "Generating..." : "Generate video";
}

function resetVideoLinks() {
  downloadVideo.href = "#";
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

function getValue(id) {
  return document.querySelector(`#${id}`).value.trim();
}

function getNumber(id) {
  return Number(document.querySelector(`#${id}`).value);
}

function getOptionalNumber(id) {
  const value = document.querySelector(`#${id}`).value.trim();
  return value === "" ? null : Number(value);
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
