// Photo slider: the line follows the mouse as it moves over the photo (no
// click needed), or a finger dragging across it. The arrow keys work too.
// Left of the line is black and white, right of it is color.
(function () {
  var box = document.getElementById('compare');
  var handle = box && box.querySelector('.compare-handle');
  if (!box || !handle) return;

  var current = 50, target = 50, running = false;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function apply(pct) {
    box.style.setProperty('--pos', pct + '%');
    handle.setAttribute('aria-valuenow', Math.round(pct));
  }
  // Glide toward the target so the line moves smoothly instead of jumping.
  function tick() {
    var diff = target - current;
    if (reduce || Math.abs(diff) < 0.05) { current = target; apply(current); running = false; return; }
    current += diff * 0.22;
    apply(current);
    requestAnimationFrame(tick);
  }
  function setTarget(pct) {
    target = Math.max(0, Math.min(100, pct));
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  function fromEvent(e) {
    var r = box.getBoundingClientRect();
    setTarget(((e.clientX - r.left) / r.width) * 100);
  }

  var touching = false;
  box.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse') {
      touching = true;
      if (box.setPointerCapture) box.setPointerCapture(e.pointerId);
    }
    fromEvent(e);
  });
  box.addEventListener('pointermove', function (e) {
    // Mouse: just moving over the photo is enough. Touch/pen: while it is down.
    if (e.pointerType === 'mouse' || touching) fromEvent(e);
  });
  function stop() { touching = false; }
  box.addEventListener('pointerup', stop);
  box.addEventListener('pointercancel', stop);

  handle.addEventListener('keydown', function (e) {
    var step = e.shiftKey ? 10 : 4;
    if (e.key === 'ArrowLeft') { setTarget(target - step); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { setTarget(target + step); e.preventDefault(); }
    else if (e.key === 'Home') { setTarget(0); e.preventDefault(); }
    else if (e.key === 'End') { setTarget(100); e.preventDefault(); }
  });
})();


// Scroll morph: as you scroll down, the big "gala" wordmark melts and reshapes
// into the small badge in the top-left corner (and back again as you scroll up).
// The four letters each reshape into the badge outline and merge like liquid,
// then the real badge (with its white "g") fades in on top.
(function () {
  var wm = document.querySelector('.wordmark-img');
  var corner = document.querySelector('.corner-logo');
  if (!wm || !corner || !window.fetch) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var BLOB = 'M200.59 33.48C208.07 40.5025 206.987 50.535 213.74 57.9425C217.725 62.825 224.452 65.6975 230.002 68.935C234.182 71.415 237.6 74.8325 240.175 79.3425C245.407 88.61 248.49 99.7625 248.83 109.832C249.21 119.497 243.525 127.965 245.067 137.515C246.225 145.042 250.08 152.05 249.997 159.765C249.395 174.95 242.79 191.367 228.182 199.845L227.958 199.98C210.937 208.91 212.177 217.062 203.01 229.717C194.42 240.585 176.283 251.357 162.66 249.857C152.883 248.697 145.117 241.952 134.75 242.527C123.272 242.617 113.862 250.36 102.13 248.385C88.8725 246.692 72.6525 239.165 65.67 228.93C61.2225 222.492 60.3875 214.67 54.5825 208.81C48.435 202.217 38.19 199.395 32.305 192.647C24.1225 183.397 18.9525 167.913 20.175 156.073C21.0225 148.617 25.385 141.807 25.305 134.215C25.38 127.087 22.0125 120.205 20.9475 113.152C18.6425 99.2325 24.765 83.1025 35.03 73.8325C50.785 61.6575 55.57 64.0825 60.97 44.5325C65.8175 29.915 85.255 18.78 104.057 20.2775C116.117 21.195 126.932 26.925 139.317 25.2775C147.105 24.6125 153.495 21.4025 161.07 20.3475C175.455 18.3925 191.873 24.9125 200.585 33.48L200.59 33.48Z';
  // On phones (touch screens) we keep it lighter: fewer points and no liquid blur,
  // because phones struggle to redraw a full-screen blur on every scroll tick.
  var coarse = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 800;
  var N = coarse ? 140 : 200, NH = coarse ? 28 : 40;      // points per outline / per hole
  var BADGE = { x: 62 / 320, y: 40 / 320, w: 194 / 320, h: 242 / 320 };  // badge inside its picture
  var VBW = 380, VBH = 397;                               // size of the wordmark drawing
  var NS = 'http://www.w3.org/2000/svg';

  var layer, svg, group, blur, letters = [], shapes = [], ready = false, queued = false;
  var range = 400, lastP = -1;   // how far you scroll for the full morph (fixed once measured)

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // Helpers for measuring outlines
  var meas = document.createElementNS(NS, 'svg');
  meas.setAttribute('width', '0'); meas.setAttribute('height', '0');
  meas.style.cssText = 'position:absolute;visibility:hidden';
  var mp = document.createElementNS(NS, 'path');
  meas.appendChild(mp);
  document.body.appendChild(meas);

  function sample(d, n) {
    mp.setAttribute('d', d);
    var L = mp.getTotalLength(), out = [];
    for (var i = 0; i < n; i++) { var p = mp.getPointAtLength(L * i / n); out.push([p.x, p.y]); }
    return out;
  }
  function area(pts) {
    var a = 0;
    for (var i = 0; i < pts.length; i++) {
      var q = pts[(i + 1) % pts.length];
      a += pts[i][0] * q[1] - q[0] * pts[i][1];
    }
    return a / 2;
  }
  function bounds(pts) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  // Line the target outline up with the letter so the shapes don't twist.
  function align(S, T) {
    var bs = bounds(S), bt = bounds(T), n = S.length, best = 0, bestCost = 1e30;
    var sw = Math.max(bs.w, bs.h), tw = Math.max(bt.w, bt.h);
    for (var s = 0; s < n; s++) {
      var cost = 0;
      for (var j = 0; j < n; j += 4) {
        var a = S[j], b = T[(j + s) % n];
        var dx = (a[0] - bs.cx) / sw - (b[0] - bt.cx) / tw, dy = (a[1] - bs.cy) / sw - (b[1] - bt.cy) / tw;
        cost += dx * dx + dy * dy;
      }
      if (cost < bestCost) { bestCost = cost; best = s; }
    }
    var out = [];
    for (var i = 0; i < n; i++) out.push(T[(i + best) % n]);
    return out;
  }

  function build(wordmarkDs) {
    // Measured once (not on every scroll): phone browsers resize the screen a little as
    // the address bar slides away, which used to make the morph jump.
    range = Math.max(320, Math.round(window.innerHeight * 0.55));
    lastP = -1;
    var r = wm.getBoundingClientRect();
    var k = r.height / VBH;
    var x0 = r.left + window.scrollX, y0 = r.top + window.scrollY;     // where it sits at the top of the page
    var cr = corner.getBoundingClientRect();
    var bx = cr.left + BADGE.x * cr.width, by = cr.top + BADGE.y * cr.height;
    var bw = BADGE.w * cr.width, bh = BADGE.h * cr.height;

    // Badge outline, fitted into the badge's spot in the corner.
    var raw = sample(BLOB, N), rb = bounds(raw);
    var target = raw.map(function (p) {
      return [bx + (p[0] - rb.x0) / rb.w * bw, by + (p[1] - rb.y0) / rb.h * bh];
    });
    var center = [bx + bw / 2, by + bh / 2];

    letters = wordmarkDs.map(function (d) {
      var subs = d.match(/M[^M]+/g) || [d];
      var outerIdx = 0, outerLen = -1, polys = subs.map(function (sd, idx) {
        mp.setAttribute('d', sd);
        var len = mp.getTotalLength();
        if (len > outerLen) { outerLen = len; outerIdx = idx; }
        return sd;
      });
      var S = sample(subs[outerIdx], N).map(function (p) { return [x0 + p[0] * k, y0 + p[1] * k]; });
      var T = target.slice();
      if ((area(S) < 0) !== (area(T) < 0)) T.reverse();
      T = align(S, T);
      var holes = [];
      subs.forEach(function (sd, idx) {
        if (idx === outerIdx) return;
        var H = sample(sd, NH).map(function (p) { return [x0 + p[0] * k, y0 + p[1] * k]; });
        holes.push({ S: H, c: center });
      });
      return { S: S, T: T, holes: holes };
    });

    // One path per letter.
    shapes.forEach(function (el) { el.remove(); });
    shapes = letters.map(function () {
      var el = document.createElementNS(NS, 'path');
      el.setAttribute('fill', '#212121');
      group.appendChild(el);
      return el;
    });
  }

  function update() {
    queued = false;
    if (!ready) return;
    var y = window.scrollY;
    var p = clamp(y / range);
    if (p === lastP) return;      // nothing changed since the last redraw
    lastP = p;

    if (p <= 0.002) {                       // at the very top: show the real wordmark
      svg.style.display = 'none';
      wm.style.visibility = '';
      corner.style.opacity = 0;
      return;
    }
    svg.style.display = '';
    wm.style.visibility = 'hidden';

    var goo = Math.sin(p * Math.PI);
    if (!coarse && p > 0.03 && p < 0.97) {
      blur.setAttribute('stdDeviation', (4 * goo).toFixed(2));
      group.setAttribute('filter', 'url(#morph-goo)');
    } else {
      group.removeAttribute('filter');
    }

    letters.forEach(function (L, i) {
      var pi = clamp((p - i * 0.05) / 0.85);
      var e = easeInOut(pi), wob = Math.sin(e * Math.PI) * 6;
      var d = '';
      L.S.forEach(function (a, j) {
        var b = L.T[j];
        var x = a[0] + (b[0] - a[0]) * e + wob * Math.sin(j * 0.31 + i * 1.7 + p * 6);
        var yy = a[1] + (b[1] - a[1]) * e + wob * Math.cos(j * 0.27 + i * 1.3 + p * 6);
        d += (j ? 'L' : 'M') + x.toFixed(1) + ' ' + yy.toFixed(1);
      });
      d += 'Z';
      L.holes.forEach(function (h) {
        h.S.forEach(function (a, j) {
          var x = a[0] + (h.c[0] - a[0]) * e, yy = a[1] + (h.c[1] - a[1]) * e;
          d += (j ? 'L' : 'M') + x.toFixed(1) + ' ' + yy.toFixed(1);
        });
        d += 'Z';
      });
      shapes[i].setAttribute('d', d);
    });

    // The real badge (with its white "g") fades in as the shapes settle.
    var f = clamp((p - 0.86) / 0.14);
    corner.style.opacity = f * f * (3 - 2 * f);
  }

  function request() {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }

  function setup(text) {
    var ds = [], m, re = /<path d="([^"]+)"/g;
    while ((m = re.exec(text))) ds.push(m[1]);
    if (!ds.length) return;

    // A fixed layer on top of the page: the morphing shapes plus the corner badge.
    layer = document.createElement('div');
    layer.className = 'morph-layer';
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      '<defs><filter id="morph-goo" color-interpolation-filters="sRGB" x="-20%" y="-20%" width="140%" height="140%">' +
      '<feGaussianBlur in="SourceGraphic" stdDeviation="0" result="b"/>' +
      '<feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -4.5"/>' +
      '</filter></defs><g></g>';
    layer.appendChild(svg);
    group = svg.querySelector('g');
    blur = svg.querySelector('feGaussianBlur');
    layer.appendChild(corner);                 // move the corner badge into the layer
    document.body.appendChild(layer);
    corner.style.opacity = 0;

    build(ds);
    ready = true;
    update();

    window.addEventListener('scroll', request, { passive: true });
    var t;
    var lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      // Only start over when the WIDTH changes (a rotated phone, a resized window).
      // A height-only change is just the phone's address bar sliding in or out.
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(t);
      t = setTimeout(function () {
        build(ds);
        update();
      }, 150);
    });
  }

  var go = function () {
    fetch(wm.currentSrc || wm.src).then(function (r) { return r.text(); }).then(setup).catch(function () {});
  };
  if (wm.complete) go(); else wm.addEventListener('load', go);
})();


// Browse. Book. Done.: while you scroll through this section, the three big words
// light up one at a time and the phone changes to match. Without this script (or
// with reduced motion) the words and phones simply sit one after another.
(function () {
  var sec = document.getElementById('steps');
  if (!sec) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var words = Array.prototype.slice.call(sec.querySelectorAll('.step-word'));
  var phones = Array.prototype.slice.call(sec.querySelectorAll('.phone-frame'));
  var count = Math.min(words.length, phones.length);
  if (!count) return;

  sec.classList.add('is-live');
  sec.setAttribute('data-step', '0');
  var current = -1, queued = false;

  function update() {
    queued = false;
    var r = sec.getBoundingClientRect();
    var total = sec.offsetHeight - window.innerHeight;
    var p = total > 0 ? Math.max(0, Math.min(1, -r.top / total)) : 0;
    var step = Math.min(count - 1, Math.floor(p * count));
    if (step === current) return;
    current = step;
    sec.setAttribute('data-step', String(step));
    words.forEach(function (w, i) { w.classList.toggle('is-active', i === step); });
    phones.forEach(function (f, i) { f.classList.toggle('is-active', i === step); });
  }
  function request() { if (!queued) { queued = true; requestAnimationFrame(update); } }

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
})();

