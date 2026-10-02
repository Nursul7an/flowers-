/* «Пионы для Дарии» (Dariya) — scene orchestration.
 *
 * 1. Fuji at sunset, the camera pushes in
 * 2. A hiker climbs the switchback trail
 * 3. Summit: flag, fireworks, confetti, «Вершина покорена!»
 * 4. The camera pulls back, the peony bouquet blooms with the final text
 *
 * Everything personal (text, name, colours, flowers) lives in CONFIG. */
(function (NS) {
  'use strict';

  var CONFIG = {
    congrats: {
      title: 'Вершина покорена!'
    },
    lead: 'Каждая вершина тебе по силам.',
    dedication: 'А эти цветы\u00A0— для\u00A0тебя,',
    name: 'Дария',
    replay: '↻ ещё раз',

    timing: {
      climb: 12,         // seconds the hiker needs from the foot to the summit
      celebrate: 5.2,    // fireworks + congratulations before the flowers
      charStep: 0.045,   // final text: delay between letters
      nameStep: 0.12,
      fontTimeout: 2000
    },

    music: {
      src: 'assets/music.mp3', // Pachelbel — Canon in D on a real grand piano (see tools/music); null = built-in music box
      autoplay: true,          // music is on from the start (via a «Начать» tap where the browser requires one)
      volume: 0.8
    },

    bouquet: {
      seed: 21,
      count: 66,        // cupped blooms in the dome (gaps are filled with small buds)
      size: 25,         // bloom radius in the middle of the dome
      buds: 0.08,
      leaves: 16,
      // colours taken from real Sarah Bernhardt peony bouquets
      palettes: [
        { light: '#F6A4CB', mid: '#DE4F98', deep: '#A42066', rim: '#FFC4E0', crease: '#6E1046' }, // magenta
        { light: '#FBBAD6', mid: '#EE7DB3', deep: '#C2407F', rim: '#FFD8EA', crease: '#8C2458' }, // hot pink
        { light: '#FDE2EC', mid: '#F5B6CD', deep: '#D884A6', rim: '#FFF2F7', crease: '#A8577A' }, // soft pink
        { light: '#FFF7FA', mid: '#F9DDE7', deep: '#E6AEC3', rim: '#FFFFFF', crease: '#B9778F' }, // blush
        { light: '#FFFFFF', mid: '#F8F0F2', deep: '#DCC2CB', rim: '#FFFFFF', crease: '#A88893' }, // white
        { light: '#FFF4F7', mid: '#F2C9D8', deep: '#C98AA4', rim: '#FFFFFF', crease: '#9A5C76' }  // bud
      ],
      mix: [0.3, 0.26, 0.24, 0.1, 0.1, 0],
      budPalette: 5
    }
  };

  var html = document.documentElement;
  var $ = function (s) { return document.querySelector(s); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var stage = $('#stage'), intro = $('#intro'), introText = $('.intro-text');
  var leadEl = $('.lead'), dedicationEl = $('.dedication'), nameEl = $('.name');
  var nameTextEl = $('.name-text'), nameGlowEl = $('.name-glow'), nameShineEl = $('.name-shine');
  var congrats = $('#congrats'), cTitle = $('.c-title');
  var finale = $('#finale'), replayBtn = $('#replay'), soundBtn = $('#sound'), startBtn = $('#start');
  var wrap = $('#bouquet-wrap'), light = $('.bouquet-light'), veil = $('.veil'), dim = $('.dim');

  var particles, world, worldTl, bouquet, bouquetTl, finalTl, music;
  var scene = null; // gsap timeline driving the whole story
  var flowersShown = false, replaying = false, renderOnce = false;
  var leadWords, chars, nameChars, titleChars;
  var bouquetH = 0, wide = false;
  var FINALE_H = 56;

  /* ── Fallback: static text + static bouquet ─────── */
  function fallback(err) {
    if (err && window.console) console.error(err);
    if (html.classList.contains('fallback')) return;
    html.classList.add('fallback');
    var img = document.createElement('img');
    img.className = 'static-bouquet';
    img.src = 'assets/bouquet.svg';
    img.alt = 'Букет розовых пионов';
    intro.insertAdjacentElement('afterend', img);
  }

  /* ── Text helpers ──────────────────────────────── */
  function splitChars(el, text) {
    el.textContent = '';
    var sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    var vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    var out = [];
    var words = text.split(' ');
    words.forEach(function (w, i) {
      var ws = document.createElement('span');
      ws.className = 'word';
      Array.from(w).forEach(function (ch) {
        var c = document.createElement('span');
        c.className = 'char';
        c.textContent = ch;
        ws.appendChild(c);
        out.push(c);
      });
      vis.appendChild(ws);
      if (i < words.length - 1) vis.appendChild(document.createTextNode(' '));
    });
    el.appendChild(sr);
    el.appendChild(vis);
    return out;
  }

  function splitWords(el, text) {
    el.textContent = '';
    return text.split(' ').map(function (w, i, arr) {
      var s = document.createElement('span');
      s.className = 'sw';
      s.textContent = w;
      el.appendChild(s);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
  }

  function centerOf(node) {
    var r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, right: r.right };
  }

  function fontsReady(ms) {
    var timeout = new Promise(function (res) { setTimeout(res, ms); });
    if (!document.fonts || !document.fonts.load) return timeout;
    var load = Promise.all([
      document.fonts.load('48px "Marck Script"', CONFIG.name),
      document.fonts.load('20px "Cormorant Garamond"', CONFIG.lead)
    ]).then(function () { return document.fonts.ready; });
    return Promise.race([load, timeout]).catch(function () {});
  }

  /* ── Layout ────────────────────────────────────── */
  function layout() {
    var W = window.innerWidth, H = window.innerHeight, aspect = bouquet.aspect, h;
    wide = W > H * 1.25 && H < 700;
    if (wide) {
      h = Math.min(H - FINALE_H - 16, (W * 0.5) / aspect);
      wrap.style.left = '70%';
      finale.style.left = '40%';
    } else {
      h = Math.min(H * 0.64, H - FINALE_H - 150, (W * 0.98) / aspect);
      wrap.style.left = '';
      finale.style.left = '';
    }
    bouquetH = Math.max(180, h);
    wrap.style.height = bouquetH + 'px';
    wrap.style.width = bouquetH * aspect + 'px';
    placeIntro();
  }

  // the final text sits above the bouquet (or to its left on landscape phones)
  function placeIntro() {
    gsap.set(intro, { clearProps: 'transform' });
    var W = window.innerWidth, H = window.innerHeight;
    var textH = introText.offsetHeight, textW = introText.offsetWidth;
    if (wide) {
      var s1 = Math.min(0.85, (W * 0.44) / textW, (H - 40) / textH);
      gsap.set(intro, {
        x: W * 0.25 - (intro.offsetLeft + intro.offsetWidth / 2),
        y: (H - textH * s1) / 2 - intro.offsetTop,
        scale: s1
      });
      return;
    }
    var top = 64;
    var wrapTop = H - FINALE_H - bouquetH;
    var s = Math.max(0.4, Math.min(0.9, (wrapTop + bouquetH * 0.06 - top) / textH, (W - 40) / textW));
    var free = Math.max(0, wrapTop - top - textH * s);
    gsap.set(intro, { x: 0, y: top + free * 0.3 - intro.offsetTop, scale: s });
  }

  /* ── Scene 3: summit celebration ───────────────── */
  function celebrate(tl, at) {
    var W = window.innerWidth, H = window.innerHeight;
    function shell(t, fx, fy, o) {
      tl.call(function () {
        var s = world.toScreen(world.summit.x, world.summit.y);
        particles.firework(s.x + (Math.random() - 0.5) * 60, s.y - 10, fx * window.innerWidth, fy * window.innerHeight, o);
      }, null, at + t);
    }
    var P = Math.min(W, H);
    if (!reduced) {
      shell(0.0, 0.5, 0.2, { colors: ['gold', 'pink'], power: P * 0.85 });
      shell(0.5, 0.24, 0.27, { colors: ['lilac', 'white'], power: P * 0.7 });
      shell(0.85, 0.76, 0.25, { colors: ['rose', 'gold'], power: P * 0.75 });
      shell(1.5, 0.5, 0.17, { shape: 'heart', colors: ['rose', 'pink', 'white'], count: 64, power: P * 0.7, dur: 1.2 });
      shell(2.3, 0.32, 0.14, { shape: 'willow', count: 60, power: P * 0.75 });
      shell(2.6, 0.7, 0.18, { colors: ['mint', 'white'], power: P * 0.7 });
      shell(3.3, 0.22, 0.3, { colors: ['pink', 'gold'], power: P * 0.6 });
      shell(3.45, 0.78, 0.3, { colors: ['lilac', 'pink'], power: P * 0.6 });
      tl.call(function () {
        particles.confetti(0, window.innerHeight + 10, 36, 1);
        particles.confetti(window.innerWidth, window.innerHeight + 10, 36, -1);
      }, null, at + 0.9);
    }

    // «Вершина покорена!» — letters pop in like a stamp, just below the summit
    tl.call(function () {
      var sp = world.toScreen(world.summit.x, world.summit.y);
      congrats.style.top = Math.min(window.innerHeight * 0.72, sp.y + Math.max(26, window.innerHeight * 0.035)) + 'px';
    }, null, at + 0.35);
    tl.set(congrats, { autoAlpha: 1 }, at + 0.4);
    if (reduced) {
      tl.fromTo(cTitle, { opacity: 0 }, { opacity: 1, duration: 0.9, stagger: 0.4 }, at + 0.4);
    } else {
      tl.fromTo(titleChars,
        { opacity: 0, y: 40, scale: 0.2, rotation: function () { return (Math.random() - 0.5) * 50; } },
        { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2.6)', stagger: 0.045 }, at + 0.4);
    }
  }

  /* ── Scene 4: flowers + final text ─────────────── */
  function buildFinal() {
    var T = CONFIG.timing;
    var tl = gsap.timeline({ paused: true });
    tl.set([leadEl, dedicationEl, nameEl], { visibility: 'visible' }, 0);
    if (reduced) {
      tl.fromTo(leadWords.concat(chars, nameChars), { opacity: 0 }, { opacity: 1, duration: 1.4 }, 0.6)
        .fromTo(nameGlowEl, { opacity: 0 }, { opacity: 1, duration: 1 }, 1.4);
      return tl;
    }
    tl.fromTo(leadWords, { opacity: 0, y: '0.5em' }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.14 }, 0.4);
    var dAt = 0.6 + leadWords.length * 0.14;
    tl.fromTo(chars,
      { opacity: 0, y: '0.35em', scale: 0.6, rotation: -6 },
      { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(2)', stagger: T.charStep }, dAt);
    chars.forEach(function (c, i) {
      if (i % 3 === 0 && c.textContent.trim()) tl.call(function () {
        var p = centerOf(c); particles.spark(p.right, p.y);
      }, null, dAt + i * T.charStep + 0.1);
    });
    var nameAt = dAt + chars.length * T.charStep + 0.3;
    tl.fromTo(nameChars,
      { opacity: 0, y: '0.3em', scale: 0.5 },
      { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'back.out(1.8)', stagger: T.nameStep }, nameAt);
    var glowAt = nameAt + nameChars.length * T.nameStep + 0.2;
    tl.fromTo(nameGlowEl, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out' }, glowAt);
    tl.fromTo(nameTextEl, { scale: 1 }, { scale: 1.06, duration: 0.6, yoyo: true, repeat: 1, ease: 'sine.inOut' }, glowAt);
    tl.call(function () {
      var r = nameTextEl.getBoundingClientRect();
      particles.single(r.left + r.width * 0.62, r.top + r.height * 0.15);
      nameShineEl.classList.add('on');
    }, null, glowAt + 0.4);
    return tl;
  }

  function showFlowers(tl, at) {
    tl.to(congrats, { autoAlpha: 0, y: -20, duration: 0.7, ease: 'power1.in' }, at);
    tl.add(function () { world.wideShot(reduced ? 0.01 : 2.4); }, at);
    tl.to(dim, { opacity: 1, duration: 2.2, ease: 'power1.inOut' }, at + 0.3);
    tl.to(light, { opacity: 1, duration: 2.6, ease: 'power1.inOut' }, at + 0.8);
    tl.add(function () {
      flowersShown = true;
      wrap.style.display = '';
      wrap.classList.remove('swaying');
      bouquetTl.eventCallback('onComplete', onBloomed);
      bouquetTl.restart();
    }, at + 0.9);
    tl.add(function () { finalTl.restart(); }, at + 1.6);
  }

  function onBloomed() {
    renderOnce = true;
    replaying = false;
    particles.setAmbient(true);
    if (!reduced) {
      wrap.classList.add('swaying');
      var r = wrap.getBoundingClientRect();
      particles.burst(r.left + r.width / 2, r.top + r.height * 0.2, 10);
    }
    gsap.fromTo(finale, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'power2.out' });
  }

  /* ── The whole story ───────────────────────────── */
  function buildScene() {
    var tl = gsap.timeline({ paused: true });
    // the world timeline runs on its own; the story only starts it and
    // schedules everything else against its labels
    tl.add(function () { worldTl.restart(); }, 0);
    tl.to({}, { duration: worldTl.duration() }, 0);
    var summitAt = worldTl.labels.summit;
    celebrate(tl, summitAt);
    showFlowers(tl, summitAt + CONFIG.timing.celebrate * (reduced ? 0.6 : 1));
    return tl;
  }

  function resetStory() {
    flowersShown = false;
    finalTl.pause(0);
    bouquetTl.pause(0);
    renderOnce = true;
    wrap.classList.remove('swaying');
    nameShineEl.classList.remove('on');
    gsap.set([leadEl, dedicationEl, nameEl], { visibility: 'hidden' });
    gsap.set([dim, light], { opacity: 0 });
    gsap.set(congrats, { autoAlpha: 0, y: 0 });
    gsap.set(finale, { autoAlpha: 0 });
    gsap.set(bouquet.svg, { visibility: 'hidden' });
    wrap.style.display = 'none'; // keep the 1 300-node bouquet out of rendering until it is needed
  }

  function play() {
    if (scene) scene.kill();
    worldTl.pause(0);
    resetStory();
    scene = buildScene();
    scene.play(0);
  }

  function replay() {
    if (replaying) return;
    replaying = true;
    gsap.to(finale, { autoAlpha: 0, duration: 0.4 });
    gsap.to([wrap, intro, dim, light], {
      opacity: 0, duration: 0.7, ease: 'power1.in',
      onComplete: function () {
        gsap.set([wrap, intro], { opacity: 1 });
        replaying = false;
        play();
      }
    });
  }

  /* ── Music ─────────────────────────────────────── */
  function setSoundIcon(on) {
    soundBtn.textContent = on ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', on ? 'Выключить музыку' : 'Включить музыку');
  }

  function toggleMusic() {
    music.toggle().then(setSoundIcon);
  }

  // story + music start together
  function begin() {
    particles.setAmbient(true); // sakura petals drift through the whole story
    gsap.to(veil, { autoAlpha: 0, duration: reduced ? 0.8 : 1.8, ease: 'power1.inOut' });
    play();
  }

  // browsers block sound until the first tap: show the scene softly behind a «Начать» button
  function showStartGate() {
    gsap.to(veil, { autoAlpha: 0.45, duration: 1.4, ease: 'power1.inOut' });
    gsap.fromTo(startBtn, { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.9, ease: 'back.out(1.8)', delay: 0.4 });
    startBtn.addEventListener('click', function onStart() {
      startBtn.removeEventListener('click', onStart);
      music.start().then(setSoundIcon);
      gsap.to(startBtn, { autoAlpha: 0, scale: 1.15, duration: 0.45, ease: 'power1.in' });
      begin();
    });
  }

  /* ── Debug / tooling hook (OG image + static SVG export) ── */
  function jumpToEnd() {
    if (scene) scene.kill();
    scene = null;
    gsap.set(veil, { autoAlpha: 0 });
    worldTl.progress(1);
    var portrait = window.innerHeight > window.innerWidth;
    gsap.set(world.state.cam, { follow: 0, cx: 500, cy: portrait ? 520 : 470, S: portrait ? 1000 : 1150 });
    gsap.set([dim, light], { opacity: 1 });
    finalTl.progress(1);
    nameShineEl.classList.add('on');
    wrap.style.display = '';
    bouquetTl.progress(1);
    bouquet.renderAll();
    flowersShown = true;
    gsap.set(finale, { autoAlpha: 1, y: 0 });
  }

  /* ── Init ──────────────────────────────────────── */
  function init() {
    if (!window.gsap || !NS.buildBouquet || !NS.Particles || !NS.buildWorld) throw new Error('animation libs missing');

    replayBtn.textContent = CONFIG.replay;
    nameGlowEl.textContent = CONFIG.name;
    nameShineEl.textContent = CONFIG.name;
    leadWords = splitWords(leadEl, CONFIG.lead);
    chars = splitChars(dedicationEl, CONFIG.dedication);
    nameChars = splitChars(nameTextEl, CONFIG.name);
    titleChars = splitChars(cTitle, CONFIG.congrats.title);

    particles = NS.Particles($('#sky'), { reduced: reduced });
    world = NS.buildWorld($('#world'), { climbDuration: CONFIG.timing.climb });
    worldTl = world.timeline(reduced);
    bouquet = NS.buildBouquet(wrap, CONFIG.bouquet);
    bouquetTl = bouquet.timeline(reduced);
    finalTl = buildFinal();

    gsap.ticker.add(function () {
      if (bouquetTl.isActive() || renderOnce) { bouquet.renderAll(); renderOnce = false; }
    });

    layout();
    var resizeT = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(layout, 120);
    });

    replayBtn.addEventListener('click', replay);
    soundBtn.addEventListener('click', toggleMusic);
    // FR-7: a tap anywhere throws a handful of petals
    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('button')) return;
      particles.burst(e.clientX, e.clientY, 8 + Math.floor(Math.random() * 8));
    });

    NS.debug = {
      jumpToEnd: jumpToEnd, particles: particles, bouquet: bouquet, world: world, config: CONFIG,
      scene: function () { return scene; },
      worldTl: function () { return worldTl; },
      restart: function () { play(); }
    };

    particles.start();
    if (/[?&]poster\b/.test(location.search)) {
      jumpToEnd();
      return;
    }

    music = NS.Music(CONFIG.music);
    Promise.all([
      fontsReady(CONFIG.timing.fontTimeout),
      CONFIG.music.autoplay ? music.start() : Promise.resolve(false)
    ]).then(function (r) {
      setSoundIcon(r[1]);
      if (r[1] || !CONFIG.music.autoplay) begin();
      else showStartGate();
    });
  }

  try {
    init();
  } catch (e) {
    fallback(e);
  }
})(window.Flowers = window.Flowers || {});
