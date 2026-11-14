// Opens and closes the full-screen QR layer (src/ui/qr-layer.tsx), and offers
// the phone's share menu where the browser has one. Bundled by
// scripts/build-client.mjs for ~iOS 12 / Android 8 browsers and inlined into
// the pages that show the layer.
// The layer is fixed over the page: opening it moves nothing underneath, and
// closing it puts the page back exactly where it was.

const layer = document.getElementById("qr-layer");

if (layer) {
  const closeButton = layer.querySelector<HTMLElement>("[data-qr-close]");
  const shareButton = layer.querySelector<HTMLElement>("[data-qr-share]");
  let opener: HTMLElement | null = null;
  let scrollY = 0;

  const open = (button: HTMLElement) => {
    opener = button;
    scrollY = window.pageYOffset;
    layer.hidden = false;
    layer.scrollTop = 0;
    if (closeButton) closeButton.focus();
  };

  const close = () => {
    if (layer.hidden) return;
    layer.hidden = true;
    if (opener) opener.focus();
    // A swipe on the layer can scroll the page behind it on some phones; focusing
    // may scroll too (older Safari ignores preventScroll). Put the page back last.
    window.scrollTo(window.pageXOffset, scrollY);
  };

  Array.prototype.forEach.call(document.querySelectorAll("[data-qr-open]"), (button: HTMLElement) => {
    button.onclick = () => open(button);
  });
  if (closeButton) closeButton.onclick = close;
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.key === "Esc") close();
  });

  // Only where the browser can share; elsewhere the link stays written out to copy.
  if (shareButton && typeof navigator.share === "function") {
    shareButton.hidden = false;
    shareButton.onclick = () => {
      navigator
        .share({ title: shareButton.getAttribute("data-title") || undefined, url: shareButton.getAttribute("data-url") || location.href })
        // Closing the share menu without choosing rejects; nothing to do.
        .catch(() => undefined);
    };
  }
}
