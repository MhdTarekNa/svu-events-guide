/* Main script of the site.
   Every page has data-page on the body, and at the end we run only the code of that page. */

/* ---------- small helpers ---------- */

// date like "14 تشرين الثاني 2026" with normal digits
function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ar-SY-u-nu-latn", { day: "numeric", month: "long", year: "numeric" });
}

function eventDates(e) {
  return e.end ? formatDate(e.date) + " - " + formatDate(e.end) : formatDate(e.date);
}

function todayISO() {
  const t = new Date();
  return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
}

// number of days from today to a date (negative if passed)
function daysFromToday(iso) {
  const ms = new Date(iso + "T00:00:00") - new Date(todayISO() + "T00:00:00");
  return Math.round(ms / 86400000);
}

// status of the event: today / this week / ended / upcoming
function eventStatus(e) {
  const start = daysFromToday(e.date);
  const end = daysFromToday(e.end || e.date);
  if (start <= 0 && end >= 0) return { key: "today", text: "الحدث اليوم" };
  if (end < 0) return { key: "ended", text: "انتهت" };
  if (start <= 7) return { key: "week", text: "هذا الأسبوع" };
  return { key: "soon", text: "قادمة" };
}

// "غداً"، "بعد يومين"، "بعد 5 أيام"، "بعد 12 يوماً"
function daysText(n) {
  if (n === 1) return "غداً";
  if (n === 2) return "بعد يومين";
  if (n <= 10) return "بعد " + n + " أيام";
  return "بعد " + n + " يوماً";
}

function getEvent(id) {
  return EVENTS.find(e => e.id === Number(id));
}

function catBadge(cat) {
  const c = CATEGORIES[cat];
  return `<span class="badge cat-badge cat-${cat}"><i class="bi ${c.icon}"></i> ${c.name}</span>`;
}

// safe read/write of localStorage (it can fail in private mode)
function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    return null;
  }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// Bootstrap alert inside a container
function showAlert(container, type, html) {
  container.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${html}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="إغلاق"></button>
    </div>`;
}

/* ---------- event card used in many pages ---------- */
function eventCard(e) {
  const st = eventStatus(e);
  return `
  <div class="col-12 col-sm-6 col-lg-4">
    <article class="card event-card h-100">
      <div class="card-img-wrap">
        <img src="assets/img/event-${e.id}.webp" class="card-img-top" alt="${e.title}" loading="lazy">
        <span class="status-badge status-${st.key}">${st.text}</span>
      </div>
      <div class="card-body d-flex flex-column">
        <div class="mb-2">${catBadge(e.cat)}</div>
        <h3 class="card-title h5">${e.title}</h3>
        <ul class="list-unstyled small text-muted-2 mb-2">
          <li><i class="bi bi-calendar-event"></i> ${eventDates(e)}</li>
          <li><i class="bi bi-geo-alt"></i> ${PLACES[e.place].name}</li>
        </ul>
        <p class="card-text small flex-grow-1">${e.short}</p>
        <div class="d-flex gap-2">
          <a href="event.html?id=${e.id}" class="btn btn-primary btn-sm flex-grow-1">التفاصيل</a>
          <button class="btn btn-outline-secondary btn-sm" data-book="${e.id}" ${st.key === "ended" ? "disabled" : ""}>
            <i class="bi bi-ticket-perforated"></i> احجز
          </button>
        </div>
      </div>
    </article>
  </div>`;
}

/* ---------- common parts of all pages ---------- */

// dark mode: we only add the class "dark" on the body and CSS does the rest
function initTheme() {
  const btn = document.getElementById("themeToggle");
  if (store("darkMode")) document.body.classList.add("dark");
  const setIcon = () => {
    btn.innerHTML = document.body.classList.contains("dark") ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';
  };
  setIcon();
  btn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    store("darkMode", document.body.classList.contains("dark"));
    setIcon();
  });
}

function initScrollTop() {
  const btn = document.getElementById("toTop");
  window.addEventListener("scroll", () => btn.classList.toggle("show", window.scrollY > 400));
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

// booking modal: one modal for all events, we fill it with the chosen event
function initBooking() {
  const modalEl = document.getElementById("bookModal");
  if (!modalEl) return;
  const modal = new bootstrap.Modal(modalEl);
  const form = document.getElementById("bookForm");
  const msg = document.getElementById("bookMsg");

  document.addEventListener("click", ev => {
    const b = ev.target.closest("[data-book]");
    if (!b) return;
    const e = getEvent(b.dataset.book);
    form.reset();
    form.classList.remove("was-validated");
    msg.innerHTML = "";
    form.dataset.id = e.id;
    document.getElementById("bookTitle").textContent = e.title;
    document.getElementById("bookInfo").textContent = eventDates(e) + " - " + PLACES[e.place].name;
    form.querySelector("button[type=submit]").disabled = false;
    modal.show();
  });

  form.addEventListener("submit", ev => {
    ev.preventDefault();
    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      showAlert(msg, "danger", "يرجى تعبئة الحقول بشكل صحيح.");
      return;
    }
    // fake booking code, saved in the browser only
    const code = "SVU-" + form.dataset.id + "-" + Math.floor(1000 + Math.random() * 9000);
    const bookings = store("bookings") || {};
    bookings[form.dataset.id] = { name: form.bookName.value.trim(), seats: form.bookSeats.value, code };
    store("bookings", bookings);
    showAlert(msg, "success", `<i class="bi bi-check-circle"></i> تم الحجز بنجاح. رقم الحجز: <strong>${code}</strong>`);
    form.querySelector("button[type=submit]").disabled = true;
    document.dispatchEvent(new CustomEvent("booked", { detail: form.dataset.id }));
  });
}

/* ---------- home page ---------- */
function initHome() {
  // slider of the featured events (written by hand, without the Bootstrap carousel)
  const featured = EVENTS.filter(e => e.featured && eventStatus(e).key !== "ended")
                         .sort((a, b) => a.date.localeCompare(b.date));
  const track = document.getElementById("sliderTrack");
  const dots = document.getElementById("sliderDots");
  track.innerHTML = featured.map(e => `
    <div class="slide">
      <img src="assets/img/event-${e.id}.webp" alt="${e.title}">
      <div class="slide-caption">
        ${catBadge(e.cat)} <span class="status-badge status-${eventStatus(e).key} position-static">${eventStatus(e).text}</span>
        <h3 class="mt-2">${e.title}</h3>
        <p class="mb-2"><i class="bi bi-calendar-event"></i> ${eventDates(e)} &nbsp; <i class="bi bi-geo-alt"></i> ${PLACES[e.place].name}</p>
        <a href="event.html?id=${e.id}" class="btn btn-warning btn-sm">التفاصيل</a>
      </div>
    </div>`).join("");
  dots.innerHTML = featured.map((e, i) => `<button aria-label="شريحة ${i + 1}" data-i="${i}"></button>`).join("");

  let current = 0;
  let timer;
  function go(i) {
    current = (i + featured.length) % featured.length;
    // the page is RTL so the track moves to the right
    track.style.transform = `translateX(${current * 100}%)`;
    dots.querySelectorAll("button").forEach((d, k) => d.classList.toggle("active", k === current));
  }
  function auto() {
    clearInterval(timer);
    timer = setInterval(() => go(current + 1), 5000);
  }
  document.getElementById("slideNext").addEventListener("click", () => { go(current + 1); auto(); });
  document.getElementById("slidePrev").addEventListener("click", () => { go(current - 1); auto(); });
  dots.addEventListener("click", ev => { if (ev.target.dataset.i) { go(Number(ev.target.dataset.i)); auto(); } });
  const slider = document.getElementById("slider");
  slider.addEventListener("mouseenter", () => clearInterval(timer));
  slider.addEventListener("mouseleave", auto);
  go(0);
  auto();

  // quick categories with the number of events in each one
  document.getElementById("quickCats").innerHTML = Object.entries(CATEGORIES).map(([key, c]) => {
    const n = EVENTS.filter(e => e.cat === key).length;
    return `
    <div class="col-6 col-md-4 col-lg-2">
      <a href="events.html?cat=${key}" class="cat-tile cat-${key}">
        <i class="bi ${c.icon}"></i>
        <span>${c.name}</span>
        <span class="badge rounded-pill bg-light text-dark">${n}</span>
      </a>
    </div>`;
  }).join("");

  // latest events: the nearest upcoming ones
  const upcoming = EVENTS.filter(e => eventStatus(e).key !== "ended").sort((a, b) => a.date.localeCompare(b.date));
  document.getElementById("latestEvents").innerHTML = upcoming.slice(0, 6).map(eventCard).join("");

  // box of "today" or the next event with the number of days left
  const box = document.getElementById("todayBox");
  const todayEv = upcoming.find(e => eventStatus(e).key === "today");
  if (todayEv) {
    box.innerHTML = `<i class="bi bi-broadcast"></i> <strong>الحدث اليوم:</strong> ${todayEv.title} -
      <a href="event.html?id=${todayEv.id}" class="alert-link">شاهد التفاصيل</a>`;
  } else if (upcoming.length) {
    const n = upcoming[0];
    box.innerHTML = `<i class="bi bi-hourglass-split"></i> الفعالية القادمة <strong>${n.title}</strong> ${daysText(daysFromToday(n.date))} -
      <a href="event.html?id=${n.id}" class="alert-link">شاهد التفاصيل</a>`;
  } else {
    box.classList.add("d-none");
  }

  // small numbers in the hero
  document.getElementById("statEvents").textContent = EVENTS.length;
  document.getElementById("statUpcoming").textContent = upcoming.length;
  document.getElementById("statPlaces").textContent = Object.keys(PLACES).length;
}

/* ---------- events page: search and filters ---------- */
function initEvents() {
  const q = document.getElementById("fSearch");
  const cat = document.getElementById("fCat");
  const place = document.getElementById("fPlace");
  const when = document.getElementById("fWhen");
  const sort = document.getElementById("fSort");
  const list = document.getElementById("eventsList");
  const count = document.getElementById("resultCount");

  cat.innerHTML += Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${c.name}</option>`).join("");
  place.innerHTML += Object.entries(PLACES).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join("");

  // chips for the categories (same filter as the select)
  const chips = document.getElementById("catChips");
  chips.innerHTML = `<button class="btn btn-sm chip" data-cat="">الكل</button>` +
    Object.entries(CATEGORIES).map(([k, c]) => `<button class="btn btn-sm chip cat-${k}" data-cat="${k}"><i class="bi ${c.icon}"></i> ${c.name}</button>`).join("");

  // category from the link (?cat=) first, then the saved one in localStorage
  const fromUrl = new URLSearchParams(location.search).get("cat");
  const saved = store("favCat");
  if (fromUrl && CATEGORIES[fromUrl]) cat.value = fromUrl;
  else if (saved && CATEGORIES[saved]) cat.value = saved;

  function render() {
    const text = q.value.trim().toLowerCase();
    let res = EVENTS.filter(e => {
      if (cat.value && e.cat !== cat.value) return false;
      if (place.value && e.place !== place.value) return false;
      if (text && !(e.title + " " + e.short).toLowerCase().includes(text)) return false;
      const d = daysFromToday(e.date);
      const st = eventStatus(e).key;
      if (when.value === "week" && !(st === "today" || st === "week")) return false;
      if (when.value === "month" && !(d >= 0 && d <= 30) && st !== "today") return false;
      if (when.value === "upcoming" && st === "ended") return false;
      if (when.value === "past" && st !== "ended") return false;
      return true;
    });
    res.sort((a, b) => sort.value === "desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));

    list.innerHTML = res.length ? res.map(eventCard).join("") : `
      <div class="col-12"><div class="alert alert-warning text-center mb-0">
        <i class="bi bi-search"></i> لا توجد فعاليات تطابق البحث. جرب تغيير الفلاتر.
      </div></div>`;
    count.textContent = res.length;
    chips.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.cat === cat.value));
    store("favCat", cat.value);
  }

  [q, cat, place, when, sort].forEach(el => el.addEventListener("input", render));
  chips.addEventListener("click", ev => {
    const c = ev.target.closest(".chip");
    if (!c) return;
    cat.value = c.dataset.cat;
    render();
  });
  document.getElementById("fReset").addEventListener("click", () => {
    q.value = ""; cat.value = ""; place.value = ""; when.value = "all"; sort.value = "asc";
    render();
  });
  render();
}

/* ---------- event details page ---------- */
function initEventPage() {
  const id = new URLSearchParams(location.search).get("id") || 1;
  const e = getEvent(id);
  const main = document.getElementById("eventMain");
  if (!e) {
    main.innerHTML = `<div class="alert alert-danger">الفعالية غير موجودة. <a href="events.html" class="alert-link">العودة إلى كل الفعاليات</a></div>`;
    document.getElementById("relatedSection").classList.add("d-none");
    return;
  }
  document.title = e.title + " | دليل فعاليات الجامعة الافتراضية";
  const st = eventStatus(e);
  const p = PLACES[e.place];

  document.getElementById("evBreadcrumb").textContent = e.title;
  document.getElementById("evHeader").innerHTML = `
    <div class="mb-2">${catBadge(e.cat)} <span class="status-badge status-${st.key} position-static">${st.text}</span></div>
    <h1 class="h2 fw-bold">${e.title}</h1>
    <div class="d-flex flex-wrap gap-3 text-muted-2">
      <span><i class="bi bi-calendar-event"></i> ${eventDates(e)}</span>
      <span><i class="bi bi-clock"></i> ${e.time}</span>
      <span><i class="bi bi-geo-alt"></i> ${p.name}</span>
      <span><i class="bi bi-people"></i> ${e.seats} مقعد</span>
    </div>`;

  document.getElementById("evCover").src = `assets/img/event-${e.id}.webp`;
  document.getElementById("evCover").alt = e.title;
  document.getElementById("evDesc").innerHTML = e.desc.map(t => `<p>${t}</p>`).join("");

  // small gallery, a click opens the photo in a modal
  const imgs = [`event-${e.id}`, `event-${e.id}-1`, `event-${e.id}-2`];
  document.getElementById("evGallery").innerHTML = imgs.map((src, i) => `
    <div class="col-4">
      <img src="assets/img/${src}.webp" class="img-fluid rounded gallery-img" alt="صورة ${i + 1} من ${e.title}" data-src="assets/img/${src}.webp">
    </div>`).join("");
  const imgModal = new bootstrap.Modal(document.getElementById("imgModal"));
  document.getElementById("evGallery").addEventListener("click", ev => {
    const img = ev.target.closest(".gallery-img");
    if (!img) return;
    document.getElementById("imgModalSrc").src = img.dataset.src;
    imgModal.show();
  });

  document.getElementById("evMap").src = `assets/img/map-${e.place}.webp`;
  document.getElementById("evMap").alt = "خريطة " + p.name;
  document.getElementById("evAddress").textContent = p.address;

  const bookBtn = document.getElementById("evBook");
  bookBtn.dataset.book = e.id;
  if (st.key === "ended") {
    bookBtn.disabled = true;
    bookBtn.textContent = "انتهت الفعالية";
  }

  // show the booking if the user booked before
  function showMyBooking() {
    const b = (store("bookings") || {})[e.id];
    document.getElementById("myBooking").innerHTML = b
      ? `<div class="alert alert-info small mb-0"><i class="bi bi-ticket-perforated"></i> لديك حجز لهذه الفعالية (${b.seats} مقعد) - رقم الحجز ${escapeHTML(b.code)}</div>`
      : "";
  }
  showMyBooking();
  document.addEventListener("booked", showMyBooking);

  // add to calendar: we build a small .ics file and download it
  document.getElementById("evCalendar").addEventListener("click", () => {
    const start = e.date.replace(/-/g, "") + "T" + e.time.replace(":", "") + "00";
    const endDay = new Date((e.end || e.date) + "T00:00:00");
    endDay.setDate(endDay.getDate() + (e.end ? 1 : 0));
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SVU Events Guide//AR",
      "BEGIN:VEVENT",
      "UID:svu-event-" + e.id + "@events-guide",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z",
      e.end ? "DTSTART;VALUE=DATE:" + e.date.replace(/-/g, "") : "DTSTART:" + start,
      e.end ? "DTEND;VALUE=DATE:" + endDay.toISOString().slice(0, 10).replace(/-/g, "") : "DURATION:PT2H",
      "SUMMARY:" + e.title,
      "LOCATION:" + p.name + " - " + p.address,
      "DESCRIPTION:" + e.short,
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "event-" + e.id + ".ics";
    a.click();
    showAlert(document.getElementById("evActionMsg"), "success", "تم تنزيل ملف التقويم، افتحه لإضافة الفعالية إلى تقويمك.");
  });

  // share: the share menu of the phone if it exists, if not we copy the link
  document.getElementById("evShare").addEventListener("click", async () => {
    const msg = document.getElementById("evActionMsg");
    if (navigator.share) {
      try { await navigator.share({ title: e.title, text: e.short, url: location.href }); } catch (err) { /* user closed it */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(location.href);
      showAlert(msg, "success", "تم نسخ رابط الفعالية، يمكنك مشاركته مع أصدقائك.");
    } catch (err) {
      showAlert(msg, "danger", "لم أستطع نسخ الرابط، انسخه من شريط العنوان.");
    }
  });

  // related events: same category first, then others
  const related = EVENTS.filter(x => x.id !== e.id)
    .sort((a, b) => (b.cat === e.cat) - (a.cat === e.cat) || a.date.localeCompare(b.date))
    .slice(0, 3);
  document.getElementById("relatedEvents").innerHTML = related.map(x => `
    <div class="col-12 col-md-4">
      <a href="event.html?id=${x.id}" class="related-card">
        <img src="assets/img/event-${x.id}.webp" alt="${x.title}" loading="lazy">
        <div>
          ${catBadge(x.cat)}
          <h3 class="h6 mt-1 mb-0">${x.title}</h3>
          <small class="text-muted-2">${formatDate(x.date)}</small>
        </div>
      </a>
    </div>`).join("");
}

/* ---------- contact page: form check ---------- */
function initContact() {
  const form = document.getElementById("contactForm");
  const msg = document.getElementById("contactMsg");
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // check one field and write the error under it
  function check(field) {
    const v = field.value.trim();
    let err = "";
    if (!v) err = "هذا الحقل مطلوب.";
    else if (field.name === "name" && v.length < 3) err = "الاسم قصير، اكتب 3 أحرف على الأقل.";
    else if (field.name === "email" && !emailRe.test(v)) err = "صيغة البريد غير صحيحة، مثال: name@example.com";
    else if (field.name === "message" && v.length < 10) err = "الرسالة قصيرة، اكتب 10 أحرف على الأقل.";
    field.classList.toggle("is-invalid", !!err);
    field.classList.toggle("is-valid", !err);
    field.nextElementSibling.textContent = err;
    return !err;
  }

  // form.name is the name of the form itself, so we take the inputs from form.elements
  const fields = [form.elements["name"], form.elements["email"], form.elements["message"]];
  fields.forEach(f => f.addEventListener("blur", () => check(f)));
  fields[2].addEventListener("input", () => {
    document.getElementById("msgCount").textContent = fields[2].value.length;
  });

  form.addEventListener("submit", ev => {
    ev.preventDefault();
    const ok = fields.map(check).every(Boolean);
    if (!ok) {
      showAlert(msg, "danger", "<i class='bi bi-exclamation-triangle'></i> لم يتم الإرسال، يرجى تصحيح الحقول المحددة باللون الأحمر.");
      return;
    }
    showAlert(msg, "success", `<i class="bi bi-check-circle"></i> شكراً ${escapeHTML(fields[0].value.trim())}، تم إرسال رسالتك بنجاح وسنرد عليك على البريد ${escapeHTML(fields[1].value.trim())}.`);
    form.reset();
    fields.forEach(f => f.classList.remove("is-valid"));
    document.getElementById("msgCount").textContent = 0;
  });
}

/* ---------- start ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initScrollTop();
  initBooking();
  document.getElementById("year").textContent = new Date().getFullYear();

  const page = document.body.dataset.page;
  if (page === "home") initHome();
  if (page === "events") initEvents();
  if (page === "event") initEventPage();
  if (page === "contact") initContact();
});
