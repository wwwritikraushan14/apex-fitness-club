/* ============================================================
   APEX FITNESS CLUB — app.js (shared, vanilla JS)
   Loaded on every page. Page-specific logic lives in
   checkout.js (checkout page) and dashboard.js (dashboard/admin).
   ============================================================ */
var WHATSAPP_NUMBER = "918292160777";

/* ---------- localStorage helpers (demo data only, stays in the browser) ---------- */
var ApexStore = (function () {
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  return {
    getMember: function () { return read("apex_member", null); },
    setMember: function (m) { return write("apex_member", m); },
    getOrders: function () { return read("apex_orders", []); },
    addOrder: function (o) {
      var list = read("apex_orders", []);
      list.push(o);
      return write("apex_orders", list);
    },
    getInquiries: function () { return read("apex_inquiries", []); },
    addInquiry: function (q) {
      var list = read("apex_inquiries", []);
      list.push(q);
      return write("apex_inquiries", list);
    }
  };
})();

/* Clear every demo record this site stored on this device. */
function apexClearDemoData() {
  ["apex_member", "apex_orders", "apex_inquiries"].forEach(function (k) {
    try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
  });
  ["apex_idem_key", "apex_pay_inflight"].forEach(function (k) {
    try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ }
  });
}
window.apexClearDemoData = apexClearDemoData;

/* ---------- Validation + ID/date helpers ---------- */
/* Normalise an Indian mobile: allow spaces/dashes, optional +91 / 91 / 0 prefix.
   Valid result: exactly 10 digits, first digit 6–9. */
function apexNormalisePhone(raw) {
  var digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.indexOf("91") === 0) digits = digits.slice(2);
  if (digits.length === 11 && digits.charAt(0) === "0") digits = digits.slice(1);
  return digits;
}
function apexIsValidPhone(raw) {
  return /^[6-9]\d{9}$/.test(apexNormalisePhone(raw));
}
function apexIsValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
}
/* Membership ID like AFC-483920 (6 random digits) — unique among stored demo records */
function apexMakeMemberId() {
  var taken = {};
  try {
    var m = ApexStore.getMember();
    if (m && m.id) taken[m.id] = true;
    ApexStore.getOrders().forEach(function (o) { if (o.membershipId) taken[o.membershipId] = true; });
  } catch (e) { /* storage unavailable — uniqueness check skipped */ }
  var id;
  do { id = "AFC-" + String(Math.floor(100000 + Math.random() * 900000)); } while (taken[id]);
  return id;
}
/* Local-date ISO string (YYYY-MM-DD). toISOString() is UTC, which is a day
   behind local time in IST between midnight and 05:29 — never use it for dates. */
function apexLocalISODate(d) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}
/* Expiry = start date + N months, returned as ISO date (YYYY-MM-DD).
   Clamped to the last day of the target month (Jan 31 + 1 month = Feb 28/29). */
function apexAddMonths(isoDate, months) {
  var d = new Date(isoDate + "T00:00:00");
  var day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return apexLocalISODate(d);
}
function apexTodayISO() {
  return apexLocalISODate(new Date());
}
function apexFormatDate(isoDate) {
  try {
    return new Date(isoDate + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric"
    });
  } catch (e) { return isoDate; }
}
function apexFormatINR(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

/* ---------- Toast notifications (replaces bare alerts) ---------- */
function apexToast(message, isError) {
  var wrap = document.getElementById("toastWrap");
  if (!wrap) return;
  var toast = document.createElement("div");
  toast.className = "toast" + (isError ? " toast-error" : "");
  toast.textContent = message;
  wrap.appendChild(toast);
  setTimeout(function () {
    toast.classList.add("out");
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
  }, 3400);
}
window.apexToast = apexToast;

/* Show a brief spinner + disabled state on a submit button while an
   async-feeling action runs. Returns the button's original label. */
function apexSetLoading(btn, loading, busyText) {
  if (!btn) return "";
  if (loading) {
    var original = btn.innerHTML;
    btn.disabled = true;
    btn.dataset.apexOriginal = original;
    btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>&nbsp; ' + (busyText || "Please wait…");
    return original;
  }
  btn.disabled = false;
  if (btn.dataset.apexOriginal) btn.innerHTML = btn.dataset.apexOriginal;
  return "";
}

var apexReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* WebP support (one canvas test): the lightbox serves WebP when available, JPG otherwise */
var apexSupportsWebp = (function () {
  try {
    return document.createElement("canvas").toDataURL("image/webp").indexOf("data:image/webp") === 0;
  } catch (e) { return false; }
})();

/* ---------- Branded loading screen ---------- */
(function () {
  var loader = document.getElementById("pageLoader");
  if (!loader) return;
  var hidden = false;
  function hide() {
    if (hidden) return;
    hidden = true;
    loader.classList.add("done");
  }
  if (apexReducedMotion) { hide(); return; }
  window.addEventListener("load", function () { setTimeout(hide, 350); });
  setTimeout(hide, 900); // safety net: never block the page
  loader.addEventListener("click", hide); // skippable
})();

/* ---------- Sticky header shadow ---------- */
(function () {
  var header = document.querySelector(".site-header");
  if (!header) return;
  function onScroll() { header.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

/* ---------- Mobile menu ---------- */
(function () {
  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("mainNav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      nav.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
})();

/* ---------- Hero parallax (desktop, fine pointers only, never on reduced motion) ---------- */
(function () {
  var hero = document.querySelector(".hero");
  var media = document.querySelector(".hero-media");
  if (!hero || !media) return;
  if (apexReducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
  var ticking = false;
  function update() {
    ticking = false;
    var y = window.scrollY;
    if (y < hero.offsetHeight) media.style.transform = "translateY(" + (y * 0.22) + "px)";
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
})();

/* ---------- Pause infinite animations while their section is off-screen ---------- */
(function () {
  if (!("IntersectionObserver" in window) || apexReducedMotion) return;
  function pauseWhenHidden(section, animated) {
    if (!section || !animated) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        animated.style.animationPlayState = entry.isIntersecting ? "" : "paused";
      });
    });
    io.observe(section);
  }
  pauseWhenHidden(document.querySelector(".marquee"), document.querySelector(".marquee-track"));
  pauseWhenHidden(document.querySelector(".hero"), document.querySelector(".hero-media img"));
})();

/* ---------- Magnetic primary CTAs (desktop, fine pointers only) ---------- */
(function () {
  if (!window.matchMedia("(pointer: fine)").matches || apexReducedMotion) return;
  document.querySelectorAll(".magnetic").forEach(function (el) {
    el.addEventListener("mousemove", function (e) {
      var r = el.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      el.style.transform = "translate(" + (dx * 5).toFixed(1) + "px," + (dy * 5).toFixed(1) + "px)";
    });
    el.addEventListener("mouseleave", function () { el.style.transform = ""; });
  });
})();

/* ---------- Scroll-reveal animations (with per-card stagger inside grids) ---------- */
(function () {
  document.querySelectorAll(".grid, .plans-grid, .trainers-grid").forEach(function (grid) {
    grid.querySelectorAll(":scope > .reveal").forEach(function (el, i) {
      el.style.setProperty("--rd", ((i % 4) * 80) + "ms");
    });
  });
  var els = document.querySelectorAll(".reveal");
  if (!els.length) return;
  if (!("IntersectionObserver" in window)) {
    els.forEach(function (el) { el.classList.add("in"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
    });
  }, { threshold: 0.12 });
  els.forEach(function (el) { io.observe(el); });
})();

/* ---------- Image reveal (clip wipe as images scroll into view) ---------- */
(function () {
  var imgs = document.querySelectorAll(".about-media img, .trainer-img img, .card-img img");
  if (!imgs.length) return;
  imgs.forEach(function (img) { img.classList.add("img-reveal"); });
  if (!("IntersectionObserver" in window)) {
    imgs.forEach(function (img) { img.classList.add("in"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
    });
  }, { threshold: 0.2 });
  imgs.forEach(function (img) { io.observe(img); });
})();

/* ---------- Animated stat counters (smooth, once, when visible) ---------- */
(function () {
  var counters = document.querySelectorAll(".counter");
  if (!counters.length) return;
  function animate(el) {
    var target = parseInt(el.getAttribute("data-target"), 10) || 0;
    var start = null, duration = 1600;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // easeOutExpo
      el.textContent = Math.round(target * eased).toLocaleString("en-IN");
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (!("IntersectionObserver" in window)) {
    counters.forEach(animate);
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { animate(entry.target); io.unobserve(entry.target); }
    });
  }, { threshold: 0.4 });
  counters.forEach(function (el) { io.observe(el); });
})();

/* ---------- Testimonials carousel (fade + swipe) ---------- */
(function () {
  var track = document.getElementById("testiTrack");
  if (!track) return;
  var slides = track.children.length;
  var dotsWrap = document.getElementById("testiDots");
  var prevBtn = document.getElementById("testiPrev");
  var nextBtn = document.getElementById("testiNext");
  var carousel = document.getElementById("testiCarousel");
  var current = 0, timer = null;

  // Build dots
  for (var i = 0; i < slides; i++) {
    (function (idx) {
      var dot = document.createElement("button");
      dot.className = "car-dot";
      dot.setAttribute("aria-label", "Go to testimonial " + (idx + 1));
      dot.addEventListener("click", function () { go(idx); restart(); });
      dotsWrap.appendChild(dot);
    })(i);
  }
  var dots = dotsWrap.children;
  function go(idx) {
    current = (idx + slides) % slides;
    track.style.transform = "translateX(-" + current * 100 + "%)";
    for (var s = 0; s < slides; s++) {
      track.children[s].classList.toggle("active", s === current);
    }
    for (var d = 0; d < dots.length; d++) {
      dots[d].classList.toggle("active", d === current);
    }
  }
  function restart() {
    stop();
    timer = setInterval(function () { go(current + 1); }, 5000);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  prevBtn.addEventListener("click", function () { go(current - 1); restart(); });
  nextBtn.addEventListener("click", function () { go(current + 1); restart(); });
  carousel.addEventListener("mouseenter", stop);
  carousel.addEventListener("mouseleave", restart);
  carousel.addEventListener("focusin", stop);
  carousel.addEventListener("focusout", restart);
  // Touch swipe
  var touchX = null;
  carousel.addEventListener("touchstart", function (e) {
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });
  carousel.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 40) { go(current + (dx < 0 ? 1 : -1)); restart(); }
  }, { passive: true });
  go(0);
  restart();
})();

/* ---------- Gallery lightbox ---------- */
(function () {
  var tiles = Array.prototype.slice.call(document.querySelectorAll(".gal-tile"));
  if (!tiles.length) return;
  var lightbox = document.getElementById("lightbox");
  var lbImg = document.getElementById("lbImg");
  var lbCaption = document.getElementById("lbCaption");
  if (!lightbox || !lbImg) return;
  var current = 0, lastFocus = null;

  function show(i) {
    current = (i + tiles.length) % tiles.length;
    var tile = tiles[current];
    var img = tile.querySelector("img");
    var full = tile.getAttribute("data-full");
    if (apexSupportsWebp) full = full.replace(/\.jpg$/i, ".webp");
    lbImg.onerror = function () { // fall back to the JPG if the WebP is ever missing
      if (/\.webp$/i.test(lbImg.src)) { lbImg.onerror = null; lbImg.src = tile.getAttribute("data-full"); }
    };
    lbImg.src = full;
    lbImg.alt = img ? img.alt : "";
    lbCaption.textContent = tile.getAttribute("data-caption") || "";
  }
  function open(i) {
    lastFocus = document.activeElement;
    show(i);
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    document.getElementById("lbClose").focus();
  }
  function close() {
    lightbox.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus(); // focus returns to the tile
  }
  tiles.forEach(function (tile, i) {
    tile.addEventListener("click", function () { open(i); });
  });
  document.getElementById("lbClose").addEventListener("click", close);
  document.getElementById("lbPrev").addEventListener("click", function () { show(current - 1); });
  document.getElementById("lbNext").addEventListener("click", function () { show(current + 1); });
  lightbox.addEventListener("click", function (e) { if (e.target === lightbox) close(); });
  document.addEventListener("keydown", function (e) {
    if (lightbox.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
})();

/* ---------- Program cards: "Explore Program" sets the join goal ---------- */
(function () {
  var joinForm = document.getElementById("joinForm");
  var goalSelect = document.getElementById("jGoal");
  if (!joinForm || !goalSelect) return;
  var PROGRAM_GOALS = {
    "Weight Training": "Strength",
    "Personal Training": "General Fitness",
    "Cardio Training": "Fitness & Stamina",
    "CrossFit": "Fitness & Stamina",
    "Strength & Conditioning": "Strength",
    "Weight Loss Programs": "Weight Loss",
    "Muscle Building": "Muscle Building",
    "Yoga & Flexibility": "Yoga & Flexibility"
  };
  document.querySelectorAll("#programs .card").forEach(function (card) {
    var link = card.querySelector(".link-arrow");
    var h3 = card.querySelector("h3");
    if (!link || !h3) return;
    link.addEventListener("click", function (e) {
      e.preventDefault();
      var goal = PROGRAM_GOALS[h3.textContent.trim()] || "General Fitness";
      goalSelect.value = goal;
      joinForm.scrollIntoView({ behavior: "smooth", block: "start" });
      apexToast("Goal set to " + goal + " — complete the form to start.");
    });
  });
})();

/* ---------- Trainer cards: "Train with {name}" sets the join goal ---------- */
(function () {
  var joinForm = document.getElementById("joinForm");
  var goalSelect = document.getElementById("jGoal");
  if (!joinForm || !goalSelect) return;
  var TRAINER_GOALS = {
    "Arjun Singh": "Strength",
    "Rahul Kapoor": "Fitness & Stamina",
    "Neha Verma": "Yoga & Flexibility",
    "Sana Khan": "Weight Loss"
  };
  document.querySelectorAll("#trainers .card").forEach(function (card) {
    var nameEl = card.querySelector(".trainer-name");
    var body = card.querySelector(".card-body");
    if (!nameEl || !body) return;
    var name = nameEl.textContent.trim();
    var first = name.split(" ")[0];
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost btn-sm trainer-cta";
    btn.textContent = "Train with " + first;
    btn.addEventListener("click", function () {
      goalSelect.value = TRAINER_GOALS[name] || "General Fitness";
      joinForm.scrollIntoView({ behavior: "smooth", block: "start" });
      apexToast(first + " will be your trainer — set your goal and join.");
    });
    body.appendChild(btn);
  });
})();

/* ---------- Demo social links ("#") explain themselves instead of doing nothing ---------- */
(function () {
  document.querySelectorAll('a[href="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      var label = link.getAttribute("aria-label") || "";
      var network = "this profile";
      ["Instagram", "Facebook", "YouTube", "WhatsApp"].forEach(function (n) {
        if (label.indexOf(n) !== -1) network = n;
      });
      apexToast("Demo link — Apex's real " + network + " isn't connected yet.");
    });
  });
})();

/* ---------- Join / registration form (index) ---------- */
(function () {
  var form = document.getElementById("joinForm");
  if (!form) return;
  var nameInput = document.getElementById("jName");
  var emailInput = document.getElementById("jEmail");
  var phoneInput = document.getElementById("jPhone");
  var ageInput = document.getElementById("jAge");
  var planSelect = document.getElementById("jPlan");
  var goalSelect = document.getElementById("jGoal");
  var phoneError = document.getElementById("joinPhoneError");
  var formError = document.getElementById("joinFormError");
  var successBox = document.getElementById("joinSuccess");
  var memberIdEl = document.getElementById("joinMemberId");
  var successText = document.getElementById("joinSuccessText");
  var submitBtn = form.querySelector('[type="submit"]');

  phoneInput.addEventListener("input", function () {
    phoneInput.classList.remove("invalid");
    phoneError.hidden = true;
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    formError.hidden = true;
    var name = nameInput.value.trim();
    var email = emailInput.value.trim();
    var age = parseInt(ageInput.value, 10);
    if (!name) { formError.textContent = "Please enter your full name."; formError.hidden = false; nameInput.focus(); return; }
    if (!apexIsValidEmail(email)) { formError.textContent = "Please enter a valid email address."; formError.hidden = false; emailInput.focus(); return; }
    if (!apexIsValidPhone(phoneInput.value)) {
      phoneInput.classList.add("invalid");
      phoneError.hidden = false;
      phoneInput.focus();
      return;
    }
    if (isNaN(age) || age < 14 || age > 80) {
      formError.textContent = "Please enter an age between 14 and 80.";
      formError.hidden = false;
      ageInput.focus();
      return;
    }
    // Brief loading state so the (demo) registration feels responsive
    apexSetLoading(submitBtn, true, "Creating your membership…");
    setTimeout(function () {
      var plan = planSelect.value;
      var goal = goalSelect.value;
      var start = apexTodayISO();
      var member = {
        id: apexMakeMemberId(),
        name: name,
        email: email,
        phone: apexNormalisePhone(phoneInput.value),
        age: age,
        plan: plan,
        goal: goal,
        startDate: start,
        durationMonths: 1,
        expiryDate: apexAddMonths(start, 1),
        createdAt: new Date().toISOString(),
        source: "join-form"
      };
      if (!ApexStore.setMember(member)) {
        apexSetLoading(submitBtn, false);
        formError.textContent = "Your membership could not be saved in this browser (storage is unavailable). Please allow site data and try again.";
        formError.hidden = false;
        return;
      }
      apexSetLoading(submitBtn, false);
      memberIdEl.textContent = member.id;
      successText.textContent = name + " — " + plan.toUpperCase() + " plan, goal: " + goal +
        ". Membership valid till " + apexFormatDate(member.expiryDate) + ".";
      successBox.hidden = false;
      form.hidden = true;
      successBox.scrollIntoView({ behavior: "smooth", block: "center" });
      apexToast("Welcome to Apex, " + name.split(" ")[0] + "! Your membership ID is " + member.id + ".");
    }, 500);
  });
})();

/* ---------- Contact form (index) ---------- */
(function () {
  var form = document.getElementById("contactForm");
  if (!form) return;
  var nameInput = document.getElementById("cName");
  var emailInput = document.getElementById("cEmail");
  var phoneInput = document.getElementById("cPhone");
  var goalSelect = document.getElementById("cGoal");
  var messageInput = document.getElementById("cMessage");
  var phoneError = document.getElementById("contactPhoneError");
  var formError = document.getElementById("contactFormError");
  var successBox = document.getElementById("contactSuccess");
  var submitBtn = form.querySelector('[type="submit"]');

  phoneInput.addEventListener("input", function () {
    phoneInput.classList.remove("invalid");
    phoneError.hidden = true;
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    formError.hidden = true;
    var name = nameInput.value.trim();
    var email = emailInput.value.trim();
    var message = messageInput.value.trim();
    if (!name) { formError.textContent = "Please enter your name."; formError.hidden = false; nameInput.focus(); return; }
    if (!apexIsValidPhone(phoneInput.value)) {
      phoneInput.classList.add("invalid");
      phoneError.hidden = false;
      phoneInput.focus();
      return;
    }
    if (!apexIsValidEmail(email)) { formError.textContent = "Please enter a valid email address."; formError.hidden = false; emailInput.focus(); return; }
    if (message.length < 5) { formError.textContent = "Please write a short message (at least a few words)."; formError.hidden = false; messageInput.focus(); return; }
    // Brief loading state so the (demo) send feels responsive
    apexSetLoading(submitBtn, true, "Sending…");
    setTimeout(function () {
      var saved = ApexStore.addInquiry({
        name: name,
        email: email,
        phone: apexNormalisePhone(phoneInput.value),
        goal: goalSelect.value,
        message: message,
        date: new Date().toISOString()
      });
      apexSetLoading(submitBtn, false);
      if (!saved) {
        formError.textContent = "Your message could not be saved in this browser (storage is unavailable). Please allow site data and try again, or message us on WhatsApp.";
        formError.hidden = false;
        return;
      }
      successBox.hidden = false;
      form.hidden = true;
      successBox.scrollIntoView({ behavior: "smooth", block: "center" });
      apexToast("Message sent — the Apex team will get back to you soon.");
    }, 500);
  });
})();

/* ---------- Footer year ---------- */
(function () {
  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
})();
