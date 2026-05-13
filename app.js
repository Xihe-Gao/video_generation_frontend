const form = document.querySelector("#generationForm");
const imageInput = document.querySelector("#imageInput");
const uploadLabel = document.querySelector("#uploadLabel");
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
let currentImageUrl = "";
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

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    promptInput.value = button.dataset.prompt;
    promptInput.focus();
  });
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
  if (!file) return;

  uploadLabel.textContent = `${file.name} · ${formatBytes(file.size)}`;
  if (currentImageUrl) {
    URL.revokeObjectURL(currentImageUrl);
  }
  currentImageUrl = URL.createObjectURL(file);
  videoPreview.removeAttribute("src");
  videoPreview.load();
  imagePreview.src = currentImageUrl;
  imagePreview.hidden = false;
  videoPreview.hidden = true;
  emptyState.hidden = true;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (getValue("passcode") !== "kevin") {
    setStatus("error", "Passcode error", "The passcode is incorrect.");
    appendLog("\nError: passcode incorrect");
    return;
  }

  const file = imageInput.files?.[0];

  setBusy(true);
  resetVideoLinks();

  try {
    setStatus("running", "Preparing request", file ? "Encoding reference image..." : "Submitting prompt-only generation...");
    const imageBase64 = file ? await fileToBase64(file) : null;
    const apiEndpoint = trimTrailingSlash(getValue("apiEndpoint"));
    const payload = buildPayload(imageBase64);

    writeLog("POST /v2/generate", payload);
    const createResponse = await fetch(`${apiEndpoint}/v2/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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

    const result = await pollUntilComplete(apiEndpoint, jobId);
    showCompletedVideo(result.url);
  } catch (error) {
    const message = normalizeFetchError(error);
    setStatus("error", "Request blocked", message);
    appendLog(`\nError: ${message}`);
  } finally {
    setBusy(false);
  }
});

function buildPayload(imageBase64) {
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
    image_url: null,
    image_base64: imageBase64,
    verbose: document.querySelector("#verbose").checked,
  };
}

async function pollUntilComplete(apiEndpoint, jobId) {
  while (true) {
    await wait(pollIntervalMs);

    const response = await fetch(`${apiEndpoint}/status/${encodeURIComponent(jobId)}`);
    const data = await readJson(response);

    writeLog(`GET /status/${jobId}`, data);

    if (!response.ok) {
      throw new Error(data.error || `Status request failed: ${response.status}`);
    }

    if (data.status === "completed") {
      if (!data.url) {
        throw new Error("Completed response did not include url.");
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
  };
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

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
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
