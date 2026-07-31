/* Client-side access gate for the standalone ForgeX app. */
(function (global) {
  'use strict';

  var AUTH_KEY = 'forgex.authenticated';
  var LOGIN_PAGE = 'login.html';
  var currentPage = (global.location.pathname.split('/').pop() || 'index.html').toLowerCase();

  function isAuthenticated() {
    try { return global.localStorage.getItem(AUTH_KEY) === '1'; } catch (e) { return false; }
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
    try { global.localStorage.setItem(AUTH_KEY, '1'); } catch (e) {}
    return true;
  }
  function logout() {
    try { global.localStorage.removeItem(AUTH_KEY); } catch (e) {}
    global.location.replace(LOGIN_PAGE);
  }

  global.ForgeXAuth = { login: login, logout: logout, isAuthenticated: isAuthenticated };
  if (currentPage !== LOGIN_PAGE && currentPage !== 'smoke.html' && !isAuthenticated()) redirectToLogin();
  if (currentPage === LOGIN_PAGE && isAuthenticated()) global.location.replace('index.html');

  global.addEventListener('click', function (event) {
    var button = event.target.closest('[data-logout]');
    if (button) { event.preventDefault(); logout(); }
  });
})(window);
