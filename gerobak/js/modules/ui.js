/**
 * UI MODULE (Sprint 4 - Code Splitting Completion)
 * 
 * UI-related functions: sheets, toasts, navigation, formatting.
 */

const UIModule = (function() {
  'use strict';

  // Toast notification
  function toast(msg, type) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = "toast show" + (type ? " toast-" + type : "");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.className = "toast", 2500);
  }

  // Sheet navigation
  let sheetHistory = [];

  function replaceSheet(popCount) {
    if (popCount > 0) {
      sheetHistory.splice(sheetHistory.length - popCount, popCount);
    }
  }

  function patchParentSheet(mutator) {
    if (sheetHistory.length >= 2) {
      const parent = sheetHistory[sheetHistory.length - 2];
      mutator(parent);
    }
  }

  function snapshotCurrentSheet() {
    const view = document.getElementById("view");
    if (!view) return null;
    return {
      html: view.innerHTML,
      scrollY: window.scrollY,
      state: { ...appState } // Assuming appState is global
    };
  }

  function openSheet(html, rebind) {
    const view = document.getElementById("view");
    if (!view) return;
    
    const snapshot = snapshotCurrentSheet();
    if (snapshot) sheetHistory.push(snapshot);
    
    view.innerHTML = html;
    window.scrollTo(0, 0);
    if (rebind !== false) bindSheet();
  }

  function closeSheet() {
    if (sheetHistory.length === 0) return;
    const prev = sheetHistory.pop();
    const view = document.getElementById("view");
    if (!view) return;
    
    view.innerHTML = prev.html;
    window.scrollTo(0, prev.scrollY);
    bindSheet();
  }

  function bindSheet() {
    // Rebind event listeners for sheet content
    // This is a placeholder - actual implementation depends on app structure
    if (typeof window.bindSheet === 'function') {
      window.bindSheet();
    }
  }

  // Confirm dialogs
  function confirmDestructive(message, onConfirm) {
    if (!confirm(message)) return;
    onConfirm();
  }

  async function confirmDestructiveAsync(message) {
    return new Promise((resolve) => {
      const confirmed = confirm(message);
      resolve(confirmed);
    });
  }

  // Formatting functions
  function formatRp(n) {
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString("id-ID");
  }

  function parseFormattedNumber(s) {
    if (!s) return 0;
    return parseInt(String(s).replace(/[^0-9]/g, ""), 10) || 0;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function timeShort(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Public API
  return {
    toast,
    openSheet,
    closeSheet,
    replaceSheet,
    patchParentSheet,
    confirmDestructive,
    confirmDestructiveAsync,
    formatRp,
    formatNumber,
    parseFormattedNumber,
    todayISO,
    timeShort,
    escapeHtml,
  };
})();

if (typeof window !== 'undefined') {
  window.UIModule = UIModule;
}
