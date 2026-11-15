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
