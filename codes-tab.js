/* Codes tab upgrade: form + academic year, PDF cards (15 per page, each in a rectangle).
   Loaded after the admin page script, so it can use sb and show(). */
(function () {
  const pane = document.getElementById("pane-codes");
  if (!pane) return;
  const $ = (id) => document.getElementById(id);

  pane.innerHTML =
    '<h2>Checker cards</h2>' +
    '<p class="muted">Cards are shown only once, right after you create them. The PDF downloads by itself. Keep it safe, because the PINs cannot be shown again.</p>' +
    '<div class="row">' +
      '<div><label for="cForm">Form</label><select id="cForm">' +
        '<option value="1">Form 1</option><option value="2">Form 2</option><option value="3">Form 3</option></select></div>' +
      '<div><label for="cAcad">Academic year</label><input id="cAcad" type="text" value="2026/2027" maxlength="9" placeholder="2026/2027"></div>' +
    '</div>' +
    '<div class="row">' +
      '<div><label for="cCount">How many</label><input id="cCount" type="number" min="1" max="5000" value="15"></div>' +
      '<div><label for="cUses">Checks per card</label><input id="cUses" type="number" min="1" max="20" value="3"></div>' +
    '</div>' +
    '<label for="cBatch">Batch name</label><input id="cBatch" type="text" value="Batch 1" maxlength="100">' +
    '<div id="cMsg" class="msg" hidden></div>' +
    '<button class="btn" id="genBtn" type="button">Generate cards (PDF)</button>' +
    '<button class="btn btn-line" id="pdfAgain" type="button" hidden>Download the PDF again</button>';

  /* Use the academic year saved in the School tab, if it looks like 2026/2027 */
  try {
    sb.rpc("get_school_info").then(({ data }) => {
      if (data && /^\d{4}\/\d{4}$/.test(data.academic_year || "")) $("cAcad").value = data.academic_year;
    });
  } catch (e) { /* keep the default */ }

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
  function makePdf(cards, form, acad, uses) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 63, H = 55, COLS = 3, ROWS = 5, PER = COLS * ROWS;
    const X0 = (210 - COLS * W) / 2, Y0 = (297 - ROWS * H) / 2;
    const site = new URL("./", location.href).href.replace(/^https?:\/\//, "");

    cards.forEach((c, i) => {
      if (i > 0 && i % PER === 0) doc.addPage();
      const k = i % PER;
      const x = X0 + (k % COLS) * W, y = Y0 + Math.floor(k / COLS) * H, cx = x + W / 2;
      const mid = { align: "center" };

      doc.setDrawColor(40); doc.setLineWidth(0.3); doc.rect(x, y, W, H);

      doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
      doc.text("TOASE SNR HIGH SCHOOL", cx, y + 6, mid);
      doc.setFont("helvetica", "normal"); doc.setFontSize(6);
      doc.text("RESULTS CHECKER CARD", cx, y + 9.5, mid);
      doc.setLineWidth(0.15); doc.line(x + 4, y + 11.5, x + W - 4, y + 11.5);

      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text("Form " + form + "  |  " + acad, cx, y + 16, mid);

      doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); doc.setTextColor(90);
      doc.text("SERIAL NO.", cx, y + 21.5, mid);
      doc.setTextColor(20); doc.setFont("courier", "bold"); doc.setFontSize(10);
      doc.text(c.serial, cx, y + 26, mid);

      doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); doc.setTextColor(90);
      doc.text("PIN", cx, y + 31.5, mid);
      doc.setTextColor(20); doc.setFont("courier", "bold"); doc.setFontSize(13);
      doc.text(c.code, cx, y + 37, mid);

      doc.setFont("helvetica", "normal"); doc.setFontSize(5.3);
      doc.text("Go to: " + site, cx, y + 42.5, mid);
      doc.text(doc.splitTextToSize("Choose your semester, then enter your index number, PIN and date of birth.", W - 8), cx, y + 45.3, mid);
      doc.setFont("helvetica", "bold");
      doc.text("Valid for " + uses + " checks. One semester, one student.", cx, y + 51.5, mid);
    });
    return doc;
  }

  let last = null; // kept in memory only, so the PDF can be downloaded again before leaving the page

  function save(info) {
    makePdf(info.cards, info.form, info.acad, info.uses).save(info.name);
  }

  $("genBtn").addEventListener("click", async () => {
    const form = $("cForm").value, acad = $("cAcad").value.trim();
    const count = parseInt($("cCount").value, 10), uses = parseInt($("cUses").value, 10);
    const batch = $("cBatch").value.trim() || null;
    if (!/^\d{4}\/\d{4}$/.test(acad)) { show($("cMsg"), "err", "Academic year must look like 2026/2027."); return; }
    if (!(count >= 1 && count <= 5000) || !(uses >= 1 && uses <= 20)) {
      show($("cMsg"), "err", "Check the numbers: 1 to 5000 cards, and 1 to 20 checks per card."); return;
    }
    const btn = $("genBtn"); btn.disabled = true; $("pdfAgain").hidden = true; last = null;
    try {
      await loadJsPdf(); // load the PDF tool first, so no cards are made if it fails
      const { data, error } = await sb.rpc("admin_generate_codes", {
        p_count: count, p_form: form, p_academic_year: acad, p_batch: batch, p_max_checks: uses,
      });
      if (error) throw new Error(error.message);
      const cards = data.map((r) => ({ serial: r.serial_number, code: r.code }));
      const name = "checker-cards-form" + form + "-" + acad.replace("/", "-") + "-" +
        (batch || "batch").replace(/[^A-Za-z0-9_-]+/g, "_") + ".pdf";
      last = { cards, form, acad, uses, name };
      $("pdfAgain").hidden = false;
      save(last);
      show($("cMsg"), "ok", cards.length + " cards created on " + Math.ceil(cards.length / 15) +
        " page(s). The PDF is downloading. Keep it safe: the PINs cannot be shown again.");
    } catch (e) {
      show($("cMsg"), "err", e.message || "Something went wrong.");
    } finally {
      btn.disabled = false;
    }
  });

  $("pdfAgain").addEventListener("click", () => { if (last) save(last); });
})();
