/**
 * DocLocker — Authentication & Login Security Prototype (js/auth.js)
 * Handles registration validation, password strength & matching,
 * show/hide password toggles, Forgot Password UI modal,
 * demo login authentication, and 3-attempt consecutive failure lockout.
 *
 * IMPORTANT: This is a student frontend prototype. Real authentication,
 * password hashing, and permanent account lockouts MUST be enforced on a backend.
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    USERS: 'doclocker_users',
    SESSION: 'doclocker_active_session',
    FAILED_ATTEMPTS: 'doclocker_failed_attempts',
    LOCKOUT_UNTIL: 'doclocker_lockout_until',
  };

  const MAX_FAILED_ATTEMPTS = 3;
  const LOCKOUT_DURATION_MS = 30 * 1000; // 30-second demo lockout window

  let lockoutTimerId = null;

  document.addEventListener('DOMContentLoaded', function () {
    seedDefaultDemoUser();
    initPasswordToggles();

    if (document.getElementById('loginForm')) {
      initLoginPage();
    }

    if (document.getElementById('registerForm')) {
      initRegisterPage();
    }
  });

  /**
   * Ensure the default demo user exists in localStorage for instant evaluation.
   */
  function seedDefaultDemoUser() {
    const users = getStoredUsers();
    const hasDemo = users.some(function (u) {
      return u.userId.toLowerCase() === 'vishal2026';
    });

    if (!hasDemo) {
      users.push({
        fullName: 'Vishal Kumar',
        userId: 'vishal2026',
        email: 'vishal.demo@doclocker.local',
        passwordHash: simpleDemoEncode('Vault@2026'),
        createdAt: '2026-11-01T10:00:00.000Z',
        isDemo: true,
      });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    }
  }

  /**
   * Non-cryptographic encoding used strictly for prototype demo comparison
   * so plaintext demo strings aren't mirrored verbatim in session state.
   */
  function simpleDemoEncode(raw) {
    return btoa(unescape(encodeURIComponent('mv_demo_' + raw)));
  }

  function getStoredUsers() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Wire all Show/Hide password toggle buttons cleanly.
   */
  function initPasswordToggles() {
    const toggleButtons = document.querySelectorAll('[data-toggle-password]');
    toggleButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const targetId = btn.getAttribute('data-toggle-password');
        const input = document.getElementById(targetId);
        if (!input) return;

        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        btn.setAttribute('aria-pressed', String(isHidden));
        btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        btn.innerHTML = isHidden ? getEyeOffSvg() : getEyeSvg();
      });
    });
  }

  /* ========================================================================
     LOGIN PAGE FLOW & 3-ATTEMPT LOCKOUT DEMO
     ======================================================================== */
  function initLoginPage() {
    const form = document.getElementById('loginForm');
    const userIdInput = document.getElementById('loginUserId');
    const passwordInput = document.getElementById('loginPassword');
    const fillDemoBtn = document.getElementById('fillDemoBtn');
    const infoAlert = document.getElementById('loginInfoAlert');
    const infoText = document.getElementById('loginInfoText');

    // Check URL flags for helpful feedback
    const params = new URLSearchParams(window.location.search);
    if (params.get('registered') === '1' && infoAlert && infoText) {
      infoText.textContent = 'Account created successfully! Please sign in with your User ID and Password.';
      infoAlert.classList.remove('hidden');
    } else if (params.get('auth') === 'required' && infoAlert && infoText) {
      infoText.textContent = 'Please sign in to access your DocLocker dashboard.';
      infoAlert.classList.remove('hidden');
    } else if (params.get('loggedout') === '1' && infoAlert && infoText) {
      infoText.textContent = 'You have been logged out safely.';
      infoAlert.classList.remove('hidden');
    }

    // Convenience button to fill demo credentials
    if (fillDemoBtn) {
      fillDemoBtn.addEventListener('click', function () {
        userIdInput.value = 'vishal2026';
        passwordInput.value = 'Vault@2026';
        clearFieldError(userIdInput, 'loginUserIdError');
        clearFieldError(passwordInput, 'loginPasswordError');
      });
    }

    initForgotPasswordModal();
    checkExistingLockout();

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      if (isCurrentlyLockedOut()) {
        checkExistingLockout();
        return;
      }

      const userId = userIdInput.value.trim();
      const password = passwordInput.value;

      let valid = true;
      clearFieldError(userIdInput, 'loginUserIdError');
      clearFieldError(passwordInput, 'loginPasswordError');

      if (!userId) {
        setFieldError(userIdInput, 'loginUserIdError', 'Please enter your User ID.');
        valid = false;
      }

      if (!password) {
        setFieldError(passwordInput, 'loginPasswordError', 'Please enter your password.');
        valid = false;
      }

      if (!valid) return;

      const users = getStoredUsers();
      const matchedUser = users.find(function (u) {
        return (
          u.userId.toLowerCase() === userId.toLowerCase() &&
          u.passwordHash === simpleDemoEncode(password)
        );
      });

      if (matchedUser) {
        // Successful login: reset failure counter and store active session
        resetFailedAttempts();
        const sessionPayload = {
          userId: matchedUser.userId,
          fullName: matchedUser.fullName,
          email: matchedUser.email,
          createdAt: matchedUser.createdAt,
          loggedInAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionPayload));
        window.location.href = 'dashboard.html';
        return;
      }

      // Invalid credentials: increment consecutive failed login counter
      handleFailedLoginAttempt();
    });
  }

  function getFailedAttemptCount() {
    return parseInt(sessionStorage.getItem(STORAGE_KEYS.FAILED_ATTEMPTS) || '0', 10) || 0;
  }

  function resetFailedAttempts() {
    sessionStorage.removeItem(STORAGE_KEYS.FAILED_ATTEMPTS);
    sessionStorage.removeItem(STORAGE_KEYS.LOCKOUT_UNTIL);
    if (lockoutTimerId) {
      clearInterval(lockoutTimerId);
      lockoutTimerId = null;
    }
  }

  function isCurrentlyLockedOut() {
    const until = parseInt(sessionStorage.getItem(STORAGE_KEYS.LOCKOUT_UNTIL) || '0', 10);
    return until > Date.now();
  }

  function handleFailedLoginAttempt() {
    const nextCount = getFailedAttemptCount() + 1;
    sessionStorage.setItem(STORAGE_KEYS.FAILED_ATTEMPTS, String(nextCount));

    if (nextCount >= MAX_FAILED_ATTEMPTS) {
      const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      sessionStorage.setItem(STORAGE_KEYS.LOCKOUT_UNTIL, String(lockoutUntil));
      activateLockoutUi(lockoutUntil);
    } else {
      const remaining = MAX_FAILED_ATTEMPTS - nextCount;
      showLoginError(
        'Invalid User ID or Password!',
        'Attempt ' +
          nextCount +
          ' of ' +
          MAX_FAILED_ATTEMPTS +
          ' failed. ' +
          remaining +
          ' attempt' +
          (remaining === 1 ? '' : 's') +
          ' remaining before temporary lockout.'
      );
    }
  }

  function checkExistingLockout() {
    const until = parseInt(sessionStorage.getItem(STORAGE_KEYS.LOCKOUT_UNTIL) || '0', 10);
    if (until > Date.now()) {
      activateLockoutUi(until);
    } else if (until > 0) {
      resetFailedAttempts();
    }
  }

  function activateLockoutUi(lockoutUntil) {
    const submitBtn = document.getElementById('loginSubmitBtn');
    const userIdInput = document.getElementById('loginUserId');
    const passwordInput = document.getElementById('loginPassword');

    if (submitBtn) submitBtn.disabled = true;
    if (userIdInput) userIdInput.disabled = true;
    if (passwordInput) passwordInput.disabled = true;

    function updateCountdown() {
      const msLeft = lockoutUntil - Date.now();
      if (msLeft <= 0) {
        resetFailedAttempts();
        if (submitBtn) submitBtn.disabled = false;
        if (userIdInput) userIdInput.disabled = false;
        if (passwordInput) passwordInput.disabled = false;
        hideLoginError();
        return;
      }

      const secondsLeft = Math.ceil(msLeft / 1000);
      showLoginError(
        'Account Temporarily Locked (Demo Security)',
        'Too many consecutive failed login attempts (3/3). Try again in ' +
          secondsLeft +
          's. Note: Client-side lockouts do not permanently suspend accounts; real authentication and lockout policies must be enforced on a backend.'
      );
    }

    updateCountdown();
    if (lockoutTimerId) clearInterval(lockoutTimerId);
    lockoutTimerId = setInterval(updateCountdown, 1000);
  }

  function showLoginError(title, detail) {
    const alertBox = document.getElementById('loginErrorAlert');
    const titleEl = document.getElementById('loginErrorTitle');
    const detailEl = document.getElementById('loginErrorDetail');
    if (!alertBox || !titleEl || !detailEl) return;

    titleEl.textContent = title;
    detailEl.textContent = detail;
    alertBox.classList.remove('hidden');
  }

  function hideLoginError() {
    const alertBox = document.getElementById('loginErrorAlert');
    if (alertBox) alertBox.classList.add('hidden');
  }

  /**
   * Forgot Password UI-only modal handler.
   */
  function initForgotPasswordModal() {
    const trigger = document.getElementById('forgotPasswordBtn');
    const modal = document.getElementById('forgotModal');
    const closeBtn = document.getElementById('closeForgotModal');
    const cancelBtn = document.getElementById('cancelForgotModal');
    const forgotForm = document.getElementById('forgotForm');
    const forgotFeedback = document.getElementById('forgotFeedback');
    const forgotInput = document.getElementById('forgotUserEmail');

    if (!trigger || !modal) return;

    function openModal() {
      modal.classList.remove('hidden');
      if (forgotFeedback) forgotFeedback.classList.add('hidden');
      if (forgotInput) forgotInput.focus();
    }

    function closeModal() {
      modal.classList.add('hidden');
    }

    trigger.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    if (forgotForm) {
      forgotForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const val = forgotInput ? forgotInput.value.trim() : '';
        if (!val) return;
        if (forgotFeedback) {
          forgotFeedback.textContent =
            'UI Preview: If a backend email service were active, password reset instructions for "' +
            val +
            '" would be sent securely.';
          forgotFeedback.classList.remove('hidden');
        }
      });
    }
  }

  /* ========================================================================
     REGISTRATION PAGE VALIDATION & ACCOUNT CREATION
     ======================================================================== */
  function initRegisterPage() {
    const form = document.getElementById('registerForm');
    const fullNameInput = document.getElementById('regFullName');
    const userIdInput = document.getElementById('regUserId');
    const emailInput = document.getElementById('regEmail');
    const passwordInput = document.getElementById('regPassword');
    const confirmInput = document.getElementById('regConfirmPassword');
    const registerAlert = document.getElementById('registerAlert');

    passwordInput.addEventListener('input', function () {
      updatePasswordStrengthUI(passwordInput.value);
      if (confirmInput.value) {
        validatePasswordMatch();
      }
    });

    confirmInput.addEventListener('input', validatePasswordMatch);

    function validatePasswordMatch() {
      if (confirmInput.value !== passwordInput.value) {
        setFieldError(
          confirmInput,
          'regConfirmPasswordError',
          'Passwords do not match.'
        );
        return false;
      }
      clearFieldError(confirmInput, 'regConfirmPasswordError');
      return true;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (registerAlert) registerAlert.classList.add('hidden');

      const fullName = fullNameInput.value.trim();
      const userId = userIdInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const confirmPassword = confirmInput.value;

      let isValid = true;

      clearFieldError(fullNameInput, 'regFullNameError');
      clearFieldError(userIdInput, 'regUserIdError');
      clearFieldError(emailInput, 'regEmailError');
      clearFieldError(passwordInput, 'regPasswordError');
      clearFieldError(confirmInput, 'regConfirmPasswordError');

      if (fullName.length < 2) {
        setFieldError(fullNameInput, 'regFullNameError', 'Enter your full name (at least 2 characters).');
        isValid = false;
      }

      if (!/^[a-zA-Z0-9_]{4,20}$/.test(userId)) {
        setFieldError(
          userIdInput,
          'regUserIdError',
          'User ID must be 4–20 characters using letters, numbers, or underscores.'
        );
        isValid = false;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFieldError(emailInput, 'regEmailError', 'Enter a valid email address.');
        isValid = false;
      }

      const pwdCheck = evaluatePassword(password);
      if (!pwdCheck.isStrong) {
        setFieldError(
          passwordInput,
          'regPasswordError',
          'Password must be 8+ characters with uppercase, lowercase, a number, and a special character.'
        );
        isValid = false;
      }

      if (!confirmPassword || password !== confirmPassword) {
        setFieldError(confirmInput, 'regConfirmPasswordError', 'Passwords must match.');
        isValid = false;
      }

      if (!isValid) return;

      const users = getStoredUsers();
      const duplicate = users.some(function (u) {
        return u.userId.toLowerCase() === userId.toLowerCase();
      });

      if (duplicate) {
        setFieldError(userIdInput, 'regUserIdError', 'This User ID is already taken. Choose another.');
        return;
      }

      users.push({
        fullName: fullName,
        userId: userId,
        email: email,
        passwordHash: simpleDemoEncode(password),
        createdAt: new Date().toISOString(),
        isDemo: false,
      });

      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      window.location.href = 'login.html?registered=1';
    });
  }

  function evaluatePassword(pwd) {
    const hasLength = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasDigit = /\d/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

    let score = 0;
    if (hasLength) score++;
    if (hasUpper && hasLower) score++;
    if (hasDigit) score++;
    if (hasSpecial) score++;

    return {
      score: score,
      isStrong: hasLength && hasUpper && hasLower && hasDigit && hasSpecial,
    };
  }

  function updatePasswordStrengthUI(pwd) {
    const bars = [
      document.getElementById('strengthBar1'),
      document.getElementById('strengthBar2'),
      document.getElementById('strengthBar3'),
      document.getElementById('strengthBar4'),
    ];
    const label = document.getElementById('strengthLabel');
    if (!bars[0] || !label) return;

    const result = evaluatePassword(pwd);
    const colors = ['#E2E8F0', '#DC2626', '#D97706', '#2563EB', '#15803D'];
    const labels = [
      'Use at least 8 characters with mixed case, a digit, and a symbol.',
      'Weak — add uppercase, numbers, and symbols.',
      'Fair — keep adding missing character types.',
      'Good — almost ready.',
      'Strong password.',
    ];

    const activeColor = pwd.length === 0 ? colors[0] : colors[result.score];
    bars.forEach(function (bar, index) {
      bar.style.backgroundColor =
        pwd.length > 0 && index < result.score ? activeColor : '#DCE6F5';
    });
    label.textContent = pwd.length === 0 ? labels[0] : labels[result.score];
  }

  /* ========================================================================
     SHARED FIELD & SVG HELPERS
     ======================================================================== */
  function setFieldError(input, errorId, message) {
    input.classList.add('is-invalid');
    const el = document.getElementById(errorId);
    if (el) el.textContent = message;
  }

  function clearFieldError(input, errorId) {
    input.classList.remove('is-invalid');
    const el = document.getElementById(errorId);
    if (el) el.textContent = '';
  }

  function getEyeSvg() {
    return (
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>' +
      '<circle cx="12" cy="12" r="3"></circle>' +
      '</svg>'
    );
  }

  function getEyeOffSvg() {
    return (
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>' +
      '<line x1="1" y1="1" x2="23" y2="23"></line>' +
      '</svg>'
    );
  }
})();
