/* The journey: Mount Fuji at sunset, a hiker climbing a switchback trail,
 * a flag at the summit. Drawn procedurally in SVG; a virtual camera
 * (cx, cy, S = size of the square that must fit on screen) frames the shots.
 *
 * GSAP tweens plain state objects (camera, hiker, pose); one ticker callback
 * turns that state into SVG transforms each frame. */
(function (NS) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var SUMMIT_Y = 228;

  function n(v) { return Math.round(v * 100) / 100; }
  function el(tag, attrs, parent) {
    var node = document.createElementNS(SVGNS, tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }
  function makeRng(seed) {
    return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function stops(grad, list) {
    list.forEach(function (s) {
      var a = { offset: s[0], 'stop-color': s[1] };
      if (s[2] !== undefined) a['stop-opacity'] = s[2];
      el('stop', a, grad);
    });
    return grad;
  }

  /* ── Mount Fuji geometry: concave slopes, flat crater top ─────────── */
  var LEFT = [[-420, 780], [330, 700], [446, SUMMIT_Y]];
  var RIGHT = [[554, SUMMIT_Y], [670, 700], [1420, 780]];
  function quad(c, t) {
    var u = 1 - t;
    return [u * u * c[0][0] + 2 * u * t * c[1][0] + t * t * c[2][0],
            u * u * c[0][1] + 2 * u * t * c[1][1] + t * t * c[2][1]];
  }
  // x of a slope at height y (sampled)
  function slopeX(curve, y) {
    var best = null, bd = 1e9;
    for (var t = 0; t <= 1.0001; t += 0.004) {
      var p = quad(curve, t), d = Math.abs(p[1] - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best[0];
  }
  var CRATER = 'L462 222 L476 230 L492 223 L508 229 L522 221 L538 228';
  var MOUNTAIN_D = 'M-420 780 Q330 700 446 ' + SUMMIT_Y + ' ' + CRATER + ' L554 ' + SUMMIT_Y + ' Q670 700 1420 780 Z';

  // smooth path through points (Catmull-Rom → cubic Bézier)
  function smoothPath(pts) {
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ' C' + n(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + n(p1[1] + (p2[1] - p0[1]) / 6) +
        ' ' + n(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + n(p2[1] - (p3[1] - p1[1]) / 6) +
        ' ' + p2[0] + ' ' + p2[1];
    }
    return d;
  }

  function cloud(parent, cx, cy, w, h, rnd, grad) {
    var g = el('g', {}, parent);
    var count = Math.max(5, Math.round(w / (h * 0.7)));
    for (var i = 0; i < count; i++) {
      var u = i / (count - 1);
      var r = h * (0.45 + Math.sin(u * Math.PI) * 0.55) * (0.8 + rnd() * 0.4);
      el('circle', { cx: n(cx - w / 2 + u * w), cy: n(cy - r * 0.35), r: n(r), fill: 'url(#' + grad + ')' }, g);
    }
    el('ellipse', { cx: cx, cy: n(cy + h * 0.12), rx: n(w * 0.56), ry: n(h * 0.4), fill: 'url(#' + grad + ')' }, g);
    return g;
  }

  /* ── Sakura ─────────────────────────────────────────────────────────
   * A recursive, tapering branch skeleton; blossom clusters sit at the branch
   * tips as many small blooms in four tones (shadow → body → light →
   * highlight), lit from the upper side, plus tiny five-petal flowers on the
   * edges. Everything is merged into a few path elements per tree. */
  function circ(cx, cy, r) {
    return 'M' + n(cx - r) + ' ' + n(cy) + 'a' + n(r) + ' ' + n(r) + ' 0 1 0 ' + n(2 * r) + ' 0a' + n(r) + ' ' + n(r) + ' 0 1 0 ' + n(-2 * r) + ' 0';
  }

  function cherryTree(parent, x, y, scale, flip, rnd) {
    var g = el('g', { transform: 'translate(' + x + ' ' + y + ') scale(' + (flip ? -scale : scale) + ' ' + scale + ')' }, parent);
    var wood = ['', '', '', '', ''];     // branch paths by thickness level
    var tips = [];

    // tapered, slightly curved limb drawn as a filled quad strip
    function limb(x0, y0, x1, y1, w0, w1, bend) {
      var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
      var nx = -dy / L, ny = dx / L;
      var mx = (x0 + x1) / 2 + nx * bend, my = (y0 + y1) / 2 + ny * bend;
      return 'M' + n(x0 + nx * w0 / 2) + ' ' + n(y0 + ny * w0 / 2) +
        ' Q' + n(mx + nx * (w0 + w1) / 4) + ' ' + n(my + ny * (w0 + w1) / 4) + ' ' + n(x1 + nx * w1 / 2) + ' ' + n(y1 + ny * w1 / 2) +
        ' L' + n(x1 - nx * w1 / 2) + ' ' + n(y1 - ny * w1 / 2) +
        ' Q' + n(mx - nx * (w0 + w1) / 4) + ' ' + n(my - ny * (w0 + w1) / 4) + ' ' + n(x0 - nx * w0 / 2) + ' ' + n(y0 - ny * w0 / 2) + 'Z';
    }
    function grow(x0, y0, ang, len, w, depth) {
      var a = ang * Math.PI / 180;
      var x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
      var w1 = w * 0.66;
      wood[Math.min(depth, 4)] += limb(x0, y0, x1, y1, w, w1, (rnd() - 0.5) * len * 0.25);
      if (depth >= 2) tips.push({ x: x1, y: y1, s: depth >= 3 ? 1 : 1.25 });
      if (depth >= 4) return;
      var kids = depth === 0 ? 3 : 2 + (rnd() < 0.45 ? 1 : 0);
      for (var k = 0; k < kids; k++) {
        // umbrella habit: limbs spread sideways, then arch up and out
        var spread = depth === 0 ? (k - 1) * 42 : (k / Math.max(1, kids - 1) - 0.5) * 80;
        var na = ang + spread + (rnd() - 0.5) * 22;
        na = Math.max(-170, Math.min(-10, na));
        grow(x1, y1, na, len * (0.68 + rnd() * 0.14), w1, depth + 1);
      }
    }
    grow(0, 0, -90 + (rnd() - 0.5) * 8, 120, 30, 0);

    // blossom clusters
    var shade = '', body = '', lite = '', glow = '', flowers = '', eyes = '';
    tips.forEach(function (t) {
      var cr = (34 + rnd() * 22) * t.s;
      var count = Math.round(16 + cr * 0.32);
      for (var i = 0; i < count; i++) {
        var a = rnd() * Math.PI * 2, d = Math.sqrt(rnd());
        var px = t.x + Math.cos(a) * d * cr * 1.25;
        var py = t.y + Math.sin(a) * d * cr * 0.8 + d * cr * 0.18; // droop
        var r = 5 + rnd() * 9 * (1 - d * 0.4);
        // light from the upper side: tone by position inside the cluster
        var lit = -Math.sin(a) * d * 0.8 - Math.cos(a) * d * 0.3 + (rnd() - 0.5) * 0.6;
        shade += circ(px + 2, py + 3, r);
        if (lit > -0.35) body += circ(px, py, r * 0.92);
        if (lit > 0.15) lite += circ(px - r * 0.2, py - r * 0.25, r * 0.6);
        if (lit > 0.55) glow += circ(px - r * 0.3, py - r * 0.35, r * 0.3);
      }
      // individual five-petal flowers on the rim of the cluster
      for (i = 0; i < 4; i++) {
        var fa = rnd() * Math.PI * 2, fd = 0.75 + rnd() * 0.35;
        var fx = t.x + Math.cos(fa) * fd * cr * 1.2, fy = t.y + Math.sin(fa) * fd * cr * 0.8 + cr * 0.12;
        var fs = 3.2 + rnd() * 2.6, rot = rnd() * 72;
        for (var p = 0; p < 5; p++) {
          var pa = (rot + p * 72) * Math.PI / 180;
          flowers += circ(fx + Math.cos(pa) * fs * 0.62, fy + Math.sin(pa) * fs * 0.62, fs * 0.5);
        }
        eyes += circ(fx, fy, fs * 0.22);
      }
    });

    var woodCol = ['#2E1B27', '#33202C', '#3A2532', '#432B39', '#4C3140'];
    var layers = [[shade, '#B9578C', 1]];
    for (var lv = 0; lv < wood.length; lv++) if (wood[lv]) layers.push([wood[lv], woodCol[lv], 1]);
    layers.push([body, '#EC93BE', 1], [lite, '#F8BFD8', 1], [glow, '#FFE3EF', 1], [flowers, '#FFE4F0', 0.92], [eyes, '#E27AA6', 1]);
    layers.forEach(function (L) { el('path', { d: L[0], fill: L[1], opacity: L[2] }, g); });
    bakeTree(g, layers, tips, scale);
    return g;
  }

  /* The trees never change, but the camera moves every frame: re-painting
   * thousands of tiny blossom shapes is expensive, so each tree is drawn once
   * into a bitmap (sharp enough for the widest shot on this screen) and the
   * vector version is swapped for an <image>. If anything fails, the vector
   * version simply stays. */
  // bake one tree at a time, shortly after start-up
  var bakeQueue = [];
  function runBakeQueue() {
    var job = bakeQueue.shift();
    if (job) { job(); setTimeout(runBakeQueue, 60); }
  }

  function bakeTree(g, layers, tips, scale) {
    var minX = -40, maxX = 40, minY = -40, maxY = 10;
    tips.forEach(function (t) {
      minX = Math.min(minX, t.x - 110); maxX = Math.max(maxX, t.x + 110);
      minY = Math.min(minY, t.y - 90); maxY = Math.max(maxY, t.y + 110);
    });
    var w = maxX - minX, h = maxY - minY;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var ppu = Math.min(2.5, Math.min(window.innerWidth, window.innerHeight) / 880 * dpr * scale * 1.2);
    ppu = Math.max(0.8, ppu);
    var markup = '<svg xmlns="' + SVGNS + '" viewBox="' + n(minX) + ' ' + n(minY) + ' ' + n(w) + ' ' + n(h) + '" width="' + Math.round(w * ppu) + '" height="' + Math.round(h * ppu) + '">' +
      layers.map(function (L) { return '<path d="' + L[0] + '" fill="' + L[1] + '" opacity="' + L[2] + '"/>'; }).join('') + '</svg>';
    bakeQueue.push(function () {
      try {
        var url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
        var img = new Image();
        img.onload = function () {
          try {
            var c = document.createElement('canvas');
            c.width = Math.round(w * ppu); c.height = Math.round(h * ppu);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            c.toBlob(function (blob) {
              if (!blob) return;
              var bmp = URL.createObjectURL(blob);
              var im = el('image', { x: n(minX), y: n(minY), width: n(w), height: n(h), preserveAspectRatio: 'none' });
              im.setAttribute('href', bmp);
              im.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', bmp);
              var probe = new Image();
              probe.onload = function () {
                while (g.firstChild) g.removeChild(g.firstChild);
                g.appendChild(im);
              };
              probe.src = bmp;
            }, 'image/png');
          } catch (e) { /* keep vectors */ }
        };
        img.src = url;
      } catch (e) { /* keep vectors */ }
    });
  }

  /* ── The hiker (side view, facing +x) ───────────────────────────────
   * Built as a small skeleton (hip → thigh → shin → foot, shoulder → upper
   * arm → forearm → hand) with tapered, shaded segments. The walk is driven
   * by keyframed joint curves of a real uphill gait. */

  // periodic Catmull-Rom through [phase, value] keys (phase 0..1)
  function curve(keys) {
    return function (t) {
      t = ((t % 1) + 1) % 1;
      var i = 0;
      while (i < keys.length - 1 && keys[i + 1][0] <= t) i++;
      var k0 = keys[(i - 1 + keys.length) % keys.length], k1 = keys[i], k2 = keys[(i + 1) % keys.length], k3 = keys[(i + 2) % keys.length];
      var t1 = k1[0], t2 = i + 1 < keys.length ? k2[0] : k2[0] + 1;
      var u = (t - t1) / ((t2 - t1) || 1);
      var p0 = k0[1], p1 = k1[1], p2 = k2[1], p3 = k3[1];
      return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
    };
  }
  // angles in degrees; negative = forward. Phase 0 = heel strike of that leg.
  var GAIT = {
    hip: curve([[0, -30], [0.15, -22], [0.4, -2], [0.6, 12], [0.72, -8], [0.87, -38], [0.95, -33]]),
    knee: curve([[0, 8], [0.12, 22], [0.4, 8], [0.6, 36], [0.73, 66], [0.88, 24], [0.96, 8]]),
    ankle: curve([[0, -12], [0.12, 0], [0.45, 8], [0.6, 28], [0.75, 6], [0.9, -6]])
  };

  function buildHiker(parent, defs) {
    var root = el('g', {}, parent);
    stops(el('radialGradient', { id: 'hk-contact' }, defs), [['0', '#1A0E22', 0.4], ['1', '#1A0E22', 0]]);
    el('ellipse', { cx: 2, cy: 4.5, rx: 15, ry: 3, fill: 'url(#hk-contact)' }, root); // contact shadow
    var flip = el('g', {}, root);
    // horizontal shading across a part: back side (−x) darker, sun side (+x) lit
    function shade(id, dark, mid, light) {
      stops(el('linearGradient', { id: id, x1: 0, y1: 0, x2: 1, y2: 0 }, defs), [['0', dark], ['0.55', mid], ['1', light]]);
      return 'url(#' + id + ')';
    }
    var C = {
      skin: shade('hk-skin', '#D9A486', '#F0C3A2', '#FAD7BC'),
      skinBack: shade('hk-skinb', '#C08A6E', '#D9A88A', '#E6B898'),
      jacket: shade('hk-jacket', '#33503A', '#4C7253', '#6F9672'),
      sleeveBack: shade('hk-sleeveb', '#2A4231', '#3A5A41', '#4C7253'),
      pants: shade('hk-pants', '#4A4134', '#6E6250', '#8C7E66'),
      pantsBack: shade('hk-pantsb', '#3B3329', '#51473A', '#62574A'),
      boot: shade('hk-boot', '#2C1F18', '#4A3324', '#6A4A34'),
      pack: shade('hk-pack', '#5C3E26', '#8A6240', '#A87A52'),
      hair: shade('hk-hair', '#24150F', '#3B2620', '#5A3A2C'),
      cap: shade('hk-cap', '#B4551F', '#E07B3F', '#F59A5C')
    };

    // tapered capsule hanging down from (0,0) to (0,len)
    function seg(p, len, w0, w1, fill, extra) {
      var a = w0 / 2, b = w1 / 2;
      var d = 'M' + n(-a) + ' 0 C' + n(-a * 1.08) + ' ' + n(len * 0.35) + ' ' + n(-b * 1.05) + ' ' + n(len * 0.7) + ' ' + n(-b) + ' ' + n(len) +
        ' A' + n(b) + ' ' + n(b) + ' 0 0 0 ' + n(b) + ' ' + n(len) +
        ' C' + n(b * 1.1) + ' ' + n(len * 0.7) + ' ' + n(a * 1.12) + ' ' + n(len * 0.35) + ' ' + n(a) + ' 0' +
        ' A' + n(a) + ' ' + n(a) + ' 0 0 0 ' + n(-a) + ' 0Z';
      return el('path', Object.assign({ d: d, fill: fill }, extra || {}), p);
    }
    function joint(p, x, y) {
      var g = el('g', {}, p);
      var j = el('g', {}, g);
      return { g: g, j: j, x: x, y: y };
    }
    function setJ(J, a) { J.g.setAttribute('transform', 'translate(' + n(J.x) + ' ' + n(J.y) + ') rotate(' + n(a) + ')'); }

    var THIGH = 21, SHIN = 20, HIP_Y = -44;
    function leg(front) {
      var hip = joint(flip, 0.5, HIP_Y);
      seg(hip.g, THIGH + 2, 9.5, 7.2, front ? C.pants : C.pantsBack);
      var knee = joint(hip.g, 0, THIGH);
      seg(knee.g, SHIN + 1, 7, 5.2, front ? C.pants : C.pantsBack);
      // knee crease and cuff of the trousers
      el('path', { d: 'M-2.6 1 Q0 3 2.8 1.2', fill: 'none', stroke: 'rgba(30,20,10,0.35)', 'stroke-width': 0.7 }, knee.g);
      var ankle = joint(knee.g, 0, SHIN);
      // boot: shaft, toe box, lug sole, laces
      var bt = ankle.g;
      el('path', { d: 'M-3.6 -4.5 L3.4 -4.5 L3.9 -0.8 Q8.6 -0.6 10.2 1.6 Q10.8 3.2 9.6 3.6 L-4.4 3.6 Q-5.2 1 -3.6 -4.5Z', fill: C.boot }, bt);
      el('path', { d: 'M-4.6 3.4 L9.8 3.4 L9.6 5 L-4.4 5Z', fill: '#1E1510' }, bt);
      el('path', { d: 'M-3.4 5 l1 1 1-1 1 1 1-1 1 1 1-1 1 1 1-1 1 1 1-1 1 1 1-1', fill: 'none', stroke: '#1E1510', 'stroke-width': 0.9 }, bt);
      el('path', { d: 'M3.2 -3.2 L5.4 -0.6 M2.6 -1.6 L4.4 0.6', stroke: '#D9C49A', 'stroke-width': 0.6, 'stroke-linecap': 'round' }, bt);
      el('path', { d: 'M-3.8 -4.6 L3.6 -4.6 L3.4 -3.4 L-3.8 -3.4Z', fill: '#5A4630' }, bt);
      return { hip: hip, knee: knee, ankle: ankle };
    }

    function arm(p, front) {
      var sh = joint(p, 0.5, -67.5);
      var sleeve = front ? C.jacket : C.sleeveBack;
      seg(sh.g, 13.5, 6.4, 5.2, sleeve);
      var el2 = joint(sh.g, 0, 12.5);
      seg(el2.g, 12, 5.2, 4.4, sleeve);
      el('rect', { x: -2.5, y: 10.2, width: 5, height: 2.2, rx: 1, fill: front ? '#2F4A35' : '#263B2C' }, el2.g); // cuff
      var wrist = joint(el2.g, 0, 12.6);
      // hand: palm + thumb, slightly cupped around the pole grip
      el('path', { d: 'M-2 -0.6 Q-2.6 3.4 -0.6 4.6 Q2 5 2.6 2.4 L2.4 -0.4 Q0 -1.2 -2 -0.6Z', fill: front ? C.skin : C.skinBack }, wrist.g);
      el('path', { d: 'M2.2 0.2 Q4 0.8 3.6 2.6', fill: 'none', stroke: front ? '#D9A486' : '#C08A6E', 'stroke-width': 1.3, 'stroke-linecap': 'round' }, wrist.g);
      return { sh: sh, el: el2, wrist: wrist };
    }

    // back limbs first, then body, then near limbs
    var backLeg = leg(false);
    var body = el('g', {}, flip);
    var backArm = arm(body, false);

    // backpack (on the back, −x): frame, lid, side bottle, sleeping roll
    el('path', { d: 'M-6 -72 Q-19 -73 -20 -64 L-20.5 -49 Q-20 -43 -12 -43 L-6 -44Z', fill: C.pack }, body);
    el('path', { d: 'M-7 -73.5 Q-18 -76 -20.5 -68 L-19.5 -64.5 Q-12 -67 -6.5 -66Z', fill: '#6E4A2E' }, body);
    el('path', { d: 'M-20 -57 L-20.5 -49 Q-19.5 -46 -15 -46 L-14.5 -55Z', fill: '#734F31' }, body);
    el('rect', { x: -24, y: -58, width: 4.6, height: 11, rx: 2, fill: '#4F86A8' }, body);
    el('rect', { x: -23.5, y: -60, width: 3.6, height: 2.4, rx: 0.8, fill: '#2E4D63' }, body);
    el('ellipse', { cx: -13, cy: -75.5, rx: 8.6, ry: 3.6, fill: '#C4664A' }, body);
    el('path', { d: 'M-17.5 -77.5 L-17.5 -73.5 M-8.5 -77.6 L-8.5 -73.4', stroke: '#8A3F2C', 'stroke-width': 1 }, body);

    // torso: fitted softshell jacket, waist, hem
    el('path', { d: 'M-6.2 -71 Q-1 -73.4 5 -71.5 Q9.6 -69.4 9.2 -63 Q8.2 -57 6.4 -52.5 Q6.2 -47 7.4 -41.5 L-6.6 -41.5 Q-5.4 -48 -5.8 -54 Q-7.4 -62 -6.2 -71Z', fill: C.jacket }, body);
    el('path', { d: 'M5.6 -71 Q9 -66 7.4 -59 Q6.4 -55 6 -52', fill: 'none', stroke: 'rgba(255,214,170,0.35)', 'stroke-width': 1 }, body); // sun rim light
    el('path', { d: 'M5 -70.5 Q7 -60 6.2 -42', fill: 'none', stroke: '#2B4431', 'stroke-width': 0.6 }, body);      // zipper
    el('path', { d: 'M-1 -56 L5.6 -56.6 L5.4 -54.6 L-1 -54.2Z', fill: '#3E5E45' }, body);                           // chest pocket flap
    el('path', { d: 'M-6.8 -43.6 L7.6 -43.6 L7.6 -40.8 L-6.8 -40.8Z', fill: '#2F4A35' }, body);                      // hem
    // hip belt and shoulder strap of the pack, crossing in front
    el('path', { d: 'M-12 -47.5 L8.2 -47 L8 -44.6 L-12 -45Z', fill: '#3A2A1E' }, body);
    el('rect', { x: 5.6, y: -48, width: 3, height: 3.8, rx: 0.6, fill: '#1E1510' }, body);
    el('path', { d: 'M-5 -72 Q4 -72 5.4 -64 Q6 -58 3.6 -48', fill: 'none', stroke: '#3A2A1E', 'stroke-width': 2.4 }, body);
    el('path', { d: 'M3.4 -58 L7 -58.4', stroke: '#1E1510', 'stroke-width': 1.2 }, body);                         // sternum strap

    // neck + head (profile facing +x)
    var head = el('g', {}, body);
    el('path', { d: 'M-0.6 -74 L4.2 -74 L4.6 -70.5 L-0.8 -70.5Z', fill: C.skinBack }, head);
    el('path', { d: 'M-3.2 -73.6 Q1.6 -76 6 -73.8 L6.4 -71.2 Q1.6 -72.6 -3.4 -70.8Z', fill: '#2F4A35' }, head);        // collar
    var pony = el('g', {}, head);
    // ponytail: thick, tapering, with a lighter strand
    el('path', { d: 'M0 0 C-5 1.5 -8.5 7 -8 14 C-7.6 19 -5.4 22.5 -3.4 24 C-4.4 19 -3.6 13 -1.2 8 C0.4 5 1.8 2.6 2.4 1.4Z', fill: C.hair }, pony);
    el('path', { d: 'M-1.6 3 C-5 7 -6 12 -5.2 18', fill: 'none', stroke: '#6A4636', 'stroke-width': 0.8, 'stroke-linecap': 'round' }, pony);
    el('rect', { x: -1.6, y: -1.4, width: 3.6, height: 2.6, rx: 1, fill: '#E07B3F', transform: 'rotate(-20)' }, pony); // hair tie
    // skull + face profile: forehead, nose, lips, chin, jaw
    el('path', { d: 'M-5.4 -80.5 Q-5.6 -86.8 1 -87.6 Q7.4 -88 8.6 -82.6 L8.8 -80.8 Q10.6 -78.4 10.8 -77.6 Q10.6 -77 9.4 -76.9 L9.6 -76 Q9 -75.5 9.6 -75 Q9 -74.4 9.2 -73.6 Q8.4 -72 5.6 -72.4 Q2.4 -72.6 0.6 -73.8 Q-4.8 -75.6 -5.4 -80.5Z', fill: C.skin }, head);
    el('path', { d: 'M1.6 -80.6 Q-0.4 -80.4 -0.2 -78.2 Q0.2 -76.6 1.8 -76.8', fill: '#E3AE8E', stroke: '#C98C6C', 'stroke-width': 0.5 }, head); // ear
    el('path', { d: 'M6.4 -80.2 Q7.4 -80.9 8.2 -80.1', fill: 'none', stroke: '#2B1B22', 'stroke-width': 0.8, 'stroke-linecap': 'round' }, head); // closed-ish eye
    el('path', { d: 'M8.1 -80.2 L8.9 -79.5 M7.6 -80.6 L8.2 -81.4', stroke: '#2B1B22', 'stroke-width': 0.4 }, head);    // lashes
    el('path', { d: 'M5.8 -82.4 Q7.2 -83.2 8.6 -82.6', fill: 'none', stroke: '#3B2620', 'stroke-width': 0.6 }, head);  // brow
    el('ellipse', { cx: 6.4, cy: -77.4, rx: 1.8, ry: 1.2, fill: '#F08DA6', opacity: 0.45 }, head);                    // blush
    el('path', { d: 'M9.3 -75.3 Q8.6 -75 8.2 -75.2', fill: 'none', stroke: '#B8575E', 'stroke-width': 0.7, 'stroke-linecap': 'round' }, head); // lips
    // hair under the cap: side, nape, wisp over the ear
    el('path', { d: 'M-5.6 -80 Q-6.2 -84.4 -2.6 -85.6 L2.8 -85 Q1 -82.6 1.4 -80.8 Q-1.6 -79.6 -1.2 -76 Q-3.8 -76.6 -5.6 -80Z', fill: C.hair }, head);
    el('path', { d: 'M3.6 -84.8 Q4 -81.8 2.8 -80.2', fill: 'none', stroke: '#3B2620', 'stroke-width': 0.9, 'stroke-linecap': 'round' }, head);
    // cap: crown with panels, button, curved brim
    el('path', { d: 'M-5.8 -83.4 Q-5.2 -91.2 2 -91.2 Q8.4 -90.8 9.2 -84.2 Q2 -85.6 -5.8 -83.4Z', fill: C.cap }, head);
    el('path', { d: 'M1.6 -91 Q2.6 -87.6 2.4 -84.8', fill: 'none', stroke: '#B4551F', 'stroke-width': 0.5 }, head);
    el('circle', { cx: 1.8, cy: -91.2, r: 0.8, fill: '#B4551F' }, head);
    el('path', { d: 'M7.6 -84.8 Q12.4 -85.6 16 -83.4 Q15.6 -82.4 13.4 -82.4 Q10.4 -82.8 8 -82.8Z', fill: '#B95A2A' }, head);
    pony.setAttribute('transform', 'translate(-5 -82)');

    var frontLeg = leg(true);
    var frontArm = arm(body, true);
    // trekking pole held in the near hand
    var pole = el('g', {}, frontArm.wrist.g);
    el('line', { x1: 0, y1: -3, x2: 0, y2: 46, stroke: '#C9CCD8', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, pole);
    el('rect', { x: -1.3, y: -4, width: 2.6, height: 7, rx: 1, fill: '#2A2A33' }, pole);
    el('ellipse', { cx: 0, cy: 41.5, rx: 2.6, ry: 0.8, fill: '#2A2A33' }, pole);
    // draw order: back leg, body (+ back arm), near leg, near arm
    flip.appendChild(frontLeg.hip.g);
    body.appendChild(frontArm.sh.g);
    flip.appendChild(body);

    function legPose(L, ph, w, jumpTuck, standHip) {
      var h = lerp(standHip, GAIT.hip(ph), w), k = lerp(4, GAIT.knee(ph), w), a = lerp(0, GAIT.ankle(ph), w);
      h -= jumpTuck * 20; k += jumpTuck * 34;
      setJ(L.hip, h); setJ(L.knee, k);
      // foot: counter-rotate so it stays near the ground line, plus the ankle roll
      setJ(L.ankle, -(h + k) + a);
      // height of the sole below the hip (forward kinematics)
      var r = Math.PI / 180;
      return { h: h, y: THIGH * Math.cos(h * r) + SHIN * Math.cos((h + k) * r) + 5 };
    }

    return {
      root: root,
      pose: function (st) {
        var ph = st.phase / (Math.PI * 2), w = st.walk, up = st.armsUp;
        var tuck = Math.min(1, st.jump / 9) * up;
        var nearL = legPose(frontLeg, ph, w, tuck, -6), farL = legPose(backLeg, ph + 0.5, w, tuck * 0.8, 6);
        var nearH = nearL.h, farH = farL.h;
        // keep the lower foot on the ground: this also gives the natural bounce of the walk
        var bob = -HIP_Y - Math.max(nearL.y, farL.y);
        // uphill lean while walking, upright and proud at the top
        var lean = 11 * w * (1 - up);
        body.setAttribute('transform', 'rotate(' + n(lean) + ' 0 -44)');
        // arms swing opposite to the legs; at the summit both go up in a V
        // summit: near arm in a forward fist-pump, far arm straight up
        var nearA = lerp(farH * 0.75 - 6, -122, up);
        var farA = lerp(nearH * 0.75 - 6, -172, up);
        var nearE = lerp(-28 - 12 * Math.max(0, -Math.sin(ph * 2 * Math.PI)), -26, up);
        var farE = lerp(-24, -8, up);
        setJ(frontArm.sh, nearA - lean * 0.6); setJ(frontArm.el, nearE);
        setJ(backArm.sh, farA - lean * 0.6); setJ(backArm.el, farE);
        setJ(frontArm.wrist, 0); setJ(backArm.wrist, 0);
        // pole: tip leads slightly ahead when the arm is forward, planted behind as it swings back
        var poleWorld = 8 + (nearA + 6) * 0.35;
        pole.setAttribute('transform', 'rotate(' + n(poleWorld - (lean + nearA - lean * 0.6 + nearE)) + ')');
        pole.setAttribute('opacity', n(1 - up));
        // ponytail lags behind the head bob, and bounces at the summit
        pony.setAttribute('transform', 'translate(-5 -82) rotate(' + n(6 + Math.sin(ph * 4 * Math.PI + 0.8) * 7 * w + up * 12 * Math.sin(st.t * 9)) + ')');
        flip.setAttribute('transform', 'translate(0 ' + n(bob) + ') scale(' + n(st.dir) + ' 1)');
        root.setAttribute('transform', 'translate(' + n(st.x) + ' ' + n(st.y - st.jump) + ') scale(' + n(st.scale) + ')');
        root.setAttribute('opacity', n(st.o));
      }
    };
  }

  NS.buildHiker = buildHiker; // exposed for tools/visual checks

  /* ── Public ───────────────────────────────────────────────────────── */
  NS.buildWorld = function (container, cfg) {
    cfg = cfg || {};
    var rnd = makeRng(cfg.seed || 5);
    var svg = el('svg', { xmlns: SVGNS, focusable: 'false', preserveAspectRatio: 'none' });
    var defs = el('defs', {}, svg);
    stops(el('linearGradient', { id: 'sky', x1: 0, y1: -700, x2: 0, y2: 790, gradientUnits: 'userSpaceOnUse' }, defs),
      [['0', '#141640'], ['0.3', '#33306A'], ['0.55', '#7C4C86'], ['0.75', '#D7798F'], ['0.9', '#F7A486'], ['1', '#FFCB8C']]);
    stops(el('radialGradient', { id: 'sunglow' }, defs),
      [['0', '#FFF1C9', 0.95], ['0.18', '#FFC98A', 0.7], ['0.5', '#FF9A84', 0.22], ['1', '#FF9A84', 0]]);
    stops(el('linearGradient', { id: 'ray', x1: 0, y1: 0, x2: 1, y2: 0 }, defs),
      [['0', '#FFE7B0', 0.55], ['1', '#FFE7B0', 0]]);
    stops(el('linearGradient', { id: 'fuji', x1: 160, y1: 0, x2: 960, y2: 0, gradientUnits: 'userSpaceOnUse' }, defs),
      [['0', '#22265A'], ['0.45', '#353370'], ['0.7', '#6E4B7E'], ['0.88', '#AE6574'], ['1', '#D9826E']]);
    stops(el('linearGradient', { id: 'haze', x1: 0, y1: 470, x2: 0, y2: 790, gradientUnits: 'userSpaceOnUse' }, defs),
      [['0', '#C98DA6', 0], ['1', '#E9A3A8', 0.75]]);
    stops(el('linearGradient', { id: 'snow', x1: 400, y1: 0, x2: 640, y2: 0, gradientUnits: 'userSpaceOnUse' }, defs),
      [['0', '#B9BDE6'], ['0.45', '#F4F2FF'], ['0.7', '#FFFFFF'], ['1', '#FFD2BC']]);
    stops(el('linearGradient', { id: 'cloudg', x1: 0, y1: 0, x2: 0, y2: 1 }, defs),
      [['0', '#FFF6EE'], ['0.55', '#F9D3CF'], ['1', '#D99AB1']]);
    stops(el('linearGradient', { id: 'cloudfar', x1: 0, y1: 0, x2: 0, y2: 1 }, defs),
      [['0', '#FFC7A8', 0.9], ['1', '#C87AA0', 0.5]]);
    stops(el('linearGradient', { id: 'lake', x1: 0, y1: 780, x2: 0, y2: 1500, gradientUnits: 'userSpaceOnUse' }, defs),
      [['0', '#F2A68E'], ['0.25', '#B06A8E'], ['0.6', '#4A3468'], ['1', '#1E1838']]);
    stops(el('linearGradient', { id: 'sunpath', x1: 0, y1: 0, x2: 0, y2: 1 }, defs),
      [['0', '#FFE2B0', 0.8], ['1', '#FFE2B0', 0]]);
    stops(el('linearGradient', { id: 'ground', x1: 0, y1: 0, x2: 0, y2: 1 }, defs),
      [['0', '#3A2840'], ['1', '#150F22']]);
    var snowClip = el('clipPath', { id: 'snowclip' }, defs);

    var cam = el('g', {}, svg);
    el('rect', { x: -4000, y: -4000, width: 9000, height: 4790, fill: 'url(#sky)' }, cam);
    // stars
    var stars = el('g', { fill: '#FFFFFF' }, cam);
    for (var i = 0; i < 70; i++) {
      el('circle', { cx: n(-900 + rnd() * 2800), cy: n(-1400 + rnd() * 1450), r: n(0.8 + rnd() * 1.8), opacity: n(0.25 + rnd() * 0.6) }, stars);
    }
    // sun with slowly turning rays
    var SUN = { x: 860, y: 610 };
    el('circle', { cx: SUN.x, cy: SUN.y, r: 560, fill: 'url(#sunglow)' }, cam);
    var rays = el('g', {}, cam);
    for (i = 0; i < 14; i++) {
      el('path', { d: 'M0 -6 L900 -30 L900 30 L0 6 Z', fill: 'url(#ray)', transform: 'rotate(' + n(i * 360 / 14 + rnd() * 8) + ')', opacity: n(0.25 + rnd() * 0.3) }, rays);
    }
    el('circle', { cx: SUN.x, cy: SUN.y, r: 44, fill: '#FFF5DC' }, cam);
    // high clouds
    var farClouds = el('g', {}, cam);
    [[-120, 120, 360, 40], [380, 40, 300, 30], [820, 160, 420, 46], [180, 330, 260, 26], [1180, 330, 300, 30]].forEach(function (c) {
      cloud(farClouds, c[0], c[1], c[2], c[3], rnd, 'cloudfar');
    });
    // distant ridges
    el('path', { d: 'M-1600 790 L-900 735 L-600 760 L-300 730 L-80 770 L1080 772 L1300 728 L1600 752 L2000 720 L2600 790 Z', fill: '#4E3B6E', opacity: 0.85 }, cam);

    // Fuji
    var fuji = el('g', {}, cam);
    el('path', { d: MOUNTAIN_D, fill: 'url(#fuji)' }, fuji);
    var ridges = el('g', { fill: 'none', stroke: 'rgba(255,220,230,0.07)', 'stroke-width': 3 }, fuji);
    for (i = -6; i <= 6; i++) {
      if (!i) continue;
      el('path', { d: 'M' + (500 + i * 7) + ' 240 Q' + n(500 + i * 40) + ' 480 ' + n(500 + i * 95 + (rnd() - 0.5) * 40) + ' 780' }, ridges);
    }
    // snow cap with streaks running down the ridges
    var snowPts = [];
    var SL = 392, SR = 378, xL = slopeX(LEFT, SL), xR = slopeX(RIGHT, SR), N = 22;
    for (i = 0; i <= N; i++) {
      var u = i / N, sx = lerp(xL, xR, u), base = lerp(SL, SR, u) - Math.sin(u * Math.PI) * 26;
      var sy = i === 0 || i === N ? base : base + (i % 2 ? 18 + rnd() * 58 : -8 + rnd() * 14);
      snowPts.push(n(sx) + ' ' + n(sy));
    }
    var snowD = 'M' + n(xL) + ' ' + SL;
    for (var y = SL; y >= SUMMIT_Y; y -= 12) snowD += ' L' + n(slopeX(LEFT, y)) + ' ' + y;
    snowD += ' L446 ' + SUMMIT_Y + ' ' + CRATER + ' L554 ' + SUMMIT_Y;
    for (y = SUMMIT_Y + 12; y <= SR; y += 12) snowD += ' L' + n(slopeX(RIGHT, y)) + ' ' + y;
    snowD += ' L' + snowPts.slice().reverse().join(' L') + ' Z';
    el('path', { d: snowD }, snowClip);
    el('path', { d: snowD, fill: 'url(#snow)' }, fuji);
    var snowRidges = el('g', { 'clip-path': 'url(#snowclip)', fill: 'none', stroke: 'rgba(120,110,180,0.2)', 'stroke-width': 1.8 }, fuji);
    for (i = -4; i <= 4; i++) {
      el('path', { d: 'M' + (500 + i * 9) + ' 234 Q' + n(500 + i * 30) + ' 330 ' + n(500 + i * 58 + (rnd() - 0.5) * 24) + ' 450' }, snowRidges);
    }
    el('path', { d: MOUNTAIN_D, fill: 'url(#haze)' }, fuji);

    // clouds hugging the mountain (drift)
    var midClouds = [];
    [[120, 742, 340, 46], [900, 560, 260, 40], [560, 752, 440, 50], [-200, 735, 380, 48], [1200, 745, 380, 48]].forEach(function (c, k) {
      var g = cloud(cam, c[0], c[1], c[2], c[3], rnd, 'cloudg');
      midClouds.push({ g: g });
    });

    // tree line and lake with the mountain's reflection
    var treeD = 'M-1600 800 L-1600 770';
    for (var tx = -1600; tx <= 2600; tx += 9 + rnd() * 10) treeD += ' L' + n(tx) + ' ' + n(778 - rnd() * 22) + ' L' + n(tx + 5) + ' 780';
    treeD += ' L2600 800 Z';
    el('rect', { x: -4000, y: 790, width: 9000, height: 3000, fill: 'url(#lake)' }, cam);
    var refl = el('g', { transform: 'translate(0 1592) scale(1 -1)', opacity: 0.26 }, cam);
    el('path', { d: MOUNTAIN_D, fill: '#2E2C62' }, refl);
    el('path', { d: snowD, fill: '#F6E9F2' }, refl);
    el('rect', { x: SUN.x - 40, y: 796, width: 80, height: 420, fill: 'url(#sunpath)', opacity: 0.55 }, cam);
    var shimmer = el('g', { stroke: 'rgba(255,230,210,0.35)', 'stroke-width': 2, 'stroke-linecap': 'round' }, cam);
    for (i = 0; i < 40; i++) {
      var ly = 810 + rnd() * 420, lx = -200 + rnd() * 1400, lw = 10 + rnd() * 50;
      el('line', { x1: n(lx), y1: n(ly), x2: n(lx + lw), y2: n(ly) }, shimmer);
    }
    el('path', { d: treeD, fill: '#211A38' }, cam);

    // trail
    var TRAIL = cfg.trail || [[240, 690], [640, 600], [360, 500], [600, 402], [468, 300], [496, 230]];
    var trailD = smoothPath(TRAIL);
    el('path', { d: trailD, fill: 'none', stroke: 'rgba(255,236,220,0.28)', 'stroke-width': 3, 'stroke-dasharray': '2 7', 'stroke-linecap': 'round' }, cam);
    var walked = el('path', { d: trailD, fill: 'none', stroke: 'rgba(255,214,150,0.85)', 'stroke-width': 3, 'stroke-dasharray': '2 7', 'stroke-linecap': 'round' }, cam);
    svg.style.visibility = 'hidden';
    container.appendChild(svg);
    var trailLen = walked.getTotalLength();
    var mask = el('path', { d: trailD, fill: 'none', stroke: '#fff', 'stroke-width': 10 }, null);
    var trailMaskId = 'walkmask';
    var m = el('mask', { id: trailMaskId, maskUnits: 'userSpaceOnUse' }, defs);
    mask.setAttribute('stroke-dasharray', n(trailLen) + ' ' + n(trailLen + 10));
    m.appendChild(mask);
    walked.setAttribute('mask', 'url(#' + trailMaskId + ')');

    // flag at the summit
    var flag = el('g', {}, cam);
    el('line', { x1: 0, y1: 0, x2: 0, y2: -52, stroke: '#EDE6F2', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, flag);
    var cloth = el('g', {}, flag);
    el('path', { d: 'M1 -51 Q14 -55 26 -49 Q38 -44 44 -47 L44 -27 Q36 -24 26 -29 Q14 -34 1 -31 Z', fill: '#F07AA8' }, cloth);
    el('path', { d: 'M22 -40 C22 -44 17 -45 16 -41 C15 -45 10 -44 10 -40 C10 -36 16 -33 16 -33 C16 -33 22 -36 22 -40 Z', fill: '#FFFFFF' }, cloth);

    // hiker
    var hiker = buildHiker(cam, defs);

    // foreground: ground and cherry trees framing the lake
    el('path', { d: 'M-2000 1290 C-600 1240 -200 1280 300 1305 C700 1325 1100 1270 2800 1290 L2800 3000 L-2000 3000 Z', fill: 'url(#ground)' }, cam);
    // reeds along the shore
    var reedD = '';
    for (var rx = -1400; rx < 2400; rx += 7 + rnd() * 9) {
      var rh = 30 + rnd() * 60, lean = (rnd() - 0.5) * 18;
      reedD += 'M' + n(rx) + ' 1300 Q' + n(rx + lean * 0.4) + ' ' + n(1300 - rh * 0.6) + ' ' + n(rx + lean) + ' ' + n(1300 - rh) + ' ';
    }
    el('path', { d: reedD, fill: 'none', stroke: '#2C1E35', 'stroke-width': 3, 'stroke-linecap': 'round' }, cam);
    cherryTree(cam, -330, 1300, 1.5, false, rnd);
    cherryTree(cam, 1330, 1305, 1.5, true, rnd);
    cherryTree(cam, 40, 1310, 1.35, false, rnd);
    cherryTree(cam, 960, 1320, 1.3, true, rnd);

    /* ── state ─────────────────────────────────────── */
    var W = 1, H = 1;
    var state = {
      cam: { cx: 500, cy: 470, S: 1250, follow: 0 },
      hiker: { dist: 0, o: 0, scale: 1, walk: 0, armsUp: 0, jump: 0 },
      flag: { s: 0, wave: 0 },
      t: 0
    };
    var smooth = { x: TRAIL[0][0], y: TRAIL[0][1], dir: 1 };
    var pose = { phase: 0, walk: 0, armsUp: 0, dir: 1, x: 0, y: 0, jump: 0, scale: 1, o: 0, t: 0 };
    var k = 1, ox = 0, oy = 0;

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    }

    function hikerPoint(d) {
      var p = walked.getPointAtLength(Math.max(0, Math.min(trailLen, d)));
      var p2 = walked.getPointAtLength(Math.max(0, Math.min(trailLen, d + 4)));
      return { x: p.x, y: p.y, dx: p2.x - p.x };
    }

    var lastT = 0;
    function update() {
      var now = performance.now() / 1000;
      var dt = Math.min(0.05, lastT ? now - lastT : 0.016);
      lastT = now;
      state.t += dt;

      var h = state.hiker;
      var hp = hikerPoint(h.dist);
      if (Math.abs(hp.dx) > 0.2) smooth.dir += ((hp.dx > 0 ? 1 : -1) - smooth.dir) * Math.min(1, dt * 9);
      pose.phase = h.dist / 58 * Math.PI * 2;
      pose.walk = h.walk; pose.armsUp = h.armsUp; pose.jump = h.jump;
      pose.dir = Math.abs(smooth.dir) < 0.08 ? (smooth.dir < 0 ? -0.08 : 0.08) : smooth.dir;
      pose.x = hp.x; pose.y = hp.y; pose.scale = h.scale; pose.o = h.o; pose.t = state.t;
      hiker.pose(pose);
      mask.setAttribute('stroke-dashoffset', n(trailLen - h.dist));

      // camera: blend the scripted shot with "follow the hiker" (lagged)
      smooth.x += (hp.x - smooth.x) * Math.min(1, dt * 3.5);
      smooth.y += (hp.y - smooth.y) * Math.min(1, dt * 3.5);
      var c = state.cam;
      var cx = lerp(c.cx, smooth.x, c.follow), cy = lerp(c.cy, smooth.y - 30, c.follow);
      k = Math.min(W, H) / c.S;
      ox = W / 2 - cx * k; oy = H / 2 - cy * k;
      cam.setAttribute('transform', 'translate(' + n(ox) + ' ' + n(oy) + ') scale(' + n(k * 1000) / 1000 + ')');

      // ambient motion
      rays.setAttribute('transform', 'translate(' + SUN.x + ' ' + SUN.y + ') rotate(' + n(state.t * 2.2) + ')');
      for (var i = 0; i < midClouds.length; i++) {
        var mc = midClouds[i];
        mc.g.setAttribute('transform', 'translate(' + n(Math.sin(state.t * 0.09 + i) * 40) + ' 0)');
      }
      var f = state.flag;
      flag.setAttribute('transform', 'translate(522 ' + (SUMMIT_Y + 1) + ') scale(' + n(f.s) + ')');
      cloth.setAttribute('transform', 'skewY(' + n(Math.sin(state.t * 6) * 4 * f.wave) + ')');
    }

    resize();
    window.addEventListener('resize', resize);
    setTimeout(runBakeQueue, 50);
    gsap.ticker.add(update);
    update();
    svg.style.visibility = '';

    function timeline(reduced) {
      var tl = gsap.timeline({ paused: true });
      var c = state.cam, h = state.hiker, f = state.flag;
      var CLIMB = cfg.climbDuration || 12;
      // portrait screens see much more height: frame lower so the lake and trees fill it
      var OPEN = H > W ? { cy: 600, S: 900 } : { cy: 520, S: 1000 };
      if (reduced) {
        tl.set(c, { cx: 500, cy: 175, S: 540, follow: 0 }, 0)
          .set(h, { dist: trailLen, o: 1, walk: 0, armsUp: 1, scale: 1 }, 0)
          .set(f, { s: 1, wave: 0.3 }, 0)
          .addLabel('summit', 1.2)
          .to({}, { duration: 2.4 });
        return tl;
      }
      tl.set(h, { dist: 0, o: 0, scale: 0.6, walk: 0, armsUp: 0, jump: 0 }, 0)
        .set(f, { s: 0, wave: 0 }, 0)
        .fromTo(c, { cx: 500, cy: OPEN.cy, S: OPEN.S * 1.18, follow: 0 }, { S: OPEN.S, duration: 3.4, ease: 'sine.inOut' }, 0)
        .to(h, { o: 1, scale: 1, duration: 0.7, ease: 'back.out(2)' }, 1.5)
        .to(c, { follow: 1, S: 330, duration: 2.4, ease: 'power2.inOut' }, 2.4)
        .to(h, { walk: 1, duration: 0.4 }, 2.6)
        .to(h, { dist: trailLen, duration: CLIMB, ease: 'sine.inOut' }, 2.6)
        .addLabel('climb', 2.6)
        .to(c, { follow: 0, cx: 500, cy: 175, S: 540, duration: 2.2, ease: 'power2.inOut' }, 2.6 + CLIMB - 1.2)
        .to(h, { walk: 0, duration: 0.4 }, 2.6 + CLIMB - 0.3)
        .addLabel('summit', 2.6 + CLIMB)
        .to(f, { s: 1, duration: 0.6, ease: 'back.out(2.4)' }, 'summit+=0.1')
        .to(f, { wave: 1, duration: 0.4 }, 'summit+=0.4')
        .to(h, { armsUp: 1, duration: 0.45, ease: 'back.out(2)' }, 'summit+=0.3')
        .to(h, { jump: 9, duration: 0.22, yoyo: true, repeat: 3, ease: 'power1.out' }, 'summit+=0.55');
      return tl;
    }

    return {
      svg: svg,
      state: state,
      timeline: timeline,
      climbProgress: function () { return trailLen ? state.hiker.dist / trailLen : 0; },
      toScreen: function (x, y) { return { x: ox + x * k, y: oy + y * k }; },
      // final shot behind the bouquet
      wideShot: function (dur) {
        var portrait = H > W;
        return gsap.to(state.cam, { follow: 0, cx: 500, cy: portrait ? 520 : 470, S: portrait ? 1000 : 1150, duration: dur, ease: 'power2.inOut' });
      },
      summit: { x: 500, y: SUMMIT_Y }
    };
  };
})(window.Flowers = window.Flowers || {});
