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

    function spawnPetal(x, y, vx, vy, kind) {
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
      p.img = petalSprites[(Math.random() * petalSprites.length) | 0];
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
        ctx.drawImage(p.img, -20, -26);
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
