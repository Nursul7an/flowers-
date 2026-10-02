/* Background music. By default a soft music-box lullaby is synthesised with
 * Web Audio (zero bytes to download, no licensing questions). If config.music.src
 * points to an .mp3, that file is used instead and only fetched on first play. */
(function (NS) {
  'use strict';

  // Am – F – C – G, arpeggiated; MIDI note numbers
  var CHORDS = [
    [57, 60, 64, 69, 72, 69, 64, 60],
    [53, 57, 60, 65, 69, 65, 60, 57],
    [48, 55, 60, 64, 67, 64, 60, 55],
    [55, 59, 62, 67, 71, 67, 62, 59]
  ];
  var MELODY = [76, null, 74, 72, 74, null, 72, 69, 72, null, 71, 67, 71, null, 74, null];

  function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  NS.Music = function (cfg) {
    cfg = cfg || {};
    var ctx = null, master = null, timer = 0, nextTime = 0, stepIdx = 0, playing = false;
    var audio = null;
    var BEAT = 60 / (cfg.bpm || 76) / 2; // eighth notes

    function setupSynth() {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0;
      // soft echo for a "room" feel
      var delay = ctx.createDelay(1);
      delay.delayTime.value = BEAT * 3;
      var fb = ctx.createGain(); fb.gain.value = 0.28;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      master.connect(ctx.destination);
      master.connect(delay);
      delay.connect(lp); lp.connect(fb); fb.connect(delay);
      lp.connect(ctx.destination);
      return true;
    }

    function note(m, time, vol, len) {
      var o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o2.type = 'triangle';
      o.frequency.value = freq(m); o2.frequency.value = freq(m) * 2;
      var g2 = ctx.createGain(); g2.gain.value = 0.18;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(vol, time + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, time + len);
      o.start(time); o2.start(time);
      o.stop(time + len + 0.05); o2.stop(time + len + 0.05);
    }

    // warm sustained pad under each chord
    function pad(m, time, len) {
      [-4, 4].forEach(function (cents) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq(m);
        o.detune.value = cents;
        o.connect(g); g.connect(master);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.linearRampToValueAtTime(0.026, time + 0.9);
        g.gain.setValueAtTime(0.026, time + len - 0.6);
        g.gain.linearRampToValueAtTime(0.0001, time + len + 0.4);
        o.start(time); o.stop(time + len + 0.5);
      });
    }

    function schedule() {
      while (nextTime < ctx.currentTime + 0.25) {
        var chord = CHORDS[Math.floor(stepIdx / 8) % CHORDS.length];
        if (stepIdx % 8 === 0) {
          pad(chord[0] - 12, nextTime, BEAT * 8);
          pad(chord[1], nextTime, BEAT * 8);
          pad(chord[2], nextTime, BEAT * 8);
        }
        note(chord[stepIdx % 8], nextTime, 0.12, 1.6);
        var mel = MELODY[stepIdx % MELODY.length];
        if (mel && Math.floor(stepIdx / 16) % 2 === 1) note(mel, nextTime, 0.09, 2.2);
        nextTime += BEAT;
        stepIdx++;
      }
    }

    function playSynth() {
      if (!ctx && !setupSynth()) return false;
      if (ctx.state === 'suspended') ctx.resume();
      stepIdx = 0;
      nextTime = ctx.currentTime + 0.08;
      clearInterval(timer);
      timer = setInterval(schedule, 90);
      schedule();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(cfg.volume || 0.5, ctx.currentTime + 1.5);
      return true;
    }

    function stopSynth() {
      if (!ctx) return;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      setTimeout(function () { if (!playing) { clearInterval(timer); ctx.suspend(); } }, 700);
    }

    function playFile() {
      if (!audio) {
        audio = new Audio(cfg.src); // lazy: fetched only now
        audio.loop = true;
        audio.preload = 'auto';
      }
      audio.volume = cfg.volume || 0.5;
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
      return true;
    }

    // keep quiet while the tab is hidden
    document.addEventListener('visibilitychange', function () {
      if (!playing) return;
      if (document.hidden) {
        if (ctx) { clearInterval(timer); ctx.suspend(); }
        if (audio) audio.pause();
      } else {
        if (cfg.src) playFile(); else playSynth();
      }
    });

    function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

    // Resolves true when sound is actually playing. Without a user gesture
    // browsers keep audio blocked; then this resolves false and the caller
    // should try again from a tap.
    function start() {
      if (playing) return Promise.resolve(true);
      if (cfg.src) {
        if (!audio) { audio = new Audio(cfg.src); audio.loop = true; audio.preload = 'auto'; }
        audio.volume = cfg.volume || 0.5;
        return Promise.resolve(audio.play()).then(function () { playing = true; return true; })
          .catch(function () { return false; });
      }
      if (!ctx && !setupSynth()) return Promise.resolve(false);
      var resumed = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
      // a blocked resume() never settles, so don't wait for it forever
      return Promise.race([resumed, wait(350)]).then(function () {
        if (ctx.state !== 'running') return false;
        playing = true;
        playSynth();
        return true;
      }).catch(function () { return false; });
    }

    function stop() {
      if (!playing) return;
      playing = false;
      if (cfg.src) { if (audio) audio.pause(); } else stopSynth();
    }

    return {
      get playing() { return playing; },
      start: start,
      stop: stop,
      toggle: function () {
        if (playing) { stop(); return Promise.resolve(false); }
        return start();
      }
    };
  };
})(window.Flowers = window.Flowers || {});
