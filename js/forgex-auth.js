/* Client-side access gate for the standalone ForgeX app. */
(function (global) {
  'use strict';

  var AUTH_KEY = 'forgex.authenticated';
  var LOGIN_PAGE = 'login.html';
  var currentPage = (global.location.pathname.split('/').pop() || 'index.html').toLowerCase();

  function getStoredAuthValue() {
    try {
      if (global.localStorage && global.localStorage.getItem(AUTH_KEY) === '1') return '1';
    } catch (e) {}
    try {
      if (global.sessionStorage && global.sessionStorage.getItem(AUTH_KEY) === '1') return '1';
    } catch (e) {}
    return null;
  }

  function setStoredAuthValue(value) {
    try { global.localStorage.setItem(AUTH_KEY, value); } catch (e) {}
    try { global.sessionStorage.setItem(AUTH_KEY, value); } catch (e) {}
  }

  function clearStoredAuthValue() {
    try { global.localStorage.removeItem(AUTH_KEY); } catch (e) {}
    try { global.sessionStorage.removeItem(AUTH_KEY); } catch (e) {}
  }

  function isAuthenticated() {
    return getStoredAuthValue() === '1';
  }
  function getReturnPage() {
    var match = global.location.search.match(/[?&]next=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : 'index.html';
  }
  function redirectToLogin() {
    var next = currentPage === 'index.html' ? '' : '?next=' + encodeURIComponent(currentPage);
    global.location.replace(LOGIN_PAGE + next);
  }
  function login(password) {
    if (password !== 'ForgeX2026') return false;
    setStoredAuthValue('1');
    return true;
  }
  function logout() {
    clearStoredAuthValue();
    global.location.replace(LOGIN_PAGE);
  }

  function ensureLogoutButton() {
    if (currentPage === LOGIN_PAGE || currentPage === 'smoke.html') return;
    var actions = global.document && global.document.querySelector('.topbar__actions');
    if (!actions || actions.querySelector('[data-logout]')) return;

    var button = global.document.createElement('button');
    button.type = 'button';
    button.className = 'topbar-logout';
    button.setAttribute('data-logout', 'true');
    button.setAttribute('aria-label', 'خروج');
    button.setAttribute('title', 'خروج');
    button.textContent = '×';

    actions.insertBefore(button, actions.firstChild);
  }

  global.ForgeXAuth = { login: login, logout: logout, isAuthenticated: isAuthenticated };
  if (currentPage !== LOGIN_PAGE && currentPage !== 'smoke.html' && !isAuthenticated()) redirectToLogin();
  if (currentPage === LOGIN_PAGE && isAuthenticated()) global.location.replace('index.html');

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', ensureLogoutButton);
  } else {
    ensureLogoutButton();
  }

  global.addEventListener('click', function (event) {
    var button = event.target.closest('[data-logout]');
    if (button) { event.preventDefault(); logout(); }
  });
})(window);
