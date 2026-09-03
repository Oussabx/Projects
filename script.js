const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const navToggle = document.getElementById('navToggle');
const nav = document.getElementById('nav');
if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- Scroll reveal ---- */
if (!prefersReducedMotion && 'IntersectionObserver' in window) {
  const revealEls = document.querySelectorAll('[data-reveal]');
  revealEls.forEach((el, i) => {
    const group = el.closest('[data-reveal-group]');
    if (group) el.style.setProperty('--i', i % 6);
  });
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
}

/* ---- 3D tilt on cards ---- */
if (!prefersReducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.tilt-card, .gallery-tile').forEach((card) => {
    const strength = card.classList.contains('gallery-tile') ? 6 : 10;
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(800px) rotateX(${(-y * strength).toFixed(2)}deg) rotateY(${(x * strength).toFixed(2)}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

/* ---- Parallax blobs ---- */
if (!prefersReducedMotion) {
  const parallaxEls = Array.from(document.querySelectorAll('[data-parallax]'));
  if (parallaxEls.length) {
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      parallaxEls.forEach((el) => {
        const speed = parseFloat(el.dataset.parallax) || 0.15;
        el.style.transform = `translateY(${(y * speed).toFixed(1)}px)`;
      });
      ticking = false;
    };
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );
    update();
  }
}

/* ---- Booking form -> WhatsApp ---- */
const bookingForm = document.getElementById('bookingForm');
if (bookingForm) {
  bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(bookingForm);
    const petName = data.get('petName') || '';
    const petType = data.get('petType') || '';
    const service = data.get('service') || '';
    const preferredTime = data.get('preferredTime') || '';
    const address = data.get('address') || '';
    const notes = data.get('notes') || '';

    const lines = [
      `Hi Pet Hero! I'd like to book a grooming appointment.`,
      petName ? `Pet name: ${petName}` : '',
      petType ? `Pet type: ${petType}` : '',
      service ? `Service: ${service}` : '',
      preferredTime ? `Preferred time: ${preferredTime}` : '',
      address ? `Address: ${address}` : '',
      notes ? `Notes: ${notes}` : '',
    ].filter(Boolean);

    const message = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/96179450883?text=${message}`, '_blank', 'noopener');
  });
}
