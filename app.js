const form = document.querySelector("#generationForm");
const imageInput = document.querySelector("#imageInput");
const uploadLabel = document.querySelector("#uploadLabel");
const imageThumb = document.querySelector("#imageThumb");
const audioInput = document.querySelector("#audioInput");
const audioUploadLabel = document.querySelector("#audioUploadLabel");
const audioPlayer = document.querySelector("#audioPlayer");
const audioDropZone = document.querySelector("#audioDropZone");
const audioChooseBtn = document.querySelector("#audioChooseBtn");
const submitButton = document.querySelector("#submitButton");
const statusDot = document.querySelector("#statusDot");
const statusTitle = document.querySelector("#statusTitle");
const statusMessage = document.querySelector("#statusMessage");
const logOutput = document.querySelector("#logOutput");
const imagePreview = document.querySelector("#imagePreview");
const videoPreview = document.querySelector("#videoPreview");
const emptyState = document.querySelector("#emptyState");
const openVideo = document.querySelector("#openVideo");
const downloadVideo = document.querySelector("#downloadVideo");
const promptInput = document.querySelector("#prompt");
const heroVideo = document.querySelector("#heroVideo");

const pollIntervalMs = 5000;
const DEFAULT_IMAGE = "./materials/song.png";
const DEFAULT_AUDIO = "./materials/song.mp3";
let currentImageUrl = "";

// Show default image preview on load
(async () => {
  try {
    currentImageUrl = DEFAULT_IMAGE;
    imagePreview.src = DEFAULT_IMAGE;
    imagePreview.hidden = false;
    emptyState.hidden = true;
  } catch {}
})();
const heroVideoClips = [
  "./videos/clip_1.mp4",
  "./videos/clip_2.mp4",
  "./videos/clip_3.mp4",
  "./videos/clip_4.mp4",
];
let currentHeroClip = 0;

heroVideo.addEventListener("ended", () => {
  currentHeroClip = (currentHeroClip + 1) % heroVideoClips.length;
  heroVideo.src = heroVideoClips[currentHeroClip];
  heroVideo.play().catch(() => {});
});


document.querySelectorAll(".example-card video").forEach((video) => {
  const card = video.closest(".example-card");
  card.addEventListener("mouseenter", () => video.play().catch(() => {}));
  card.addEventListener("mouseleave", () => {
    video.pause();
    video.currentTime = 0;
  });
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (!file) {
    uploadLabel.textContent = "song.png · default";
    if (currentImageUrl && currentImageUrl !== DEFAULT_IMAGE) URL.revokeObjectURL(currentImageUrl);
    currentImageUrl = DEFAULT_IMAGE;
    imageThumb.src = DEFAULT_IMAGE;
    imagePreview.src = DEFAULT_IMAGE;
    return;
  }

  uploadLabel.textContent = `${file.name} · ${formatBytes(file.size)}`;
  if (currentImageUrl && currentImageUrl !== DEFAULT_IMAGE) URL.revokeObjectURL(currentImageUrl);
  currentImageUrl = URL.createObjectURL(file);
  imageThumb.src = currentImageUrl;
  videoPreview.removeAttribute("src");
  videoPreview.load();
  imagePreview.src = currentImageUrl;
  imagePreview.hidden = false;
  videoPreview.hidden = true;
  emptyState.hidden = true;
});

audioChooseBtn.addEventListener("click", () => audioInput.click());

audioInput.addEventListener("change", () => {
  const file = audioInput.files?.[0];
  if (!file) {
    audioPlayer.src = DEFAULT_AUDIO;
    audioUploadLabel.textContent = "song.mp3 · default";
    return;
  }
  applyAudioFile(file);
});

audioDropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  audioDropZone.classList.add("drag-over");
});
audioDropZone.addEventListener("dragleave", () => audioDropZone.classList.remove("drag-over"));
audioDropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  audioDropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files?.[0];
  if (file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    audioInput.files = dt.files;
    applyAudioFile(file);
  }
});

function applyAudioFile(file) {
  const url = URL.createObjectURL(file);
  audioPlayer.src = url;
  audioPlayer.load();
  audioUploadLabel.textContent = `${file.name} · ${formatBytes(file.size)}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!getValue("passcode")) {
    setStatus("error", "Passcode error", "Please enter an API key.");
    appendLog("\nError: API key missing");
    return;
  }

  const file = imageInput.files?.[0];
  const audioFile = audioInput.files?.[0];

  setBusy(true);
  resetVideoLinks();

  try {
    const hasAudio = true; // always ia2v (default song.mp3 if no file)
    setStatus("running", "Preparing request", "Encoding media...");
    const imageBase64 = file ? await fileToBase64(file) : await urlToBase64(DEFAULT_IMAGE);
    const audioBase64 = audioFile ? await fileToBase64(audioFile) : await urlToBase64(DEFAULT_AUDIO);
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

    setStatus("running", "Generation queued", `Job ID: ${jobId}`);
    appendLog(`\njob_id: ${jobId}\n`);

    const result = await pollUntilComplete(apiEndpoint, jobId, passcode);
    showCompletedVideo(result.url);
  } catch (error) {
    const message = normalizeFetchError(error);
    setStatus("error", "Request blocked", message);
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
    image_base64: imageBase64,
    audio_base64: audioBase64,
    verbose: document.querySelector("#verbose").checked,
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

    setStatus("running", "Generating video", formatJobStatus(data.status));
  }
}

function showCompletedVideo(videoUrl) {
  imagePreview.removeAttribute("src");
  videoPreview.src = videoUrl;
  videoPreview.hidden = false;
  imagePreview.hidden = true;
  emptyState.hidden = true;

  openVideo.href = videoUrl;
  downloadVideo.href = videoUrl;
  openVideo.classList.remove("disabled");
  downloadVideo.classList.remove("disabled");

  setStatus("done", "Video ready", "The generated video is available below.");
  appendLog(`\nvideo_url: ${videoUrl}`);
}

function setStatus(kind, title, message) {
  statusDot.className = `status-dot ${kind}`;
  statusTitle.textContent = title;
  statusMessage.textContent = message;
}

function setBusy(isBusy) {
  submitButton.disabled = isBusy;
  submitButton.textContent = isBusy ? "Generating..." : "Generate";
}

function resetVideoLinks() {
  openVideo.href = "#";
  downloadVideo.href = "#";
  openVideo.classList.add("disabled");
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
