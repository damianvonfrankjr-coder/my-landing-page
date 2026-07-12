/* Prime Reserve Planning — shared behaviour.
 * Three primitives only (see design.md): nav frost, mobile sheet, mailto form composer. */

(function () {
  "use strict";

  // Nav frost-on-scroll (rAF-throttled)
  var nav = document.querySelector(".nav");
  if (nav) {
    var ticking = false;
    var update = function () {
      nav.classList.toggle("is-scrolled", window.scrollY > 24);
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  // Mobile sheet
  var toggle = document.querySelector(".nav__toggle");
  var sheet = document.querySelector(".nav__sheet");
  if (toggle && sheet) {
    toggle.addEventListener("click", function () {
      var open = sheet.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Menu";
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sheet.classList.contains("is-open")) {
        sheet.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "Menu";
        toggle.focus();
      }
    });
  }

  // Static-host form handling: compose a pre-filled email.
  // No backend exists on a static deploy; the form says so in its helper text.
  document.querySelectorAll("form[data-mailto]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var lines = [];
      var data = new FormData(form);
      data.forEach(function (value, key) {
        if (String(value).trim() !== "") lines.push(key + ": " + value);
      });
      var subject = form.getAttribute("data-subject") || "Website enquiry";
      var href = "mailto:contact@primereserveplanning.com" +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(lines.join("\n"));
      window.location.href = href;
    });
  });
})();
