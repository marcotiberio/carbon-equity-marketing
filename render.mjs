// Shared banner renderer. Runs unchanged in Node (build.mjs) and in the
// browser (editor/index.html) so there is exactly one code path from
// template + copy -> final banner HTML.
//
// A template is a normal, standalone-valid banner whose copy nodes are marked
// with data-ce="<path>" (e.g. data-ce="headline.1", data-ce="slides.0.1").
// render() bakes the copy into a `window.CE` object and appends a tiny
// hydration script that fills every marked node before the CSS animations run.
// Because the copy is baked into the file, each rendered banner is fully
// self-contained — no runtime fetch — which is what Google Display Network
// requires for HTML5 creatives.

import { logo } from './logo.mjs';

const LOGO_DARK = logo('#2e0f2b'); // for the light (paper) banners
const LOGO_LIGHT = logo('#FBFCFC'); // for the dark (plum) banners

// Runs *inside* each banner. Kept as a plain string so it can be inlined.
const HYDRATE = `<script>(function(){
  var CE = window.CE || {};
  document.querySelectorAll('[data-ce]').forEach(function(el){
    var v = el.getAttribute('data-ce').split('.').reduce(function(o,k){
      return (o==null)?o:o[k];
    }, CE);
    if (v!=null) el.innerHTML = v;
  });
  if (CE.clickUrl){
    window.clickTag = CE.clickUrl;
    document.querySelectorAll('a.banner').forEach(function(a){ a.href = CE.clickUrl; });
  }
})();</script>`;

/**
 * @param {string} template  raw template HTML
 * @param {object} data       the banner's copy object from content.json
 * @param {object} [opts]
 * @param {string} [opts.clickUrl]  destination URL (baked into CE)
 * @param {string} [opts.baseHref]  <base> injected into <head> so relative
 *                                  asset URLs resolve (used by the editor's
 *                                  iframe preview; omitted for dist builds
 *                                  where assets sit next to index.html)
 * @returns {string} final self-contained banner HTML
 */
export function render(template, data, opts = {}) {
  const ce = Object.assign({}, data, { clickUrl: opts.clickUrl });
  let html = template
    .split('{{LOGO_DARK}}').join(LOGO_DARK)
    .split('{{LOGO_LIGHT}}').join(LOGO_LIGHT)
    .replace('__CE_DATA__', JSON.stringify(ce));

  if (opts.baseHref) {
    html = html.replace('<head>', '<head>\n  <base href="' + opts.baseHref + '">');
  }

  // Hydration must run after the markup exists, so append it just before </body>.
  return html.replace('</body>', HYDRATE + '\n</body>');
}
