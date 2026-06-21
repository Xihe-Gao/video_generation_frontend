window.addEventListener("load", async () => {
  // Wait for Clerk to initialize (auth.js runs first)
  await new Promise(r => setTimeout(r, 300));

  if (!window._clerk?.user) {
    document.getElementById("authGate").hidden = false;
    return;
  }

  document.getElementById("dashMain").hidden = false;
  loadDashboard();
});

async function loadDashboard() {
  const token = await window.getAuthToken();

  // Load user info
  try {
    const r    = await fetch(`${window.API_URL}/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = await r.json();

    document.getElementById("stat-credits").textContent = user.credits_balance;
    document.getElementById("stat-plan").textContent    = capitalize(user.plan);

    if (user.current_period_end) {
      const d = new Date(user.current_period_end);
      document.getElementById("stat-renew").textContent = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } else {
      document.getElementById("stat-renew").textContent = "—";
    }

    if (user.plan === "free") {
      document.getElementById("btn-upgrade").hidden = false;
      document.getElementById("btn-portal").hidden  = true;
    }
  } catch (e) {
    console.error("Failed to load user info", e);
  }

  // Load job history
  try {
    const r    = await fetch(`${window.API_URL}/user/videos?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    renderJobs(data.jobs || []);
  } catch (e) {
    document.getElementById("jobs-loading").textContent = "Failed to load jobs.";
  }

  // Billing buttons
  document.getElementById("btn-upgrade").addEventListener("click", () => {
    window.location.href = "/pricing.html";
  });

  document.getElementById("btn-portal").addEventListener("click", async () => {
    const btn = document.getElementById("btn-portal");
    btn.disabled = true;
    btn.textContent = "Loading…";
    try {
      const t = await window.getAuthToken();
      const r = await fetch(`${window.API_URL}/user/billing/portal`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const d = await r.json();
      if (d.portal_url) window.location.href = d.portal_url;
    } catch {
      alert("Could not open billing portal.");
    }
    btn.disabled = false;
    btn.textContent = "Manage Subscription";
  });
}

function renderJobs(jobs) {
  const container = document.getElementById("job-list");
  const loading   = document.getElementById("jobs-loading");
  const empty     = document.getElementById("jobs-empty");

  loading.hidden = true;

  if (!jobs.length) {
    empty.hidden = false;
    return;
  }

  // Accumulate total videos stat
  document.getElementById("stat-total").textContent = jobs.filter(j => j.status === "completed").length;

  jobs.forEach(job => {
    const card = document.createElement("div");
    card.className = `job-card job-${job.status}`;

    const date = new Date(job.created_at).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const res   = job.width && job.height ? `${job.width}×${job.height}` : "—";
    const dur   = job.duration ? `${job.duration}s` : "—";
    const cost  = job.credits_cost ? `${job.credits_cost} cr` : "";
    const label = job.prompt ? truncate(job.prompt, 80) : "—";

    card.innerHTML = `
      <div class="job-thumb">
        ${job.video_url && job.status === "completed"
          ? `<video src="${job.video_url}" muted playsinline loop></video>`
          : `<div class="job-thumb-placeholder ${job.status}"></div>`}
      </div>
      <div class="job-info">
        <p class="job-prompt">${label}</p>
        <p class="job-meta">${res} · ${dur} · ${date}${cost ? " · " + cost : ""}</p>
      </div>
      <div class="job-status-col">
        <span class="job-badge job-badge-${job.status}">${capitalize(job.status)}</span>
        ${job.video_url && job.status === "completed"
          ? `<a class="button secondary small" href="${job.video_url}" download target="_blank">Download</a>`
          : ""}
      </div>
    `;

    if (job.video_url) {
      const vid = card.querySelector("video");
      if (vid) {
        card.addEventListener("mouseenter", () => vid.play().catch(() => {}));
        card.addEventListener("mouseleave", () => { vid.pause(); vid.currentTime = 0; });
      }
    }

    container.appendChild(card);
  });
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
