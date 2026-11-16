(() => {
  const $ = (selector) => document.querySelector(selector);
  const config = window.TALONUP_CONFIG || {};
  const hasConfig = Boolean(
    config.SUPABASE_URL &&
    config.SUPABASE_ANON_KEY &&
    !config.SUPABASE_URL.includes("YOUR_") &&
    !config.SUPABASE_ANON_KEY.includes("YOUR_")
  );
  const supabaseClient = hasConfig && window.supabase
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
      })
    : null;

  const state = {
    user: null,
    profile: null,
    videos: [],
    myVideos: [],
    reviews: [],
    category: "All",
    query: "",
    view: "home",
    activeVideo: null,
    authMode: "signin",
    isUploading: false
  };

  const VIDEO_SELECT = "id,title,description,category,video_path,thumbnail_path,status,created_at,user_id,profiles(display_name,username)";

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function getProfile(video) {
    const profile = Array.isArray(video.profiles) ? video.profiles[0] : video.profiles;
    return profile || {};
  }

  function initials(name = "T") {
    return String(name).trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "T";
  }

  function publicUrl(path) {
    if (!path || !supabaseClient) return "";
    return supabaseClient.storage.from("media").getPublicUrl(path).data.publicUrl;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2900);
  }

  function setNotice(title, message) {
    const notice = $("#setupNotice");
    notice.querySelector("strong").textContent = title;
    notice.querySelector("p").textContent = message;
    notice.classList.remove("hidden");
  }

  function closeDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog && dialog.open) dialog.close();
  }

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function renderCard(video, index = 0, admin = false) {
    const profile = getProfile(video);
    const name = profile.display_name || "TalonUp creator";
    const username = profile.username ? "@" + profile.username : "";
    const thumb = publicUrl(video.thumbnail_path);
    const category = video.category || "Other";
    const status = video.status && video.status !== "approved"
      ? '<span class="status-pill status-' + escapeHTML(video.status) + '">' + escapeHTML(video.status) + '</span>'
      : "";
    const actions = admin
      ? '<div class="admin-actions"><button class="small-action approve" data-review="approved" data-id="' + escapeHTML(video.id) + '" type="button">Approve</button><button class="small-action reject" data-review="rejected" data-id="' + escapeHTML(video.id) + '" type="button">Reject</button></div>'
      : "";
    return `
      <article class="video-card" style="--i:${Math.min(index, 12)}">
        <button class="thumbnail" type="button" data-watch="${escapeHTML(video.id)}" aria-label="Watch ${escapeHTML(video.title)}">
          ${thumb ? '<img src="' + escapeHTML(thumb) + '" alt="" loading="lazy">' : '<span class="thumbnail-fallback cat-' + escapeHTML(category.toLowerCase()) + '"><span class="fallback-mark">TALONUP</span><span class="fallback-title">' + escapeHTML(video.title) + '</span></span>'}
          <span class="play-overlay"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6z"></path></svg></span></span>
          <span class="category-tag">${escapeHTML(category)}</span>
        </button>
        <div class="video-info">
          <span class="creator-avatar">${escapeHTML(initials(name))}</span>
          <div class="video-copy">
            <h3>${escapeHTML(video.title)}</h3>
            <span class="video-meta">${escapeHTML(name)} ${username ? "· " + escapeHTML(username) : ""}<br>${escapeHTML(formatDate(video.created_at))} ${status}</span>
            ${actions}
          </div>
        </div>
      </article>`;
  }

  function renderGrid(items, target = "#videoGrid", admin = false) {
    const grid = $(target);
    if (!items.length) {
      grid.innerHTML = "";
      return;
    }
    grid.innerHTML = items.map((video, index) => renderCard(video, index, admin)).join("");
  }

  function getCurrentItems() {
    const source = state.view === "uploads" ? state.myVideos : state.videos;
    let items = source.slice();
    if (state.category !== "All" && state.view !== "uploads") {
      items = items.filter(video => video.category === state.category);
    }
    if (state.query.trim()) {
      const q = state.query.trim().toLowerCase();
      items = items.filter(video => {
        const profile = getProfile(video);
        return [video.title, video.description, video.category, profile.display_name, profile.username]
          .some(value => String(value || "").toLowerCase().includes(q));
      });
    }
    items.sort((a, b) => {
      const direction = $("#sortSelect").value === "oldest" ? 1 : -1;
      return direction * (new Date(a.created_at) - new Date(b.created_at));
    });
    return items;
  }

  function updateEmptyState(items) {
    const empty = $("#emptyState");
    const grid = $("#videoGrid");
    const isConfigured = Boolean(supabaseClient);
    if (!items.length) {
      grid.classList.add("hidden");
      empty.classList.remove("hidden");
      if (!isConfigured) {
        $("#emptyTitle").textContent = "TalonUp is ready to connect";
        $("#emptyCopy").textContent = "The front end is in place. Connect the database and storage to switch on shared videos, accounts, and uploads.";
        $("#emptyUpload").textContent = "How setup works";
      } else if (state.query) {
        $("#emptyTitle").textContent = "No matches this time";
        $("#emptyCopy").textContent = "Try another search or clear the filters.";
        $("#emptyUpload").textContent = "Clear search";
      } else if (state.view === "uploads") {
        $("#emptyTitle").textContent = "Nothing uploaded yet";
        $("#emptyCopy").textContent = "Your uploads will show up here. You don't need a separate channel to start.";
        $("#emptyUpload").textContent = "Upload a video";
      } else {
        $("#emptyTitle").textContent = "It's quiet in here";
        $("#emptyCopy").textContent = "The first videos haven't landed yet. Check back soon, or be the one to start it.";
        $("#emptyUpload").textContent = "Upload a video";
      }
    } else {
      grid.classList.remove("hidden");
      empty.classList.add("hidden");
    }
  }

  function applyFilters() {
    const items = getCurrentItems();
    renderGrid(items);
    updateEmptyState(items);

    if (state.view === "uploads") {
      $("#pageTitle").textContent = state.query ? "Your upload search" : "My uploads";
      $("#pageSubtitle").textContent = "Your videos and their review status";
    } else if (state.query) {
      $("#pageTitle").textContent = "Search results";
      $("#pageSubtitle").textContent = items.length + (items.length === 1 ? " video found" : " videos found");
    } else if (state.view === "explore") {
      $("#pageTitle").textContent = "Explore videos";
      $("#pageSubtitle").textContent = "Follow a curiosity and see where it takes you";
    } else {
      $("#pageTitle").textContent = "Find something worth watching";
      $("#pageSubtitle").textContent = "Browse what's new, follow a curiosity, or just see where you end up";
    }
    $("#clearSearch").classList.toggle("hidden", !state.query);
  }

  async function loadFeed() {
    if (!supabaseClient) {
      setNotice("Browsing preview", "The video service isn't connected yet. The layout is ready; connect Supabase to turn on shared accounts, search, and uploads.");
      state.videos = [];
      applyFilters();
      return;
    }
    const { data, error } = await supabaseClient
      .from("videos")
      .select(VIDEO_SELECT)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(120);
    if (error) {
      setNotice("One setup step is still missing", "Run supabase/setup.sql in your Supabase SQL Editor, then refresh this page. Details: " + error.message);
      state.videos = [];
    } else {
      $("#setupNotice").classList.add("hidden");
      state.videos = data || [];
    }
    applyFilters();
  }

  async function loadMyUploads() {
    if (!supabaseClient || !state.user) {
      state.myVideos = [];
      applyFilters();
      return;
    }
    const { data, error } = await supabaseClient
      .from("videos")
      .select(VIDEO_SELECT)
      .eq("user_id", state.user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      showToast("Couldn't load your uploads: " + error.message);
      state.myVideos = [];
    } else {
      state.myVideos = data || [];
    }
    applyFilters();
  }

  async function loadAdminReviews() {
    const section = $("#adminSection");
    if (!state.profile || !state.profile.is_admin || !supabaseClient) {
      section.classList.add("hidden");
      return;
    }
    const { data, error } = await supabaseClient
      .from("videos")
      .select(VIDEO_SELECT)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) {
      showToast("Review queue couldn't load");
      return;
    }
    state.reviews = data || [];
    $("#reviewCount").textContent = state.reviews.length + (state.reviews.length === 1 ? " waiting" : " waiting");
    renderGrid(state.reviews, "#reviewGrid", true);
    section.classList.remove("hidden");
  }

  async function syncUser(user) {
    state.user = user || null;
    state.profile = null;
    if (state.user && supabaseClient) {
      const { data } = await supabaseClient
        .from("profiles")
        .select("display_name,username,is_admin")
        .eq("id", state.user.id)
        .maybeSingle();
      state.profile = data || {
        display_name: state.user.user_metadata?.display_name || state.user.email?.split("@")[0] || "Creator",
        username: "",
        is_admin: false
      };
    }
    const button = $("#accountButton");
    if (state.user) {
      button.textContent = initials(state.profile?.display_name || state.user.email);
      button.classList.add("signed-in");
      button.setAttribute("aria-label", "Signed in. Click to sign out");
      button.title = "Signed in as " + (state.profile?.display_name || state.user.email) + " — click to sign out";
    } else {
      button.textContent = "Sign in";
      button.classList.remove("signed-in");
      button.setAttribute("aria-label", "Sign in");
      button.title = "";
      state.myVideos = [];
    }
    await loadAdminReviews();
    if (state.view === "uploads" && state.user) await loadMyUploads();
  }

  function openAuth(mode = "signin") {
    if (!supabaseClient) {
      showToast("Accounts will work once Supabase is connected");
      setNotice("Connect Supabase to enable accounts", "Add your Supabase project URL and publishable key in config.js, then run the setup SQL. Watching the preview doesn't require an account.");
      return;
    }
    state.authMode = mode;
    updateAuthMode();
    $("#authError").textContent = "";
    openDialog("authDialog");
  }

  function updateAuthMode() {
    const signup = state.authMode === "signup";
    $("#authTitle").textContent = signup ? "Create your account" : "Welcome back";
    $("#authLead").textContent = signup
      ? "Make an account to upload videos. You can watch without one."
      : "Sign in to upload and keep track of your videos. Watching is always open.";
    $("#displayNameWrap").classList.toggle("hidden", !signup);
    $("#authPassword").autocomplete = signup ? "new-password" : "current-password";
    $("#authSubmit").textContent = signup ? "Create account" : "Sign in";
    $("#authSwitchText").textContent = signup ? "Already have an account?" : "New to TalonUp?";
    $("#authSwitch").textContent = signup ? "Sign in" : "Create an account";
  }

  async function handleAuth(event) {
    event.preventDefault();
    if (!supabaseClient) return;
    const button = $("#authSubmit");
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    const displayName = $("#displayName").value.trim();
    $("#authError").textContent = "";
    button.disabled = true;
    button.textContent = "Please wait…";
    let result;
    if (state.authMode === "signup") {
      result = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName || email.split("@")[0] } }
      });
    } else {
      result = await supabaseClient.auth.signInWithPassword({ email, password });
    }
    button.disabled = false;
    button.textContent = state.authMode === "signup" ? "Create account" : "Sign in";
    if (result.error) {
      $("#authError").textContent = result.error.message;
      return;
    }
    if (state.authMode === "signup" && !result.data.session) {
      $("#authError").textContent = "Check your email for the confirmation link, then come back and sign in.";
      return;
    }
    await syncUser(result.data.user);
    closeDialog("authDialog");
    $("#authForm").reset();
    showToast(state.authMode === "signup" ? "Account created. Welcome to TalonUp." : "You're signed in.");
  }

  function requireAccount() {
    if (!supabaseClient) {
      openAuth();
      return false;
    }
    if (!state.user) {
      openAuth("signin");
      showToast("Sign in first to upload a video");
      return false;
    }
    return true;
  }

  function openUpload() {
    if (!requireAccount()) return;
    $("#uploadForm").reset();
    $("#fileLabel").textContent = "Choose a video to upload";
    $("#fileHint").textContent = "MP4, WebM, or MOV · up to " + (config.MAX_UPLOAD_MB || 50) + " MB";
    $("#fileMeta").classList.add("hidden");
    $("#uploadProgress").classList.add("hidden");
    $("#uploadError").textContent = "";
    $("#publishButton").disabled = false;
    $("#publishButton").textContent = "Send for review";
    $("#videoTitle").value = "";
    state.isUploading = false;
    openDialog("uploadDialog");
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  function updateSelectedFile() {
    const file = $("#videoFile").files[0];
    if (!file) return;
    $("#fileLabel").textContent = file.name;
    $("#fileHint").textContent = "Selected video";
    $("#fileMeta").textContent = formatBytes(file.size) + " · " + (file.type || "video file");
    $("#fileMeta").classList.remove("hidden");
    if (!$("#videoTitle").value) {
      $("#videoTitle").value = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    }
  }

  function uploadResumable(file, objectPath, session) {
    if (!window.tus || !window.tus.Upload) {
      return Promise.reject(new Error("The resumable upload library didn't load. Refresh and try again."));
    }
    const projectRef = new URL(config.SUPABASE_URL).hostname.split(".")[0];
    const endpoint = "https://" + projectRef + ".storage.supabase.co/storage/v1/upload/resumable";
    const upload = new window.tus.Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: "Bearer " + session.access_token,
        apikey: config.SUPABASE_ANON_KEY,
        "x-upsert": "false"
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: "media",
        objectName: objectPath,
        contentType: file.type || "video/mp4",
        cacheControl: "3600"
      },
      onError(error) {
        rejectUpload(error);
      },
      onProgress(uploaded, total) {
        const percent = Math.min(100, Math.round((uploaded / total) * 100));
        $("#progressPercent").textContent = percent + "%";
        $("#progressBar").style.width = percent + "%";
        $("#progressHint").textContent = formatBytes(uploaded) + " of " + formatBytes(total);
      },
      onSuccess() {
        resolveUpload();
      }
    });
    let resolveUpload;
    let rejectUpload;
    const promise = new Promise((resolve, reject) => {
      resolveUpload = resolve;
      rejectUpload = reject;
    });
    upload.findPreviousUploads().then(previous => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject => rejectUpload(reject));
    return promise;
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!requireAccount() || state.isUploading) return;
    const file = $("#videoFile").files[0];
    const title = $("#videoTitle").value.trim();
    if (!file) {
      $("#uploadError").textContent = "Choose a video file first.";
      return;
    }
    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if (!allowedTypes.includes(file.type) && !/\.(mp4|webm|mov)$/i.test(file.name)) {
      $("#uploadError").textContent = "Use an MP4, WebM, or MOV video.";
      return;
    }
    const maxBytes = (Number(config.MAX_UPLOAD_MB) || 50) * 1024 * 1024;
    if (file.size > maxBytes) {
      $("#uploadError").textContent = "This file is larger than " + (config.MAX_UPLOAD_MB || 50) + " MB. Try a smaller export.";
      return;
    }
    if (!title) {
      $("#uploadError").textContent = "Add a title for your video.";
      return;
    }
    const thumbFile = $("#thumbnailFile").files[0];
    if (thumbFile && thumbFile.size > 4 * 1024 * 1024) {
      $("#uploadError").textContent = "Thumbnails need to be 4 MB or smaller.";
      return;
    }

    state.isUploading = true;
    $("#publishButton").disabled = true;
    $("#publishButton").textContent = "Uploading…";
    $("#uploadError").textContent = "";
    $("#uploadProgress").classList.remove("hidden");
    $("#progressLabel").textContent = "Uploading video";
    $("#progressPercent").textContent = "0%";
    $("#progressBar").style.width = "0%";
    $("#progressHint").textContent = "Resumable upload · this tab needs to stay open";
    try {
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error("Your session expired. Sign in again and retry.");
      const userId = state.user.id;
      const videoId = crypto.randomUUID();
      const extension = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
      const videoPath = userId + "/" + videoId + "." + extension;
      await uploadResumable(file, videoPath, sessionData.session);

      let thumbnailPath = null;
      if (thumbFile) {
        $("#progressLabel").textContent = "Saving thumbnail";
        const thumbExt = (thumbFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        thumbnailPath = userId + "/" + videoId + "-thumb." + thumbExt;
        const { error: thumbError } = await supabaseClient.storage.from("media").upload(thumbnailPath, thumbFile, {
          cacheControl: "3600",
          contentType: thumbFile.type,
          upsert: false
        });
        if (thumbError) throw thumbError;
      }

      $("#progressLabel").textContent = "Sending for review";
      const { error: rowError } = await supabaseClient.from("videos").insert({
        user_id: userId,
        title,
        description: $("#videoDescription").value.trim(),
        category: $("#videoCategory").value,
        video_path: videoPath,
        thumbnail_path: thumbnailPath,
        status: "pending"
      });
      if (rowError) {
        await supabaseClient.storage.from("media").remove([videoPath, ...(thumbnailPath ? [thumbnailPath] : [])]);
        throw rowError;
      }
      $("#progressPercent").textContent = "100%";
      $("#progressBar").style.width = "100%";
      closeDialog("uploadDialog");
      showToast("Video sent for review. It will appear after approval.");
      if (state.view === "uploads") await loadMyUploads();
      await loadAdminReviews();
    } catch (error) {
      $("#uploadError").textContent = error.message || "The upload didn't finish. Please try again.";
      $("#publishButton").disabled = false;
      $("#publishButton").textContent = "Try again";
    } finally {
      state.isUploading = false;
    }
  }

  function openWatch(videoId) {
    const video = [...state.videos, ...state.myVideos, ...state.reviews].find(item => item.id === videoId);
    if (!video || video.status !== "approved" && video.user_id !== state.user?.id && !state.profile?.is_admin) return;
    state.activeVideo = video;
    const profile = getProfile(video);
    const name = profile.display_name || "TalonUp creator";
    $("#watchPlayer").src = publicUrl(video.video_path);
    $("#watchCategory").textContent = video.category || "Other";
    $("#watchTitle").textContent = video.title;
    $("#watchCreator").textContent = name;
    $("#watchUsername").textContent = profile.username ? "@" + profile.username : "";
    $("#watchAvatar").textContent = initials(name);
    $("#watchDescription").textContent = video.description || "No description added.";
    $("#reportButton").classList.toggle("hidden", video.status !== "approved");
    openDialog("watchDialog");
  }

  async function handleReport(event) {
    event.preventDefault();
    if (!requireAccount() || !state.activeVideo) return;
    const { error } = await supabaseClient.from("video_reports").insert({
      video_id: state.activeVideo.id,
      reporter_id: state.user.id,
      reason: $("#reportReason").value,
      details: $("#reportDetails").value.trim()
    });
    if (error) {
      $("#reportError").textContent = error.message;
      return;
    }
    closeDialog("reportDialog");
    $("#reportForm").reset();
    showToast("Report sent to the TalonUp team. Thanks for speaking up.");
  }

  async function reviewUpload(videoId, status) {
    if (!state.profile?.is_admin) return;
    const { error } = await supabaseClient.from("videos").update({ status }).eq("id", videoId);
    if (error) {
      showToast("Couldn't update this upload: " + error.message);
      return;
    }
    showToast(status === "approved" ? "Video approved and added to the feed." : "Video rejected.");
    await loadAdminReviews();
    await loadFeed();
  }

  function setView(view) {
    if (view === "uploads" && !state.user) {
      openAuth("signin");
      showToast("Sign in to see your uploads");
      return;
    }
    state.view = view;
    state.query = "";
    state.category = "All";
    $("#searchInput").value = "";
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));
    document.querySelectorAll(".category-item").forEach(item => item.classList.toggle("selected", item.dataset.category === "All"));
    if (view === "uploads") loadMyUploads();
    else applyFilters();
  }

  // Header and navigation
  $("#searchForm").addEventListener("submit", event => {
    event.preventDefault();
    state.query = $("#searchInput").value.trim();
    if (state.view === "uploads") loadMyUploads();
    else applyFilters();
  });
  $("#searchInput").addEventListener("input", () => {
    state.query = $("#searchInput").value.trim();
    if (state.view === "uploads") applyFilters();
    else applyFilters();
  });
  $("#clearSearch").addEventListener("click", () => {
    $("#searchInput").value = "";
    state.query = "";
    applyFilters();
    $("#searchInput").focus();
  });
  $("#sortSelect").addEventListener("change", applyFilters);
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  document.querySelectorAll(".category-item").forEach(button => button.addEventListener("click", () => {
    state.category = button.dataset.category;
    state.view = "explore";
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === "explore"));
    document.querySelectorAll(".category-item").forEach(item => item.classList.toggle("selected", item === button));
    applyFilters();
  }));
  $("#uploadButton").addEventListener("click", openUpload);
  $("#emptyUpload").addEventListener("click", () => {
    if (state.query) {
      state.query = "";
      $("#searchInput").value = "";
      applyFilters();
    } else if (!supabaseClient) {
      setNotice("Connect Supabase to enable uploads", "Open the repository README and follow the short Supabase setup. The SQL file creates the tables, security rules, and media bucket.");
      showToast("Backend setup is needed before uploading");
    } else {
      openUpload();
    }
  });
  $("#accountButton").addEventListener("click", async () => {
    if (!supabaseClient) return openAuth();
    if (state.user) {
      const { error } = await supabaseClient.auth.signOut();
      if (error) showToast(error.message);
      else {
        await syncUser(null);
        showToast("Signed out");
        if (state.view === "uploads") setView("home");
      }
    } else openAuth("signin");
  });
  $("#authForm").addEventListener("submit", handleAuth);
  $("#authSwitch").addEventListener("click", () => {
    state.authMode = state.authMode === "signin" ? "signup" : "signin";
    updateAuthMode();
    $("#authError").textContent = "";
  });
  $("#videoFile").addEventListener("change", updateSelectedFile);
  $("#uploadForm").addEventListener("submit", handleUpload);
  $("#dropZone").addEventListener("dragover", event => { event.preventDefault(); $("#dropZone").classList.add("drag-over"); });
  $("#dropZone").addEventListener("dragleave", () => $("#dropZone").classList.remove("drag-over"));
  $("#dropZone").addEventListener("drop", event => {
    event.preventDefault();
    $("#dropZone").classList.remove("drag-over");
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    $("#videoFile").files = transfer.files;
    updateSelectedFile();
  });

  // Video cards and moderation actions
  document.addEventListener("click", event => {
    const watchButton = event.target.closest("[data-watch]");
    if (watchButton) openWatch(watchButton.dataset.watch);
    const reviewButton = event.target.closest("[data-review]");
    if (reviewButton) reviewUpload(reviewButton.dataset.id, reviewButton.dataset.review);
  });
  $("#reportButton").addEventListener("click", () => {
    if (!requireAccount()) return;
    $("#reportError").textContent = "";
    openDialog("reportDialog");
  });
  $("#reportForm").addEventListener("submit", handleReport);

  document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => closeDialog(button.dataset.close)));
  document.querySelectorAll("dialog").forEach(dialog => {
    dialog.addEventListener("click", event => { if (event.target === dialog && !state.isUploading) dialog.close(); });
  });
  $("#watchDialog").addEventListener("close", () => {
    $("#watchPlayer").pause();
    $("#watchPlayer").removeAttribute("src");
    $("#watchPlayer").load();
  });

  // Start the public feed without requiring a sign-in.
  if (!supabaseClient) {
    setNotice("Browsing preview", "The video service isn't connected yet. The layout is ready; connect Supabase to turn on shared accounts, search, and uploads.");
    state.videos = [];
    applyFilters();
  } else {
    loadFeed();
    supabaseClient.auth.getSession().then(({ data }) => syncUser(data.session?.user || null));
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      syncUser(session?.user || null);
    });
  }
})();