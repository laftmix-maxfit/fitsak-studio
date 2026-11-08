(function () {
  "use strict";

  var cfg = window.FS_CONFIG || {};
  var root = document.documentElement;
  var LANG = root.getAttribute("data-site-lang") === "ua" ? "ua" : "en";
  var CONSENT_KEY = "fs_consent";
  var INTERNAL_KEY = "fs_internal";
  var DEBUG_KEY = "fs_debug";
  var CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid"];

  function store(op, key, value) {
    try {
      if (op === "get") return window.localStorage.getItem(key);
      if (op === "set") window.localStorage.setItem(key, value);
      if (op === "del") window.localStorage.removeItem(key);
    } catch (e) { /* storage blocked: carry on without it */ }
    return null;
  }

  function session(op, key, value) {
    try {
      if (op === "get") return window.sessionStorage.getItem(key);
      if (op === "set") window.sessionStorage.setItem(key, value);
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

  /* ---------- url parameters: internal, debug, first-touch campaign ---------- */
  var params = null;
  try { params = new URLSearchParams(window.location.search); } catch (e) { params = null; }

  if (params) {
    // ?internal=1 marks this browser as internal traffic, ?internal=0 clears it
    var internal = params.get("internal");
    if (internal === "1") store("set", INTERNAL_KEY, "1");
    if (internal === "0") store("del", INTERNAL_KEY);

    // ?debug=1 turns on GA4 DebugView for this browser session
    if (params.get("debug") === "1") session("set", DEBUG_KEY, "1");

    // first touch wins: a stored value is never overwritten
    CAMPAIGN_KEYS.forEach(function (k) {
      var v = params.get(k);
      if (!v || session("get", "fs_" + k)) return;
      v = v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100);
      if (v) session("set", "fs_" + k, v);
    });
  }

  function campaign(key) { return session("get", "fs_" + key) || ""; }

  /* ---------- analytics ---------- */
  function track(name, params) {
    try {
      if (typeof gtag !== "function") return;
      if (gaOn && !gaLoaded) return; // no consent yet: nothing is queued or sent
      var p = params || {};
      p.page_language = LANG;
      if (store("get", INTERNAL_KEY) === "1") p.traffic_type = "internal";
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
    gtag("set", "url_passthrough", true);
  }

  // ad_personalization is never granted
  function consentUpdate(state) {
    gtag("consent", "update", {
      analytics_storage: state,
      ad_storage: state,
      ad_user_data: state
    });
  }

  // gtag.js is fetched only after the visitor accepts; nothing from Google loads before that
  var gaLoaded = false;
  function loadGa() {
    if (!gaOn || gaLoaded) return;
    gaLoaded = true;
    consentUpdate("granted");
    gtag("js", new Date());
    var conf = { page_language: LANG };
    if (store("get", INTERNAL_KEY) === "1") conf.traffic_type = "internal";
    if (session("get", DEBUG_KEY) === "1") conf.debug_mode = true;
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
      else if (gaLoaded && typeof gtag === "function") consentUpdate("denied");
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

  /* ---------- audit form ---------- */
  var T = {
    en: {
      sending: "Sending…",
      required: "Please fill in this field",
      website: "Enter your site address, for example example.com",
      contact: "Enter an email, a Telegram @username or a phone number",
      consent: "Your consent is needed to send the request",
      tooLong: "Please keep it under 1000 characters",
      pkg: "Choose a package from the list",
      success: "Thank you! Request no. {id} received. I’ll reply within 24 hours.",
      errPre: "Couldn’t send. Try again or write on ",
      errMid: " / by "
    },
    ua: {
      sending: "Надсилаю…",
      required: "Заповніть це поле",
      website: "Вкажіть адресу сайту, наприклад example.com",
      contact: "Вкажіть email, @нік у Telegram або телефон",
      consent: "Для надсилання потрібна ваша згода",
      tooLong: "Не більше 1000 символів",
      pkg: "Оберіть пакет зі списку",
      success: "Дякую! Заявка № {id} отримана. Відповім протягом 24 годин.",
      errPre: "Не вдалося надіслати. Спробуйте ще раз або напишіть у ",
      errMid: " / на "
    }
  }[LANG];

  var form = document.getElementById("audit-form");
  var auditSection = document.getElementById("audit");
  var packageSelect = form ? form.elements.package : null;
  var firstField = form ? form.elements.name : null;
  var suppressStart = false;

  function scrollToAudit() {
    if (!auditSection) return;
    var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    auditSection.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  }

  function selectPackage(value) {
    if (!packageSelect) return false;
    for (var i = 0; i < packageSelect.options.length; i++) {
      if (packageSelect.options[i].value === value) { packageSelect.value = value; return true; }
    }
    return false;
  }

  function newLeadId() {
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var out = "";
    var buf = null;
    try {
      if (window.crypto && window.crypto.getRandomValues) buf = window.crypto.getRandomValues(new Uint8Array(4));
    } catch (e) { buf = null; }
    for (var i = 0; i < 4; i++) {
      var n = buf ? buf[i] : Math.floor(Math.random() * 256);
      out += chars.charAt(n % chars.length);
    }
    return "L" + Date.now().toString(36) + out;
  }

  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
  function isTelegram(v) {
    return /^@[A-Za-z0-9_]{5,32}$/.test(v) || /^(https?:\/\/)?(www\.)?t\.me\/[A-Za-z0-9_]{5,32}\/?$/i.test(v);
  }
  function isPhone(v) {
    if (!/^\+?[\d\s\-()]+$/.test(v)) return false;
    var digits = v.replace(/\D/g, "").length;
    return digits >= 9 && digits <= 15;
  }
  function isSite(v) { return /^(https?:\/\/)?[^\s.\/]+\.[^\s]{2,}$/i.test(v); }

  // returns an error message, or "" when the field is fine
  function fieldError(el) {
    var v = (el.type === "checkbox") ? "" : String(el.value || "").trim();
    if (el.name === "consent") return el.checked ? "" : T.consent;
    // optional or preset fields: never "required", but reported the same way when wrong
    if (el.name === "message") return el.value.length > 1000 ? T.tooLong : "";
    if (el.name === "package") {
      for (var i = 0; i < el.options.length; i++) if (el.options[i].value === el.value) return "";
      return T.pkg;
    }
    if (!v) return T.required;
    if (el.name === "website" && !isSite(v)) return T.website;
    if (el.name === "contact" && !(isEmail(v) || isTelegram(v) || isPhone(v))) return T.contact;
    return "";
  }

  function showFieldError(el, message) {
    var box = document.getElementById(el.id + "-err");
    if (box) {
      box.textContent = message;
      box.hidden = !message;
    }
    if (message) el.setAttribute("aria-invalid", "true");
    else el.removeAttribute("aria-invalid");
  }

  function clearBox(box) {
    while (box && box.firstChild) box.removeChild(box.firstChild);
  }

  function showSendError(box) {
    clearBox(box);
    var tgLink = document.createElement("a");
    tgLink.href = "https://t.me/" + encodeURIComponent(tg);
    tgLink.target = "_blank";
    tgLink.rel = "noopener";
    tgLink.textContent = "Telegram";
    var mailLink = document.createElement("a");
    mailLink.href = "mailto:" + email;
    mailLink.textContent = "email";
    box.appendChild(document.createTextNode(T.errPre));
    box.appendChild(tgLink);
    box.appendChild(document.createTextNode(T.errMid));
    box.appendChild(mailLink);
  }

  function leadSource() {
    var parts = [];
    for (var i = 0; i < CAMPAIGN_KEYS.length - 1; i++) {
      var v = campaign(CAMPAIGN_KEYS[i]);
      if (v) parts.push(CAMPAIGN_KEYS[i] + "=" + v);
    }
    return parts.length ? parts.join("&") : "direct";
  }

  function initForm() {
    // in page order, so the first invalid one gets the focus
    var fields = [
      form.elements.name, form.elements.website, form.elements.contact,
      form.elements.message, form.elements.package, form.elements.consent
    ];
    var submitBtn = form.querySelector("[type=submit]");
    var errorBox = document.getElementById("audit-error");
    var successBox = document.getElementById("audit-success");
    var startSent = false;
    var sending = false;
    var submitLabel = submitBtn ? submitBtn.textContent : "";

    function formStart() {
      if (startSent || suppressStart) return;
      startSent = true;
      track("audit_form_start", { form_package: packageSelect.value });
    }
    form.addEventListener("focusin", formStart);
    form.addEventListener("input", formStart);

    fields.forEach(function (el) {
      var clear = function () { showFieldError(el, ""); };
      el.addEventListener("input", clear);
      el.addEventListener("change", clear);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) return;
      clearBox(errorBox);

      var firstBad = null;
      fields.forEach(function (el) {
        var msg = fieldError(el);
        showFieldError(el, msg);
        if (msg && !firstBad) firstBad = el;
      });
      if (firstBad) { firstBad.focus(); return; }

      var bot = form.elements.botcheck;
      if (bot && bot.checked) return; // honeypot: a person cannot tick a hidden box

      var key = String(cfg.WEB3FORMS_KEY || "");
      var pkg = packageSelect.value;
      var leadId = newLeadId();
      var payload = {
        access_key: key,
        subject: "Fitsak: заявка на аудит (" + pkg + ")",
        from_name: "fitsak.com",
        name: form.elements.name.value.trim(),
        website: form.elements.website.value.trim(),
        contact: form.elements.contact.value.trim(),
        message: form.elements.message.value.trim(),
        package: pkg,
        page_language: LANG,
        lead_id: leadId,
        source: leadSource(),
        gclid: campaign("gclid")
      };

      sending = true;
      submitBtn.disabled = true;
      submitBtn.textContent = T.sending;

      var ctrl = typeof AbortController === "function" ? new AbortController() : null;
      var timer = window.setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);

      var finish = function () {
        window.clearTimeout(timer);
        sending = false;
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      };

      if (!/^[0-9a-f-]{30,40}$/i.test(key)) { finish(); showSendError(errorBox); return; }

      window.fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        return res.json().then(function (json) { return res.ok && json && json.success === true; },
          function () { return false; });
      }).then(function (ok) {
        finish();
        if (!ok) { showSendError(errorBox); return; }
        form.hidden = true;
        clearBox(successBox);
        var p = document.createElement("p");
        p.textContent = T.success.replace("{id}", leadId);
        successBox.appendChild(p);
        successBox.classList.add("is-shown");
        // no name, site, contact or message goes to analytics
        track("generate_lead", {
          form_package: pkg,
          lead_id: leadId,
          lead_source: campaign("utm_source") || "direct"
        });
      }, function () {
        finish();
        showSendError(errorBox);
      });
    });

    // ?package=X in an external link: applied once on load
    if (params) {
      var wanted = params.get("package");
      if (wanted && selectPackage(wanted)) {
        window.addEventListener("load", scrollToAudit, { once: true });
      }
    }
  }
  if (form && packageSelect) initForm();

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

    // a package button picks the package, scrolls to the form and focuses the first field
    if (d.package && form && packageSelect) {
      e.preventDefault();
      selectPackage(d.package);
      scrollToAudit();
      suppressStart = true; // only a real interaction counts as audit_form_start
      try { firstField.focus({ preventScroll: true }); } catch (err) { firstField.focus(); }
      suppressStart = false;
    }

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

    // the sticky button hides while the form or the contact block is on screen
    var ctaTargets = { audit: false, contact: false };
    ["audit", "contact"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      new IntersectionObserver(function (entries) {
        ctaTargets[id] = entries[0].isIntersecting;
        document.body.classList.toggle("is-contact-visible", ctaTargets.audit || ctaTargets.contact);
      }).observe(el);
    });
  }
})();
