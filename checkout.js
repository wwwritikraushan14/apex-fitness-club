/* ============================================================
   APEX FITNESS CLUB — checkout.js (demo checkout, localStorage only)
   NO real payments. No real card details, CVV, PINs or OTPs
   are ever collected or sent anywhere.
   Depends on app.js (ApexStore + validation helpers).
   ============================================================ */
(function () {
  "use strict";

  var PLANS = {
    basic: { key: "basic", name: "BASIC", price: 999 },
    pro: { key: "pro", name: "PRO", price: 1999 },
    elite: { key: "elite", name: "ELITE", price: 2999 }
  };
  var METHOD_LABELS = {
    upi: "UPI",
    card: "Debit / Credit Card",
    netbanking: "Net Banking",
    demo: "Demo Payment"
  };

  var form = document.getElementById("checkoutForm");
  if (!form) return; // not on the checkout page

  /* ---------- Element refs ---------- */
  var planPills = Array.prototype.slice.call(document.querySelectorAll("#planPills .plan-pill"));
  var durPills = Array.prototype.slice.call(document.querySelectorAll("#durPills .dur-pill"));
  var payBtns = Array.prototype.slice.call(document.querySelectorAll("#payMethods .pay-method"));
  var nameInput = document.getElementById("coName");
  var emailInput = document.getElementById("coEmail");
  var phoneInput = document.getElementById("coPhone");
  var ageInput = document.getElementById("coAge");
  var goalSelect = document.getElementById("coGoal");
  var upiInput = document.getElementById("upiId");
  var cardNumInput = document.getElementById("cardNum");
  var cardExpInput = document.getElementById("cardExp");
  var cardNameInput = document.getElementById("cardName");
  var bankSelect = document.getElementById("bankSelect");
  var formError = document.getElementById("coFormError");
  var phoneError = document.getElementById("coPhoneError");
  var payBtn = document.getElementById("payBtn");
  var simulateFailLink = document.getElementById("simulateFail");
  var checkoutMain = document.getElementById("checkoutMain");
  var successBox = document.getElementById("successBox");
  var failBox = document.getElementById("failBox");
  var retryBtn = document.getElementById("retryBtn");
  var downloadBtn = document.getElementById("downloadReceiptBtn");

  /* ---------- State ---------- */
  var selectedPlan = "pro";
  var selectedMonths = 1;
  var selectedMethod = "upi";
  var simulateFail = false;
  var lastOrder = null; // kept for the receipt download

  /* ---------- Preselect plan from URL (?plan=basic|pro|elite) ---------- */
  try {
    var param = new URLSearchParams(window.location.search).get("plan");
    if (param && PLANS[param]) selectedPlan = param;
  } catch (e) { /* URLSearchParams unavailable — keep default */ }

  /* ---------- Selection helpers ---------- */
  function selectPlan(key) {
    selectedPlan = key;
    planPills.forEach(function (p) {
      var active = p.getAttribute("data-plan") === key;
      p.classList.toggle("selected", active);
      p.setAttribute("aria-checked", active ? "true" : "false");
    });
    updateSummary();
  }
  function selectMonths(months) {
    selectedMonths = months;
    durPills.forEach(function (p) {
      var active = parseInt(p.getAttribute("data-months"), 10) === months;
      p.classList.toggle("selected", active);
      p.setAttribute("aria-checked", active ? "true" : "false");
    });
    updateSummary();
  }
  function selectMethod(method) {
    selectedMethod = method;
    payBtns.forEach(function (b) {
      var active = b.getAttribute("data-method") === method;
      b.classList.toggle("selected", active);
      b.setAttribute("aria-checked", active ? "true" : "false");
    });
    ["upi", "card", "netbanking", "demo"].forEach(function (m) {
      var panel = document.getElementById("panel-" + m);
      if (panel) panel.hidden = (m !== method);
    });
    updateSummary();
  }
  function total() {
    return PLANS[selectedPlan].price * selectedMonths;
  }
  function updateSummary() {
    var plan = PLANS[selectedPlan];
    document.getElementById("sumPlan").textContent = plan.name;
    document.getElementById("sumMonthly").textContent = apexFormatINR(plan.price);
    document.getElementById("sumDuration").textContent =
      selectedMonths + (selectedMonths === 1 ? " month" : " months");
    document.getElementById("sumMethod").textContent = METHOD_LABELS[selectedMethod];
    document.getElementById("sumTotal").textContent = apexFormatINR(total());
    payBtn.innerHTML = "Pay " + apexFormatINR(total()) + " Now";
  }

  planPills.forEach(function (p) {
    p.addEventListener("click", function () { selectPlan(p.getAttribute("data-plan")); });
  });
  durPills.forEach(function (p) {
    p.addEventListener("click", function () { selectMonths(parseInt(p.getAttribute("data-months"), 10)); });
  });
  payBtns.forEach(function (b) {
    b.addEventListener("click", function () { selectMethod(b.getAttribute("data-method")); });
  });

  /* ---------- Input niceties (formatting only — demo fields) ---------- */
  cardNumInput.addEventListener("input", function () {
    var digits = cardNumInput.value.replace(/\D/g, "").slice(0, 16);
    cardNumInput.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  });
  cardExpInput.addEventListener("input", function () {
    var digits = cardExpInput.value.replace(/\D/g, "").slice(0, 4);
    cardExpInput.value = digits.length > 2 ? digits.slice(0, 2) + "/" + digits.slice(2) : digits;
  });
  phoneInput.addEventListener("input", function () {
    phoneInput.classList.remove("invalid");
    phoneError.hidden = true;
  });

  /* ---------- Validation ---------- */
  function showError(msg, focusEl) {
    formError.textContent = msg;
    formError.hidden = false;
    if (focusEl) focusEl.focus();
  }
  function validate() {
    formError.hidden = true;
    var name = nameInput.value.trim();
    var email = emailInput.value.trim();
    var age = parseInt(ageInput.value, 10);
    if (!name) { showError("Please enter your full name.", nameInput); return false; }
    if (!apexIsValidEmail(email)) { showError("Please enter a valid email address.", emailInput); return false; }
    if (!apexIsValidPhone(phoneInput.value)) {
      phoneInput.classList.add("invalid");
      phoneError.hidden = false;
      phoneInput.focus();
      return false;
    }
    if (isNaN(age) || age < 14 || age > 80) {
      showError("Please enter an age between 14 and 80.", ageInput);
      return false;
    }
    if (selectedMethod === "upi") {
      var upi = upiInput.value.trim();
      if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi)) {
        showError("Enter a demo UPI ID like demo@upi. Never enter your real UPI ID.", upiInput);
        return false;
      }
    }
    if (selectedMethod === "card") {
      var digits = cardNumInput.value.replace(/\D/g, "");
      if (digits.length !== 16) {
        showError("Enter the 16-digit demo card number (4242 4242 4242 4242).", cardNumInput);
        return false;
      }
      var exp = cardExpInput.value.trim();
      var m = exp.match(/^(\d{2})\/(\d{2})$/);
      if (!m || +m[1] < 1 || +m[1] > 12) {
        showError("Enter the card expiry as MM/YY (for example 12/28).", cardExpInput);
        return false;
      }
      var now = new Date();
      var expYear = 2000 + parseInt(m[2], 10);
      var expMonth = parseInt(m[1], 10);
      if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
        showError("That demo card looks expired — use a future expiry like 12/28.", cardExpInput);
        return false;
      }
      if (!cardNameInput.value.trim()) {
        showError("Enter the name on the card.", cardNameInput);
        return false;
      }
    }
    if (selectedMethod === "netbanking" && !bankSelect.value) {
      showError("Please choose a bank to continue (demo only).", bankSelect);
      return false;
    }
    return true;
  }

  /* ---------- Idempotency + duplicate-submit guard ---------- */
  function getIdemKey() {
    var key = null;
    try { key = sessionStorage.getItem("apex_idem_key"); } catch (e) { /* ignore */ }
    if (!key) {
      key = "idem-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e6);
      try { sessionStorage.setItem("apex_idem_key", key); } catch (e) { /* ignore */ }
    }
    return key;
  }

  /* ---------- Success / failure ---------- */
  function makeTxnId() {
    return "APX-" + Date.now().toString(36).toUpperCase() + "-" +
      String(Math.floor(1000 + Math.random() * 9000));
  }

  function showSuccess(order) {
    document.getElementById("rcTxn").textContent = order.txnId;
    document.getElementById("rcMember").textContent = order.membershipId;
    document.getElementById("rcName").textContent = order.name;
    document.getElementById("rcPlan").textContent = order.planName + " — " + apexFormatINR(order.monthly) + "/month";
    document.getElementById("rcDuration").textContent =
      order.durationMonths + (order.durationMonths === 1 ? " month" : " months");
    document.getElementById("rcAmount").textContent = apexFormatINR(order.amount);
    document.getElementById("rcMethod").textContent = order.methodLabel;
    document.getElementById("rcDate").textContent = apexFormatDate(order.date);
    document.getElementById("rcExpiry").textContent = apexFormatDate(order.expiryDate);
    checkoutMain.hidden = true;
    failBox.hidden = true;
    successBox.hidden = false;
    successBox.scrollIntoView({ behavior: "smooth", block: "start" });
    if (window.apexToast) apexToast("Payment successful — receipt ready to download.");
  }

  function showFailure(msg) {
    document.getElementById("failText").textContent = msg;
    checkoutMain.hidden = true;
    successBox.hidden = true;
    failBox.hidden = false;
    failBox.scrollIntoView({ behavior: "smooth", block: "start" });
    if (window.apexToast) apexToast("Demo payment declined — no money was charged. You can retry.", true);
  }

  function setProcessing(on) {
    payBtn.disabled = on;
    payBtn.innerHTML = on
      ? '<span class="spinner" aria-hidden="true"></span>&nbsp; Processing…'
      : "Pay " + apexFormatINR(total()) + " Now";
    try { sessionStorage.setItem("apex_pay_inflight", on ? "1" : "0"); } catch (e) { /* ignore */ }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    // Duplicate-submit guard: ignore clicks while a payment is processing
    try {
      if (sessionStorage.getItem("apex_pay_inflight") === "1") {
        if (window.apexToast) apexToast("Your demo payment is already processing — please wait.");
        return;
      }
    } catch (err) { /* ignore */ }
    if (!validate()) return;

    setProcessing(true);
    var idemKey = getIdemKey();

    // Simulated processing (~2 seconds)
    setTimeout(function () {
      if (simulateFail) {
        simulateFail = false;
        setProcessing(false);
        showFailure("The demo payment was declined (simulated failure). No money was charged. Please check your details and try again.");
        return;
      }
      var plan = PLANS[selectedPlan];
      var start = apexTodayISO();
      var expiry = apexAddMonths(start, selectedMonths);

      // Reuse the existing membership ID for the same email, else create one
      var existing = ApexStore.getMember();
      var memberId = (existing && existing.email === emailInput.value.trim())
        ? existing.id
        : apexMakeMemberId();

      var order = {
        txnId: makeTxnId(),
        idemKey: idemKey,
        membershipId: memberId,
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        phone: apexNormalisePhone(phoneInput.value),
        age: parseInt(ageInput.value, 10),
        goal: goalSelect.value,
        plan: selectedPlan,
        planName: plan.name,
        monthly: plan.price,
        durationMonths: selectedMonths,
        amount: total(),
        method: selectedMethod,
        methodLabel: METHOD_LABELS[selectedMethod],
        date: start,
        expiryDate: expiry,
        status: "success"
      };
      var orderSaved = ApexStore.addOrder(order);
      var memberSaved = ApexStore.setMember({
        id: memberId,
        name: order.name,
        email: order.email,
        phone: order.phone,
        age: order.age,
        plan: selectedPlan,
        monthly: plan.price,
        goal: order.goal,
        startDate: start,
        durationMonths: selectedMonths,
        expiryDate: expiry,
        createdAt: existing ? (existing.createdAt || new Date().toISOString()) : new Date().toISOString(),
        source: "checkout"
      });
      lastOrder = order;
      // Fresh idempotency key for the next order — the old one belonged to this order
      try { sessionStorage.removeItem("apex_idem_key"); } catch (e) { /* ignore */ }
      setProcessing(false);
      if (!orderSaved || !memberSaved) {
        if (window.apexToast) apexToast("Demo payment succeeded, but the order could not be saved in this browser (storage unavailable) — your receipt below is still available.", true);
      }
      showSuccess(order);
    }, 2000);
  });

  /* ---------- Simulate failed payment ---------- */
  simulateFailLink.addEventListener("click", function () {
    simulateFail = true;
    if (window.apexToast) apexToast("Failure simulation armed — the next Pay Now attempt will show the failure screen.");
    payBtn.focus();
  });

  /* ---------- Retry after failure ---------- */
  retryBtn.addEventListener("click", function () {
    failBox.hidden = true;
    checkoutMain.hidden = false;
    checkoutMain.scrollIntoView({ behavior: "smooth", block: "start" });
    if (window.apexToast) apexToast("Ready to try again — check your details and press Pay Now.");
  });

  /* ---------- Receipt download (jsPDF, with print fallback) ---------- */
  downloadBtn.addEventListener("click", function () {
    if (!lastOrder) return;
    var o = lastOrder;
    var lines = [
      "APEX FITNESS CLUB — Demo Receipt",
      "----------------------------------------",
      "Transaction ID: " + o.txnId,
      "Membership ID: " + o.membershipId,
      "Name: " + o.name,
      "Email: " + o.email,
      "Phone: " + o.phone,
      "Plan: " + o.planName + " (" + apexFormatINR(o.monthly) + "/month)",
      "Duration: " + o.durationMonths + (o.durationMonths === 1 ? " month" : " months"),
      "Amount paid: " + apexFormatINR(o.amount),
      "Payment method: " + o.methodLabel,
      "Payment date: " + apexFormatDate(o.date),
      "Valid till: " + apexFormatDate(o.expiryDate),
      "----------------------------------------",
      "DEMO PAYMENT ONLY — No real money was charged.",
      "Apex Fitness Club, India. Open 5 AM – 10 PM, all days.",
      "Phone: +91 82921 60777"
    ];
    try {
      if (window.jspdf && window.jspdf.jsPDF) {
        var doc = new window.jspdf.jsPDF();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("APEX FITNESS CLUB", 14, 18);
        doc.setFontSize(11);
        doc.text("Demo Receipt — DEMO PAYMENT ONLY", 14, 26);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        var y = 38;
        lines.slice(2).forEach(function (line) {
          // Wrap long lines (e.g. a long member name) so nothing is clipped off the page
          doc.splitTextToSize(line, 182).forEach(function (wl) {
            doc.text(wl, 14, y);
            y += 7;
          });
        });
        doc.save("Apex-Receipt-" + o.txnId + ".pdf");
        if (window.apexToast) apexToast("Receipt downloaded.");
        return;
      }
    } catch (err) { /* fall through to print */ }
    // jsPDF failed to load — fall back to the browser print dialog
    if (window.apexToast) apexToast("Print dialog opened — choose “Save as PDF” to download the receipt.");
    window.print();
  });

  /* ---------- Init ---------- */
  // Clear any stale "payment in flight" flag (e.g. the page was reloaded
  // mid-payment) so a fresh visit can never be stuck unable to pay.
  try { sessionStorage.setItem("apex_pay_inflight", "0"); } catch (e) { /* ignore */ }
  selectPlan(selectedPlan);
  selectMonths(1);
  selectMethod("upi");
})();
