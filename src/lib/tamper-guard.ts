// Best-effort deterrents against devtools, download managers, and cookie/session
// injector extensions. NOTE: none of these are bulletproof — a determined user
// can bypass every one. They exist to discourage casual abuse.

let installed = false;

function showBlock(reason: string) {
  let el = document.getElementById("tamper-block");
  if (!el) {
    el = document.createElement("div");
    el.id = "tamper-block";
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div style="max-width:560px">
      <h1 style="font-size:1.5rem;margin-bottom:1rem">Access blocked</h1>
      <p style="opacity:.75;line-height:1.5">
        This session has been terminated because ${reason}.
        Please close developer tools and any download / cookie extensions,
        then reload the page.
      </p>
    </div>`;
  el.classList.add("on");
  // Stop the app cold.
  try {
    document.querySelectorAll("video").forEach((v) => { v.pause(); v.src = ""; });
  } catch { /* noop */ }
}

function detectDevtools() {
  const threshold = 160;
  const check = () => {
    // Detects devtools by measuring the difference between outer and inner window size
    const w = window.outerWidth - window.innerWidth;
    const h = window.outerHeight - window.innerHeight;
    if (w > threshold || h > threshold) {
      showBlock("developer tools were detected");
      return true;
    }
    return false;
  };
  setInterval(check, 1000);

  // Timing trap: `debugger` pauses only when devtools are open.
  // We measure the execution time around the debugger statement.
  setInterval(() => {
    const t0 = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    if (performance.now() - t0 > 100) showBlock("developer tools were detected");
  }, 2000);
}

function detectDownloadHelpers() {
  // IDM / FDM / Video DownloadHelper inject markers into the DOM.
  const markers = [
    "idmmzmark", "idm-mark", "flashgot", "adm-download-helper",
    "video-downloader", "dvh-container",
  ];
  const scan = () => {
    for (const id of markers) {
      if (document.getElementById(id) || document.querySelector(`[class*="${id}"]`)) {
        showBlock("a download-manager extension was detected");
        return;
      }
    }
    // IDM adds a "download this video" button next to <video> elements with high z-index
    document.querySelectorAll("video").forEach((v) => {
      const sib = v.parentElement?.querySelector('[style*="z-index: 2147483647"]');
      if (sib && sib.tagName !== "DIV") return;
    });
  };
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true, subtree: true,
  });
  setInterval(scan, 3000);
}

function detectCookieEditors() {
  // Popular cookie editors (EditThisCookie, Cookie-Editor) don't leave DOM traces,
  // but we can flag rapid cookie mutations that don't originate from our app.
  let last = document.cookie;
  setInterval(() => {
    const now = document.cookie;
    if (now !== last) {
      const added = now.split(";").filter((c) => !last.includes(c.trim()));
      // Ignore our own auth cookies (Supabase, Google Analytics, Cloudflare).
      const suspicious = added.some((c) => !/^\s*(sb-|_ga|cf_)/.test(c));
      if (suspicious && added.length > 2) {
        showBlock("suspicious cookie activity was detected");
      }
      last = now;
    }
  }, 1500);
}

function hardenContextMenu() {
  // Prevents right-click and common keyboard shortcuts for inspection
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (e.key === "F12") { e.preventDefault(); showBlock("F12 was pressed"); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k)) {
      e.preventDefault();
      showBlock("the inspector shortcut was used");
    }
    if ((e.ctrlKey || e.metaKey) && k === "u") {
      e.preventDefault();
      showBlock("view-source was requested");
    }
    if ((e.ctrlKey || e.metaKey) && k === "s") e.preventDefault();
  });
}

/**
 * Installs various deterrents against devtools usage, download managers, and cookie tampering.
 * Disabled in development environment.
 */
export function installTamperGuard() {
  if (installed || import.meta.env.DEV) return;
  installed = true;
  hardenContextMenu();
  detectDevtools();
  detectDownloadHelpers();
  detectCookieEditors();
}
