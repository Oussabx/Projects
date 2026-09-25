(function () {
  var root = document.documentElement;

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

  // Projects
  var grid = document.getElementById('projects');
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function renderProjects(filter) {
    grid.innerHTML = '';
    (window.PROJECTS || []).forEach(function (p) {
      if (filter !== 'all' && p.categories.indexOf(filter) === -1) return;
      var card = el('article', 'project');
      var media = el('div', 'project-media');
      var img = el('img');
      img.src = p.image;
      img.alt = p.title + ' preview';
      img.loading = 'lazy';
      img.width = 800;
      img.height = 520;
      media.appendChild(img);
      var body = el('div', 'project-body');
      body.appendChild(el('p', 'project-role', p.role));
      body.appendChild(el('h3', 'project-title', p.title));
      body.appendChild(el('p', 'project-summary', p.summary));
      var tags = el('ul', 'tags');
      p.tags.forEach(function (t) { tags.appendChild(el('li', null, t)); });
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
      renderProjects(btn.dataset.filter);
    });
  });
  renderProjects('all');

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

  // Contact form → opens the visitor's mail app (no backend needed)
  var form = document.getElementById('contactForm');
  var note = document.getElementById('formNote');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      note.textContent = 'Please fill in your name, a valid email and a message.';
      note.className = 'form-note is-error';
      return;
    }
    var name = document.getElementById('name').value.trim();
    var subject = encodeURIComponent('Portfolio enquiry from ' + name);
    var body = encodeURIComponent(document.getElementById('message').value.trim() + '\n\n— ' + name + ' (' + document.getElementById('email').value.trim() + ')');
    window.location.href = 'mailto:you@example.com?subject=' + subject + '&body=' + body;
    note.textContent = 'Opening your email app… thanks for reaching out!';
    note.className = 'form-note is-success';
  });
})();
