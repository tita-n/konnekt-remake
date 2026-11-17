(function () {
  try {
    var stored = localStorage.getItem("konnekt:theme") || "system";
    var dark = stored === "dark" || (stored === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    // Start solid; the appearance provider upgrades once capabilities are known.
    document.documentElement.dataset.glass = "solid";
  } catch (error) {
    document.documentElement.dataset.theme = "light";
  }
})();
