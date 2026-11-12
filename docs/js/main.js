// "Plan it your way" list: hovering (or tapping, or tabbing to) a line shows
// its photo and description.
(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('.plan-row'));
  if (!rows.length) return;

  function activate(row) {
    rows.forEach(function (r) { r.classList.toggle('is-active', r === row); });
  }

  rows.forEach(function (row) {
    row.addEventListener('mouseenter', function () { activate(row); });
    row.addEventListener('focus', function () { activate(row); });
    row.addEventListener('click', function () { activate(row); });
  });
})();


// "Browse. Book. Done." — made of dots that scatter and reform into the next
// word. Plays once when scrolled into view.
(function () {
  var title = document.getElementById('bbd');
  var canvas = title && title.querySelector('.bbd-canvas');
  if (!canvas || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var WORDS = ['Browse.', 'Book.', 'Done.'];
  var COUNT = 3600;
  var COLORS = ['#34408A', '#FFC400', '#008A4B', '#F25A0A', '#A8C8DC'];
  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0, fontPx = 0, wordPoints = [], particles = [];
  var started = false;

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function size() {
    fontPx = parseFloat(getComputedStyle(title).fontSize);
    W = title.clientWidth;
    H = Math.round(fontPx * 1.5);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Turn a word into a cloud of points by drawing it and sampling pixels.
  function sample(word) {
    var off = document.createElement('canvas');
    off.width = W; off.height = H;
    var o = off.getContext('2d');
    o.fillStyle = '#fff';
    o.font = '800 ' + fontPx + 'px Inter, sans-serif';
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    o.fillText(word, W / 2, H / 2 + fontPx * 0.04);
    var data = o.getImageData(0, 0, W, H).data, pts = [];
    var step = Math.max(2, Math.round(fontPx / 48));
    for (var y = 0; y < H; y += step) {
      for (var x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
      }
    }
    return shuffle(pts);
  }

  function build() {
    size();
    wordPoints = WORDS.map(sample);
    if (!particles.length) {
      for (var i = 0; i < COUNT; i++) {
        particles.push({
          x: Math.random() * W, y: Math.random() * H, fx: 0, fy: 0,
          sx: 0, sy: 0, tx: 0, ty: 0, delay: 0,
          color: COLORS[i % COLORS.length], t: 1
        });
      }
    }
  }

  // Send every dot from where it is now toward its spot in the next word,
  // swinging out wide on the way so the word seems to break apart.
  function goTo(index, duration, now) {
    var pts = wordPoints[index];
    particles.forEach(function (p, i) {
      var target = pts[i % pts.length];
      p.fx = p.x; p.fy = p.y;
      p.tx = target[0]; p.ty = target[1];
      var ang = Math.random() * Math.PI * 2, r = (0.3 + Math.random()) * fontPx * 0.9;
      p.sx = (p.fx + p.tx) / 2 + Math.cos(ang) * r;
      p.sy = (p.fy + p.ty) / 2 + Math.sin(ang) * r * 0.6;
      p.delay = (p.tx / W) * 0.25 + Math.random() * 0.1;
      p.t = 0;
    });
    transition = { start: now, duration: duration };
  }

  var transition = null;

  function frame(now) {
    ctx.clearRect(0, 0, W, H);
    var dot = Math.max(1.6, fontPx / 60);
    var moving = false;
    particles.forEach(function (p) {
      if (transition) {
        var raw = (now - transition.start) / transition.duration;
        var t = Math.min(1, Math.max(0, (raw - p.delay) / (1 - 0.35)));
        p.t = t;
        var u = 1 - ease(t), v = ease(t);
        p.x = u * u * p.fx + 2 * u * v * p.sx + v * v * p.tx;
        p.y = u * u * p.fy + 2 * u * v * p.sy + v * v * p.ty;
        if (t < 1) moving = true;
      }
      ctx.fillStyle = (p.t > 0 && p.t < 0.96) ? p.color : '#FFFFFF';
      ctx.fillRect(p.x - dot / 2, p.y - dot / 2, dot, dot);
    });
    if (transition && !moving) transition = null;
    requestAnimationFrame(frame);
  }

  function play() {
    var step = 0;
    function next() {
      goTo(step, 1500, performance.now());
      step++;
      if (step < WORDS.length) setTimeout(next, 1500 + 1100);
    }
    next();
  }

  function start() {
    if (started) return;
    started = true;
    build();
    requestAnimationFrame(frame);
    play();
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    if (!started) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      size(); wordPoints = WORDS.map(sample);
      var last = wordPoints[Math.min(WORDS.length - 1, Math.max(0, particles.__word || WORDS.length - 1))];
      particles.forEach(function (p, i) { var t = last[i % last.length]; p.x = t[0]; p.y = t[1]; p.t = 1; });
      transition = null;
    }, 200);
  });

  var ready = (document.fonts && document.fonts.ready) || Promise.resolve();
  ready.then(function () {
    title.classList.add('is-animated');
    new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { obs.disconnect(); start(); }
      });
    }, { threshold: 0.6 }).observe(title);
  });
})();
