/* ============================================
   CUSTOM CURSOR
   ============================================ */
const cursor = document.getElementById('cursor');
const follower = document.getElementById('cursorFollower');
let mouseX = 0, mouseY = 0;
let followerX = 0, followerY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  cursor.style.left = mouseX + 'px';
  cursor.style.top = mouseY + 'px';
});

function animateFollower() {
  followerX += (mouseX - followerX) * 0.12;
  followerY += (mouseY - followerY) * 0.12;
  follower.style.left = followerX + 'px';
  follower.style.top = followerY + 'px';
  requestAnimationFrame(animateFollower);
}
animateFollower();

/* ============================================
   NAVBAR SCROLL EFFECT
   ============================================ */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}, { passive: true });

/* ============================================
   MOBILE MENU
   ============================================ */
const navToggle = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');
let menuOpen = false;

navToggle.addEventListener('click', () => {
  menuOpen = !menuOpen;
  mobileMenu.classList.toggle('open', menuOpen);
  const spans = navToggle.querySelectorAll('span');
  if (menuOpen) {
    spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
    spans[1].style.transform = 'rotate(-45deg) translate(5px, -5px)';
  } else {
    spans[0].style.transform = '';
    spans[1].style.transform = '';
  }
});

mobileMenu.querySelectorAll('.mobile-link').forEach(link => {
  link.addEventListener('click', () => {
    menuOpen = false;
    mobileMenu.classList.remove('open');
    const spans = navToggle.querySelectorAll('span');
    spans[0].style.transform = '';
    spans[1].style.transform = '';
  });
});

/* ============================================
   PARALLAX DECO TEXT
   ============================================ */
const decoName = document.getElementById('decoName');
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  if (decoName) {
    decoName.style.transform = `translateX(${scrollY * -0.15}px)`;
  }
}, { passive: true });

/* ============================================
   HERO IMAGE TILT
   ============================================ */
const heroImg = document.getElementById('heroImg');
const heroImageContainer = heroImg?.closest('.hero-image-container');

if (heroImageContainer) {
  heroImageContainer.addEventListener('mousemove', (e) => {
    const rect = heroImageContainer.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    heroImg.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.02)`;
  });
  heroImageContainer.addEventListener('mouseleave', () => {
    heroImg.style.transform = '';
    heroImg.style.transition = 'transform 0.6s ease';
    setTimeout(() => { heroImg.style.transition = ''; }, 600);
  });
}

/* ============================================
   SCROLL REVEAL
   ============================================ */
const revealEls = document.querySelectorAll(
  '.about-grid, .about-title, .about-text, .tag, .stats-row, .stat-item, ' +
  '.projects-header, .project-card, .services-header, .service-item, ' +
  '.testimonial-card, .contact-title, .contact-sub, .contact-form, .contact-socials'
);

revealEls.forEach((el) => el.classList.add('reveal'));

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
);

revealEls.forEach((el) => revealObserver.observe(el));

/* Staggered children */
document.querySelectorAll('.about-tags, .stats-row, .projects-grid, .services-list, .testimonials-track').forEach((container) => {
  const children = container.children;
  Array.from(children).forEach((child, i) => {
    child.classList.add('reveal');
    child.style.transitionDelay = `${i * 0.08}s`;
    revealObserver.observe(child);
  });
});

/* ============================================
   COUNTER ANIMATION
   ============================================ */
function animateCounter(el, target, duration = 1800) {
  let start = 0;
  const step = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };
  requestAnimationFrame(step);
}

const statNumbers = document.querySelectorAll('.stat-number');
const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const target = parseInt(entry.target.dataset.target, 10);
        animateCounter(entry.target, target);
        counterObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 }
);

statNumbers.forEach((el) => counterObserver.observe(el));

/* ============================================
   CONTACT FORM
   ============================================ */
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('.btn-submit');
    const original = btn.textContent;
    btn.textContent = '¡Enviado! ✓';
    btn.style.background = '#4ade80';
    setTimeout(() => {
      btn.textContent = original;
      btn.style.background = '';
      contactForm.reset();
    }, 3000);
  });
}

/* ============================================
   SMOOTH ANCHOR SCROLL
   ============================================ */
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ============================================
   SERVICE ITEMS — SLIDE HOVER EFFECT
   ============================================ */
document.querySelectorAll('.service-item').forEach((item) => {
  item.addEventListener('mouseenter', () => {
    item.style.paddingLeft = '2.5rem';
    item.style.paddingRight = '2.5rem';
  });
  item.addEventListener('mouseleave', () => {
    item.style.paddingLeft = '';
    item.style.paddingRight = '';
  });
});

/* ============================================
   HERO LINK ROWS — RIPPLE EFFECT
   ============================================ */
document.querySelectorAll('.hero-link-row').forEach((row) => {
  row.addEventListener('click', (e) => {
    const ripple = document.createElement('span');
    const rect = row.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px; height: ${size}px;
      left: ${e.clientX - rect.left - size / 2}px;
      top: ${e.clientY - rect.top - size / 2}px;
      background: rgba(212,255,94,0.15);
      border-radius: 50%;
      transform: scale(0);
      animation: rippleAnim 0.6s ease-out forwards;
      pointer-events: none;
    `;
    row.style.position = 'relative';
    row.style.overflow = 'hidden';
    row.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
});

/* Inject ripple keyframe */
const style = document.createElement('style');
style.textContent = `
  @keyframes rippleAnim {
    to { transform: scale(2.5); opacity: 0; }
  }
`;
document.head.appendChild(style);

/* ============================================
   TAG HOVER — MAGNETIC EFFECT
   ============================================ */
document.querySelectorAll('.tag').forEach((tag) => {
  tag.addEventListener('mousemove', (e) => {
    const rect = tag.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.3;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.3;
    tag.style.transform = `translate(${x}px, ${y}px)`;
  });
  tag.addEventListener('mouseleave', () => {
    tag.style.transform = '';
  });
});

/* ============================================
   NAVBAR LINKS — UNDERLINE SLIDE
   ============================================ */
document.querySelectorAll('.nav-link').forEach((link) => {
  link.insertAdjacentHTML('beforeend', '<span class="nav-underline" style="display:block;height:1px;background:var(--accent);transform:scaleX(0);transform-origin:left;transition:transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94);margin-top:1px"></span>');
  link.addEventListener('mouseenter', () => {
    link.querySelector('.nav-underline').style.transform = 'scaleX(1)';
  });
  link.addEventListener('mouseleave', () => {
    link.querySelector('.nav-underline').style.transform = 'scaleX(0)';
  });
});

/* ============================================
   PAGE LOAD — FADE IN
   ============================================ */
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 0.5s ease';
window.addEventListener('load', () => {
  document.body.style.opacity = '1';
});
