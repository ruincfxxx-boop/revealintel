// ===== Reveal — Main Script =====
document.addEventListener('DOMContentLoaded', () => {

  // Auto-Login Status
  const isIndex = !window.location.pathname.includes('dashboard.html');
  const hasSavedKey = !!localStorage.getItem('reveal_active_key');

  const navLinks = document.querySelectorAll('.nav-link');
  const scrollSections = document.querySelectorAll('.scroll-section');
  const accessBtn = document.getElementById('access-btn');
  const overlay = document.getElementById('access-overlay');
  const accessCard = document.getElementById('access-card');
  const accessGlow = document.getElementById('access-card-glow');
  const accessClose = document.getElementById('access-close');
  const accessTabs = document.querySelectorAll('.access-tab');
  const accessPanels = document.querySelectorAll('.access-tab-panel');

  // ============================
  // Scroll Reveal Animations
  // ============================
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.scroll-reveal').forEach(el => {
    revealObserver.observe(el);
  });

  // ============================
  // Nav Smooth Scroll + Active Highlighting
  // ============================
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Highlight nav link based on scroll position
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          const linkTarget = link.getAttribute('href').substring(1);
          link.classList.toggle('active', linkTarget === id);
        });
      }
    });
  }, { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' });

  scrollSections.forEach(section => {
    sectionObserver.observe(section);
  });

  // ============================
  // Stat Counter Animation
  // ============================
  const statValues = document.querySelectorAll('.stat-value[data-count]');

  function animateCounter(el) {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const duration = 1800;
    const startTime = performance.now();
    const hasDecimal = target % 1 !== 0;

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = target * eased;

      if (hasDecimal) {
        el.textContent = current.toFixed(1) + suffix;
      } else {
        el.textContent = Math.round(current) + suffix;
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statValues.forEach(el => statsObserver.observe(el));

  // ============================
  // Access Gateway Modal
  // ============================
  function openAccess() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    function onAnimEnd() {
      accessCard.style.animation = 'none';
      accessCard.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
      accessCard.removeEventListener('animationend', onAnimEnd);
    }
    accessCard.addEventListener('animationend', onAnimEnd);

    setTimeout(() => {
      const tokenInput = document.getElementById('access-token');
      if (tokenInput) tokenInput.focus();
      loadCaptcha();
    }, 500);
  }
  
  function loadCaptcha() {
    fetch('/api/captcha')
      .then(res => res.json())
      .then(data => {
        const cId = document.getElementById('captcha-id');
        const cQ = document.getElementById('captcha-question');
        const cA = document.getElementById('captcha-answer');
        if (cId) cId.value = data.id;
        if (cQ) cQ.textContent = data.question;
        if (cA) cA.value = '';

        const cIdS = document.getElementById('captcha-id-signup');
        const cQS = document.getElementById('captcha-question-signup');
        const cAS = document.getElementById('captcha-answer-signup');
        if (cIdS) cIdS.value = data.id;
        if (cQS) cQS.textContent = data.question;
        if (cAS) cAS.value = '';
      })
      .catch(err => {
        const cQ = document.getElementById('captcha-question');
        const cQS = document.getElementById('captcha-question-signup');
        if (cQ) cQ.textContent = "Failed to load Captcha. Please refresh.";
        if (cQS) cQS.textContent = "Failed to load Captcha. Please refresh.";
      });
  }

  function closeAccess() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    accessCard.style.animation = '';
    accessCard.style.transform = '';
  }

  if (accessBtn) {
    if (hasSavedKey && isIndex) {
      accessBtn.textContent = 'Open Dashboard';
      accessBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'dashboard.html';
      });
    } else {
      accessBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openAccess();
      });
    }
  }

  if (accessClose) {
    accessClose.addEventListener('click', closeAccess);
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAccess();
    });
  }

  // Handle Sign In submission
  const accessSubmit = document.getElementById('access-submit');
  if (accessSubmit) {
    accessSubmit.addEventListener('click', (e) => {
      e.preventDefault();
      
      const tokenInput = document.getElementById('access-token');
      const token = tokenInput ? tokenInput.value.trim() : '';
      const captchaId = document.getElementById('captcha-id').value;
      const captchaAnswer = document.getElementById('captcha-answer').value.trim();
      const submitBtn = document.getElementById('access-submit');
      
      if (token && captchaId && captchaAnswer) {
        submitBtn.textContent = 'Verifying...';
        submitBtn.disabled = true;
        
        fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: token, captchaId, captchaAnswer })
        })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            alert(data.error);
            submitBtn.innerHTML = 'Sign In'; 
            submitBtn.disabled = false;
            loadCaptcha();
          } else {
            if (data.location === 'known') {
              localStorage.setItem('reveal_active_key', token);
              localStorage.setItem('reveal_username', data.user);
            } else {
              sessionStorage.setItem('reveal_active_key', token);
              sessionStorage.setItem('reveal_username', data.user);
              alert("New location detected. Your session will not be saved permanently.");
            }
            window.location.href = 'dashboard.html';
          }
        })
        .catch(err => {
          alert('Login failed due to network error.');
          submitBtn.textContent = 'Sign In';
          submitBtn.disabled = false;
        });
      }
    });
  }

  // Handle Sign Up submission
  const signupSubmit = document.getElementById('access-signup-submit');
  if (signupSubmit) {
    signupSubmit.addEventListener('click', (e) => {
      e.preventDefault();
      
      const usernameInput = document.getElementById('access-username');
      const passwordInput = document.getElementById('access-password');
      const emailInput = document.getElementById('access-email');
      const discordInput = document.getElementById('access-discord');
      const inviteInput = document.getElementById('access-invite');
      
      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const discordId = discordInput ? discordInput.value.trim() : '';
      const invite = inviteInput ? inviteInput.value.trim() : '';
      const captchaId = document.getElementById('captcha-id-signup').value;
      const captchaAnswer = document.getElementById('captcha-answer-signup').value.trim();
      
      if (username && password && email && captchaId && captchaAnswer) {
        signupSubmit.textContent = 'Creating...';
        signupSubmit.disabled = true;
        
        fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, email, discordId, invite, captchaId, captchaAnswer })
        })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            alert(data.error);
            signupSubmit.innerHTML = 'Create Account';
            signupSubmit.disabled = false;
            loadCaptcha();
          } else {
            localStorage.setItem('reveal_active_key', data.key);
            localStorage.setItem('reveal_username', data.user);
            window.location.href = 'dashboard.html';
          }
        })
        .catch(err => {
          alert('Sign Up failed due to network error.');
          signupSubmit.textContent = 'Create Account';
          signupSubmit.disabled = false;
        });
      } else {
        alert('Please fill out all required fields.');
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      closeAccess();
    }
  });

  // Tab switching
  accessTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      accessTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      accessPanels.forEach(panel => panel.classList.remove('active'));
      const targetPanel = document.getElementById(`tab-${target}`);
      if (targetPanel) {
        requestAnimationFrame(() => targetPanel.classList.add('active'));
      }
    });
  });

  // ============================
  // 3D Tilt Effect
  // ============================
  function setupTilt(cardEl, glowEl) {
    if (!cardEl) return;
    const maxRotation = 12;
    let cardRect = null;
    let rafId = null;
    let targetRotateX = 0;
    let targetRotateY = 0;
    let currentRotateX = 0;
    let currentRotateY = 0;
    let isHovering = false;

    function updateCardTransform() {
      const lerpFactor = 0.12;
      currentRotateX += (targetRotateX - currentRotateX) * lerpFactor;
      currentRotateY += (targetRotateY - currentRotateY) * lerpFactor;

      cardEl.style.transform = `perspective(800px) rotateX(${currentRotateX}deg) rotateY(${currentRotateY}deg) scale(1)`;

      if (isHovering || Math.abs(currentRotateX - targetRotateX) > 0.05 || Math.abs(currentRotateY - targetRotateY) > 0.05) {
        rafId = requestAnimationFrame(updateCardTransform);
      } else {
        currentRotateX = 0;
        currentRotateY = 0;
        cardEl.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
        rafId = null;
      }
    }

    cardEl.addEventListener('mouseenter', () => {
      isHovering = true;
      cardRect = cardEl.getBoundingClientRect();
      cardEl.style.transition = 'none';
      if (!rafId) {
        rafId = requestAnimationFrame(updateCardTransform);
      }
    });

    cardEl.addEventListener('mousemove', (e) => {
      if (!cardRect) cardRect = cardEl.getBoundingClientRect();

      const x = e.clientX - cardRect.left;
      const y = e.clientY - cardRect.top;
      const centerX = cardRect.width / 2;
      const centerY = cardRect.height / 2;

      const normalizedX = (x - centerX) / centerX;
      const normalizedY = (y - centerY) / centerY;

      targetRotateY = normalizedX * maxRotation;
      targetRotateX = -normalizedY * maxRotation;

      const glowX = (x / cardRect.width) * 100;
      const glowY = (y / cardRect.height) * 100;
      cardEl.style.setProperty('--glow-x', `${glowX}%`);
      cardEl.style.setProperty('--glow-y', `${glowY}%`);
      if (glowEl) {
        glowEl.style.setProperty('--glow-x', `${glowX}%`);
        glowEl.style.setProperty('--glow-y', `${glowY}%`);
      }

      const shadowX = -normalizedX * 20;
      const shadowY = -normalizedY * 20;
      cardEl.style.boxShadow = `
        0 0 0 1px rgba(255,255,255,0.04),
        ${shadowX}px ${shadowY + 20}px 60px -12px rgba(0, 0, 0, 0.7),
        0 0 40px rgba(0, 0, 0, 0.3)
      `;

      if (!rafId) {
        rafId = requestAnimationFrame(updateCardTransform);
      }
    });

    cardEl.addEventListener('mouseleave', () => {
      isHovering = false;
      targetRotateX = 0;
      targetRotateY = 0;
      cardRect = null;

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      cardEl.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s ease';
      cardEl.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
      cardEl.style.boxShadow = `
        0 0 0 1px rgba(255,255,255,0.04),
        0 20px 60px -12px rgba(0, 0, 0, 0.7),
        0 0 40px rgba(0, 0, 0, 0.3)
      `;

      function onTransEnd(e) {
        if (e.propertyName === 'transform') {
          cardEl.style.transition = 'none';
          currentRotateX = 0;
          currentRotateY = 0;
          cardEl.removeEventListener('transitionend', onTransEnd);
        }
      }
      cardEl.addEventListener('transitionend', onTransEnd);
    });
  }

  setupTilt(accessCard, accessGlow);
  const apiTerminal = document.getElementById('api-terminal');
  setupTilt(apiTerminal, null);

  // ============================
  // Nav scroll effect
  // ============================
  const nav = document.getElementById('main-nav');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.style.borderBottomColor = 'rgba(255, 255, 255, 0.06)';
    } else {
      nav.style.borderBottomColor = 'rgba(255, 255, 255, 0.04)';
    }
  });

  // ============================
  // Hero mouse glow
  // ============================
  const hero = document.querySelector('.hero');
  if (hero) {
    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      hero.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      hero.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    });
  }

  // ============================
  // Cart & Checkout Logic
  // ============================
  let cart = [];
  const PLATFORM_FEE = 1.50;

  const cartBadge = document.getElementById('cart-badge');
  const cartEmpty = document.getElementById('cart-empty');
  const cartItemsWrap = document.getElementById('cart-items-wrap');
  const cartItemsContainer = document.getElementById('cart-items');
  const checkoutItemsContainer = document.getElementById('checkout-items');
  
  const els = {
    cartSub: document.getElementById('cart-subtotal'),
    cartFee: document.getElementById('cart-fee'),
    cartTot: document.getElementById('cart-total'),
    checkSub: document.getElementById('checkout-subtotal'),
    checkFee: document.getElementById('checkout-fee'),
    checkTot: document.getElementById('checkout-total'),
    payText: document.getElementById('checkout-pay-text'),
    payBtn: document.getElementById('checkout-pay-btn')
  };

  function updateCartBadge() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    cartBadge.textContent = count;
    if (count > 0) {
      cartBadge.classList.add('visible');
      cartBadge.classList.remove('pop');
      void cartBadge.offsetWidth;
      cartBadge.classList.add('pop');
    } else {
      cartBadge.classList.remove('visible');
    }
  }

  function renderCart() {
    updateCartBadge();
    
    if (cart.length === 0) {
      if (cartEmpty) cartEmpty.style.display = 'block';
      if (cartItemsWrap) cartItemsWrap.style.display = 'none';
      return;
    }

    if (cartEmpty) cartEmpty.style.display = 'none';
    if (cartItemsWrap) cartItemsWrap.style.display = 'block';

    let subtotal = 0;
    
    // Render Cart Page Items
    if (cartItemsContainer) {
      cartItemsContainer.innerHTML = cart.map((item, i) => {
        subtotal += item.price * item.qty;
        return `
          <div class="cart-item">
            <div class="cart-item-icon">${item.name.charAt(0)}</div>
            <div class="cart-item-info">
              <div class="cart-item-name">${item.name}</div>
              <div class="cart-item-cycle">Monthly License</div>
            </div>
            <div class="cart-item-qty">
              <button class="cart-qty-btn" onclick="updateQty(${i}, -1)">-</button>
              <div class="cart-qty-value">${item.qty}</div>
              <button class="cart-qty-btn" onclick="updateQty(${i}, 1)">+</button>
            </div>
            <div class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</div>
            <button class="cart-item-remove" onclick="removeFromCart(${i})">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        `;
      }).join('');
    }

    // Render Checkout Sidebar Items
    if (checkoutItemsContainer) {
      checkoutItemsContainer.innerHTML = cart.map(item => `
        <div class="checkout-order-item">
          <span class="checkout-order-item-name">${item.name} x${item.qty}</span>
          <span>$${(item.price * item.qty).toFixed(2)}</span>
        </div>
      `).join('');
    }

    const total = subtotal + PLATFORM_FEE;
    const subStr = `$${subtotal.toFixed(2)}`;
    const feeStr = `$${PLATFORM_FEE.toFixed(2)}`;
    const totStr = `$${total.toFixed(2)}`;

    if (els.cartSub) els.cartSub.textContent = subStr;
    if (els.checkSub) els.checkSub.textContent = subStr;
    if (els.cartFee) els.cartFee.textContent = feeStr;
    if (els.checkFee) els.checkFee.textContent = feeStr;
    if (els.cartTot) els.cartTot.textContent = totStr;
    if (els.checkTot) els.checkTot.textContent = totStr;
    if (els.payText) els.payText.textContent = `Pay ${totStr}`;
  }

  window.updateQty = (index, delta) => {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) {
      cart.splice(index, 1);
    }
    renderCart();
  };

  window.removeFromCart = (index) => {
    cart.splice(index, 1);
    renderCart();
  };

  // Toast Notification
  function showToast(message) {
    let toast = document.getElementById('cart-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'cart-toast';
      toast.className = 'cart-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `
      <svg class="cart-toast-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span>${message}</span>
    `;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Add to Cart Handlers
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = btn.dataset.plan;
      const price = parseFloat(btn.dataset.price);
      const name = btn.dataset.name;
      
      const existing = cart.find(i => i.plan === plan);
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({ plan, price, name, qty: 1 });
      }
      
      // Ensure the cart section is visible when something is added
      const cartSect = document.getElementById('cart');
      if (cartSect) {
        cartSect.style.display = 'block';
      }
      
      renderCart();
      showToast(`${name} added to cart`);
    });
  });

  // Nav Cart Icon Click Handler
  const navCartBtn = document.getElementById('nav-cart-btn');
  if (navCartBtn) {
    navCartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const cartSect = document.getElementById('cart');
      if (cartSect) {
        cartSect.style.display = 'block';
        cartSect.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // Proceed to checkout
  const btnCheckout = document.getElementById('cart-checkout-btn');
  if (btnCheckout) {
    btnCheckout.addEventListener('click', () => {
      const checkoutSect = document.getElementById('checkout');
      if (checkoutSect) {
        checkoutSect.style.display = 'block';
        checkoutSect.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // Payment Selection
  const payOptions = document.querySelectorAll('.checkout-payment-option');
  payOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      payOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      const radio = opt.querySelector('input');
      radio.checked = true;

      document.getElementById('payment-details-stripe').style.display = 'none';
      document.getElementById('payment-details-crypto').style.display = 'none';
      document.getElementById('payment-details-cashapp').style.display = 'none';
      document.getElementById('payment-details-venmo').style.display = 'none';

      const method = radio.value;
      if (document.getElementById(`payment-details-${method}`)) {
        document.getElementById(`payment-details-${method}`).style.display = 'block';
      }
    });
  });

  // Mock Payment Flow
  if (els.payBtn) {
    els.payBtn.addEventListener('click', async () => {
      if (cart.length === 0) return;
      
      const email = document.getElementById('checkout-email').value.trim();
      if (!email) {
        showToast('Please enter your email address');
        return;
      }
      
      const selectedPlan = cart[0].plan.charAt(0).toUpperCase() + cart[0].plan.slice(1);
      const method = document.querySelector('input[name="payment"]:checked').value;

      const discordId = document.getElementById('checkout-discord') ? document.getElementById('checkout-discord').value.trim() : '';

      els.payBtn.classList.add('loading');
      els.payText.textContent = 'Processing...';
      
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, plan: selectedPlan, method, discordId })
        });
        const data = await res.json();

        // Redirect to NowPayments Crypto Invoice if returned
        if (data.redirect) {
          window.location.href = data.redirect;
          return;
        }

        document.querySelector('.checkout-layout').style.display = 'none';
        
        const successSect = document.getElementById('checkout-success');
        const successDetails = document.getElementById('checkout-success-details');
        
        successDetails.innerHTML = `
          <div class="checkout-success-row">
            <span>Item</span>
            <span>${cart[0].name}</span>
          </div>
          <div class="cart-summary-divider"></div>
          <div class="checkout-success-row">
            <span>Total Paid</span>
            <span>${els.checkTot.textContent}</span>
          </div>
          <div class="checkout-success-row" style="margin-top: 12px; font-size: 15px;">
            <span>API Key</span>
            <span style="color:#4ade80; font-family:var(--font-mono); user-select:all;">${data.key.key}</span>
          </div>
          <div style="font-size: 11px; margin-top: 16px; color: rgba(255,255,255,0.4); text-align:center;">
            A receipt and a copy of your API Key have been sent to <strong>${email}</strong>.<br>
            Please save your key securely!
          </div>
        `;
        
        successSect.style.display = 'block';
        
        // Save to local storage for automatic login
        localStorage.setItem('rawintel_active_key', data.key.key);
        
        cart = [];
        renderCart();
      } catch (err) {
        console.error(err);
        showToast('Checkout failed. Please try again.');
        els.payBtn.classList.remove('loading');
        els.payText.textContent = `Pay ${els.checkTot.textContent}`;
      }
    });
  }

  // Init cart state
  renderCart();

  // ============================
  // Interactive Background Canvas
  // ============================
  const canvas = document.getElementById('bg-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    const maxParticles = 80;

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    let mouse = { x: null, y: null };
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
    window.addEventListener('mouseout', () => {
      mouse.x = null;
      mouse.y = null;
    });

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.8;
        this.vy = (Math.random() - 0.5) * 0.8;
        this.radius = Math.random() * 2 + 1;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx = -this.vx;
        if (this.y < 0 || this.y > height) this.vy = -this.vy;

        if (mouse.x != null && mouse.y != null) {
          let dx = mouse.x - this.x;
          let dy = mouse.y - this.y;
          let distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 180) {
            // Attract to mouse
            this.x += dx * 0.03;
            this.y += dy * 0.03;
          }
        }
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
      }
    }

    for (let i = 0; i < maxParticles; i++) {
      particles.push(new Particle());
    }

    function animateBg() {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        
        // Draw line to mouse
        if (mouse.x != null && mouse.y != null) {
          let dxm = mouse.x - particles[i].x;
          let dym = mouse.y - particles[i].y;
          let distMouse = Math.sqrt(dxm * dxm + dym * dym);
          if (distMouse < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 - distMouse / 150 * 0.4})`;
            ctx.lineWidth = 1;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }

        for (let j = i; j < particles.length; j++) {
          let dx = particles[i].x - particles[j].x;
          let dy = particles[i].y - particles[j].y;
          let distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 - distance / 120 * 0.3})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(animateBg);
    }
    animateBg();
  }

});
