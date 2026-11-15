// Asks with the browser's own dialog before a button carrying data-confirm does
// its job (e.g. opening or closing Registration); "Abbrechen" stops it.
// Bundled by scripts/build-client.mjs and inlined once into every admin page.
// Without JavaScript the button works as is, without asking.

document.addEventListener("click", (event) => {
  const target = event.target as Element | null;
  const button = target && target.closest ? target.closest("[data-confirm]") : null;
  if (button && !window.confirm(button.getAttribute("data-confirm") || "")) event.preventDefault();
});
