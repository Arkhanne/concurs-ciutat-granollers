/* Concurs Ciutat de Granollers — interaccions: menú mòbil, fase en curs, calendari, filtres del palmarès */
(function () {
  "use strict";

  var data = {};
  try { data = JSON.parse(document.getElementById("site-data").textContent); } catch (e) { /* sense dades */ }
  var t = data.t || {};

  // Data d'avui en format AAAA-MM-DD (hora local)
  var now = new Date();
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var today = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
  var daysBetween = function (iso) {
    var p = iso.split("-");
    var target = new Date(+p[0], +p[1] - 1, +p[2]);
    var base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target - base) / 86400000);
  };
  var fmt = function (iso) {
    var p = iso.split("-"), d = +p[2], m = data.months[+p[1] - 1], y = p[0];
    if (data.lang === "en") return d + " " + m + " " + y;
    if (data.lang === "ca") return d + " " + (/^[aeiou]/.test(m) ? "d’" : "de ") + m + " de " + y;
    return d + " de " + m + " de " + y;
  };

  // Menú mòbil
  var toggle = document.querySelector(".menu-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.querySelectorAll(".nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("menu-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Aparició suau en fer scroll
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  // Fase en curs i proper pas
  var next = null;
  (data.milestones || []).some(function (m) { if (m.date >= today) { next = m; return true; } return false; });
  var phase = null;
  (data.phases || []).forEach(function (p) { if (p.from <= today) phase = p; });
  document.querySelectorAll("[data-status]").forEach(function (box) {
    if (phase) {
      box.querySelector("[data-status-title]").textContent = phase.title;
      box.querySelector("[data-status-text]").textContent = phase.text;
    }
    var nextEl = box.querySelector("[data-status-next]");
    var countEl = box.querySelector("[data-status-count]");
    if (next) {
      nextEl.innerHTML = "";
      nextEl.appendChild(document.createTextNode(t.next + ": "));
      var b = document.createElement("b");
      b.textContent = next.title;
      nextEl.appendChild(b);
      nextEl.appendChild(document.createTextNode(" · " + fmt(next.date)));
      var n = daysBetween(next.date);
      countEl.textContent = n === 0 ? t.today : n === 1 ? t.tomorrow : t["in"] + " " + n + " " + t.days;
    } else {
      nextEl.textContent = t.none || "";
      countEl.textContent = "";
    }
  });

  // Línies de temps: fites fetes i propera fita
  document.querySelectorAll("[data-timeline]").forEach(function (list) {
    var items = Array.prototype.slice.call(list.querySelectorAll("[data-date]"));
    var nextIdx = -1;
    items.forEach(function (li, i) {
      var d = li.getAttribute("data-date");
      li.classList.toggle("is-done", d < today);
      if (nextIdx === -1 && d >= today) nextIdx = i;
    });
    if (nextIdx > -1) items[nextIdx].classList.add("is-next");
    // A la portada només mostrem l'última fita feta i les quatre següents
    if (list.classList.contains("mini-timeline")) {
      var start = nextIdx === -1 ? items.length - 5 : Math.max(0, nextIdx - 1);
      items.forEach(function (li, i) { li.classList.toggle("is-hidden", i < start || i > start + 4); });
    }
  });

  // Estat de les inscripcions
  document.querySelectorAll("[data-reg]").forEach(function (box) {
    var open = data.regOpen <= today && today <= data.regClose;
    box.classList.toggle("is-closed", !open);
    var state = box.querySelector("[data-reg-state]");
    if (state) state.textContent = open ? t.open : (today < data.regOpen ? t.closed + " · " + t.soon : t.closed);
  });

  // Índex de les bases: marca la secció visible
  var tocLinks = document.querySelectorAll(".toc a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var tocIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && map[e.target.id]) {
          tocLinks.forEach(function (a) { a.classList.remove("is-active"); });
          map[e.target.id].classList.add("is-active");
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) tocIo.observe(el); });
  }

  // Palmarès: cerca i filtres
  var palmares = document.querySelector("[data-palmares]");
  if (palmares) {
    var search = document.querySelector("[data-palmares-search]");
    var count = document.querySelector("[data-palmares-count]");
    var filter = "all";
    var norm = function (s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
    var apply = function () {
      var q = norm(search.value.trim());
      var total = 0;
      palmares.querySelectorAll(".year").forEach(function (year) {
        var visible = 0;
        year.querySelectorAll(".game").forEach(function (g) {
          var role = g.getAttribute("data-role");
          var okFilter = filter === "all" ||
            (filter === "w" && (role === "w" || role === "e" || role === "kw" || role === "p")) ||
            (filter === "pub" && g.getAttribute("data-pub") === "1");
          var ok = okFilter && (!q || norm(g.getAttribute("data-search")).indexOf(q) > -1);
          g.classList.toggle("is-hidden", !ok);
          if (ok) visible++;
        });
        year.classList.toggle("is-hidden", visible === 0);
        total += visible;
      });
      count.textContent = total;
      palmares.querySelector(".empty").hidden = total > 0;
    };
    search.addEventListener("input", apply);
    document.querySelectorAll("[data-palmares-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        filter = btn.getAttribute("data-palmares-filter");
        document.querySelectorAll("[data-palmares-filter]").forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        apply();
      });
    });
  }
})();
