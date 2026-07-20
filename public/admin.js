// ===== Admin Panel Logic =====

document.addEventListener('DOMContentLoaded', () => {
  const lockScreen = document.getElementById('admin-lock');
  const adminPanel = document.getElementById('admin-panel');
  const passInput = document.getElementById('admin-pass');
  const loginBtn = document.getElementById('admin-login-btn');
  const errorMsg = document.getElementById('lock-error');

  const generateBtn = document.getElementById('generate-key-btn');
  const planSelect = document.getElementById('new-key-plan');
  const durationSelect = document.getElementById('new-key-duration');
  const emailInput = document.getElementById('new-key-email');
  const keysTbody = document.getElementById('keys-tbody');

  // Master password
  loginBtn.addEventListener('click', () => {
    if (passInput.value === 'R3v3al_0wN3r!2026') {
      lockScreen.style.display = 'none';
      adminPanel.style.display = 'block';
      renderKeys();
    } else {
      errorMsg.style.display = 'block';
    }
  });

  passInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
  });

  // State Management (Now fetches from Backend)
  async function fetchKeys() {
    try {
      const res = await fetch('/api/admin/keys');
      const data = await res.json();
      return data.keys || [];
    } catch (err) {
      console.error('Failed to fetch keys', err);
      return [];
    }
  }

  // Generate Key
  generateBtn.addEventListener('click', async () => {
    const plan = planSelect.value;
    const durationDays = durationSelect.value;
    const email = emailInput.value.trim();

    try {
      const res = await fetch('/api/admin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, durationDays, email })
      });
      const data = await res.json();
      
      if (data.success) {
        emailInput.value = '';
        renderKeys();
      }
    } catch (err) {
      console.error('Failed to generate key', err);
    }
  });

  // Revoke Key (For now, we just reload since revoke isn't in backend yet, but we'll leave placeholder)
  window.revokeKey = function(id) {
    alert('Revoke feature coming soon to backend integration!');
  };

  // Render Table
  async function renderKeys() {
    const keys = await fetchKeys();
    
    if (keys.length === 0) {
      keysTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:rgba(255,255,255,0.4);">No active keys generated yet.</td></tr>`;
      return;
    }

    // Reverse array to show newest first
    keys.reverse();

    keysTbody.innerHTML = keys.map(k => {
      const expDate = k.durationDays === 9999 ? 'Lifetime' : new Date(k.expires).toLocaleDateString();
      let badgeClass = 'badge-free';
      if (k.plan === 'Owner') badgeClass = 'badge-owner';
      if (k.plan === 'Plus') badgeClass = 'badge-plus';
      if (k.plan === 'Pro') badgeClass = 'badge-pro';
      if (k.plan === 'Enterprise') badgeClass = 'badge-enterprise';

      return `
        <tr>
          <td class="key-mono">${k.key}</td>
          <td style="color:rgba(255,255,255,0.8);">${k.email || 'N/A'}</td>
          <td><span class="badge ${badgeClass}">${k.plan}</span></td>
          <td style="color:rgba(255,255,255,0.6);">${expDate}</td>
          <td>
            <button class="action-btn" onclick="revokeKey(${k.id})">Revoke</button>
          </td>
        </tr>
      `;
    }).join('');
  }

});
