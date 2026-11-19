/*
 * State-only addresses. Loaded first in <head> on every page.
 *
 * If the site is opened on an address whose first part starts with a state name,
 * e.g. enugu-ev-registration.vercel.app or bayelsa-ev-registration.vercel.app
 * (or a custom domain like enugu.example.com), only that state's page is shown:
 * the chooser and the other state's page redirect to it immediately.
 * Any other address (the main one) behaves normally.
 */
(function () {
  var label = location.hostname.split('.')[0].toLowerCase();
  var lock = label.indexOf('enugu') === 0 ? 'enugu' : label.indexOf('bayelsa') === 0 ? 'bayelsa' : null;
  if (!lock) return;
  if (location.pathname.indexOf('/' + lock + '/') !== 0) {
    location.replace('/' + lock + '/' + location.search + location.hash);
  }
})();
