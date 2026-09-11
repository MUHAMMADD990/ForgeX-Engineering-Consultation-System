/* ==========================================================================
   ForgeX UI Utilities — js/forgex-utils.js
   Shared, dependency-free UI plumbing: toasts, confirm dialogs, loading
   overlay, dark-mode toggle. Injects its own DOM containers so any page
   can call these without adding markup. Load AFTER forgex-db.js.
   ========================================================================== */
(function (global) {
  'use strict';

  var ICONS = {
    success: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M20 6L9 17l-5-5"/></svg>',
    error:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17.5v.1"/></svg>',
    info:    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/></svg>',
    warning: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17.5v.1"/></svg>'
  };

  function ensureContainer(id, className, innerHTML) {
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      if (className) el.className = className;
      if (innerHTML) el.innerHTML = innerHTML;
      document.body.appendChild(el);
    }
    return el;
  }

  function init() {
    ensureContainer('fxToastStack', 'toast-stack');
    ensureContainer('fxLoadingOverlay', 'loading-overlay',
      '<div class="loading-overlay__box"><div class="loading-overlay__spinner"></div><span id="fxLoadingText">جارٍ التحميل…</span></div>');
    ensureContainer('fxConfirmOverlay', 'confirm-overlay',
      '<div class="confirm-box">' +
        '<div class="confirm-box__icon">' + ICONS.warning + '</div>' +
        '<h3 id="fxConfirmTitle">تأكيد الإجراء</h3>' +
        '<p id="fxConfirmMsg"></p>' +
        '<div class="confirm-box__actions">' +
          '<button class="btn btn--outline" id="fxConfirmCancel">إلغاء</button>' +
          '<button class="btn btn--danger-solid" id="fxConfirmOk">تأكيد</button>' +
        '</div>' +
      '</div>');
    applyStoredTheme();
  }

  /* ---------------- TOASTS ---------------- */
  function toast(message, type) {
    type = type || 'info';
    var stack = document.getElementById('fxToastStack') || ensureContainer('fxToastStack', 'toast-stack');
    var el = document.createElement('div');
    el.className = 'toast toast--' + type;
    el.innerHTML = (ICONS[type] || ICONS.info) + '<span>' + escapeHtml(message) + '</span>';
    stack.appendChild(el);
    setTimeout(function () {
      el.classList.add('is-leaving');
      setTimeout(function () { el.remove(); }, 200);
    }, 3200);
  }

  /* ---------------- CONFIRM DIALOG (returns a Promise<boolean>) ---------------- */
  function confirmDialog(message, title) {
    return new Promise(function (resolve) {
      var overlay = document.getElementById('fxConfirmOverlay');
      document.getElementById('fxConfirmTitle').textContent = title || 'تأكيد الإجراء';
      document.getElementById('fxConfirmMsg').textContent = message || 'هل أنت متأكد؟';
      overlay.classList.add('is-open');

      var okBtn = document.getElementById('fxConfirmOk');
      var cancelBtn = document.getElementById('fxConfirmCancel');

      function cleanup(result) {
        overlay.classList.remove('is-open');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlay);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onOverlay(e) { if (e.target === overlay) cleanup(false); }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlay);
    });
  }

  /* ---------------- LOADING OVERLAY ---------------- */
  function showLoading(text) {
    var overlay = document.getElementById('fxLoadingOverlay');
    document.getElementById('fxLoadingText').textContent = text || 'جارٍ التحميل…';
    overlay.classList.add('is-open');
  }
  function hideLoading() {
    var overlay = document.getElementById('fxLoadingOverlay');
    if (overlay) overlay.classList.remove('is-open');
  }

  /* ---------------- THEME (dark mode) ---------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    try { localStorage.setItem('forgex.theme', theme); } catch (e) {}
  }
  function applyStoredTheme() {
    var stored = null;
    try { stored = localStorage.getItem('forgex.theme'); } catch (e) {}
    if (stored) applyTheme(stored);
  }
  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    return next;
  }

  /* ---------------- MISC HELPERS shared across pages ---------------- */
  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : str;
    return d.innerHTML;
  }
  function humanFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.ForgeXUI = {
    toast: toast,
    confirm: confirmDialog,
    loading: { show: showLoading, hide: hideLoading },
    theme: { apply: applyTheme, toggle: toggleTheme, applyStored: applyStoredTheme },
    escapeHtml: escapeHtml,
    humanFileSize: humanFileSize,
    readFileAsDataUrl: readFileAsDataUrl
  };

})(window);
