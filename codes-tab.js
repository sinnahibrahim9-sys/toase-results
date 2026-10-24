/* Codes tab: form + academic year, PDF cards (15 per page, each in a rectangle), per school.
   Loaded after the admin page script, so it can use sb, show() and window.currentSchool. */
(function () {
  const pane = document.getElementById("pane-codes");
  if (!pane) return;
  const $ = (id) => document.getElementById(id);
  const school = () => window.currentSchool || { id: 1, slug: "toase", name: "Toase Snr High School" };

  pane.innerHTML =
    '<h2>Checker cards</h2>' +
    '<p class="muted" id="cardSchool" style="font-weight:600"></p>' +
    '<p class="muted">Cards are shown only once, right after you create them. The PDF downloads by itself. Keep it safe, because the PINs cannot be shown again.</p>' +
    '<div class="row">' +
      '<div><label for="cCount">How many</label><input id="cCount" type="number" min="1" max="5000" value="15"></div>' +
      '<div><label for="cUses">Checks per card</label><input id="cUses" type="number" min="1" max="20" value="3"></div>' +
    '</div>' +
    '<label for="cBatch">Batch name</label><input id="cBatch" type="text" value="Batch 1" maxlength="100">' +
    '<div id="cMsg" class="msg" hidden></div>' +
    '<button class="btn" id="genBtn" type="button">Generate cards (PDF)</button>' +
    '<button class="btn btn-line" id="pdfAgain" type="button" hidden>Download the PDF again</button>';

  /* Show the chosen school */
  function refreshForSchool() {
    const sc = school();
    $("cardSchool").textContent = "Cards for: " + (sc.name || sc.slug);
  }
  refreshForSchool();
  const tabBtn = document.querySelector('[data-tab="codes"]');
  if (tabBtn) tabBtn.addEventListener("click", refreshForSchool);

  function loadJsPdf() {
    if (window.jspdf) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load the PDF tool. Check your internet and try again."));
      document.head.append(s);
    });
  }

  /* A4, 3 columns x 5 rows = 15 cards per page */
  function makePdf(info) {
    const { cards, uses, school: sc } = info;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 63, H = 55, COLS = 3, ROWS = 5, PER = COLS * ROWS;
    const X0 = (210 - COLS * W) / 2, Y0 = (297 - ROWS * H) / 2;
    const site = (new URL("./", location.href).href + "?school=" + sc.slug).replace(/^https?:\/\//, "");
    const title = String(sc.name || sc.slug).toUpperCase();

    cards.forEach((c, i) => {
      if (i > 0 && i % PER === 0) doc.addPage();
      const k = i % PER;
      const x = X0 + (k % COLS) * W, y = Y0 + Math.floor(k / COLS) * H, cx = x + W / 2;
      const mid = { align: "center" };

      doc.setDrawColor(40); doc.setLineWidth(0.3); doc.rect(x, y, W, H);

      /* school name: shrink the text until it fits on one line */
      doc.setTextColor(20); doc.setFont("helvetica", "bold");
      let size = 8.5; doc.setFontSize(size);
      while (size > 4.5 && doc.getTextWidth(title) > W - 6) { size -= 0.25; doc.setFontSize(size); }
      doc.text(title, cx, y + 6, mid);
      doc.setFont("helvetica", "normal"); doc.setFontSize(6);
      doc.text("RESULTS CHECKER CARD", cx, y + 9.5, mid);
      doc.setLineWidth(0.15); doc.line(x + 4, y + 11.5, x + W - 4, y + 11.5);

      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text("Any form  |  one semester", cx, y + 16, mid);

      doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); doc.setTextColor(90);
      doc.text("SERIAL NO.", cx, y + 21.5, mid);
      doc.setTextColor(20); doc.setFont("courier", "bold"); doc.setFontSize(10);
      doc.text(c.serial, cx, y + 26, mid);

      doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); doc.setTextColor(90);
      doc.text("PIN", cx, y + 31.5, mid);
      doc.setTextColor(20); doc.setFont("courier", "bold"); doc.setFontSize(13);
      doc.text(c.code, cx, y + 37, mid);

      /* web address (with the school link) and instructions */
      doc.setFont("helvetica", "normal"); doc.setFontSize(5.1);
      const goLines = doc.splitTextToSize("Go to: " + site, W - 6);
      doc.text(goLines, cx, y + 42.2, mid);
      const yy = y + 42.2 + goLines.length * 2.07 + 0.6;
      doc.text("Choose semester; enter index number, PIN, date of birth.", cx, yy, mid);
      doc.setFont("helvetica", "bold");
      doc.text("Valid for " + uses + " checks. One semester, one student.", cx, y + H - 2.8, mid);
    });
    return doc;
  }

  let last = null; // kept in memory only, so the PDF can be downloaded again before leaving the page

  function save(info) {
    makePdf(info).save(info.name);
  }

  $("genBtn").addEventListener("click", async () => {
    const sc = { id: school().id, slug: school().slug, name: school().name };
        const count = parseInt($("cCount").value, 10), uses = parseInt($("cUses").value, 10);
    const batch = $("cBatch").value.trim() || null;
    if (!(count >= 1 && count <= 5000) || !(uses >= 1 && uses <= 20)) {
      show($("cMsg"), "err", "Check the numbers: 1 to 5000 cards, and 1 to 20 checks per card."); return;
    }
    const btn = $("genBtn"); btn.disabled = true; $("pdfAgain").hidden = true; last = null;
    try {
      await loadJsPdf(); // load the PDF tool first, so no cards are made if it fails
      const { data, error } = await sb.rpc("admin_generate_codes", {
        p_count: count, p_batch: batch, p_max_checks: uses, p_school_id: sc.id,
      });
      if (error) throw new Error(error.message);
      const cards = data.map((r) => ({ serial: r.serial_number, code: r.code }));
      const name = "checker-cards-" + sc.slug + "-" +
        (batch || "batch").replace(/[^A-Za-z0-9_-]+/g, "_") + ".pdf";
      last = { cards, uses, name, school: sc };
      $("pdfAgain").hidden = false;
      save(last);
      show($("cMsg"), "ok", cards.length + " cards created for " + (sc.name || sc.slug) + " on " + Math.ceil(cards.length / 15) +
        " page(s). The PDF is downloading. Keep it safe: the PINs cannot be shown again.");
    } catch (e) {
      show($("cMsg"), "err", e.message || "Something went wrong.");
    } finally {
      btn.disabled = false;
    }
  });

  $("pdfAgain").addEventListener("click", () => { if (last) save(last); });
})();
