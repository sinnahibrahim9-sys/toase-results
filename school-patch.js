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

  /* colour letter grades too (A, B, C...). The page only coloured grades with a number (A1, B2...) */
  ready(function () {
    var tb = el("rRows"); if (!tb) return;
    var COL = { A1: "g-good", B2: "g-good", B3: "g-good", C4: "g-fair", C5: "g-fair", C6: "g-fair",
                D7: "g-weak", E8: "g-weak", F9: "g-fail" };
    function paint() {
      tb.querySelectorAll("td.grade").forEach(function (td) {
        var g = td.textContent.trim().toUpperCase(), c = COL[g];
        if (!c) return;
        td.classList.remove("g-good", "g-fair", "g-weak", "g-fail");
        td.classList.add(c);
      });
    }
    new MutationObserver(paint).observe(tb, { childList: true });
    paint();
  });

  /* a Remark column (Excellent, Very Good...) next to each grade */
  ready(function () {
    var tb = el("rRows"); if (!tb) return;
    var REMARK = { A1: "Excellent", B2: "Very Good", B3: "Good", C4: "Credit", C5: "Credit", C6: "Credit", D7: "Pass", E8: "Pass", F9: "Fail" };
    var table = tb.closest("table");
    function fill() {
      var hr = table && table.querySelector("thead tr");
      if (hr && !hr.querySelector(".rk")) { var th = document.createElement("th"); th.className = "rk"; th.textContent = "Remark"; hr.appendChild(th); }
      tb.querySelectorAll("tr").forEach(function (r) {
        if (r.querySelector(".rk")) return;
        var g = r.querySelector("td.grade"), td = document.createElement("td");
        td.className = "rk"; td.style.fontSize = ".85rem"; td.style.color = "var(--muted)";
        td.textContent = (g && REMARK[g.textContent.trim().toUpperCase()]) || "";
        r.appendChild(td);
      });
    }
    new MutationObserver(fill).observe(tb, { childList: true });
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
