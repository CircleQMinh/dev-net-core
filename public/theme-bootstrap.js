(function () {
  var storageKey = "dev-net-core:theme";
  var mode = "dark";

  try {
    var storedMode = window.localStorage.getItem(storageKey);

    if (storedMode === "dark" || storedMode === "light") {
      mode = storedMode;
    }
  } catch {
    // Keep the stable dark default when browser storage is unavailable.
  }

  var root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
  root.style.colorScheme = mode;
})();
