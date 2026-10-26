(function () {
  "use strict";

  var cfg = window.FS_CONFIG || {};
  var root = document.documentElement;
  var LANG = root.getAttribute("data-site-lang") === "ua" ? "ua" : "en";
  var CONSENT_KEY = "fs_consent";
  var INTERNAL_KEY = "fs_internal";

  function store(op, key, value) {
    try {
      if (op === "get") return window.localStorage.getItem(key);
      if (op === "set") window.localStorage.setItem(key, value);
      if (op === "del") window.localStorage.removeItem(key);
    } catch (e) { /* storage blocked: carry on without it */ }
    return null;
  }

  function isSet(value, placeholder) {
    return typeof value === "string" && value !== "" && value !== placeholder;
  }

  var gaId = cfg.GA_MEASUREMENT_ID;
  var gaOn = isSet(gaId, "G-XXXXXXXXXX") && /^G-[A-Z0-9]{6,12}$/.test(gaId) && !/^G-X+$/.test(gaId);
  var clarityId = cfg.CLARITY_ID;
  var clarityOk = isSet(clarityId, "CLARITY_ID") && /^[a-z0-9]{8,12}$/i.test(clarityId);

  /* ---------- analytics ---------- */
  function track(name, params) {
    try {
      if (typeof gtag !== "function") return;
      if (gaOn && !gaLoaded) return; // no consent yet: nothing is queued or sent
      var p = params || {};
      p.page_language = LANG;
      gtag("event", name, p);
    } catch (e) { /* analytics must never break the page */ }
  }

  function loadScript(src) {
    var s = document.createElement("script");
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  function initGa() {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") {
      window.gtag = function () { window.dataLayer.push(arguments); };
    }
    gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      wait_for_update: 500
    });
  }

  // gtag.js is fetched only after the visitor accepts; nothing from Google loads before that
  var gaLoaded = false;
  function loadGa() {
    if (!gaOn || gaLoaded) return;
    gaLoaded = true;
    gtag("consent", "update", { analytics_storage: "granted" });
    gtag("js", new Date());
    var conf = { page_language: LANG };
    if (store("get", INTERNAL_KEY) === "1") conf.traffic_type = "internal";
    gtag("config", gaId, conf);
    loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gaId));
  }

  var clarityLoaded = false;
  function setClarity(granted) {
    try {
      if (granted && clarityOk && !clarityLoaded) {
        window.clarity = window.clarity || function () {
          (window.clarity.q = window.clarity.q || []).push(arguments);
        };
        loadScript("https://www.clarity.ms/tag/" + encodeURIComponent(clarityId));
        clarityLoaded = true;
      }
      if (clarityLoaded && typeof window.clarity === "function") {
        window.clarity("consent", granted);
      }
    } catch (e) { /* ignore */ }
  }

  // ?internal=1 marks this browser as internal traffic, ?internal=0 clears it
  try {
    var q = new URLSearchParams(window.location.search).get("internal");
    if (q === "1") store("set", INTERNAL_KEY, "1");
    if (q === "0") store("del", INTERNAL_KEY);
  } catch (e) { /* ignore */ }

  if (gaOn) initGa();

  /* ---------- consent banner ---------- */
  var banner = document.getElementById("consent");

  function showBanner(show) {
    if (!banner) return;
    banner.hidden = !show;
    document.body.classList.toggle("has-consent", show);
  }

  function applyConsent(state) {
    try {
      if (state === "granted") loadGa();
      else if (gaLoaded && typeof gtag === "function") gtag("consent", "update", { analytics_storage: "denied" });
    } catch (e) { /* ignore */ }
    setClarity(state === "granted");
  }

  var saved = store("get", CONSENT_KEY);
  if (saved === "granted") { loadGa(); setClarity(true); }
  showBanner(saved !== "granted" && saved !== "denied");

  /* ---------- contacts from config ---------- */
  function each(sel, fn) {
    var list = document.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }
  var email = String(cfg.CONTACT_EMAIL || "");
  var tg = String(cfg.CONTACT_TELEGRAM || "").replace(/^@/, "");
  each("[data-email-text]", function (el) { el.textContent = email; });
  each("[data-email-link]", function (el) { el.href = "mailto:" + email; });
  each("[data-telegram-link]", function (el) { el.href = "https://t.me/" + encodeURIComponent(tg); });
  if (isSet(cfg.FIVERR_URL, "")) each("[data-fiverr-link]", function (el) { el.href = cfg.FIVERR_URL; });

  /* ---------- clicks ---------- */
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function onCopied(btn) {
    track("contact_click", { channel: "email_copy" });
    var label = btn.getAttribute("data-label") || btn.textContent;
    btn.setAttribute("data-label", label);
    btn.textContent = btn.getAttribute("data-done") || label;
    window.setTimeout(function () { btn.textContent = label; }, 1800);
  }

  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("a, button") : null;
    if (!t) return;
    var d = t.dataset || {};

    if (d.consent) {
      store("set", CONSENT_KEY, d.consent);
      applyConsent(d.consent);
      showBanner(false);
      return;
    }
    if (t.hasAttribute("data-consent-open")) { showBanner(true); return; }
    if (t.hasAttribute("data-copy-email")) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(email).then(function () { onCopied(t); }, function () {
          if (fallbackCopy(email)) onCopied(t);
        });
      } else if (fallbackCopy(email)) {
        onCopied(t);
      }
      return;
    }

    if (d.cta) track("cta_click", { cta_location: d.cta });
    if (d.service) track("service_click", { service_name: d.service });
    if (d.contact) track("contact_click", { channel: d.contact });
    if (d.langSwitch) track("language_switch", { to_language: d.langSwitch });

    if (t.tagName === "A" && /^https?:$/.test(t.protocol) && t.hostname !== window.location.hostname) {
      track("outbound_click", { link_domain: t.hostname });
    }
  });

  /* ---------- scroll depth ---------- */
  var depthMarks = [25, 50, 75];
  var depthSent = {};
  var ticking = false;
  function checkDepth() {
    ticking = false;
    var el = document.documentElement;
    var max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;
    var pct = (window.pageYOffset / max) * 100;
    for (var i = 0; i < depthMarks.length; i++) {
      var m = depthMarks[i];
      if (pct >= m && !depthSent[m]) {
        depthSent[m] = true;
        track("scroll_depth", { percent: m });
      }
    }
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(checkDepth); }
  }, { passive: true });

  /* ---------- section views ---------- */
  var seen = {};
  if ("IntersectionObserver" in window) {
    var sections = document.querySelectorAll("[data-section]");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var name = en.target.getAttribute("data-section");
        var vh = en.rootBounds ? en.rootBounds.height : window.innerHeight;
        // tall sections can never reach 50% of their own height on a phone, so half a screen counts too
        var visible = en.intersectionRatio >= 0.5 || en.intersectionRect.height >= vh * 0.5;
        if (!en.isIntersecting || !visible || seen[name]) return;
        seen[name] = true;
        track("section_view", { section_name: name });
        if (name === "case") track("case_view");
      });
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    for (var i = 0; i < sections.length; i++) io.observe(sections[i]);

    var contact = document.getElementById("contact");
    if (contact) {
      new IntersectionObserver(function (entries) {
        document.body.classList.toggle("is-contact-visible", entries[0].isIntersecting);
      }).observe(contact);
    }
  }
})();
