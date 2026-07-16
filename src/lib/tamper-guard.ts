/**
 * Playback deterrents: download-manager extension scan + lightweight
 * F12 / Inspect / view-source blocking in production builds.
 *
 * These shortcuts are a deterrent, not absolute DRM — remote debugging and
 * `--auto-open-devtools` can still bypass them. Real stream protection lives
 * in signed Xtream HMAC tokens.
 */

let installed = false;

function showBlock(reason: string) {
  let el = document.getElementById("tamper-block");
  if (!el) {
    el = document.createElement("div");
    el.id = "tamper-block";
    document.body.appendChild(el);
  }
  el.replaceChildren();
  const wrap = document.createElement("div");
  wrap.style.maxWidth = "560px";
  const h1 = document.createElement("h1");
  h1.style.fontSize = "1.5rem";
  h1.style.marginBottom = "1rem";
  h1.textContent = "Playback blocked";
  const p = document.createElement("p");
  p.style.opacity = ".75";
  p.style.lineHeight = "1.5";
  p.textContent =
    `This session was paused because ${reason}. ` +
    `Please close developer tools / disable the extension and reload the page.`;
  wrap.appendChild(h1);
  wrap.appendChild(p);
  el.appendChild(wrap);
  el.classList.add("on");
  try {
    document.querySelectorAll("video").forEach((v) => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    });
  } catch {
    /* noop */
  }
}

function detectDownloadHelpers() {
  const markers = [
    "idmmzmark",
    "idm-mark",
    "flashgot",
    "adm-download-helper",
    "video-downloader",
    "dvh-container",
  ];
  const scan = () => {
    for (const id of markers) {
      if (document.getElementById(id) || document.querySelector(`[class*="${id}"]`)) {
        showBlock("a download-manager extension was detected");
        return;
      }
    }
  };
  new MutationObserver(() => scan()).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  scan();
}

function blockDevtoolsShortcuts() {
  const blockKey = (e: KeyboardEvent) => {
    const key = e.key?.toLowerCase?.() ?? "";
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    // F12, Ctrl+Shift+I/J/C, Ctrl+U (view source), Ctrl+Shift+K (Firefox console)
    if (
      key === "f12" ||
      (ctrl && shift && (key === "i" || key === "j" || key === "c" || key === "k")) ||
      (ctrl && key === "u")
    ) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };
  window.addEventListener("keydown", blockKey, true);

  // Block right-click "Inspect" on media surfaces (still allow elsewhere for accessibility).
  document.addEventListener(
    "contextmenu",
    (e) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("video, .video-shell, [data-player]")) {
        e.preventDefault();
      }
    },
    true,
  );

  // Heuristic: docked DevTools shrinks the outer window vs screen.
  let warned = false;
  const checkDock = () => {
    const widthGap = window.outerWidth - window.innerWidth;
    const heightGap = window.outerHeight - window.innerHeight;
    if (widthGap > 160 || heightGap > 160) {
      if (!warned) {
        warned = true;
        showBlock("developer tools appear to be open");
      }
    } else {
      warned = false;
      document.getElementById("tamper-block")?.classList.remove("on");
    }
  };
  window.setInterval(checkDock, 1200);
}

/**
 * Installs playback guards. No-op in development so local debugging still works.
 */
export function installTamperGuard() {
  if (installed || import.meta.env.DEV) return;
  installed = true;
  detectDownloadHelpers();
  blockDevtoolsShortcuts();
}
