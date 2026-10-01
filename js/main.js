/* «Пионы для Дарии» — scene orchestration.
 * Everything personal (text, name, colours, flowers) lives in CONFIG. */
(function (NS) {
  'use strict';

  var CONFIG = {
    // lines that appear one by one and dissolve before the dedication
    story: [
      'Говорят, пионы цветут всего пару недель в году…',
      '…и всегда — для кого-то особенного.'
    ],
    dedication: 'Эти — для самой доброй и самой красивой девушки на свете —',
    name: 'Дарии',
    button: 'Для тебя 🌸',
    hint: 'нажми — и они распустятся',
    replay: '↻ ещё раз',

    timing: {
      silence: 1.4,      // scene 1: dusk + fireflies before the text starts
      wordStep: 0.16,    // scene 2: story lines, delay between words
      storyHold: 1.7,    // how long a story line stays fully visible
      charStep: 0.04,    // dedication: delay between letters
      nameStep: 0.12,    // the name is written slower
      fontTimeout: 2000  // never wait longer than this for web fonts
    },

    music: {
      src: null,               // e.g. 'assets/music.mp3' (royalty-free); null = built-in music box
      startWithBouquet: false, // true = music starts on the «Для тебя» tap
      volume: 0.5
    },

    bouquet: {
      seed: 11,
      flowerCount: 10,
      bloomGap: 0.24,
      // light rim → mid → deep base; shade = colour of the crevices
      palettes: [
        { light: '#FBD0E2', mid: '#F08DB9', deep: '#D24E91', shade: '#8E2A62' }, // ярко-розовый
        { light: '#FDE2EB', mid: '#F5B0C8', deep: '#E07CA3', shade: '#9E4670' }, // розовый
        { light: '#FFF2F5', mid: '#FAD3DF', deep: '#EFA9BF', shade: '#B47388' }, // нежный
        { light: '#FFFDF8', mid: '#FAEEE8', deep: '#EBCFCF', shade: '#A88C90' }, // кремово-белый
        { light: '#F8D8EC', mid: '#ECA4D0', deep: '#CF6DAE', shade: '#8C3B78' }  // сиренево-розовый
      ],
      // viewBox x −10…410, y 80…560; x, y = centre of the head, r = radius
      flowers: [
        { x: 135, y: 185, r: 56, palette: 1, tilt: -10 },
        { x: 205, y: 165, r: 60, palette: 0, tilt: 4 },
        { x: 275, y: 188, r: 56, palette: 4, tilt: 12 },
        { x: 80, y: 252, r: 54, palette: 2, tilt: -18 },
        { x: 160, y: 240, r: 62, palette: 3, tilt: -6 },
        { x: 245, y: 236, r: 62, palette: 0, tilt: 8 },
        { x: 325, y: 254, r: 54, palette: 1, tilt: 18 },
        { x: 118, y: 312, r: 58, palette: 0, tilt: -10 },
        { x: 200, y: 305, r: 64, palette: 1, tilt: 0 },
        { x: 284, y: 314, r: 58, palette: 2, tilt: 10 }
      ],
      bloomOrder: [8, 4, 5, 1, 0, 2, 7, 9, 3, 6],
      buds: [
        { x: 44, y: 196, r: 11, tilt: -24, palette: 0 },
        { x: 362, y: 192, r: 11, tilt: 22, palette: 4 }
      ],
      // leaves peeking between the flowers and the paper: [x, y, angle, length, compound]
      leaves: [
        [34, 322, -72, 70, true], [368, 324, 72, 70, true],
        [70, 206, -46, 56, false], [336, 202, 46, 56, false],
        [165, 132, -24, 46, false], [248, 132, 26, 46, false]
      ]
    }
  };

  var html = document.documentElement;
  var $ = function (s) { return document.querySelector(s); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var stage = $('#stage'), intro = $('#intro'), introText = $('.intro-text');
  var dedicationEl = $('.dedication'), nameEl = $('.name'), nameTextEl = $('.name-text'), nameGlowEl = $('.name-glow');
  var nameShineEl = $('.name-shine'), storyEl = $('.story'), hintEl = $('.hint');
  var openBtn = $('#open'), finale = $('#finale'), replayBtn = $('#replay'), soundBtn = $('#sound');
  var wrap = $('#bouquet-wrap'), light = $('.bouquet-light'), veil = $('.veil');

  var particles, bouquet, bouquetTl, introTl, music;
  var opened = false, introDone = false, tapEnabled = false, replaying = false, wantSkip = false;
  var renderOnce = false;
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
    var chars = [];
    var words = text.split(' ');
    words.forEach(function (w, i) {
      var ws = document.createElement('span');
      ws.className = 'word';
      Array.from(w).forEach(function (ch) {
        var c = document.createElement('span');
        c.className = 'char';
        c.textContent = ch;
        ws.appendChild(c);
        chars.push(c);
      });
      vis.appendChild(ws);
      if (i < words.length - 1) vis.appendChild(document.createTextNode(' '));
    });
    el.appendChild(sr);
    el.appendChild(vis);
    return chars;
  }

  // story lines: one <p> per line, words wrapped for a word-by-word reveal
  function buildStory(lines) {
    storyEl.textContent = '';
    var sr = document.createElement('p');
    sr.className = 'sr-only';
    sr.textContent = lines.join(' ');
    storyEl.appendChild(sr);
    return lines.map(function (text) {
      var p = document.createElement('p');
      p.className = 'story-line';
      p.setAttribute('aria-hidden', 'true');
      var words = text.split(' ').map(function (w, i, arr) {
        var s = document.createElement('span');
        s.className = 'sw';
        s.textContent = w;
        p.appendChild(s);
        if (i < arr.length - 1) p.appendChild(document.createTextNode(' '));
        return s;
      });
      storyEl.appendChild(p);
      return { el: p, words: words };
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
      document.fonts.load('20px "Cormorant Garamond"', CONFIG.button)
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
      h = Math.min(H * 0.68, H - FINALE_H - 120, (W * 0.98) / aspect);
      wrap.style.left = '';
      finale.style.left = '';
    }
    bouquetH = Math.max(180, h);
    wrap.style.height = bouquetH + 'px';
    wrap.style.width = bouquetH * aspect + 'px';
    if (opened) placeIntro(false);
  }

  // Scene 4: the dedication rises and shrinks to make room for the bouquet
  function placeIntro(animate) {
    var W = window.innerWidth, H = window.innerHeight;
    var textH = introText.offsetHeight, textW = introText.offsetWidth;
    var vars;
    if (wide) {
      var s1 = Math.min(0.75, (W * 0.44) / textW, (H - 40) / textH);
      vars = {
        x: W * 0.25 - (intro.offsetLeft + intro.offsetWidth / 2),
        y: (H - textH * s1) / 2 - intro.offsetTop,
        scale: s1
      };
    } else {
      var top = 14 + (parseFloat(getComputedStyle(soundBtn).top) > 20 ? 10 : 0);
      var wrapTop = H - FINALE_H - bouquetH;
      var s = Math.max(0.32, Math.min(0.8, (wrapTop - top) / textH, (W - 60) / textW));
      // centre the text in the space left above the bouquet
      var free = Math.max(0, wrapTop - top - textH * s);
      vars = { x: 0, y: top + free * 0.4 - intro.offsetTop, scale: s };
    }
    if (animate) gsap.to(intro, Object.assign({ duration: 1.1, ease: 'power3.inOut' }, vars));
    else gsap.set(intro, vars);
  }

  /* ── Scene 2–3: dedication ─────────────────────── */
  function buildIntro(story, chars, nameChars) {
    var T = CONFIG.timing;
    var tl = gsap.timeline({ paused: true });

    // story lines: word by word, hold, then dissolve upwards
    story.forEach(function (line) {
      tl.set(line.el, { visibility: 'visible' });
      if (reduced) {
        tl.fromTo(line.words, { opacity: 0 }, { opacity: 1, duration: 0.9 })
          .to(line.words, { opacity: 0, duration: 0.7 }, '+=' + (T.storyHold + 0.6));
      } else {
        var start = tl.duration();
        tl.fromTo(line.words,
          { opacity: 0, y: '0.6em', scale: 0.85 },
          { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power2.out', stagger: T.wordStep }, start);
        line.words.forEach(function (w, i) {
          tl.call(function () { var p = centerOf(w); particles.spark(p.right, p.y); }, null, start + i * T.wordStep + 0.2);
        });
        tl.to(line.words, {
          opacity: 0, y: '-0.5em', scale: 1.04, duration: 0.7, ease: 'power1.in', stagger: 0.05
        }, start + 0.8 + line.words.length * T.wordStep + T.storyHold);
      }
      tl.set(line.el, { visibility: 'hidden' }, '+=0.15');
    });

    var t0 = tl.duration();
    tl.set([dedicationEl, nameEl], { visibility: 'visible' }, t0);

    if (reduced) {
      tl.fromTo(chars.concat(nameChars), { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'power1.inOut' })
        .fromTo(nameGlowEl, { opacity: 0 }, { opacity: 1, duration: 1 }, '-=0.4');
    } else {
      tl.fromTo(chars,
        { opacity: 0, y: '0.35em', scale: 0.6, rotation: -6 },
        { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(2)', stagger: T.charStep }, t0);
      chars.forEach(function (c, i) {
        if (i % 3 === 0 && c.textContent.trim()) tl.call(function () {
          var p = centerOf(c); particles.spark(p.right, p.y);
        }, null, t0 + i * T.charStep + 0.1);
      });
      var nameAt = t0 + chars.length * T.charStep + 0.35;
      tl.fromTo(nameChars,
        { opacity: 0, y: '0.3em', scale: 0.5 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'back.out(1.8)', stagger: T.nameStep }, nameAt);
      nameChars.forEach(function (c) {
        tl.call(function () { var p = centerOf(c); particles.spark(p.x, p.y); }, null, '<');
      });
      var glowAt = nameAt + nameChars.length * T.nameStep + 0.2;
      tl.fromTo(nameGlowEl, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out' }, glowAt);
      tl.fromTo(nameTextEl, { scale: 1 }, { scale: 1.06, duration: 0.6, yoyo: true, repeat: 1, ease: 'sine.inOut' }, glowAt);
      tl.call(function () {
        var r = nameTextEl.getBoundingClientRect();
        particles.single(r.left + r.width * 0.62, r.top + r.height * 0.15);
      }, null, glowAt + 0.3);
      tl.call(function () { nameShineEl.classList.add('on'); }, null, glowAt + 0.9);
    }

    // FR-3: the button exists only after the text is complete
    tl.fromTo(openBtn, { autoAlpha: 0, y: 14 }, {
      autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out',
      onComplete: function () {
        introDone = true;
        openBtn.style.pointerEvents = 'auto';
        if (!reduced) openBtn.classList.add('breathing');
      }
    }, '+=0.5');
    tl.fromTo(hintEl, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out' }, '-=0.2');
    return tl;
  }

  function skipIntro() {
    if (introDone || opened) return;
    if (!introTl) { wantSkip = true; return; }
    introTl.progress(1);
  }

  /* ── Scene 4–7: bouquet ────────────────────────── */
  function openBouquet() {
    if (opened || !introDone) return; // FR-3 + double-tap guard
    opened = true;
    openBtn.disabled = true;
    openBtn.style.pointerEvents = 'none';
    openBtn.classList.remove('breathing');
    gsap.to(openBtn, { autoAlpha: 0, scale: 0.92, duration: 0.35, ease: 'power1.in' });
    gsap.to(hintEl, { autoAlpha: 0, duration: 0.3 });

    gsap.delayedCall(0.06, playBouquet); // FR-4: stems start well under 200 ms
    placeIntro(true);
    gsap.to(light, { opacity: 1, duration: 2.6, delay: 0.5, ease: 'power1.inOut' });

    if (CONFIG.music.startWithBouquet && !(music && music.playing)) toggleMusic();
  }

  function playBouquet() {
    wrap.classList.remove('swaying');
    bouquetTl.eventCallback('onComplete', onBloomed);
    bouquetTl.restart();
  }

  function onBloomed() {
    renderOnce = true;
    replaying = false;
    tapEnabled = true;
    particles.setAmbient(true);
    if (!reduced) {
      wrap.classList.add('swaying');
      var r = wrap.getBoundingClientRect();
      particles.burst(r.left + r.width / 2, r.top + r.height * 0.2, 10);
    }
    gsap.fromTo(finale, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'power2.out' });
  }

  function replay() {
    if (replaying || !opened) return;
    replaying = true;
    gsap.to(finale, { autoAlpha: 0, duration: 0.4 });
    gsap.to(bouquet.svg, {
      opacity: 0, duration: 0.6, ease: 'power1.in',
      onComplete: playBouquet
    });
  }

  /* ── Music ─────────────────────────────────────── */
  function toggleMusic() {
    if (!music) music = NS.Music(CONFIG.music);
    var on = music.toggle();
    soundBtn.textContent = on ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', on ? 'Выключить музыку' : 'Включить музыку');
  }

  /* ── Debug / tooling hook (OG image + static SVG export) ── */
  function jumpToEnd() {
    gsap.killTweensOf([veil, intro, openBtn]);
    gsap.set(veil, { autoAlpha: 0 });
    if (introTl) introTl.progress(1);
    gsap.set([dedicationEl, nameEl], { visibility: 'visible' });
    gsap.set(nameGlowEl, { opacity: 1 });
    gsap.set(storyEl, { autoAlpha: 0 });
    gsap.set(hintEl, { autoAlpha: 0 });
    nameShineEl.classList.add('on');
    introDone = true;
    opened = true;
    gsap.set(openBtn, { autoAlpha: 0 });
    gsap.set(light, { opacity: 1 });
    bouquetTl.progress(1);
    bouquet.renderAll();
    placeIntro(false);
    gsap.set(finale, { autoAlpha: 1, y: 0 });
  }

  /* ── Init ──────────────────────────────────────── */
  function init() {
    if (!window.gsap || !NS.buildBouquet || !NS.Particles) throw new Error('animation libs missing');

    openBtn.textContent = CONFIG.button;
    replayBtn.textContent = CONFIG.replay;
    nameGlowEl.textContent = CONFIG.name;
    nameShineEl.textContent = CONFIG.name;
    hintEl.textContent = CONFIG.hint;
    var story = buildStory(CONFIG.story || []);

    var chars = splitChars(dedicationEl, CONFIG.dedication);
    var nameChars = splitChars(nameTextEl, CONFIG.name);

    particles = NS.Particles($('#sky'), { reduced: reduced });
    bouquet = NS.buildBouquet(wrap, CONFIG.bouquet);
    bouquetTl = bouquet.timeline(reduced);

    gsap.ticker.add(function () {
      if (bouquetTl.isActive() || renderOnce) { bouquet.renderAll(); renderOnce = false; }
    });

    layout();
    var resizeT = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(layout, 120);
    });

    openBtn.addEventListener('click', openBouquet);
    replayBtn.addEventListener('click', replay);
    soundBtn.addEventListener('click', toggleMusic);
    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('button')) return;
      if (!opened) { skipIntro(); return; } // FR-11
      if (tapEnabled) particles.burst(e.clientX, e.clientY, 8 + Math.floor(Math.random() * 8)); // FR-7
    });

    NS.debug = { jumpToEnd: jumpToEnd, particles: particles, bouquet: bouquet, config: CONFIG };

    if (/[?&]poster\b/.test(location.search)) {
      particles.start();
      jumpToEnd();
      return;
    }

    // Scene 1: dusk + fireflies
    particles.start();
    gsap.to(veil, { autoAlpha: 0, duration: reduced ? 0.8 : 1.6, ease: 'power1.inOut' });

    var minDelay = new Promise(function (res) { setTimeout(res, CONFIG.timing.silence * 1000); });
    Promise.all([minDelay, fontsReady(CONFIG.timing.fontTimeout)]).then(function () {
      introTl = buildIntro(story, chars, nameChars);
      introTl.play();
      if (wantSkip) introTl.progress(1);
    });
  }

  try {
    init();
  } catch (e) {
    fallback(e);
  }
})(window.Flowers = window.Flowers || {});
