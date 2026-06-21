// Shared Clerk auth + nav init — included on every page

const CLERK_PUBLISHABLE_KEY = "pk_test_YOUR_KEY_HERE"; // replace with your Clerk key
const API_URL = "https://ltx-gateway.fly.dev";

// Expose for other scripts
window.API_URL = API_URL;

async function initClerk() {
  const clerk = window.Clerk;
  await clerk.load({ signInUrl: "/auth.html", signUpUrl: "/auth.html" });

  const nav          = document.querySelector(".nav-links");
  const dashLink     = document.getElementById("nav-dashboard");
  const signinLink   = document.getElementById("nav-signin");
  const userMount    = document.getElementById("nav-user-mount");
  const creditsEl    = document.getElementById("nav-credits");

  if (clerk.user) {
    dashLink  && (dashLink.hidden   = false);
    signinLink && (signinLink.hidden = true);
    if (userMount) clerk.mountUserButton(userMount);
    if (creditsEl) loadNavCredits(creditsEl);
  } else {
    dashLink  && (dashLink.hidden   = true);
    signinLink && (signinLink.hidden = false);
  }

  window._clerk = clerk;
}

async function loadNavCredits(el) {
  try {
    const token = await window._clerk.session.getToken();
    const r = await fetch(`${API_URL}/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return;
    const data = await r.json();
    el.textContent = `${data.credits_balance} cr`;
    el.hidden = false;
  } catch {}
}

// Helper used by playground, dashboard, pricing pages
window.getAuthToken = async () => {
  if (!window._clerk?.session) return null;
  return await window._clerk.session.getToken();
};

window.requireAuth = () => {
  if (!window._clerk?.user) {
    window.location.href = "/auth.html?redirect=" + encodeURIComponent(location.pathname);
    return false;
  }
  return true;
};

window.addEventListener("load", initClerk);
