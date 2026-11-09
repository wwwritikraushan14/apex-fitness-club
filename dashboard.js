/* ============================================================
   APEX FITNESS CLUB — dashboard.js
   Renders the member dashboard and the demo admin dashboard
   from localStorage (ApexStore in app.js). No server, no auth.
   ============================================================ */
(function () {
  "use strict";
  var page = document.body.getAttribute("data-page");
  var PLAN_NAMES = { basic: "BASIC", pro: "PRO", elite: "ELITE" };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function byDateDesc(a, b) {
    return String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || ""));
  }

  /* ---------- MEMBER DASHBOARD ---------- */
  if (page === "dashboard") {
    var emptyEl = document.getElementById("dashEmpty");
    var contentEl = document.getElementById("dashContent");
    var member = ApexStore.getMember();

    if (!member) {
      if (emptyEl) emptyEl.hidden = false;
      if (contentEl) contentEl.hidden = true;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    if (contentEl) contentEl.hidden = false;

    var set = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set("mName", member.name);
    set("mId", member.id);
    set("mEmail", member.email);
    set("mPhone", member.phone ? "+91 " + member.phone : "—");
    set("mAge", member.age != null ? String(member.age) + " years" : "—");
    set("mGoal", member.goal || "—");
    set("mPlan", (PLAN_NAMES[member.plan] || String(member.plan || "—").toUpperCase()) +
      (member.monthly ? " — " + apexFormatINR(member.monthly) + "/month" : ""));
    set("mStart", apexFormatDate(member.startDate));
    set("mExpiry", apexFormatDate(member.expiryDate));
    set("mDuration", (member.durationMonths || 1) + ((member.durationMonths || 1) === 1 ? " month" : " months"));

    var statusEl = document.getElementById("mStatus");
    var expired = member.expiryDate && member.expiryDate < apexTodayISO();
    if (statusEl) {
      statusEl.textContent = expired ? "Expired" : "Active";
      statusEl.classList.toggle("status-expired", !!expired);
      statusEl.classList.toggle("status-active", !expired);
    }
    var renewBtn = document.getElementById("renewBtn");
    if (renewBtn) renewBtn.href = "checkout.html?plan=" + encodeURIComponent(member.plan || "pro");

    // Payment history: this member's orders (by membership ID, fallback to email)
    var orders = ApexStore.getOrders().filter(function (o) {
      return o.membershipId === member.id || o.email === member.email;
    }).sort(byDateDesc);
    var tbody = document.getElementById("payBody");
    var emptyNote = document.getElementById("payEmpty");
    if (tbody) {
      tbody.innerHTML = orders.map(function (o) {
        return "<tr><td>" + esc(apexFormatDate(o.date)) + "</td><td>" + esc(o.txnId) + "</td><td>" +
          esc(o.planName || o.plan) + "</td><td>" + esc(o.durationMonths) + " mo</td><td>" +
          esc(o.methodLabel || o.method) + "</td><td>" + esc(apexFormatINR(o.amount)) + "</td><td>" +
          esc(o.status || "success") + "</td></tr>";
      }).join("");
    }
    if (emptyNote) emptyNote.hidden = orders.length > 0;

    // Clear this device's demo data (member + orders + inquiries)
    var clearDataBtn = document.getElementById("clearDataBtn");
    if (clearDataBtn) {
      clearDataBtn.addEventListener("click", function () {
        if (!window.confirm("Clear all demo data stored on this device? Your demo membership and payment history will be removed.")) return;
        if (window.apexClearDemoData) apexClearDemoData();
        if (window.apexToast) apexToast("Demo data cleared on this device.");
        window.location.reload();
      });
    }
    return;
  }

  /* ---------- DEMO ADMIN DASHBOARD ---------- */
  if (page === "admin") {
    var orders = ApexStore.getOrders().slice().sort(byDateDesc);
    var inquiries = ApexStore.getInquiries().slice().sort(byDateDesc);
    var member = ApexStore.getMember();

    // Unique members = unique membership IDs across orders + current member
    var memberIds = {};
    orders.forEach(function (o) { if (o.membershipId) memberIds[o.membershipId] = true; });
    if (member && member.id) memberIds[member.id] = true;
    var memberCount = Object.keys(memberIds).length;

    var revenue = orders.reduce(function (sum, o) { return sum + (Number(o.amount) || 0); }, 0);

    var setNum = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    setNum("statMembers", String(memberCount));
    setNum("statOrders", String(orders.length));
    setNum("statRevenue", apexFormatINR(revenue));
    setNum("statInquiries", String(inquiries.length));

    // Plans selected (from orders; include the current member's plan if no order yet)
    var planStats = { basic: { n: 0, rev: 0 }, pro: { n: 0, rev: 0 }, elite: { n: 0, rev: 0 } };
    orders.forEach(function (o) {
      if (planStats[o.plan]) {
        planStats[o.plan].n += 1;
        planStats[o.plan].rev += Number(o.amount) || 0;
      }
    });
    var plansBody = document.getElementById("plansBody");
    var plansEmpty = document.getElementById("plansEmpty");
    var anyPlan = Object.keys(planStats).some(function (k) { return planStats[k].n > 0; });
    if (plansBody) {
      plansBody.innerHTML = Object.keys(planStats).map(function (k) {
        return "<tr><td>" + PLAN_NAMES[k] + "</td><td>" + planStats[k].n + "</td><td>" +
          apexFormatINR(planStats[k].rev) + "</td></tr>";
      }).join("");
    }
    if (plansEmpty) plansEmpty.hidden = anyPlan;

    // Payment records
    var ordersBody = document.getElementById("ordersBody");
    var ordersEmpty = document.getElementById("ordersEmpty");
    if (ordersBody) {
      ordersBody.innerHTML = orders.map(function (o) {
        return "<tr><td>" + esc(apexFormatDate(o.date)) + "</td><td>" + esc(o.txnId) + "</td><td>" +
          esc(o.name) + "</td><td>" + esc(o.planName || o.plan) + "</td><td>" +
          esc(o.methodLabel || o.method) + "</td><td>" + esc(apexFormatINR(o.amount)) + "</td><td>" +
          esc(o.status || "success") + "</td></tr>";
      }).join("");
    }
    if (ordersEmpty) ordersEmpty.hidden = orders.length > 0;

    // Recent registrations: one row per order + the current member if not in orders
    var regs = orders.map(function (o) {
      return {
        date: o.date, id: o.membershipId, name: o.name,
        email: o.email, plan: o.planName || o.plan, goal: o.goal || "—"
      };
    });
    if (member && !regs.some(function (r) { return r.id === member.id; })) {
      regs.push({
        date: member.startDate, id: member.id, name: member.name,
        email: member.email, plan: PLAN_NAMES[member.plan] || member.plan, goal: member.goal || "—"
      });
      regs.sort(byDateDesc);
    }
    var regsBody = document.getElementById("regsBody");
    var regsEmpty = document.getElementById("regsEmpty");
    if (regsBody) {
      regsBody.innerHTML = regs.map(function (r) {
        return "<tr><td>" + esc(apexFormatDate(r.date)) + "</td><td>" + esc(r.id) + "</td><td>" +
          esc(r.name) + "</td><td>" + esc(r.email) + "</td><td>" + esc(r.plan) + "</td><td>" +
          esc(r.goal) + "</td></tr>";
      }).join("");
    }
    if (regsEmpty) regsEmpty.hidden = regs.length > 0;

    // Contact inquiries
    var inqBody = document.getElementById("inqBody");
    var inqEmpty = document.getElementById("inqEmpty");
    if (inqBody) {
      inqBody.innerHTML = inquiries.map(function (q) {
        return "<tr><td>" + esc(apexFormatDate((q.date || "").slice(0, 10))) + "</td><td>" +
          esc(q.name) + "</td><td>" + esc(q.email) + "</td><td>" + esc(q.phone || "—") + "</td><td>" +
          esc(q.goal || "—") + "</td><td>" + esc(q.message) + "</td></tr>";
      }).join("");
    }
    if (inqEmpty) inqEmpty.hidden = inquiries.length > 0;

    // Download demo data as CSV (orders + inquiries)
    var exportBtn = document.getElementById("exportCsvBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        function csvRow(cells) {
          return cells.map(function (c) {
            return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"';
          }).join(",");
        }
        var lines = ["Apex Fitness Club — Demo Data Export"];
        lines.push("");
        lines.push("Payments");
        lines.push(csvRow(["Date", "Transaction ID", "Name", "Email", "Plan", "Duration (months)", "Method", "Amount (INR)", "Status"]));
        orders.forEach(function (o) {
          lines.push(csvRow([o.date, o.txnId, o.name, o.email, o.planName || o.plan, o.durationMonths, o.methodLabel || o.method, o.amount, o.status || "success"]));
        });
        lines.push("");
        lines.push("Contact Inquiries");
        lines.push(csvRow(["Date", "Name", "Email", "Phone", "Goal", "Message"]));
        inquiries.forEach(function (q) {
          lines.push(csvRow([(q.date || "").slice(0, 10), q.name, q.email, q.phone || "", q.goal || "", q.message]));
        });
        var blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "apex-demo-data-" + apexTodayISO() + ".csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        if (window.apexToast) apexToast("Demo data downloaded as CSV.");
      });
    }

    // Clear all demo data stored on this device
    var clearDemoBtn = document.getElementById("clearDemoBtn");
    if (clearDemoBtn) {
      clearDemoBtn.addEventListener("click", function () {
        if (!window.confirm("Clear ALL demo data on this device? Members, payments and inquiries will be removed.")) return;
        if (window.apexClearDemoData) apexClearDemoData();
        if (window.apexToast) apexToast("All demo data cleared on this device.");
        window.location.reload();
      });
    }
  }
})();
