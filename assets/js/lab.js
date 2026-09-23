/* =============================================================================
   AEGIS-PX — lab.js  (loaded only by description.html)
   The "Degradation Lab": a 2D-canvas simulation that makes the core research
   point visible — you can crank image quality down and the DETECTOR's
   confidence barely moves, while AEGIS-PX's predicted failure risk climbs.

   No Three.js here on purpose: this page must stay light, and a flat canvas
   communicates the idea faster than a 3D scene would.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.getElementById('lab-canvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');

  /* ---- state, bound to the controls in the HTML -------------------------- */
  var state = {
    severity: 45,          // 0–100 master slider
    condition: 'fog',      // fog | glare | blur | night
    level: 4,              // autonomy level: 2/3 → driver handback, 4/5 → safe stop
    running: false,
    frame: 0
  };

  var els = {
    severity: document.getElementById('lab-severity'),
    severityOut: document.getElementById('lab-severity-out'),
    confidence: document.getElementById('lab-confidence'),
    confidenceBar: document.getElementById('lab-confidence-bar'),
    risk: document.getElementById('lab-risk'),
    riskBar: document.getElementById('lab-risk-bar'),
    status: document.getElementById('lab-status'),
    statusText: document.getElementById('lab-status-text'),
    response: document.getElementById('lab-response'),
    live: document.getElementById('lab-live'),
    desc: document.getElementById('lab-canvas-desc')
  };

  /* ---- helpers ----------------------------------------------------------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* The model's own confidence: barely reacts to image quality. This is the
     "silent" part of the failure — it stays reassuringly high. */
  function detectorConfidence(sev) {
    return clamp(99.3 - sev * 0.045 + Math.sin(sev * 0.4) * 0.3, 94, 99.9);
  }

  /* AEGIS risk: reads internal activations, so it tracks degradation closely. */
  function aegisRisk(sev) {
    var t = Math.pow(sev / 100, 1.35);      // ease-in: risk accelerates late
    return clamp(4 + t * 93, 0, 99);
  }

  function statusFor(risk) {
    if (risk < 35) return { cls: 'status-ok', text: 'MONITORING', glyph: '●' };
    if (risk < 70) return { cls: 'status-warn', text: 'RISK ELEVATED', glyph: '▲' };
    return { cls: 'status-bad', text: 'INTERVENTION', glyph: '■' };
  }

  function responseFor(risk, level) {
    if (risk < 35) return level <= 3 ? 'Level ' + level + ' — hands on wheel, lane centered.'
                                     : 'Level ' + level + ' — full self-drive, nominal.';
    if (risk < 70) {
      return level <= 3
        ? 'Level 2–3 — alert raised, driver asked to retake control (handback).'
        : 'Level 4–5 — speed reduced, camera weight down, radar/lidar up.';
    }
    return level <= 3
      ? 'Level 2–3 — HANDOFF REQUIRED: audible + haptic takeover request.'
      : 'Level 4–5 — minimal-risk manoeuvre: pull over and stop safely.';
  }

  /* ---- readouts ---------------------------------------------------------- */
  function updateReadouts() {
    var conf = detectorConfidence(state.severity);
    var risk = aegisRisk(state.severity);
    var st = statusFor(risk);

    els.confidence.textContent = conf.toFixed(1) + '%';
    els.confidenceBar.style.width = conf + '%';
    els.confidenceBar.style.background = 'var(--safe)'; // confidence never worries

    els.risk.textContent = risk.toFixed(0) + '%';
    els.riskBar.style.width = risk + '%';
    els.riskBar.style.background =
      risk < 35 ? 'var(--safe)' : (risk < 70 ? 'var(--alert)' : 'var(--fail)');

    // Status uses a pill (colour + shape + text) so it never relies on colour.
    els.status.className = 'status-pill ' + st.cls;
    els.status.innerHTML = '<span aria-hidden="true">' + st.glyph + '</span> ' + st.text;
    els.statusText.textContent = st.text.toLowerCase() === 'monitoring'
      ? 'The detector is behaving normally.'
      : 'The detector still reports high confidence, but internal activations look wrong.';
    els.response.textContent = responseFor(risk, state.level);

    // One polite live region so screen-reader users get the same story.
    els.live.textContent =
      'Severity ' + state.severity + ' percent. Detector confidence ' + conf.toFixed(1) +
      ' percent. Aegis risk ' + risk.toFixed(0) + ' percent. Status ' + st.text + '.';

    els.desc.textContent =
      'Synthetic road view under ' + state.condition + ' at ' + state.severity +
      ' percent severity, with a detection box around the vehicle ahead.';
  }

  /* ---- drawing ----------------------------------------------------------- */
  function resize() {
    // Render at CSS size × DPR (capped at 2, same rule as the WebGL hero).
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    var sev = state.severity / 100;

    ctx.clearRect(0, 0, w, h);

    /* --- sky / horizon --------------------------------------------------- */
    var horizon = h * 0.46;
    var sky = ctx.createLinearGradient(0, 0, 0, horizon);
    if (state.condition === 'night') {
      sky.addColorStop(0, '#04060B');
      sky.addColorStop(1, '#0A121C');
    } else {
      sky.addColorStop(0, '#0A1520');
      sky.addColorStop(1, '#16303F');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon);

    /* --- road (simple one-point perspective) ------------------------------ */
    ctx.fillStyle = '#0C1219';
    ctx.beginPath();
    ctx.moveTo(w * 0.44, horizon);
    ctx.lineTo(w * 0.56, horizon);
    ctx.lineTo(w * 1.25, h);
    ctx.lineTo(w * -0.25, h);
    ctx.closePath();
    ctx.fill();

    // centre dashes, sized by depth (bigger = closer)
    ctx.fillStyle = 'rgba(233,239,245,0.75)';
    for (var i = 0; i < 9; i++) {
      var t = ((i / 9) + (state.frame * 0.004) % (1 / 9)) % 1; // scrolling = motion
      var z = Math.pow(t, 2.2);                                 // perspective curve
      var y = horizon + z * (h - horizon);
      var cw = 2 + z * 10;
      var ch = 4 + z * 26;
      ctx.fillRect(w / 2 - cw / 2, y, cw, ch);
    }

    /* --- the vehicle ahead (the thing being detected) --------------------- */
    var carW = w * 0.13, carH = carW * 0.62;
    var carX = w * 0.5 - carW / 2, carY = horizon + (h - horizon) * 0.24;
    ctx.fillStyle = '#1B2836';
    ctx.fillRect(carX, carY, carW, carH);
    ctx.fillStyle = '#2C3E52';
    ctx.fillRect(carX + carW * 0.14, carY + carH * 0.1, carW * 0.72, carH * 0.36);
    // tail lights
    ctx.fillStyle = '#FF5A6E';
    ctx.fillRect(carX + 4, carY + carH - 8, 12, 5);
    ctx.fillRect(carX + carW - 16, carY + carH - 8, 12, 5);

    /* --- detection box + label (stays green/confident at any severity) ---- */
    var pad = 12;
    var risk = aegisRisk(state.severity);
    var boxColor = risk < 70 ? 'rgba(91,228,155,0.95)' : 'rgba(255,90,110,0.95)';
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(carX - pad, carY - pad, carW + pad * 2, carH + pad * 2);

    // corner ticks — reads instantly as "object detector output"
    ctx.lineWidth = 4;
    [[carX - pad, carY - pad, 1, 1],
     [carX + carW + pad, carY - pad, -1, 1],
     [carX - pad, carY + carH + pad, 1, -1],
     [carX + carW + pad, carY + carH + pad, -1, -1]].forEach(function (c) {
      ctx.beginPath();
      ctx.moveTo(c[0] + c[2] * 16, c[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.lineTo(c[0], c[1] + c[3] * 16);
      ctx.stroke();
    });

    // label plate: the detector is confidently wrong
    var label = 'VEHICLE  ' + detectorConfidence(state.severity).toFixed(1) + '%';
    ctx.font = '600 12px "IBM Plex Mono", monospace';
    var lw = ctx.measureText(label).width + 16;
    ctx.fillStyle = 'rgba(6,9,15,0.9)';
    ctx.fillRect(carX - pad, carY - pad - 24, lw, 20);
    ctx.fillStyle = boxColor;
    ctx.fillText(label, carX - pad + 8, carY - pad - 10);

    /* --- degradation pass ------------------------------------------------ */
    ctx.save();

    if (state.condition === 'fog') {
      // layered soft bands read as depth-graded fog better than one flat fill
      for (var f = 0; f < 5; f++) {
        var a = sev * (0.10 + f * 0.055);
        ctx.fillStyle = 'rgba(203,214,224,' + a.toFixed(3) + ')';
        ctx.fillRect(0, horizon - 40 + f * 26, w, 60);
      }
      ctx.fillStyle = 'rgba(203,214,224,' + (sev * 0.28).toFixed(3) + ')';
      ctx.fillRect(0, 0, w, h);
    } else if (state.condition === 'glare') {
      var g = ctx.createRadialGradient(w * 0.72, horizon * 0.4, 0, w * 0.72, horizon * 0.4, w * 0.6);
      g.addColorStop(0, 'rgba(255,247,230,' + (0.15 + sev * 0.8).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,247,230,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (state.condition === 'blur') {
      // motion smear: repeated horizontal ghost copies of what we just drew
      ctx.globalAlpha = 0.28 * sev;
      for (var b = 1; b <= 6; b++) {
        ctx.drawImage(canvas, -b * 5 * sev, 0);
      }
      ctx.globalAlpha = 1;
    } else if (state.condition === 'night') {
      ctx.fillStyle = 'rgba(4,6,11,' + (0.25 + sev * 0.45).toFixed(3) + ')';
      ctx.fillRect(0, 0, w, h);
      // headlight hot-spot with blown-out bloom near the camera
      var hg = ctx.createRadialGradient(w * 0.5, h * 0.9, 0, w * 0.5, h * 0.9, w * 0.45);
      hg.addColorStop(0, 'rgba(255,250,235,' + (0.10 + sev * 0.35).toFixed(3) + ')');
      hg.addColorStop(1, 'rgba(255,250,235,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, w, h);
    }

    // sensor noise on top of every condition (grain grows with severity)
    var noiseCount = Math.floor(sev * 420);
    ctx.fillStyle = 'rgba(233,239,245,0.10)';
    for (var n = 0; n < noiseCount; n++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
    }

    ctx.restore();

    /* --- vignette, so the frame reads as a camera feed -------------------- */
    var vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  /* ---- animation loop (paused when off-screen or reduced motion) --------- */
  var rafId = null;
  function loop() {
    state.frame++;
    draw();
    rafId = requestAnimationFrame(loop);
  }
  function start() {
    if (reduced || rafId) { draw(); return; }  // reduced motion: draw once
    rafId = requestAnimationFrame(loop);
  }
  function stop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /* ---- wire up controls -------------------------------------------------- */
  if (els.severity) {
    els.severity.addEventListener('input', function () {
      state.severity = Number(els.severity.value);
      els.severityOut.textContent = state.severity + '%';
      updateReadouts();
      draw();
    });
  }

  var conditionInputs = document.querySelectorAll('input[name="lab-condition"]');
  Array.prototype.forEach.call(conditionInputs, function (input) {
    input.addEventListener('change', function () {
      state.condition = input.value;
      updateReadouts();
      draw();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('input[name="lab-level"]'), function (input) {
    input.addEventListener('change', function () {
      state.level = Number(input.value);
      updateReadouts();
    });
  });

  var reset = document.getElementById('lab-reset');
  if (reset) {
    reset.addEventListener('click', function () {
      state.severity = 20;
      state.condition = 'fog';
      state.level = 4;
      els.severity.value = '20';
      els.severityOut.textContent = '20%';
      document.querySelector('input[name="lab-condition"][value="fog"]').checked = true;
      document.querySelector('input[name="lab-level"][value="4"]').checked = true;
      updateReadouts();
      draw();
    });
  }

  /* ---- pause the canvas when it scrolls away (battery + CPU) ------------- */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.isIntersecting ? start() : stop(); });
    }, { threshold: 0.05 }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () {
    document.hidden ? stop() : start();
  });

  /* ---- boot -------------------------------------------------------------- */
  window.addEventListener('resize', function () {
    clearTimeout(window.__labResize);
    window.__labResize = setTimeout(resize, 150); // throttled resize
  });

  updateReadouts();
  resize();
  start();
})();
