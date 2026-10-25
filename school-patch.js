/* Makes the student page work per school.
   Load it in the <head> of index.html, BEFORE the page's own script.
   - reads ?school=nyinahin from the link (no link name = toase)
   - asks the database for that school's details
   - sends the school name along with every result check
   - shows "School not found" for a wrong link name */
(function () {
  var slug = (new URLSearchParams(location.search).get("school") || "toase")
    .toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) || "toase";
  window.SCHOOL_SLUG = slug;

  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    try {
      var u = String(url);
      if (u.indexOf("/rpc/get_school_info") > -1) {
        opts = Object.assign({}, opts, { body: JSON.stringify({ p_school: slug }) });
        return realFetch(url, opts).then(function (res) {
          res.clone().json().then(onSchool).catch(function () {});
          return res;
        });
      }
      if (u.indexOf("/functions/v1/send-help") > -1 && opts && typeof opts.body === "string") {
        var hb = JSON.parse(opts.body); hb.school = slug;
        opts = Object.assign({}, opts, { body: JSON.stringify(hb) });
      }
      if (u.indexOf("/functions/v1/swift-handler") > -1 && opts && typeof opts.body === "string") {
        var b = JSON.parse(opts.body); b.school = slug;
        var fp = document.getElementById("formPick"); if (fp && fp.value) b.form = fp.value;
        opts = Object.assign({}, opts, { body: JSON.stringify(b) });
      }
    } catch (e) { /* fall back to the normal request */ }
    return realFetch(url, opts);
  };

  function ready(fn) {
    if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn);
  }
  function el(id) { return document.getElementById(id); }
  function setLogos(src) {
    document.querySelectorAll("header.school img, .slip-head img").forEach(function (i) {
      if (src) { i.src = src; i.hidden = false; } else { i.hidden = true; }
    });
  }
  function notFound() {
    if (el("formView")) el("formView").hidden = true;
    if (el("trustNote")) el("trustNote").hidden = true;
    el("schoolName").textContent = "School not found";
    el("schoolSub").textContent = "Please check the link you were given";
    setLogos("");
  }
  /* school colour: the whole page takes the school's colour (background, cards, buttons) */
  var BRAND_KEYS = ["--brand","--brand-dark","--focus","--paper","--card","--line","--on-brand","--muted"];
  function applyBrand(c) {
    var r = document.documentElement.style;
    BRAND_KEYS.forEach(function (k) { r.removeProperty(k); });
    if (!/^#[0-9a-fA-F]{6}$/.test(c || "")) return;
    var dark = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
    var mix = function (a, pa, b) { return "color-mix(in srgb, " + a + " " + pa + "%, " + b + ")"; };
    var v = dark ? {
      "--paper": mix(c, 38, "#000000"), "--card": mix(c, 50, "#000000"), "--line": mix(c, 72, "#000000"),
      "--brand": mix(c, 45, "#ffffff"), "--brand-dark": mix(c, 30, "#ffffff"), "--focus": mix(c, 45, "#ffffff"),
      "--on-brand": "#04120a", "--muted": mix("#ffffff", 74, c)
    } : {
      "--paper": mix(c, 18, "#ffffff"), "--card": mix(c, 6, "#ffffff"), "--line": mix(c, 30, "#ffffff"),
      "--brand": c, "--brand-dark": mix(c, 72, "#000000"), "--focus": c
    };
    Object.keys(v).forEach(function (k) { r.setProperty(k, v[k]); });
    if (!document.getElementById("brandPrint")) {
      var st = document.createElement("style"); st.id = "brandPrint";
      st.textContent = "@media print{:root{--paper:#fff!important;--card:#fff!important;--ink:#000!important;--muted:#333!important;--line:#999!important;--brand:#000!important;--brand-dark:#000!important;}}";
      document.head.appendChild(st);
    }
  }
  function onSchool(d) {
    ready(function () {
      if (!d) { notFound(); return; }
      applyBrand(d.brand_color);
      if (d.logo_url) setLogos(d.logo_url); else if (slug !== "toase") setLogos("");
    });
  }

  /* a Form box (Form 1, 2 or 3) under the semester box */
  ready(function () {
    var sem = el("semester"); if (!sem || el("formPick")) return;
    var hint = sem.nextElementSibling; // the grey hint under the semester box
    var wrap = document.createElement("div");
    wrap.innerHTML = '<label for="formPick">Form</label>' +
      '<select id="formPick"><option value="">Choose form</option>' +
      '<option value="1">Form 1</option><option value="2">Form 2</option><option value="3">Form 3</option></select>' +
      '<p class="hint">Choose the form whose results you want to see.</p>';
    var anchor = hint && hint.classList.contains("hint") ? hint : sem;
    anchor.insertAdjacentElement("afterend", wrap);
  });

  /* other schools should not flash the Toase name while loading */
  ready(function () {
    if (slug === "toase") return;
    ["schoolName", "slipSchool", "stampName"].forEach(function (id) {
      var e = el(id); if (e && e.textContent.trim() === "Toase Snr High School") e.textContent = "";
    });
    document.title = "Check your results";
    setLogos("");
  });
})();
