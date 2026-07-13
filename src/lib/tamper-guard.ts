/**
 * Lightweight deterrents against download-manager browser extensions.
 *
 * Historical note: earlier versions blocked devtools via `debugger;` traps,
 * F12/Ctrl+Shift+I keybindings and heuristics on window size. Those were
 * removed because:
 *   - They are trivially bypassed (remote debugger, `--auto-open-devtools`).
 *   - They break legitimate users on ultrawide monitors, screen readers,
 *     password managers and keyboard-first workflows.
 *   - Stream protection is enforced properly at the edge via signed,
 *     time-limited HMAC tokens (see supabase/functions/xtream/index.ts).
 *
 * What remains is a passive DOM scan for markers that popular download
 * helpers (IDM, FDM, Video DownloadHelper) inject into the page. When one
 * is detected we stop playback and show a friendly message. Right-click is
 * intentionally NOT blocked.
 */

let installed = false;

function showBlock(reason: string) {
  let el = document.getElementById("tamper-block");
  if (!el) {
    el = document.createElement("div");
    el.id = "tamper-block";
    document.body.appendChild(el);
  }
  // Use textContent + createElement — never innerHTML — to keep this
  // resistant to accidental XSS if `reason` ever becomes dynamic.
  el.innerHTML = "";
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
    `Please disable the extension and reload the page.`;
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
  // A single throttled observer is enough — no busy setInterval.
  new MutationObserver(() => scan()).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  scan();
}

/**
 * Installs a passive DOM watcher for common download-helper browser
 * extensions. No-op in development.
 */
export function installTamperGuard() {
  if (installed || import.meta.env.DEV) return;
  installed = true;
  detectDownloadHelpers();
}
