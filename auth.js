// Shared Supabase auth + nav init — included on every page after config.js

const _cfg = window.FRAMEFORGE_CONFIG || {};
window.API_URL = _cfg.API_URL || "https://ltx-gateway.fly.dev";

// Promise that other scripts await instead of using fixed sleep
let _resolveReady;
window.clerkReady = new Promise(r => { _resolveReady = r; }); // kept as clerkReady for compatibility

window._currentUser = null;
window._supabase    = null;

let _menuCloseHandler = null;

async function initAuth() {
  if (!_cfg.SUPABASE_URL || _cfg.SUPABASE_URL.includes("YOUR_PROJECT")) {
    console.warn("Supabase not configured — auth disabled");
    _resolveReady(null);
    return;
  }
  try {
    const sb = window.supabase.createClient(_cfg.SUPABASE_URL, _cfg.SUPABASE_ANON_KEY);
    window._supabase = sb;

    const { data: { session } } = await sb.auth.getSession();
    window._currentUser = session?.user || null;
    _resolveReady(sb);
    _updateNav(session);

    sb.auth.onAuthStateChange((_event, session) => {
      window._currentUser = session?.user || null;
      _updateNav(session);
    });
  } catch (err) {
    console.error("Supabase init failed", err);
    _resolveReady(null);
  }
}

function _updateNav(session) {
  const dashLink   = document.getElementById("nav-dashboard");
  const signinLink = document.getElementById("nav-signin");
  const userMount  = document.getElementById("nav-user-mount");
  const creditsEl  = document.getElementById("nav-credits");

  if (session?.user) {
    dashLink   && (dashLink.hidden   = false);
    signinLink && (signinLink.hidden = true);
    if (userMount) _renderUserMenu(userMount, session.user);
    if (creditsEl) _loadNavCredits(creditsEl);
  } else {
    dashLink   && (dashLink.hidden   = true);
    signinLink && (signinLink.hidden = false);
    if (userMount) userMount.innerHTML = "";
  }
}

function _renderUserMenu(mount, user) {
  if (_menuCloseHandler) {
    document.removeEventListener("click", _menuCloseHandler);
    _menuCloseHandler = null;
  }

  const initials = (user.email || "U").charAt(0).toUpperCase();
  mount.innerHTML = `
    <div class="user-menu">
      <button class="user-avatar-btn" id="userMenuBtn" aria-label="User menu">${initials}</button>
      <div class="user-dropdown" id="userDropdown" hidden>
        <span class="user-email-label">${user.email || ""}</span>
        <a href="/dashboard.html" class="user-dropdown-item">Dashboard</a>
        <button class="user-dropdown-item" id="signOutBtn">Sign out</button>
      </div>
    </div>`;

  const btn = mount.querySelector("#userMenuBtn");
  const dd  = mount.querySelector("#userDropdown");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dd.hidden = !dd.hidden;
  });

  _menuCloseHandler = () => { if (dd) dd.hidden = true; };
  document.addEventListener("click", _menuCloseHandler);

  mount.querySelector("#signOutBtn").addEventListener("click", async () => {
    await window._supabase.auth.signOut();
    window.location.href = "/";
  });
}

async function _loadNavCredits(el) {
  try {
    const token = await window.getAuthToken();
    if (!token) return;
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
  if (!window._supabase) return null;
  const { data: { session } } = await window._supabase.auth.getSession();
  return session?.access_token || null;
};

window.requireAuth = () => {
  if (!window._currentUser) {
    window.location.href = "/auth.html?redirect=" + encodeURIComponent(location.pathname);
    return false;
  }
  return true;
};

window.addEventListener("load", initAuth);
