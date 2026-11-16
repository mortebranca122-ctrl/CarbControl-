/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "4579ea0268c3c2470fd78bad2e8cdf36"
  }, {
    "url": "pwa-512x512.png",
    "revision": "38fe5f985d10205212c1e62417da592b"
  }, {
    "url": "pwa-192x192.png",
    "revision": "ed4a6ecef1bc4a5031721234f322946e"
  }, {
    "url": "index.html",
    "revision": "04b85deb2808ea0d1293d286b0f855ed"
  }, {
    "url": "icon.svg",
    "revision": "142e1a2d9b2f73c9c51b484c379721d9"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "5a355a1d8a05c9349359b559f31b01d0"
  }, {
    "url": "src/assets/images/sukuna_cursed_hero_1794849858421.jpg",
    "revision": "d00d8fa3805bcea338009c01c9481d51"
  }, {
    "url": "src/assets/images/sukuna_app_icon_1794849858920.jpg",
    "revision": "1fe849a9e2de5fe189aec7fb931ccbc3"
  }, {
    "url": "src/assets/images/food_rice_bowl_1794849860207.jpg",
    "revision": "26270206dde0ee9ac877fffb142da24c"
  }, {
    "url": "src/assets/images/food_oat_pancake_1794849861565.jpg",
    "revision": "51d2fddbd033824b5ecfe7500684e761"
  }, {
    "url": "src/assets/images/food_beans_bowl_1794849861216.jpg",
    "revision": "329ae05bee89adef844475c7a8bdca1b"
  }, {
    "url": "icons/pwa-512x512.png",
    "revision": "38fe5f985d10205212c1e62417da592b"
  }, {
    "url": "icons/pwa-192x192.png",
    "revision": "ed4a6ecef1bc4a5031721234f322946e"
  }, {
    "url": "assets/index-BUo6I002.js",
    "revision": null
  }, {
    "url": "assets/aistudio/CarbControl__Dashboard_Neon_de_Nutri__o_72515218.png",
    "revision": null
  }, {
    "url": "assets/aistudio/CarbControl__Controle_em_Vermelho_e39aaec6.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "5a355a1d8a05c9349359b559f31b01d0"
  }, {
    "url": "icon.svg",
    "revision": "142e1a2d9b2f73c9c51b484c379721d9"
  }, {
    "url": "pwa-192x192.png",
    "revision": "ed4a6ecef1bc4a5031721234f322946e"
  }, {
    "url": "pwa-512x512.png",
    "revision": "38fe5f985d10205212c1e62417da592b"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "4579ea0268c3c2470fd78bad2e8cdf36"
  }, {
    "url": "manifest.webmanifest",
    "revision": "be15641896b3bfe8db5eb65e998e457d"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
