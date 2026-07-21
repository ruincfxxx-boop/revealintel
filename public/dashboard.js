// ===== KRYPTONITE DASHBOARD LOGIC =====

document.addEventListener('DOMContentLoaded', () => {
  const activeKey = localStorage.getItem('reveal_active_key');
  const username = localStorage.getItem('reveal_username') || (activeKey ? activeKey.split('-')[0] : 'Guest');

  // If no active key, redirect back to home
  if (!activeKey) {
    window.location.href = '/';
    return;
  }

  // Populate Dashboard Profile Data
  const kpName = document.getElementById('kp-name');
  const navKeyDisplay = document.getElementById('nav-key-display');
  const kpActive = document.getElementById('kp-active');
  const kpDate = document.getElementById('kp-date');
  const kpHiddenKey = document.getElementById('kp-hidden-key');
  const kpKeyBox = document.querySelector('.kp-key-value');

  if (kpName) kpName.textContent = username;
  if (navKeyDisplay) navKeyDisplay.textContent = username;

  // Set Current Time and Date
  const now = new Date();
  if (kpActive) {
    kpActive.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (kpDate) {
    kpDate.textContent = now.toLocaleDateString('en-GB'); // dd/mm/yyyy
  }

  // Handle Hidden Key Reveal Toggle
  if (kpKeyBox && kpHiddenKey) {
    let isHidden = true;
    kpKeyBox.style.cursor = 'pointer';
    kpKeyBox.addEventListener('click', () => {
      isHidden = !isHidden;
      if (isHidden) {
        kpHiddenKey.textContent = '••••••••••••••••';
      } else {
        kpHiddenKey.textContent = activeKey;
      }
    });
  }

  // User Dropdown Menu
  const userDropdownBtn = document.getElementById('dash-user-dropdown');
  const userMenu = document.getElementById('dash-user-menu');
  const signOutBtn = document.getElementById('sign-out-btn');

  if (userDropdownBtn && userMenu) {
    userDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!userMenu.contains(e.target)) {
        userMenu.classList.remove('active');
      }
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('reveal_active_key');
      localStorage.removeItem('reveal_username');
      window.location.href = '/';
    });
  }

  // Light Mode Toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light-mode');
    });
  }

  // Populate total searches stat (randomizer for demo)
  const totalSearchesEl = document.getElementById('kp-total-searches');
  if (totalSearchesEl) {
    let searches = Math.floor(Math.random() * 50) + 10;
    totalSearchesEl.textContent = searches;
  }

});
