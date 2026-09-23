/* =============================================================================
   AEGIS-PX — site.js
   Shared behaviour for every page. Loaded as a CLASSIC script (not a module)
   on purpose: Chrome blocks `type="module"` files over file://, and this site
   must keep working when you double-click an .html file.

   Sections
     1. helpers + reduced-motion detection
     2. sticky header state
     3. mobile navigation (keyboard + screen-reader friendly)
     4. scroll reveals with a 2.5s failsafe
     5. smooth scrolling (Lenis) + scroll choreography (GSAP ScrollTrigger)
     6. micro-interactions: magnetic buttons, card tilt, cursor glow
     7. footer year
   ========================================================================== */
(function () {
  'use strict';

  /* 1 ────────────────────────────────────────────────────────────────────────
     Preferences. `reduced` means the user asked for calm motion in their OS,
     so we skip Lenis, the cursor glow, tilts and all GSAP choreography.
     ---------------------------------------------------------------------- */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* 2 ── Header: darker background once the page has scrolled a little. ----- */
  var header = $('[data-header]');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* 3 ── Mobile navigation -------------------------------------------------
     The panel is toggled with the `hidden` attribute, exposes aria-expanded
     on the button, closes on Escape, and returns focus to the trigger —
     the standard disclosure pattern keyboard users expect.
     ---------------------------------------------------------------------- */
  var toggle = $('[data-nav-toggle]');
  var panel = $('[data-nav-panel]');
  if (toggle && panel) {
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      toggle.setAttribute('aria-label', open ? 'Close main menu' : 'Open main menu');
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
    // Close after choosing a page so the next page doesn't inherit an open menu.
    $$('a', panel).forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    // Reset on resize past the breakpoint (the CSS hides the button there).
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 768) setOpen(false);
    });
  }

  /* 4 ── Scroll reveals ----------------------------------------------------
     Elements marked `.reveal` fade up when they enter the viewport, staggered
     by their `--d` delay (set with data-delay="120").

     Two safety nets so content can never get stuck invisible:
       • anything already on screen is revealed immediately
       • a 2.5s timer force-reveals EVERYTHING if the observer never fires
     ---------------------------------------------------------------------- */
  var revealables = $$('.reveal');
  var showAll = function () { revealables.forEach(function (el) { el.classList.add('is-visible'); }); };

  if (revealables.length) {
    if (reduced || !('IntersectionObserver' in window)) {
      showAll();
    } else {
      revealables.forEach(function (el) {
        var d = el.getAttribute('data-delay');
        if (d) el.style.setProperty('--d', d + 'ms');
      });

      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target); // one-shot; stop watching after reveal
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

      revealables.forEach(function (el) {
        // Already in the first viewport? Show it now rather than on scroll.
        if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
          el.classList.add('is-visible');
        } else {
          io.observe(el);
        }
      });

      window.setTimeout(showAll, 2500); // failsafe
    }
  }

  /* 5 ── Motion: Lenis smooth scroll + GSAP ScrollTrigger -----------------
     Every library is optional here — if a CDN is blocked the page still
     works, just without the choreography.
     ---------------------------------------------------------------------- */
  var hasGsap = typeof window.gsap !== 'undefined';
  var hasST = typeof window.ScrollTrigger !== 'undefined';
  var lenis = null;

  if (!reduced && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, // expo out
      smoothWheel: true
    });
    var raf = function (time) { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);

    // Keep ScrollTrigger in sync with the virtual scroll position.
    if (hasGsap && hasST) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.lagSmoothing(0);
    }
  }

  if (hasGsap && hasST && !reduced) {
    window.gsap.registerPlugin(window.ScrollTrigger);

    // 5a. Section headings: split into words and stagger them in on scroll.
    $$('[data-split]').forEach(function (heading) {
      var words = heading.textContent.trim().split(/\s+/);
      heading.textContent = '';
      words.forEach(function (w, i) {
        var span = document.createElement('span');
        span.className = 'split-word';
        span.textContent = w;
        heading.appendChild(span);
        if (i < words.length - 1) heading.appendChild(document.createTextNode(' '));
      });

      window.gsap.from(heading.querySelectorAll('.split-word'), {
        yPercent: 110,
        opacity: 0,
        duration: 0.85,
        ease: 'expo.out',
        stagger: 0.055,
        scrollTrigger: { trigger: heading, start: 'top 88%', once: true }
      });
    });

    // 5b. Gentle parallax on figures so the page has depth as you scroll.
    $$('[data-parallax]').forEach(function (el) {
      var amount = parseFloat(el.getAttribute('data-parallax')) || 40;
      window.gsap.fromTo(el, { y: amount }, {
        y: -amount,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6 }
      });
    });

    // 5c. Progress bar in the header for long documents (Description / Docs).
    var bar = $('[data-progress]');
    if (bar) {
      window.gsap.to(bar, {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 }
      });
    }
  }

  /* 6 ── Micro-interactions (fine pointers + motion allowed only) ---------- */
  if (!reduced && finePointer) {
    // 6a. Magnetic buttons: the control leans toward the pointer, then springs
    //      back on leave. Small (12px) so it feels precise, not gimmicky.
    $$('[data-magnetic]').forEach(function (el) {
      var strength = 12;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = ((e.clientX - r.left) / r.width - 0.5) * strength;
        var y = ((e.clientY - r.top) / r.height - 0.5) * strength;
        el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });

    // 6b. Card tilt + highlight origin. CSS reads --rx/--ry/--mx/--my.
    $$('.card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', ((px - 0.5) * 7).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - py) * 7).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', function () {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });

    // 6c. Cursor glow that trails the pointer with a little lag.
    var glow = document.createElement('div');
    glow.className = 'cursor-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);

    var gx = window.innerWidth / 2, gy = window.innerHeight / 2, tx = gx, ty = gy;
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      glow.classList.add('is-on');
    }, { passive: true });
    window.addEventListener('pointerleave', function () { glow.classList.remove('is-on'); });

    (function trail() {
      // exponential smoothing = trailing lag without a physics engine.
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      glow.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)';
      requestAnimationFrame(trail);
    })();
  }

  /* 7 ── Footer year (keeps the copyright current without editing 5 files) - */
  $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
})();
