/**
 * DocLocker — Main Landing Page Script (js/main.js)
 * Handles mobile menu drawer, FAQ accordion toggles, active nav highlights,
 * and session-aware header button updates on index.html.
 */

(function () {
  'use strict';

  const SESSION_KEY = 'doclocker_active_session';

  document.addEventListener('DOMContentLoaded', function () {
    initMobileNav();
    initFaqAccordion();
    initSessionHeaderState();
    initScrollNavHighlight();
  });

  /**
   * Toggle mobile navigation drawer cleanly.
   */
  function initMobileNav() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const navPanel = document.getElementById('mobileNavPanel');
    if (!menuBtn || !navPanel) return;

    menuBtn.addEventListener('click', function () {
      const isOpen = navPanel.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(isOpen));
    });

    // Close mobile menu when any link inside is clicked
    navPanel.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navPanel.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /**
   * Accessible FAQ accordion toggle.
   */
  function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    if (!faqItems.length) return;

    faqItems.forEach(function (item) {
      const btn = item.querySelector('.faq-question');
      if (!btn) return;

      btn.addEventListener('click', function () {
        const isAlreadyOpen = item.classList.contains('open');

        // Close all items first for clean single-open behavior
        faqItems.forEach(function (other) {
          other.classList.remove('open');
          const otherBtn = other.querySelector('.faq-question');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        });

        if (!isAlreadyOpen) {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /**
   * Update top nav CTA if user already has an active demo session.
   */
  function initSessionHeaderState() {
    try {
      const rawSession = localStorage.getItem(SESSION_KEY);
      if (!rawSession) return;
      const session = JSON.parse(rawSession);
      if (!session || !session.userId) return;

      const navActions = document.getElementById('navAuthActions');
      const mobileActions = document.getElementById('mobileAuthActions');
      const heroStartBtn = document.getElementById('heroGetStartedBtn');

      if (navActions) {
        navActions.innerHTML =
          '<a href="dashboard.html" class="btn btn-primary">Open Dashboard</a>';
      }
      if (mobileActions) {
        mobileActions.innerHTML =
          '<a href="dashboard.html" class="btn btn-primary btn-full">Open Dashboard</a>';
      }
      if (heroStartBtn) {
        heroStartBtn.setAttribute('href', 'dashboard.html');
        heroStartBtn.firstChild.textContent = 'Go to Dashboard ';
      }
    } catch (err) {
      // Ignore storage parse issues cleanly
    }
  }

  /**
   * Highlight nav link matching current scroll section.
   */
  function initScrollNavHighlight() {
    const links = document.querySelectorAll('.nav-links .nav-link');
    const sections = ['home', 'about', 'features', 'faqs']
      .map(function (id) {
        return document.getElementById(id);
      })
      .filter(Boolean);

    if (!links.length || !sections.length) return;

    window.addEventListener(
      'scroll',
      function () {
        const scrollPos = window.scrollY + 120;
        let currentId = 'home';

        sections.forEach(function (section) {
          if (section.offsetTop <= scrollPos) {
            currentId = section.id;
          }
        });

        links.forEach(function (link) {
          const href = link.getAttribute('href');
          if (href === '#' + currentId) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      },
      { passive: true }
    );
  }
})();
