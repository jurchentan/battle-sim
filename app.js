(function bootstrapSplitApp() {
  const scriptOrder = [
    "./src/core.js",
    "./src/setup.js",
    "./src/ui-controls.js",
    "./src/render.js",
    "./src/sim.js",
    "./src/scenarios.js",
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = src;
      tag.onload = resolve;
      tag.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(tag);
    });
  }

  scriptOrder
    .reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve())
    .then(() => {
      if (typeof init !== "function") {
        throw new Error("init is not defined after loading split files.");
      }
      init();
    })
    .catch((err) => {
      console.error(err);
      const banner = document.getElementById("eventBanner");
      if (banner) {
        banner.textContent = "App failed to load. Open browser console for details.";
      }
    });
}());
