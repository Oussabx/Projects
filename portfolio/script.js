(function () {
  var root = document.documentElement;
  var content = { site: null, projects: [] };

  // Footer year
  document.getElementById('year').textContent = new Date().getFullYear();

  // Theme toggle (light / dark), remembered per browser
  var themeToggle = document.getElementById('themeToggle');
  function currentTheme() {
    if (root.dataset.theme) return root.dataset.theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  themeToggle.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  // Mobile nav
  var nav = document.getElementById('nav');
  var navToggle = document.getElementById('navToggle');
  function setNav(open) {
    nav.classList.toggle('is-open', open);
    navToggle.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  navToggle.addEventListener('click', function () {
    setNav(!nav.classList.contains('is-open'));
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') setNav(false);
  });

  // Header shadow on scroll
  var header = document.getElementById('header');
  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Helpers ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
  // Renders *word* as <em>word</em>; everything else is plain text.
  function setEmphasis(node, text) {
    node.textContent = '';
    text.split(/\*([^*]+)\*/).forEach(function (part, i) {
      node.appendChild(i % 2 ? el('em', null, part) : document.createTextNode(part));
    });
  }
  function fill(container, items, build) {
    if (!container || !items) return;
    container.innerHTML = '';
    items.forEach(function (item) { container.appendChild(build(item)); });
  }

  // ---------- Site content (content/site.json, edited in /admin) ----------
  function renderSite(site) {
    document.querySelectorAll('[data-field]').forEach(function (node) {
      var value = get(site, node.dataset.field);
      if (typeof value !== 'string' || !value) return;
      if (node.dataset.format === 'emphasis') setEmphasis(node, value);
      else node.textContent = value;
    });

    document.title = site.name + ' — ' + site.title;
    var desc = document.querySelector('meta[name="description"]');
    if (desc && site.hero && site.hero.lead) desc.setAttribute('content', site.hero.lead);

    var hero = site.hero || {};
    document.getElementById('availability').hidden = hero.showAvailability === false;
    fill(document.getElementById('heroStats'), hero.stats, function (s) {
      var li = el('li');
      li.appendChild(el('strong', null, s.value));
      li.appendChild(el('span', null, s.label));
      return li;
    });

    var about = site.about || {};
    fill(document.getElementById('aboutText'), about.paragraphs, function (t) { return el('p', null, t); });
    fill(document.getElementById('skills'), about.skillGroups, function (g) {
      var group = el('div', 'skill-group');
      group.appendChild(el('h3', null, g.name));
      var ul = el('ul', 'chips');
      (g.skills || []).forEach(function (s) { ul.appendChild(el('li', null, s)); });
      group.appendChild(ul);
      return group;
    });
    var avatar = document.getElementById('avatar');
    avatar.setAttribute('aria-label', 'Portrait of ' + site.name);
    if (about.photo) {
      var img = el('img');
      img.src = about.photo;
      img.alt = '';
      avatar.textContent = '';
      avatar.appendChild(img);
    }

    var contact = site.contact || {};
    if (contact.email) {
      var mail = document.getElementById('contactEmail');
      mail.href = 'mailto:' + contact.email;
      mail.textContent = contact.email;
    }
    fill(document.getElementById('socials'), contact.socials, function (s) {
      var li = el('li');
      var a = el('a', null, s.label);
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener';
      li.appendChild(a);
      return li;
    });
  }

  // ---------- Projects (content/projects.json, edited in /admin) ----------
  var grid = document.getElementById('projects');
  var activeFilter = 'all';
  function renderProjects() {
    grid.innerHTML = '';
    var shown = content.projects.filter(function (p) {
      return p.visible !== false &&
        (activeFilter === 'all' || (p.categories || []).indexOf(activeFilter) !== -1);
    });
    if (!shown.length) {
      grid.appendChild(el('p', 'projects-empty', 'No projects here yet.'));
      return;
    }
    shown.forEach(function (p) {
      var card = el('article', 'project');
      var media = el('div', 'project-media');
      if (p.image) {
        var img = el('img');
        img.src = p.image;
        img.alt = p.title + ' preview';
        img.loading = 'lazy';
        img.width = 800;
        img.height = 520;
        media.appendChild(img);
      }
      var body = el('div', 'project-body');
      if (p.role) body.appendChild(el('p', 'project-role', p.role));
      body.appendChild(el('h3', 'project-title', p.title));
      if (p.summary) body.appendChild(el('p', 'project-summary', p.summary));
      var tags = el('ul', 'tags');
      (p.tags || []).forEach(function (t) { tags.appendChild(el('li', null, t)); });
      body.appendChild(tags);
      if (p.links && p.links.length) {
        var links = el('div', 'project-links');
        p.links.forEach(function (l) {
          var a = el('a', 'link-arrow', l.label + ' ↗');
          a.href = l.href;
          a.target = '_blank';
          a.rel = 'noopener';
          links.appendChild(a);
        });
        body.appendChild(links);
      }
      card.appendChild(media);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }
  var filters = document.querySelectorAll('.filter');
  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filters.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      activeFilter = btn.dataset.filter;
      renderProjects();
    });
  });

  function loadJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }
  loadJSON('content/site.json')
    .then(function (site) { content.site = site; renderSite(site); })
    .catch(function (e) { console.warn('Using built-in page text:', e.message); });
  loadJSON('content/projects.json')
    .then(function (data) { content.projects = data.projects || []; renderProjects(); })
    .catch(function (e) {
      console.warn(e.message);
      grid.appendChild(el('p', 'projects-empty', 'Projects could not be loaded.'));
    });

  // Scroll reveal
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('js-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (r) { io.observe(r); });
  }

  // Contact form: posts to the form service set in /admin (e.g. Formspree),
  // otherwise falls back to opening the visitor's email app.
  var form = document.getElementById('contactForm');
  var note = document.getElementById('formNote');
  var submitBtn = form.querySelector('button[type="submit"]');
  function setNote(text, kind) {
    note.textContent = text;
    note.className = 'form-note' + (kind ? ' is-' + kind : '');
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      setNote('Please fill in your name, a valid email and a message.', 'error');
      return;
    }
    var contact = (content.site && content.site.contact) || {};
    var name = document.getElementById('name').value.trim();
    var email = document.getElementById('email').value.trim();
    var message = document.getElementById('message').value.trim();

    if (contact.formEndpoint) {
      submitBtn.disabled = true;
      setNote('Sending…');
      fetch(contact.formEndpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form)
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        form.reset();
        setNote('Thanks, ' + name + '! Your message was sent — I\'ll get back to you soon.', 'success');
      }).catch(function () {
        setNote('Sorry, that didn\'t send. Please email me directly instead.', 'error');
      }).then(function () { submitBtn.disabled = false; });
      return;
    }

    var to = contact.email || 'you@example.com';
    var subject = encodeURIComponent('Portfolio enquiry from ' + name);
    var body = encodeURIComponent(message + '\n\n— ' + name + ' (' + email + ')');
    window.location.href = 'mailto:' + to + '?subject=' + subject + '&body=' + body;
    setNote('Opening your email app… thanks for reaching out!', 'success');
  });
})();
