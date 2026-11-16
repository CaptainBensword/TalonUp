(() => {
  const $ = (selector) => document.querySelector(selector);
  const headerInput = $("#searchInput");
  const heroInput = $("#heroSearchInput");
  const suggestionPanel = $("#searchSuggestions");
  const suggestionList = $("#suggestionList");
  const suggestions = [
    "Game development", "Minecraft", "Animation", "Music", "Short films",
    "Building", "Tutorials", "Funny moments", "Indie games", "Science",
    "Creative projects", "Puzzle games"
  ];

  function dispatchSearch(value) {
    headerInput.value = value;
    heroInput.value = value;
    headerInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function renderSuggestions(filter = "") {
    const needle = filter.trim().toLowerCase();
    const matches = suggestions.filter(term => !needle || term.toLowerCase().includes(needle));
    suggestionList.innerHTML = matches.length
      ? matches.map(term => `<button class="suggestion-chip" type="button" data-search-term="${term.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}">${term}</button>`).join("")
      : `<span class="suggestions-empty">No quick matches. Press Enter to search the feed.</span>`;
  }

  function openSuggestions() {
    renderSuggestions(headerInput.value);
    suggestionPanel.classList.remove("hidden");
    headerInput.setAttribute("aria-expanded", "true");
  }

  function closeSuggestions() {
    suggestionPanel.classList.add("hidden");
    headerInput.setAttribute("aria-expanded", "false");
  }

  headerInput.addEventListener("focus", openSuggestions);
  headerInput.addEventListener("click", openSuggestions);
  headerInput.addEventListener("input", () => {
    heroInput.value = headerInput.value;
    renderSuggestions(headerInput.value);
    suggestionPanel.classList.remove("hidden");
  });
  heroInput.addEventListener("input", () => dispatchSearch(heroInput.value));

  $("#heroSearchForm").addEventListener("submit", event => {
    event.preventDefault();
    const term = heroInput.value.trim();
    dispatchSearch(term);
    closeSuggestions();
    $("#videoGrid").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  suggestionList.addEventListener("click", event => {
    const chip = event.target.closest("[data-search-term]");
    if (!chip) return;
    dispatchSearch(chip.dataset.searchTerm);
    closeSuggestions();
    $("#videoGrid").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("#randomSearch").addEventListener("click", () => {
    const pool = suggestions.filter(term => term.toLowerCase() !== headerInput.value.trim().toLowerCase());
    const picked = pool[Math.floor(Math.random() * pool.length)] || suggestions[0];
    dispatchSearch(picked);
    closeSuggestions();
    $("#videoGrid").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("#clearSearch").addEventListener("click", () => {
    heroInput.value = "";
    closeSuggestions();
  });
  $("#searchForm").addEventListener("submit", closeSuggestions);
  document.addEventListener("click", event => {
    if (!event.target.closest(".search")) closeSuggestions();
    const category = event.target.closest(".hero-category-hotspots [data-category]");
    if (category) $("#videoGrid").scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();