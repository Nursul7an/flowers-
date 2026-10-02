/* Canvas 2D particles: fireflies, falling petals, tap bursts, writing sparks.
 * Fixed-size pools — nothing accumulates. Pre-rendered sprites keep each
 * frame to plain drawImage calls. Frame time is sampled and the particle
 * budget drops automatically on slow devices. */
(function (NS) {
  'use strict';

  function rand(a, b) { return a + Math.random() * (b - a); }

  function sprite(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return c;
  }

  function glowSprite(color) {
    return sprite(64, 64, function (g, w) {
      var grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      grad.addColorStop(0, 'rgba(255,255,240,1)');
      grad.addColorStop(0.12, color + '0.95)');
      grad.addColorStop(0.35, color + '0.35)');
      grad.addColorStop(1, color + '0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, w);
    });
  }

  function petalSprite(edge, deep) {
    return sprite(40, 52, function (g, w, h) {
      g.translate(w / 2, h - 3);
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(-16, -6, -19, -30, -13, -42);
      g.quadraticCurveTo(-7, -50, 0, -45);
      g.quadraticCurveTo(7, -50, 13, -42);
      g.bezierCurveTo(19, -30, 16, -6, 0, 0);
      var grad = g.createRadialGradient(0, 0, 2, 0, -22, 34);
      grad.addColorStop(0, deep);
      grad.addColorStop(1, edge);
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = 'rgba(170,60,100,0.25)';
      g.lineWidth = 1;
      g.stroke();
    });
  }

  NS.Particles = function (canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var reduced = !!opts.reduced;
    var W = 0, H = 0, dpr = 1, maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    var quality = 1; // drops to 0.5 on slow devices

    var fireSprite = glowSprite('rgba(255,217,160,');
    var petalSprites = [
      petalSprite('#FDE2EB', '#F5B0C8'),
      petalSprite('#FBD0E2', '#E06AA4'),
      petalSprite('#FFF2F5', '#F2B9CB'),
      petalSprite('#FFFDF8', '#F1DCD8'),
      petalSprite('#F8D8EC', '#DD86C0')
    ];

    // fireworks: coloured glow sprites; confetti: small paper rectangles
    var FW_COLORS = {
      gold: glowSprite('rgba(255,214,140,'),
      pink: glowSprite('rgba(255,140,190,'),
      rose: glowSprite('rgba(255,95,150,'),
      lilac: glowSprite('rgba(200,150,255,'),
      white: glowSprite('rgba(255,250,245,'),
      mint: glowSprite('rgba(150,255,215,')
    };
    var confettiSprites = ['#FFD36E', '#FF8FB8', '#FFFFFF', '#B9A2FF', '#7FE3C4', '#FF6F91'].map(function (c) {
      return sprite(10, 16, function (g, w, h) { g.fillStyle = c; g.fillRect(0, 0, w, h); });
    });
    var rockets = new Array(12);
    var fsparks = new Array(520);
    for (var r0 = 0; r0 < rockets.length; r0++) rockets[r0] = { on: false };
    for (r0 = 0; r0 < fsparks.length; r0++) fsparks[r0] = { on: false };

    var fireflies = [];
    var petals = new Array(90);
    var sparks = new Array(40);
    for (var i = 0; i < petals.length; i++) petals[i] = { on: false };
    for (i = 0; i < sparks.length; i++) sparks[i] = { on: false };

    var ambient = false;
    var ambientTarget = 0;
    var ambientCount = 0;
    var spawnClock = 0;
    var running = false;
    var last = 0;
    var t = 0;
    var raf = 0;

    // frame-time sampling for adaptive quality
    var sampleSum = 0, sampleN = 0, slowStrikes = 0;

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      dpr = quality < 1 ? 1 : maxDpr;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fireflies.forEach(function (f) {
        if (f.x > W) f.x = rand(0, W);
        if (f.y > H) f.y = rand(0, H);
      });
    }

    function fireflyBudget() {
      var base = W * H > 700000 ? 22 : 15;
      return Math.round(base * quality * (reduced ? 0.6 : 1));
    }

    function makeFirefly(delay) {
      return {
        x: rand(0, W), y: rand(H * 0.08, H * 0.95),
        vx: rand(-8, 8), vy: rand(-8, 4),
        size: rand(10, 22),
        ph: rand(0, Math.PI * 2), fr: rand(0.6, 1.6),
        born: t + delay, wob: rand(0.3, 0.9)
      };
    }

    function syncFireflies() {
      var target = fireflyBudget();
      while (fireflies.length < target) fireflies.push(makeFirefly(rand(0, 1.6)));
      if (fireflies.length > target) fireflies.length = target;
    }

    function freePetal() {
      for (var i = 0; i < petals.length; i++) if (!petals[i].on) return petals[i];
      return null;
    }

    function spawnPetal(x, y, vx, vy, kind, img) {
      var p = freePetal();
      if (!p) return null;
      p.on = true;
      p.kind = kind; // 'ambient' | 'burst' | 'single'
      p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.rot = rand(0, Math.PI * 2);
      p.vr = rand(-1.6, 1.6) * (reduced ? 0.4 : 1);
      p.flip = rand(0, Math.PI * 2);
      p.vf = rand(1.5, 3.5) * (reduced ? 0.4 : 1);
      p.sway = rand(10, 28);
      p.swayF = rand(0.6, 1.3);
      p.size = kind === 'single' ? rand(0.7, 0.8) : rand(0.38, 0.7);
      p.img = img || petalSprites[(Math.random() * petalSprites.length) | 0];
      p.age = 0;
      p.life = kind === 'burst' ? rand(5, 8) : 40;
      p.fall = rand(28, 56) * (reduced ? 0.6 : 1);
      if (kind === 'ambient') ambientCount++;
      return p;
    }

    function killPetal(p) {
      if (p.kind === 'ambient') ambientCount--;
      p.on = false;
    }

    function step(dt) {
      t += dt;

      // fireflies
      for (var i = 0; i < fireflies.length; i++) {
        var f = fireflies[i];
        if (t < f.born) continue;
        f.vx += Math.sin(t * f.wob + f.ph) * 4 * dt;
        f.vy += Math.cos(t * f.wob * 0.8 + f.ph) * 4 * dt;
        f.vx = Math.max(-14, Math.min(14, f.vx));
        f.vy = Math.max(-14, Math.min(14, f.vy));
        var spd = reduced ? 0.35 : 1;
        f.x += f.vx * dt * spd; f.y += f.vy * dt * spd;
        if (f.x < -20) f.x = W + 20; else if (f.x > W + 20) f.x = -20;
        if (f.y < -20) f.y = H + 20; else if (f.y > H + 20) f.y = -20;
      }

      // ambient petal emitter
      if (ambient && ambientCount < ambientTarget) {
        spawnClock -= dt;
        if (spawnClock <= 0) {
          spawnClock = rand(0.35, 1.1);
          spawnPetal(rand(-20, W + 20), -30, rand(-10, 18), rand(10, 30), 'ambient');
        }
      }

      // petals
      for (i = 0; i < petals.length; i++) {
        var p = petals[i];
        if (!p.on) continue;
        p.age += dt;
        var drag = p.kind === 'burst' ? 1.8 : 0.6;
        p.vx += (-p.vx * drag + (Math.random() - 0.5) * 6) * dt;
        p.vy += ((p.fall - p.vy) * drag) * dt;
        p.x += (p.vx + Math.sin(p.age * p.swayF + p.flip) * p.sway * 0.9) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flip += p.vf * dt;
        if (p.y > H + 40 || p.x < -80 || p.x > W + 80 || p.age > p.life) killPetal(p);
      }

      // fireworks: rockets rise, then explode into sparks
      for (i = 0; i < rockets.length; i++) {
        var rk = rockets[i];
        if (!rk.on) continue;
        rk.age += dt;
        var k = Math.min(1, rk.age / rk.dur);
        var e = 1 - Math.pow(1 - k, 2.2); // decelerate like a real shell
        rk.x = rk.x0 + (rk.x1 - rk.x0) * e + Math.sin(rk.age * 14) * 1.2;
        rk.y = rk.y0 + (rk.y1 - rk.y0) * e;
        if (Math.random() < 0.9) addSpark(rk.x, rk.y, rand(-14, 14), rand(10, 50), 0.45, 5, 'gold', 0, 0.5);
        if (k >= 1) { rk.on = false; explode(rk); }
      }
      for (i = 0; i < fsparks.length; i++) {
        var fs = fsparks[i];
        if (!fs.on) continue;
        fs.age += dt;
        var dr = Math.pow(fs.drag, dt * 60);
        fs.vx *= dr; fs.vy = fs.vy * dr + fs.g * dt;
        fs.x += fs.vx * dt; fs.y += fs.vy * dt;
        if (fs.age > fs.life) fs.on = false;
      }

      // sparks
      for (i = 0; i < sparks.length; i++) {
        var s = sparks[i];
        if (!s.on) continue;
        s.age += dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.vy -= 6 * dt;
        if (s.age > s.life) s.on = false;
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < fireflies.length; i++) {
        var f = fireflies[i];
        var age = t - f.born;
        if (age < 0) continue;
        var a = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * f.fr * 2 + f.ph))) * Math.min(1, age / 1.2);
        ctx.globalAlpha = a * 0.9;
        var sz = f.size;
        ctx.drawImage(fireSprite, f.x - sz / 2, f.y - sz / 2, sz, sz);
      }
      for (i = 0; i < sparks.length; i++) {
        var s = sparks[i];
        if (!s.on) continue;
        var k = 1 - s.age / s.life;
        ctx.globalAlpha = k;
        var ss = s.size * (0.6 + 0.4 * k);
        ctx.drawImage(fireSprite, s.x - ss / 2, s.y - ss / 2, ss, ss);
      }

      for (i = 0; i < fsparks.length; i++) {
        var fs = fsparks[i];
        if (!fs.on) continue;
        var kk = 1 - fs.age / fs.life;
        // crackle: sparks twinkle as they fade
        ctx.globalAlpha = kk * (fs.tw ? (0.55 + 0.45 * Math.sin(fs.age * 40 + fs.ph)) : 1);
        var fz = fs.size * (0.5 + 0.5 * kk);
        ctx.drawImage(FW_COLORS[fs.c], fs.x - fz / 2, fs.y - fz / 2, fz, fz);
      }
      for (i = 0; i < rockets.length; i++) {
        var rk = rockets[i];
        if (!rk.on) continue;
        ctx.globalAlpha = 1;
        ctx.drawImage(FW_COLORS.white, rk.x - 7, rk.y - 7, 14, 14);
      }

      ctx.globalCompositeOperation = 'source-over';
      for (i = 0; i < petals.length; i++) {
        var p = petals[i];
        if (!p.on) continue;
        var fade = Math.min(1, p.age / 0.3, (p.life - p.age) / 1);
        ctx.globalAlpha = Math.max(0, fade) * 0.92;
        var c = Math.cos(p.rot), sn = Math.sin(p.rot), fl = Math.cos(p.flip);
        var sc = p.size;
        // rotate + 3D-ish tumble (squash along local y)
        ctx.setTransform(c * sc * dpr, sn * sc * dpr, -sn * sc * fl * dpr, c * sc * fl * dpr, p.x * dpr, p.y * dpr);
        ctx.drawImage(p.img, -p.img.width / 2, -p.img.height / 2);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
    }

    function adapt(dt) {
      sampleSum += dt; sampleN++;
      if (sampleN < 90) return;
      var avg = sampleSum / sampleN;
      sampleSum = 0; sampleN = 0;
      if (avg > 0.024 && quality > 0.5) {
        if (++slowStrikes >= 2) {
          quality = 0.5;
          ambientTarget = Math.round(ambientTarget * 0.5);
          resize();
          syncFireflies();
        }
      } else {
        slowStrikes = 0;
      }
    }

    function addSpark(x, y, vx, vy, life, size, c, tw, drag, g) {
      for (var i = 0; i < fsparks.length; i++) {
        var s = fsparks[i];
        if (s.on) continue;
        s.on = true; s.x = x; s.y = y; s.vx = vx; s.vy = vy;
        s.age = 0; s.life = life; s.size = size; s.c = c; s.tw = tw;
        s.drag = drag === undefined ? 0.965 : drag; s.g = g === undefined ? 70 : g;
        s.ph = Math.random() * 6.28;
        return s;
      }
      return null;
    }

    function explode(rk) {
      var n = Math.round(rk.count * quality * (reduced ? 0.5 : 1));
      var colors = rk.colors;
      var i, a, sp;
      if (rk.shape === 'heart') {
        for (i = 0; i < n; i++) {
          var tt = (i / n) * Math.PI * 2;
          var hx = 16 * Math.pow(Math.sin(tt), 3);
          var hy = -(13 * Math.cos(tt) - 5 * Math.cos(2 * tt) - 2 * Math.cos(3 * tt) - Math.cos(4 * tt));
          addSpark(rk.x, rk.y, hx * rk.power / 16, hy * rk.power / 16, rand(1.6, 2.1), rand(14, 20), colors[i % colors.length], 1, 0.955, 22);
        }
      } else if (rk.shape === 'willow') {
        for (i = 0; i < n; i++) {
          a = rand(0, Math.PI * 2); sp = rk.power * rand(0.55, 1);
          addSpark(rk.x, rk.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(2.2, 3.0), rand(9, 14), 'gold', 1, 0.95, 55);
        }
      } else {
        // peony shell: two rings for depth
        for (i = 0; i < n; i++) {
          a = (i / n) * Math.PI * 2 + rand(-0.05, 0.05);
          sp = rk.power * (i % 3 === 0 ? rand(0.45, 0.6) : rand(0.88, 1));
          addSpark(rk.x, rk.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(1.2, 1.9), rand(12, 18), colors[i % colors.length], i % 4 === 0, 0.962, 70);
        }
      }
      // bright flash at the centre
      addSpark(rk.x, rk.y, 0, 0, 0.25, rk.power * 0.5, 'white', 0, 1, 0);
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      // dt clamp: no jump after the tab was hidden (rAF pauses there)
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (!document.hidden && dt > 0) adapt(dt);
      step(dt);
      draw();
    }

    window.addEventListener('resize', function () { resize(); syncFireflies(); });

    return {
      start: function () {
        if (running) return;
        running = true;
        resize();
        syncFireflies();
        last = performance.now();
        raf = requestAnimationFrame(frame);
      },
      setAmbient: function (on) {
        ambient = on;
        ambientTarget = Math.round((W * H > 700000 ? 26 : 16) * quality * (reduced ? 0.5 : 1));
      },
      burst: function (x, y, count) {
        count = Math.round(count * (reduced ? 0.6 : 1));
        for (var i = 0; i < count; i++) {
          var a = rand(0, Math.PI * 2), sp = rand(90, 300) * (reduced ? 0.5 : 1);
          spawnPetal(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 60, 'burst');
        }
      },
      // salut: a shell from (x0,y0) that bursts at (x1,y1)
      firework: function (x0, y0, x1, y1, o) {
        o = o || {};
        for (var i = 0; i < rockets.length; i++) {
          var rk = rockets[i];
          if (rk.on) continue;
          rk.on = true; rk.age = 0;
          rk.x0 = rk.x = x0; rk.y0 = rk.y = y0; rk.x1 = x1; rk.y1 = y1;
          rk.dur = o.dur || rand(0.9, 1.25);
          rk.shape = o.shape || 'peony';
          rk.colors = o.colors || ['gold', 'pink'];
          rk.count = o.count || 70;
          rk.power = o.power || Math.min(W, H) * 0.42;
          return;
        }
      },
      confetti: function (x, y, count, dir) {
        count = Math.round(count * quality * (reduced ? 0.5 : 1));
        for (var i = 0; i < count; i++) {
          var a = -Math.PI / 2 + dir * rand(0.15, 0.75), sp = rand(380, 720);
          var p = spawnPetal(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 'burst',
            confettiSprites[(Math.random() * confettiSprites.length) | 0]);
          if (p) { p.size = rand(0.5, 0.9); p.vf = rand(6, 12); p.vr = rand(-5, 5); p.fall = rand(70, 120); p.life = rand(4, 6); }
        }
      },
      single: function (x, y) { spawnPetal(x, y, rand(-6, 6), 8, 'single'); },
      spark: function (x, y) {
        for (var i = 0; i < sparks.length; i++) {
          var s = sparks[i];
          if (s.on) continue;
          s.on = true; s.x = x; s.y = y;
          s.vx = rand(-14, 14); s.vy = rand(-26, -8);
          s.age = 0; s.life = rand(0.6, 1.1); s.size = rand(10, 18);
          return;
        }
      },
      // static snapshot used for the OG image
      snapshot: function (nPetals) {
        for (var i = 0; i < nPetals; i++) {
          var p = spawnPetal(rand(0, W), rand(0, H * 0.9), 0, 0, 'single');
          if (p) { p.age = 1; p.size = rand(0.45, 0.75); }
        }
        fireflies.forEach(function (f) { f.born = t - 2; });
        draw();
      }
    };
  };
})(window.Flowers = window.Flowers || {});
