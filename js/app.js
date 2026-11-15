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

  // personal data in the address bar (a form that was submitted with GET): drop the query before anything,
  // GA page_location included, can read it. Everything we need from it was read into params above.
  if (params) {
    var PII_KEYS = ["name", "contact", "website", "message", "business"];
    for (var pk = 0; pk < PII_KEYS.length; pk++) {
      if (params.has(PII_KEYS[pk])) {
        try { window.history.replaceState(null, "", window.location.pathname + window.location.hash); } catch (e) { /* ignore */ }
        break;
      }
    }
  }

  function campaign(key) { return session("get", "fs_" + key) || ""; }

  /* ---------- analytics ---------- */
  var saved = store("get", CONSENT_KEY); // "granted", "denied" or null while the visitor has not chosen

  // events are always sent: while consent is denied Google strips identifiers itself (cookieless pings)
  function track(name, params) {
    try {
      if (typeof gtag !== "function") return;
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

  // ad_personalization is never granted
  function consentUpdate(state) {
    gtag("consent", "update", {
      analytics_storage: state,
      ad_storage: state,
      ad_user_data: state
    });
  }

  // Consent Mode v2, advanced: gtag.js loads on every page. Everything is denied by default;
  // a stored choice is applied before config, so the first page_view already carries the right state.
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
    if (saved === "granted") consentUpdate("granted");
    gtag("js", new Date());
    var conf = { page_language: LANG };
    if (store("get", INTERNAL_KEY) === "1") conf.traffic_type = "internal";
    if (session("get", DEBUG_KEY) === "1") conf.debug_mode = true;
    gtag("config", gaId, conf);
    loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gaId));
  }

  // Microsoft Clarity. CLARITY_PRECONSENT true: the tag loads at once and stays cookieless until Accept;
  // false: the tag is not loaded at all before Accept.
  var clarityPre = cfg.CLARITY_PRECONSENT === true;
  var clarityLoaded = false;
  function clarityConsent(granted) {
    var v = granted ? "granted" : "denied";
    window.clarity("consentv2", { ad_Storage: v, analytics_Storage: v });
  }
  function setClarity(granted) {
    try {
      if (!clarityOk) return;
      if (!clarityLoaded) {
        if (!granted && !clarityPre) return;
        window.clarity = window.clarity || function () {
          (window.clarity.q = window.clarity.q || []).push(arguments);
        };
        clarityConsent(granted); // queued, so the tag reads the consent state before it does anything
        loadScript("https://www.clarity.ms/tag/" + encodeURIComponent(clarityId));
        clarityLoaded = true;
        return;
      }
      clarityConsent(granted);
    } catch (e) { /* ignore */ }
  }

  if (gaOn) initGa();
  setClarity(saved === "granted");

  /* ---------- consent banner ---------- */
  var banner = document.getElementById("consent");

  // the page gets bottom padding equal to the banner, so the end of a form is never hidden under it
  function syncBannerSpace() {
    var h = banner && !banner.hidden ? banner.offsetHeight : 0;
    root.style.setProperty("--consent-h", h + "px");
  }

  function showBanner(show) {
    if (!banner) return;
    banner.hidden = !show;
    document.body.classList.toggle("has-consent", show);
    syncBannerSpace();
  }
  window.addEventListener("resize", syncBannerSpace);

  // Google does not delete its cookies when consent is withdrawn, so Reject removes them here
  function dropCookies() {
    try {
      var host = window.location.hostname.split(".");
      var domains = [""];
      for (var i = 0; i < host.length - 1; i++) domains.push("." + host.slice(i).join("."));
      domains.push(window.location.hostname);
      document.cookie.split(";").forEach(function (pair) {
        var name = pair.split("=")[0].trim();
        if (!/^(_ga|_ga_.+|_gid|_gat.*|_gcl_.+|_clck|_clsk)$/.test(name)) return;
        domains.forEach(function (d) {
          document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + (d ? "; domain=" + d : "");
        });
      });
    } catch (e) { /* ignore */ }
  }

  function applyConsent(state) {
    saved = state;
    try {
      if (gaOn) consentUpdate(state === "granted" ? "granted" : "denied");
    } catch (e) { /* ignore */ }
    setClarity(state === "granted");
    if (state !== "granted") dropCookies();
  }

  showBanner(saved !== "granted" && saved !== "denied");

  /* ---------- contacts from config ---------- */
  function each(sel, fn) {
    var list = document.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }
  var email = String(cfg.CONTACT_EMAIL || "");
  var tg = String(cfg.CONTACT_TELEGRAM || "").replace(/^@/, "");
  each("[data-email-text]", function (el) { el.textContent = email; });
  each("[data-telegram-link]", function (el) { el.href = "https://t.me/" + encodeURIComponent(tg); });
  if (isSet(cfg.FIVERR_URL, "")) each("[data-fiverr-link]", function (el) { el.href = cfg.FIVERR_URL; });

  /* ---------- lead forms: audit (main pages), consultation dialog and short contact form (/sites/) ---------- */
  var MSG = {
    en: {
      sending: "Sending…",
      required: "Please fill in this field",
      website: "Enter your site address, for example example.com",
      contact: "Leave a phone number, a Telegram @username or an email so I can reply",
      tooLong: "Please keep it under {n} characters",
      success: {
        audit: "Thank you! Request no. {id} received. I’ll reply within 24 hours.",
        consult: "Thank you! Request no. {id} received. I’ll write within 24 hours.",
        contact_inline: "Thank you! Request no. {id} received. I’ll write within 24 hours.",
        mockup: "Thank you! The mockup comes within 48 hours after I check the brief. If I have questions, I’ll write on Telegram."
      },
      successNoId: {
        audit: "Thank you! Request received. I’ll reply within 24 hours.",
        consult: "Thank you! Request received. I’ll write within 24 hours.",
        contact_inline: "Thank you! Request received. I’ll write within 24 hours.",
        mockup: "Thank you! The mockup comes within 48 hours after I check the brief. If I have questions, I’ll write on Telegram."
      },
      errPre: "Couldn’t send. Try again or write on ",
      errMid: " / by "
    },
    ua: {
      sending: "Надсилаю…",
      required: "Заповніть це поле",
      website: "Вкажіть адресу сайту, наприклад example.com",
      contact: "Залиште телефон, @нік у Telegram або email — так я зможу відповісти",
      tooLong: "Не більше {n} символів",
      success: {
        audit: "Дякую! Заявка № {id} отримана. Відповім протягом 24 годин.",
        consult: "Дякую! Заявка № {id} отримана. Напишу протягом 24 годин.",
        contact_inline: "Дякую! Заявка № {id} отримана. Напишу протягом 24 годин.",
        mockup: "Дякую! Макет — протягом 48 годин після перевірки брифу. Якщо будуть питання, напишу в Telegram."
      },
      successNoId: {
        audit: "Дякую! Заявка отримана. Відповім протягом 24 годин.",
        consult: "Дякую! Заявка отримана. Напишу протягом 24 годин.",
        contact_inline: "Дякую! Заявка отримана. Напишу протягом 24 годин.",
        mockup: "Дякую! Макет — протягом 48 годин після перевірки брифу. Якщо будуть питання, напишу в Telegram."
      },
      errPre: "Не вдалося надіслати. Спробуйте ще раз або напишіть у ",
      errMid: " / на "
    }
  };
  var T = MSG[LANG];

  var leadForms = []; // { form, section, pkg }
  var suppressStart = false;

  function scrollToSection(section) {
    var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  }

  // the package lives in <input type="hidden" name="package">; unknown values leave the default alone
  var PACKAGES = ["audit", "deep_audit", "analytics", "repair", "landing", "ads", "site", "support", "consult", "mockup"];
  function selectPackage(entry, value) {
    if (!entry || !entry.pkg || PACKAGES.indexOf(value) < 0) return false;
    entry.pkg.value = value;
    return true;
  }

  // data-form-type → form_type in analytics and in the lead email; anything unknown counts as "audit"
  var FORM_TYPES = ["audit", "consult", "contact_inline", "mockup"];
  function formType(form) {
    var t = form.getAttribute("data-form-type");
    return FORM_TYPES.indexOf(t) >= 0 ? t : "audit";
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

  // Which rule accepts a contact value: "email", "telegram", "phone", "min5" (anything of 5+ characters:
  // an odd lead is better than a lost one) or "" when it is empty or shorter than 5 characters.
  function contactRule(value) {
    var v = String(value == null ? "" : value).trim();
    if (v.length < 5) return "";
    if (/[^\s@]@[^\s@]+\.[^\s@]/.test(v)) return "email"; // an @ with a dot after it
    if (/^@[A-Za-z0-9_]{5,32}$/.test(v) || /^(https?:\/\/)?(www\.)?t\.me\/[A-Za-z0-9_]{5,32}\/?$/i.test(v)) return "telegram";
    // phone: 9-15 digits once spaces, brackets, hyphens, dots, "+" and messenger words are dropped
    var rest = v.replace(/viber|вайбер|telegram|телеграм|тел\.?|tel\.?/gi, "").replace(/[\s()\-.+]/g, "");
    if (/^\d{9,15}$/.test(rest)) return "phone";
    if (/^[A-Za-z0-9_]{5,32}$/.test(v)) return "telegram"; // a username without @
    return "min5";
  }
  function isSite(v) { return /^(https?:\/\/)?[^\s.\/]+\.[^\s]{2,}$/i.test(v); }

  // returns null when the field is fine, else { msg, type }; type goes to analytics (form_error), the value never does
  function fieldError(el) {
    var max = parseInt(el.getAttribute("maxlength"), 10);
    if (max && el.value.length > max) return { msg: T.tooLong.replace("{n}", String(max)), type: "too_long" };
    var v = String(el.value || "").trim();
    if (el.name === "contact") {
      if (contactRule(v)) return null;
      return { msg: T.contact, type: v ? "too_short" : "required" };
    }
    if (!v) return el.required ? { msg: T.required, type: "required" } : null; // optional fields may stay empty
    if (el.name === "website" && !isSite(v)) return { msg: T.website, type: "format" };
    return null;
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

  function initForm(entry) {
    var form = entry.form;
    var pkgInput = entry.pkg;
    var defaultPkg = pkgInput.getAttribute("value") || pkgInput.value;
    var type = formType(form);
    // optional radio groups (the mockup brief): never validated; the chosen value, or "" when nothing is picked
    var radioNames = [];
    Array.prototype.forEach.call(form.elements, function (el) {
      if (el.type === "radio" && el.name && radioNames.indexOf(el.name) < 0) radioNames.push(el.name);
    });
    function radioValue(name) {
      var picked = form.querySelector('input[type=radio][name="' + name + '"]:checked');
      return picked ? picked.value : "";
    }
    // controls in page order (radios and the honeypot are not validated)
    var fields = Array.prototype.filter.call(form.elements, function (el) {
      return el.name && el.name !== "botcheck" && el.type !== "radio" && el.type !== "submit" && el.type !== "hidden" &&
        el.tagName !== "BUTTON" && el.tagName !== "FIELDSET";
    });
    var submitBtn = form.querySelector("[type=submit]");
    var errorBox = form.querySelector(".form-error");
    var successBox = entry.section.querySelector(".form-success");
    var successText = successBox ? successBox.querySelector(".form-success__text") : null;
    var startSent = false;
    var sending = false;
    var submitLabel = submitBtn ? submitBtn.textContent : "";

    function formStart() {
      if (startSent || suppressStart) return;
      startSent = true;
      if (type === "mockup") track("mockup_form_start", { form_type: type });
      else track("audit_form_start", { form_package: pkgInput.value, form_type: type });
    }
    form.addEventListener("focusin", formStart);
    form.addEventListener("input", formStart);

    var detailsSent = false;
    Array.prototype.forEach.call(form.querySelectorAll("details.form-more"), function (d) {
      d.addEventListener("toggle", function () {
        if (!d.open || detailsSent) return;
        detailsSent = true;
        track("form_details_open", { form_type: type });
      });
    });

    fields.forEach(function (el) {
      var clear = function () { showFieldError(el, ""); };
      el.addEventListener("input", clear);
      el.addEventListener("change", clear);
    });

    // back to a clean, visible form (used when the dialog is opened again after a sent request)
    entry.sent = false;
    entry.reset = function () {
      entry.sent = false;
      form.reset();
      pkgInput.value = defaultPkg;
      Array.prototype.forEach.call(form.querySelectorAll("details"), function (d) { d.open = false; });
      form.hidden = false;
      clearBox(errorBox);
      if (successBox) successBox.classList.remove("is-shown");
      if (successText) successText.textContent = "";
      fields.forEach(function (el) { showFieldError(el, ""); });
    };

    entry.showSuccess = function (msg) {
      form.hidden = true;
      entry.sent = true;
      if (successText) {
        successText.textContent = msg;
      } else {
        clearBox(successBox);
        var p = document.createElement("p");
        p.textContent = msg;
        successBox.appendChild(p);
      }
      successBox.classList.add("is-shown");
      if (successText) {
        // the form just disappeared: keep keyboard and screen reader users inside the dialog
        successBox.setAttribute("tabindex", "-1");
        successBox.focus({ preventScroll: true });
      }
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) return;
      track("form_submit_click", { form_type: type }); // every submit attempt, before validation
      clearBox(errorBox);

      var firstBad = null;
      fields.forEach(function (el) {
        var err = fieldError(el);
        showFieldError(el, err ? err.msg : "");
        if (!err) return;
        if (!firstBad) firstBad = el;
        track("form_error", { form_type: type, field: el.name, error_type: err.type }); // field name and kind only
      });
      if (firstBad) {
        var closed = firstBad.closest("details");
        if (closed && !closed.open) closed.open = true;
        firstBad.focus();
        return;
      }

      var bot = form.elements.botcheck;
      if (bot && bot.checked) return; // honeypot: a person cannot tick a hidden box

      var key = String(cfg.WEB3FORMS_KEY || "");
      var pkg = pkgInput.value;
      var leadId = newLeadId();
      var payload = {
        access_key: key,
        subject: "Fitsak: " + (form.getAttribute("data-subject") || "заявка") + " (" + pkg + ")",
        from_name: "fitsak.com",
        package: pkg,
        form_type: type,
        page_language: LANG,
        lead_id: leadId,
        source: leadSource(),
        gclid: campaign("gclid")
      };
      // the visible fields of this form, by their names, then the optional choices
      fields.forEach(function (el) { payload[el.name] = el.value.trim(); });
      radioNames.forEach(function (name) { payload[name] = radioValue(name); });

      sending = true;
      submitBtn.disabled = true;
      submitBtn.textContent = T.sending;

      var ctrl = typeof AbortController === "function" ? new AbortController() : null;
      var timedOut = false;
      var timer = window.setTimeout(function () { timedOut = true; if (ctrl) ctrl.abort(); }, 15000);
      var sendFailed = function (reason) {
        finish();
        showSendError(errorBox);
        track("form_submit_error", { form_type: type, reason: reason });
      };

      var finish = function () {
        window.clearTimeout(timer);
        sending = false;
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      };

      if (!/^[0-9a-f-]{30,40}$/i.test(key)) { finish(); showSendError(errorBox); return; } // not configured: nothing was sent

      window.fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        return res.json().then(function (json) { return res.ok && json && json.success === true; },
          function () { return false; });
      }).then(function (ok) {
        if (!ok) { sendFailed("http"); return; } // Web3Forms answered, but did not accept the request
        finish();
        entry.showSuccess(T.success[type].replace("{id}", leadId));
        // no name, site, contact, business or message goes to analytics: only fixed option values
        var lead = {
          form_package: pkg,
          form_type: type,
          lead_id: leadId,
          lead_source: campaign("utm_source") || "direct"
        };
        if (type === "mockup") {
          lead.lead_type = "mockup";
          lead.site_goal = payload.site_goal || "none";
          lead.launch = payload.launch || "none";
          lead.budget = payload.budget || "none";
        }
        track("generate_lead", lead);
      }, function () {
        sendFailed(timedOut ? "timeout" : "network");
      });
    });
  }

  each("form[data-form-type]", function (f) {
    var pkgInput = f.elements.package;
    var section = f.closest ? f.closest("section, dialog") : null;
    if (!pkgInput || !section) return;
    f.noValidate = true; // app.js shows its own messages; without app.js the browser validates natively
    var entry = { form: f, section: section, pkg: pkgInput };
    leadForms.push(entry);
    initForm(entry);
  });

  // ?package=X in an external link: applied once on load, to the first form that offers it
  if (params && leadForms.length) {
    var wanted = params.get("package");
    if (wanted) {
      for (var li = 0; li < leadForms.length; li++) {
        if (leadForms[li].section.tagName === "DIALOG") continue; // the dialog gets its package from the button that opens it
        if (formType(leadForms[li].form) === "contact_inline") continue; // the short contact form has no package choice
        if (selectPackage(leadForms[li], wanted)) {
          (function (sec) { window.addEventListener("load", function () { scrollToSection(sec); }, { once: true }); })(leadForms[li].section);
          break;
        }
      }
    }
  }

  /* ---------- consultation dialog ---------- */
  var dialog = document.getElementById("consult-dialog");
  var dialogEntry = null;
  for (var di = 0; di < leadForms.length; di++) if (leadForms[di].section === dialog) dialogEntry = leadForms[di];
  var dialogOpener = null;
  var downOnBackdrop = false;

  function openConsult(trigger) {
    if (!dialog || !dialogEntry || typeof dialog.showModal !== "function") return false; // no support: the link falls back to #contact-fallback
    if (dialog.open) return true;
    if (dialogEntry.sent && dialogEntry.reset) dialogEntry.reset();
    selectPackage(dialogEntry, trigger.getAttribute("data-package") || "consult");
    dialogOpener = trigger;
    document.body.classList.add("is-dialog-open");
    dialog.showModal();
    var first = dialogEntry.form.elements.name;
    suppressStart = true; // only a real interaction counts as audit_form_start
    try { first.focus({ preventScroll: true }); } catch (err) { first.focus(); }
    suppressStart = false;
    track("consult_open", { cta_location: trigger.getAttribute("data-cta") || "", form_package: dialogEntry.pkg.value });
    return true;
  }

  if (dialog) {
    // fires for Esc, the close buttons and a click on the backdrop; typed data stays in the form
    dialog.addEventListener("close", function () {
      document.body.classList.remove("is-dialog-open");
      var back = dialogOpener;
      dialogOpener = null;
      if (back && typeof back.focus === "function") { try { back.focus(); } catch (err) { /* ignore */ } }
    });
    // close on a click outside the box; a drag that starts inside and ends outside must not close it
    dialog.addEventListener("pointerdown", function (e) { downOnBackdrop = e.target === dialog; });
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog && downOnBackdrop) dialog.close();
      downOnBackdrop = false;
    });
  }

  /* ---------- return from the no-JS form post (Web3Forms redirects here with ?sent=1) ---------- */
  var sentParam = params ? params.get("sent") : null;
  var back = null;
  if (sentParam === "1") back = leadForms[0] || null; // main pages: the audit form
  else if (sentParam) {
    for (var bi = 0; bi < leadForms.length; bi++) {
      if (leadForms[bi].form.getAttribute("data-form-type") === sentParam) { back = leadForms[bi]; break; }
    }
  }
  if (back) {
    var backType = formType(back.form);
    if (back.section === dialog && dialog && typeof dialog.showModal === "function") {
      document.body.classList.add("is-dialog-open");
      dialog.showModal();
    } else {
      window.addEventListener("load", function () { scrollToSection(back.section); }, { once: true });
    }
    back.showSuccess(T.successNoId[backType]);
    try {
      var rest = new URLSearchParams(window.location.search);
      rest.delete("sent");
      var restText = rest.toString();
      window.history.replaceState(null, "", window.location.pathname + (restText ? "?" + restText : "") + window.location.hash);
    } catch (e) { /* ignore */ }
  }

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

    if (t.hasAttribute("data-dialog-close")) {
      var dlg = t.closest("dialog");
      if (dlg && dlg.close) dlg.close();
      return;
    }

    if (d.cta) track("cta_click", { cta_location: d.cta });
    if (d.service) track("service_click", { service_name: d.service });
    if (d.contact) track("contact_click", { channel: d.contact });
    if (d.messenger) track("messenger_click", { channel: d.messenger }); // the main button of the contact block
    if (d.langSwitch) track("language_switch", { to_language: d.langSwitch });

    // a package button picks the package in the form of this page, scrolls to it and focuses the first field
    if (t.hasAttribute("data-open-consult") && openConsult(t)) {
      e.preventDefault();
      return;
    }

    var href = t.getAttribute("href") || "";
    if (d.package && leadForms.length && href.charAt(0) === "#" && !t.hasAttribute("data-open-consult")) {
      var target = leadForms[0];
      for (var k = 0; k < leadForms.length; k++) {
        if (leadForms[k].section.id === href.slice(1)) target = leadForms[k];
      }
      e.preventDefault();
      selectPackage(target, d.package);
      scrollToSection(target.section);
      var first = target.form.elements.name;
      suppressStart = true; // only a real interaction counts as audit_form_start
      try { first.focus({ preventScroll: true }); } catch (err) { first.focus(); }
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
    var ctaTargets = { audit: false, contact: false, "contact-fallback": false, mockup: false };
    ["audit", "contact", "contact-fallback", "mockup"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      new IntersectionObserver(function (entries) {
        ctaTargets[id] = entries[0].isIntersecting;
        document.body.classList.toggle("is-contact-visible", ctaTargets.audit || ctaTargets.contact || ctaTargets["contact-fallback"] || ctaTargets.mockup);
      }).observe(el);
    });
  }
})();
