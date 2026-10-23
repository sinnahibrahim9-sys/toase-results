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
  function onSchool(d) {
    ready(function () {
      if (!d) { notFound(); return; }
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
