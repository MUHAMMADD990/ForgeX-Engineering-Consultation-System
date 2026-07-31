/* PWA registration shared by every page. */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  setTimeout(function () {
    if (window.ForgeXDB && ForgeXDB.backup && ForgeXDB.backup.autoSave) ForgeXDB.backup.autoSave();
  }, 0);
})();
