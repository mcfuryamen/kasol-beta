/* ==========================================================================
   TPA Al-Hikmah - Application Bootstrap
   Phase 10: Page Transitions + Phase 9: Router/GlobalState Integration
   ========================================================================== */

import { initDB } from "./db/init.js";
import { initRouter, navigate, onRouteChange } from "./router.js";
import { appStore, setLoading, addToast, removeToast, toggleSidebar } from "./globalState.js";

// App state
let _initialized = false;

/**
 * Initialize the application
 * Call once at the bottom of each page's <script type="module">
 */
export async function initApp() {
  if (_initialized) return;
  _initialized = true;

  // 1. Initialize database
  await initDB();

  // 2. Set up page transition observer
  setupPageTransitions();

  // 3. Set up sidebar mobile toggle
  setupSidebar();

  // 4. Set up toast auto-dismiss
  setupToasts();

  console.log("[TPA] App initialized");
}

/**
 * Page transition: fade out current content, fade in new content
 */
export function setupPageTransitions() {
  const main = document.querySelector(".page-content") || document.getElementById("pageContent");
  if (!main) return;

  onRouteChange(() => {
    // Fade out
    main.style.opacity = "0";
    main.style.transform = "translateY(8px)";
    main.style.transition = "opacity 150ms ease, transform 150ms ease";

    // Fade in after short delay
    setTimeout(() => {
      main.style.opacity = "1";
      main.style.transform = "translateY(0)";
    }, 50);
  });
}

/**
 * Sidebar toggle for mobile
 */
export function setupSidebar() {
  const overlay = document.getElementById("sidebarOverlay");
  const sidebar = document.querySelector(".app-sidebar");
  const menuBtn = document.querySelector(".header-menu-btn");

  if (overlay) {
    overlay.addEventListener("click", () => {
      sidebar?.classList.remove("open");
      overlay.classList.remove("show");
    });
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      sidebar?.classList.toggle("open");
      overlay?.classList.toggle("show");
    });
  }

  // Sync sidebar open state with global state
  appStore.subscribe(state => {
    const isOpen = state.sidebarOpen;
    sidebar?.classList.toggle("open", isOpen);
    overlay?.classList.toggle("show", isOpen);
  });
}

/**
 * Toast auto-dismiss after 4 seconds
 */
export function setupToasts() {
  // Watch for new toasts
  let prevCount = 0;
  setInterval(() => {
    const toasts = document.querySelectorAll(".toast");
    if (toasts.length !== prevCount) {
      prevCount = toasts.length;
      toasts.forEach(toast => {
        if (!toast.dataset.autodismiss) {
          toast.dataset.autodismiss = "1";
          setTimeout(() => {
            toast.style.animation = "slideOut 0.3s ease forwards";
            setTimeout(() => toast.remove(), 300);
          }, 4000);
        }
      });
    }
  }, 500);
}

/**
 * Render a loading spinner over the main content
 */
export function showLoading() {
  const main = document.querySelector(".page-content") || document.getElementById("pageContent");
  if (main) {
    main.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:300px;flex-direction:column;gap:16px">
      <div class="spinner spinner-lg"></div>
      <p style="color:var(--text-muted);font-size:14px">Memuat...</p>
    </div>`;
    main.style.opacity = "1";
    main.style.transform = "none";
  }
}

/**
 * Navigate with page transition
 */
export function goTo(hash) {
  navigate(hash);
}

/**
 * Toggle sidebar (mobile)
 */
export function toggleSide() {
  toggleSidebar();
}

// Export everything needed by pages
export { navigate, onRouteChange, appStore, addToast, removeToast, setLoading };
