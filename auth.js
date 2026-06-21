// Shared Clerk auth + nav init — included on every page after config.js

const _cfg = window.FRAMEFORGE_CONFIG || {};
window.API_URL = _cfg.API_URL || "https://ltx-gateway.fly.dev";

async function initClerk() {
  const clerk = new window.Clerk(_cfg.CLERK_PUBLISHABLE_KEY);
  await clerk.load({ signInUrl: "/auth.html", signUpUrl: "/auth.html" });
  window._clerk = clerk;

  const dashLink   = document.getElementById("nav-dashboard");
  const signinLink = document.getElementById("nav-signin");
  const userMount  = document.getElementById("nav-user-mount");
  const creditsEl  = document.getElementById("nav-credits");

  if (clerk.user) {
    dashLink  && (dashLink.hidden   = false);
    signinLink && (signinLink.hidden = true);
    if (userMount) clerk.mountUserButton(userMount);
    if (creditsEl) _loadNavCredits(creditsEl);
  } else {
    dashLink  && (dashLink.hidden   = true);
    signinLink && (signinLink.hidden = false);
  }
}

async function _loadNavCredits(el) {
  try {
    const token = await window._clerk.session.getToken();
    const r = await fetch(`${window.API_URL}/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return;
    const data = await r.json();
    el.textContent = `${data.credits_balance} cr`;
    el.hidden = false;
  } catch {}
}

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
