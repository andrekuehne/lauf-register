// Opens and closes the full-screen QR layers (src/ui/qr-layer.tsx), and offers
// the phone's share menu where the browser has one. Bundled by
// scripts/build-client.mjs for ~iOS 12 / Android 8 browsers and inlined once
// into the pages that show a layer.
// A layer is fixed over the page: opening it moves nothing underneath, and
// closing it puts the page back exactly where it was.

// A module, so these names don't clash with the browser's globals (open, close, scrollY).
export {};

let openLayer: HTMLElement | null = null;
let opener: HTMLElement | null = null;
let scrollY = 0;

const open = (layer: HTMLElement, button: HTMLElement) => {
  opener = button;
  openLayer = layer;
  scrollY = window.pageYOffset;
  layer.hidden = false;
  layer.scrollTop = 0;
  const closeButton = layer.querySelector<HTMLElement>("[data-qr-close]");
  if (closeButton) closeButton.focus();
};

const close = () => {
  if (!openLayer) return;
  openLayer.hidden = true;
  openLayer = null;
  if (opener) opener.focus();
  // A swipe on the layer can scroll the page behind it on some phones; focusing
  // may scroll too (older Safari ignores preventScroll). Put the page back last.
  window.scrollTo(window.pageXOffset, scrollY);
};

Array.prototype.forEach.call(document.querySelectorAll("[data-qr-open]"), (button: HTMLElement) => {
  const layer = document.getElementById(button.getAttribute("data-qr-open") || "");
  if (layer) button.onclick = () => open(layer, button);
});

Array.prototype.forEach.call(document.querySelectorAll(".qr-layer"), (layer: HTMLElement) => {
  const closeButton = layer.querySelector<HTMLElement>("[data-qr-close]");
  if (closeButton) closeButton.onclick = close;

  // Only where the browser can share; elsewhere the link stays written out to copy.
  const shareButton = layer.querySelector<HTMLElement>("[data-qr-share]");
  if (shareButton && typeof navigator.share === "function") {
    shareButton.hidden = false;
    shareButton.onclick = () => {
      navigator
        .share({ title: shareButton.getAttribute("data-title") || undefined, url: shareButton.getAttribute("data-url") || location.href })
        // Closing the share menu without choosing rejects; nothing to do.
        .catch(() => undefined);
    };
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" || event.key === "Esc") close();
});
