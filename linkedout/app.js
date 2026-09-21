/* ============================================================
   LinkedOut — client logic
   No dependencies. Degrades to a readable page without storage.
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  /* ---------- storage (always optional) ---------- */
  var KEY = 'linkedout.v1';
  var state = { name: 'Your Name Here', resigned: [], letters: 0, streak: Date.now(), reacts: {} };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var loaded = JSON.parse(raw);
      for (var k in loaded) if (Object.prototype.hasOwnProperty.call(loaded, k)) state[k] = loaded[k];
    }
  } catch (e) { /* private window, blocked storage — carry on */ }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- toasts ---------- */
  var toaster = $('#toaster');
  function toast(html) {
    if (!toaster) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = html;
    toaster.appendChild(t);
    setTimeout(function () {
      t.className = 'toast out';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, 4200);
  }

  /* ---------- identity ---------- */
  function initials(n) {
    var parts = String(n).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'YN';
    var s = parts[0][0] + (parts[1] ? parts[1][0] : (parts[0][1] || ''));
    return s.toUpperCase();
  }
  var nameInput = $('#nameInput');
  function paintName() {
    var n = state.name || 'Your Name Here';
    $$('#avatarMain, #avatarComposer').forEach(function (a) { a.textContent = initials(n); });
    var sig = $('#sheetSig'), sigLine = $('#sheetSigLine');
    if (sig) sig.textContent = n;
    if (sigLine) sigLine.textContent = n + ' · Formerly of ' + ($('#fCompany') ? $('#fCompany').value : 'everywhere');
  }
  if (nameInput) {
    nameInput.value = state.name;
    nameInput.addEventListener('input', function () {
      state.name = nameInput.value || 'Your Name Here';
      paintName(); save();
    });
  }

  /* ---------- stats ---------- */
  function paintStats() {
    var n = state.resigned.length;
    var set = function (id, v) { var el = $(id); if (el) el.textContent = v; };
    set('#sJobs', n);
    set('#sLetters', state.letters);
    set('#sBridges', 3 + n * 2);
    set('#sUn', 47 + n * 3);
    var tally = $('#quitTally');
    if (tally) tally.textContent = (8 - n) + ' exit' + (8 - n === 1 ? '' : 's') + ' remaining';
  }

  /* ---------- unemployment streak ---------- */
  var streakEl = $('#streak');
  function tickStreak() {
    if (!streakEl) return;
    var ms = Date.now() - state.streak;
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000), d = Math.floor(s / 86400);
    var h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    var p = function (v) { return v < 10 ? '0' + v : '' + v; };
    streakEl.textContent = d + 'd ' + p(h) + 'h ' + p(m) + 'm ' + p(sec) + 's';
  }
  tickStreak();
  setInterval(tickStreak, 1000);

  var gotJob = $('#gotJob');
  if (gotJob) gotJob.addEventListener('click', function () {
    var days = Math.floor((Date.now() - state.streak) / 86400000);
    state.streak = Date.now(); save(); tickStreak();
    toast('Streak reset. <b>' + days + ' day' + (days === 1 ? '' : 's') + '</b> of freedom, gone. Was it worth it? It was not.');
  });

  /* ---------- tabs ---------- */
  var tabs = $$('.nav [role="tab"]');
  function show(name) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { show(t.getAttribute('data-tab')); });
  });
  $$('[data-goto]').forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-goto')); });
  });

  /* ---------- search (returns nothing, always) ---------- */
  var q = $('#q'), pop = $('#searchPop'), none = $('#searchNone');
  var NO_RESULTS = [
    '0 results. You are not qualified — but more importantly, you are not interested.',
    '0 results. Did you mean: lying down?',
    '0 results. Everything matching "{q}" has already been resigned from.',
    '0 results. We found 1,400 jobs and hid them from you, as a kindness.',
    '0 results. Try searching for something you actually want.'
  ];
  if (q && pop) {
    q.addEventListener('focus', function () { pop.hidden = false; });
    q.addEventListener('input', function () {
      pop.hidden = false;
      if (none) none.textContent = pick(NO_RESULTS).replace('{q}', q.value || 'that');
    });
    document.addEventListener('click', function (e) {
      if (!pop.contains(e.target) && e.target !== q) pop.hidden = true;
    });
    q.addEventListener('keydown', function (e) { if (e.key === 'Escape') { pop.hidden = true; q.blur(); } });
  }

  /* ---------- alerts (markup lives in the page; mirror it into the bell) ---------- */
  var noteList = $('#noteList'), notePopList = $('#notePopList');
  if (noteList && notePopList) notePopList.innerHTML = noteList.innerHTML;

  var bell = $('#bellBtn'), notePop = $('#notePop'), bellCount = $('#bellCount');
  if (bell && notePop) {
    bell.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = notePop.hidden;
      notePop.hidden = !open;
      bell.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && bellCount) bellCount.hidden = true;
    });
    document.addEventListener('click', function (e) {
      if (!notePop.hidden && !notePop.contains(e.target)) {
        notePop.hidden = true;
        bell.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- reactions ---------- */
  var REACTIONS = [['👎', 'Unlike'], ['🫠', 'Relatable'], ['😬', 'Cringe'], ['🔥', 'Burn'], ['↩️', 'Un-repost']];
  function wireReactions(bar, id) {
    bar.innerHTML = REACTIONS.map(function (r, i) {
      var on = state.reacts[id + ':' + i] ? '1' : '0';
      return '<button type="button" data-on="' + on + '" data-r="' + id + ':' + i + '"><em>' + r[0] + '</em>' + r[1] + '</button>';
    }).join('');
    $$('button', bar).forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-r');
        var on = b.getAttribute('data-on') === '1';
        b.setAttribute('data-on', on ? '0' : '1');
        if (on) { delete state.reacts[key]; } else { state.reacts[key] = 1; }
        save();
      });
    });
  }
  $$('#feed .react').forEach(function (bar, i) { wireReactions(bar, 'p' + i); });

  /* ---------- see more ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.more') : null;
    if (!btn) return;
    var rest = $('.rest', btn.parentNode);
    if (!rest) return;
    rest.hidden = !rest.hidden;
    btn.textContent = rest.hidden ? '…see more' : '…see less';
  });

  /* ---------- quit board ---------- */
  var RESIGN_TOASTS = [
    'You have resigned from a job you were never offered. <b>Congratulations.</b>',
    'Resignation filed. Somewhere, a chair is free.',
    'They have been notified. They did not know who you were, but they have been notified.',
    'Your resignation has been received and immediately framed.',
    'Done. Your manager has replied "let\'s discuss Monday." You will not be there Monday.',
    'Resigned. HR has scheduled an exit interview with an empty chair.',
    'Filed. Greg Tamblin has already congratulated you.'
  ];
  function markResigned(job, animate) {
    if ($('.stamp', job)) return;
    job.setAttribute('data-gone', '1');
    var stamp = document.createElement('div');
    stamp.className = 'stamp' + (animate ? ' drop' : '');
    stamp.textContent = 'RESIGNED';
    job.appendChild(stamp);

    var counter = $('.qc', job);
    if (counter) counter.textContent = (parseInt(job.getAttribute('data-q'), 10) + 1).toLocaleString();

    var act = $('.job-act', job);
    if (act) {
      act.innerHTML = '<button class="unresign" type="button">Un-resign (you monster)</button>';
      $('.unresign', act).addEventListener('click', function () {
        job.removeAttribute('data-gone');
        if ($('.stamp', job)) job.removeChild($('.stamp', job));
        if (counter) counter.textContent = parseInt(job.getAttribute('data-q'), 10).toLocaleString();
        act.innerHTML = '<button class="resign" type="button">Resign</button>';
        wireResign($('.resign', act), job);
        state.resigned = state.resigned.filter(function (x) { return x !== job.getAttribute('data-id'); });
        save(); paintStats();
        toast('Un-resigned. You crawled back. <b>Everyone saw.</b>');
      });
    }
  }
  function wireResign(btn, job) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      var id = job.getAttribute('data-id');
      if (state.resigned.indexOf(id) === -1) state.resigned.push(id);
      save(); markResigned(job, true); paintStats();
      toast(pick(RESIGN_TOASTS));
    });
  }
  $$('#jobs .job').forEach(function (job) {
    var counter = $('.qc', job);
    if (counter) counter.textContent = parseInt(job.getAttribute('data-q'), 10).toLocaleString();
    if (state.resigned.indexOf(job.getAttribute('data-id')) !== -1) markResigned(job, false);
    else wireResign($('.resign', job), job);
  });

  $$('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.getAttribute('data-filter');
      $$('.chip').forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
      $$('#jobs .job').forEach(function (j) {
        j.hidden = !(f === 'all' || j.getAttribute('data-mode') === f);
      });
    });
  });

  var nuke = $('#nukeBtn');
  if (nuke) nuke.addEventListener('click', function () {
    var left = $$('#jobs .job').filter(function (j) { return !j.hasAttribute('data-gone'); });
    if (!left.length) { toast('Nothing left to resign from. You have reached <b>total unemployment</b>.'); return; }
    left.forEach(function (j, i) {
      setTimeout(function () {
        var id = j.getAttribute('data-id');
        if (state.resigned.indexOf(id) === -1) state.resigned.push(id);
        markResigned(j, true); save(); paintStats();
      }, i * 110);
    });
    show('jobs');
    toast('You have resigned from <b>' + left.length + ' jobs simultaneously</b>. This is a personal record and a personal low.');
  });

  $$('.tier button').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-tier');
      toast(t === 'Free'
        ? 'You remain visible. <b>Everyone can still see you.</b> Some of them are recruiters.'
        : 'Welcome to <b>' + t + '</b>. You are now harder to find, starting with by yourself.');
    });
  });

  /* ============================================================
     LETTER LAB
     ============================================================ */
  var REASONS = {
    chair: 'The chair. I want to be specific, because HR will ask. It was the chair. It leans left, it has one arm, and at 3pm it makes a sound I have started to hear at home.',
    family: 'You said we were a family. I have a family. They do not ask me to log time in fifteen-minute increments in order to attend a funeral.',
    fun: 'Mandatory fun is not fun. It is a hostage situation with a playlist. I have done the escape room. I did not escape. I am escaping now.',
    fridge: 'The fridge. Someone has been eating my labelled food for nine months. I have narrowed it to eleven people and I no longer wish to share a building with any of them.',
    slack: 'At 11:47pm on a Tuesday you sent me a message that said "quick one". It was not quick. It was not one. It is, however, the reason for this letter.',
    offline: 'In a meeting — in a room, in person, with our actual bodies — someone said "let\'s take this offline." I have thought about it every day since. I have decided to take everything offline, beginning with me.',
    title: 'I was promoted into a title I cannot pronounce, cannot explain to my mother, and cannot locate in any legal definition of employment. I am un-promoting myself to "gone".',
    openplan: 'The open-plan office was described to me as "collaborative". I have now collaborated with the sound of forty people chewing. I would like to collaborate with silence, exclusively, at home, forever.'
  };

  var MIDDLE = ['After {t}, I am resigning.', 'I am resigning, after {t}.', 'My tenure of {t} ends today.', 'This concludes {t} of employment.'];

  var TONES = {
    poetry: {
      note: 'Says nothing, beautifully. HR will frame it.',
      open: [
        'Every journey has a runway. Mine has been deprioritised in this quarter\'s roadmap, moved to the backlog, and quietly archived by someone who does not know my name.',
        'We speak often of growth. Today I am growing — outward, through the fire exit, across the car park, and onward.',
        'There comes a moment in every transformation programme when the thing being transformed simply leaves. That moment is now. I am the thing.'
      ],
      twist: [
        'I want to thank you for the opportunity in the way one thanks weather.',
        'I leave no unfinished work behind me, because nothing here was ever finished, including the strategy.',
        'This is not a loss. It is a rebalancing of the portfolio, and I am the divestment.'
      ],
      close: [
        'Please consider this my notice, my exit interview and my final deliverable — submitted on time, for the first time.',
        'I wish {c} every success. That is a sentence, and sentences are free.',
        'Kindly revoke my access, my photograph, and any memory of me from the all-hands deck.'
      ],
      sign: ['Warmest regrets,', 'With synergy withdrawn,', 'Onwards, and specifically outwards,']
    },
    passive: {
      note: 'Every sentence is technically polite. None of them are.',
      open: [
        'Per my last forty emails, I am leaving.',
        'Just circling back on my entire existence here — I\'m going to go ahead and stop.',
        'Apologies for the delay on this! I have been drafting it since my first day.'
      ],
      twist: [
        'Happy to walk anyone through the handover, though as discussed, nobody has ever established what I do.',
        'Do let me know if anything is unclear. Historically that has not stopped anyone.',
        'No rush at all on the paperwork — please take exactly as long as you took over my review.'
      ],
      close: [
        'Thanks so much in advance for processing this, and for the two years of advance I processed for you.',
        'Copying HR for visibility, which I understand is something we value here.',
        'Let me know if you\'d like to grab a coffee sometime. I won\'t be there.'
      ],
      sign: ['Best (final),', 'Thanks in advance,', 'Kind regards — genuinely the last time,']
    },
    scorched: {
      note: 'Do not send this. You are going to send this.',
      open: [
        'I have read the culture deck. It is a hostage note with better kerning.',
        'I am leaving, effective the moment you finish reading this sentence. You have now finished it.',
        'This is less a resignation than an evacuation.'
      ],
      twist: [
        'You have built an organisation in which the only thing that ships is people.',
        'Everything I know about leadership I learned here, by watching very closely and then doing the opposite.',
        'The values are painted on the wall because they could not survive anywhere else in the building.'
      ],
      close: [
        'My handover document is one page. It reads: "run".',
        'I am taking my laptop charger, my dignity, and one (1) stapler, declared here in writing so it can never be used against me.',
        'Please do not use me as a reference. I will be honest.'
      ],
      sign: ['Sincerely — for the first time,', 'Regards withheld,', 'With the warmth of a burning bridge,']
    },
    influencer: {
      note: '🚨 Humbled. Honoured. Unemployed. 🚨',
      open: [
        '🚨 BIG NEWS 🚨 I am humbled, honoured and legally obliged to announce that I am leaving {c}.',
        'Most people would not post this. I am posting it. After {t}, I am moving on from {c}. Grab a coffee ☕ — this one is a thread.',
        'I wasn\'t going to share this. Then I remembered engagement. So: I am leaving {c}.'
      ],
      twist: [
        'Three lessons from my time here:\n1. Nothing is permanent.\n2. Especially me.\n3. Always post the announcement before the exit interview.',
        'People ask what my secret is. It is simple: leave. That\'s it. That is the entire framework. I will be charging for it.',
        'Someone once told me to bring my whole self to work. I did. Both of us are leaving.'
      ],
      close: [
        'To everyone who supported me: thank you. To everyone who did not: also thank you — you were the content.',
        'DMs open for opportunities I will not read. 🙏',
        'Unlike if you have ever left somewhere. Comment "GONE" and I will send you absolutely nothing.'
      ],
      sign: ['Grateful, humbled, gone,', 'Stay hungry. Stay unemployed.', 'Onwards 🚀 (outwards),']
    },
    sincere: {
      note: 'Starts earnest. Does not stay that way.',
      open: [
        'I have written this letter eleven times. The first ten were shorter. This one is honest.',
        'I don\'t want to make this dramatic, so I will simply say: I have thought about this every single day since March.',
        'I want you to know that I tried. I want you to know exactly how much I tried. I have a spreadsheet of how much I tried.'
      ],
      twist: [
        'I used to be a person who watered the plant on my desk. I would like to go back to being that person.',
        'At some point I stopped being someone who works here and became someone who is here. I would like to be neither.',
        'I am not angry. I want that on the record, because what follows will sound angry, and it isn\'t. It is only true.'
      ],
      close: [
        'I hope you are all well. I mean that — in the way people mean things when they are never coming back.',
        'Please don\'t throw me a party. I will attend, and it will be worse.',
        'I will return the badge. I would like to keep the lanyard. I have grown attached to it, which is the only thing here I managed.'
      ],
      sign: ['With love, and a locked laptop,', 'Sincerely, and at last quietly,', 'All my best, from very far away,']
    }
  };

  var PS = [
    'P.S. The mug was mine. The plant was mine. The feelings were mine. I have taken all three.',
    'P.S. I have already changed the Wi-Fi password. Not maliciously. I simply could.',
    'P.S. This letter is also my exit interview. Thank you for attending my exit interview.',
    'P.S. Whoever has been eating my labelled food: I know. I have always known.',
    'P.S. There is a Tupperware of mine in the fridge. Consider it severance.',
    'P.S. The 3pm sound is the chair. It was always the chair. Tell the next person.',
    'P.S. Please do not add me on LinkedOut.',
    'P.S. I would like it formally noted that I never once said "let\'s take this offline".'
  ];

  var tone = 'poetry';
  var lastLetter = null;

  function fill(str, c, t) {
    return String(str).replace(/\{c\}/g, c).replace(/\{t\}/g, t);
  }

  function compose() {
    var c = ($('#fCompany') && $('#fCompany').value.trim()) || 'Synergaze';
    var t = $('#fTenure') ? $('#fTenure').value : 'some time';
    var r = $('#fReason') ? $('#fReason').value : 'family';
    var T = TONES[tone];
    var paras = [
      fill(pick(T.open), c, t),
      fill(pick(MIDDLE), c, t) + ' ' + REASONS[r],
      fill(pick(T.twist), c, t),
      fill(pick(T.close), c, t)
    ];
    return { company: c, salute: 'Dear ' + c + ',', paras: paras, sign: pick(T.sign), ps: pick(PS) };
  }

  function render(L) {
    lastLetter = L;
    var body = $('#sheetBody'), date = $('#sheetDate');
    if (!body) return;
    if (date) {
      try {
        date.textContent = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
      } catch (e) { date.textContent = new Date().toDateString(); }
    }
    var n = state.name || 'Your Name Here';
    body.innerHTML =
      '<p>' + esc(L.salute) + '</p>' +
      L.paras.map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('') +
      '<p>' + esc(L.sign) + '</p>' +
      '<div class="sig" id="sheetSig">' + esc(n) + '</div>' +
      '<div class="sig-line" id="sheetSigLine">' + esc(n) + ' · Formerly of ' + esc(L.company) + '</div>' +
      '<p class="ps" id="sheetPs">' + esc(L.ps) + '</p>';
  }

  function plain(L) {
    var n = state.name || 'Your Name Here';
    return [L.salute, '', L.paras.join('\n\n'), '', L.sign, n, '', L.ps].join('\n');
  }

  $$('.tone').forEach(function (b) {
    b.addEventListener('click', function () {
      tone = b.getAttribute('data-tone');
      $$('.tone').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      var note = $('#toneNote');
      if (note) note.textContent = TONES[tone].note;
      render(compose());
    });
  });

  var genBtn = $('#genBtn');
  if (genBtn) genBtn.addEventListener('click', function () {
    render(compose());
    state.letters++; save(); paintStats();
    toast('Draft ' + state.letters + ' filed. <b>Do not send it before 9am.</b> Send it at 9:01.');
  });

  ['#fCompany', '#fTenure', '#fReason'].forEach(function (sel) {
    var el = $(sel);
    if (el) el.addEventListener('change', function () { render(compose()); paintName(); });
  });

  var copyBtn = $('#copyBtn');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var text = plain(lastLetter || compose());
    var done = function () { toast('Letter copied. <b>Paste responsibly.</b>'); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else { fallback(); }
    } catch (e) { fallback(); }
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        document.body.removeChild(ta); done();
      } catch (e2) {
        toast('Copy blocked by your browser. <b>Select the letter and copy it by hand</b>, like a resignation should be.');
      }
    }
  });

  var HEADLINES = [
    'I\'m humbled and devastated to announce that I am leaving {c}.',
    'Some personal news: after a long think in a car park, I am leaving {c}.',
    'Today is my last day at {c}. It is also, coincidentally, my best day.',
    'I have news. It is not good news for {c}. It is excellent news for me.'
  ];
  var postBtn = $('#postBtn');
  if (postBtn) postBtn.addEventListener('click', function () {
    var L = lastLetter || compose();
    var feed = $('#feed');
    if (!feed) return;
    var n = state.name || 'Your Name Here';
    var art = document.createElement('article');
    art.className = 'card post';
    art.innerHTML =
      '<div class="post-h"><div class="avatar" aria-hidden="true">' + esc(initials(n)) + '</div>' +
      '<div class="post-who"><b>' + esc(n) + '</b>' +
      '<span>Formerly of ' + esc(L.company) + ' · Open to nothing</span><time>now · 0 views</time></div></div>' +
      '<div class="post-body">' + esc(fill(pick(HEADLINES), L.company, '')) + '\n\n' + esc(L.paras[0]) +
      '<span class="rest" hidden>\n\n' + esc(L.paras.slice(1).join('\n\n')) + '\n\n' + esc(L.sign) + '\n' + esc(n) +
      '\n\n<span class="tags">#OpenToNothing #Resigned #Blessed</span></span> ' +
      '<button class="more" type="button">…see more</button></div>' +
      '<div class="post-count"><span>0 unlikes</span><span>·</span><span>1 comment</span><span>·</span><span>0 job offers</span></div>' +
      '<div class="react"></div>' +
      '<div class="comment"><div class="avatar" aria-hidden="true">GT</div>' +
      '<div class="comment-b"><b>Greg Tamblin <i>· Congratulator</i></b><p>Congrats!! 🎉 Onwards and upwards 🙌</p></div></div>';
    feed.insertBefore(art, feed.firstChild);
    wireReactions($('.react', art), 'u' + Date.now());
    show('feed');
    toast('Posted. <b>Greg Tamblin has already congratulated you.</b>');
  });

  /* ---------- boot ---------- */
  paintName();
  paintStats();
  if ($('#toneNote')) $('#toneNote').textContent = TONES[tone].note;
})();
