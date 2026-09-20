document.addEventListener('DOMContentLoaded', () => {

  const SUPABASE_URL = 'https://xuogsjlpkkzdixkgkfng.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_8yl_XleFMsnYisXGwnbM1g_9JwQJ4f-';

  if (typeof window.supabase === 'undefined') {
    showToast('Could not load library. Check connection.', 'error');
    return;
  }

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (id) => document.getElementById(id);

  // ---------- TOAST ----------
  let toastTimer;
  function showToast(msg, type = '') {
    const t = $('toast');
    t.innerText = msg;
    t.className = 'toast ' + type;
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
  }

  // ---------- CURRENCY PREFIX ----------
  const currencySelect = $('currencySelect');
  const currencyPrefix = $('currencyPrefix');
  currencySelect.addEventListener('change', () => {
    currencyPrefix.innerText = currencySelect.value;
  });

  // ---------- AUTH ----------
  async function getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  function showModal() {
    $('authModal').classList.remove('hidden');
    $('authStatus').innerText = '';
    setTimeout(() => $('authEmail').focus(), 250);
  }

  function hideModal() {
    $('authModal').classList.add('hidden');
  }

  async function sendMagicLink() {
    const email = $('authEmail').value.trim();
    if (!email || !email.includes('@')) {
      $('authStatus').innerText = 'Please enter a valid email.';
      return;
    }
    const btn = $('authSendBtn');
    const label = $('authSendLabel');
    btn.disabled = true;
    label.innerText = 'Sending…';
    $('authStatus').innerText = '';

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });

    btn.disabled = false;
    label.innerText = 'Send Magic Link';

    if (error) {
      $('authStatus').innerText = 'Error: ' + error.message;
    } else {
      $('authStatus').innerText = '✓ Check your inbox for the sign-in link.';
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    updateAuthUI();
    showToast('Signed out', 'success');
  }

  function updateAuthUI() {
    getUser().then(user => {
      const btn = $('auth-btn');
      const info = $('user-info');
      if (user) {
        btn.innerText = 'Sign out';
        btn.onclick = signOut;
        info.innerText = '✓ ' + user.email;
      } else {
        btn.innerText = 'Sign In';
        btn.onclick = showModal;
        info.innerText = '';
      }
    });
  }

  $('modalClose').addEventListener('click', hideModal);
  $('authSendBtn').addEventListener('click', sendMagicLink);
  $('authModal').addEventListener('click', (e) => {
    if (e.target === $('authModal')) hideModal();
  });
  $('authEmail').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMagicLink();
  });

  updateAuthUI();
  supabase.auth.onAuthStateChange(() => updateAuthUI());

  // ---------- CALCULATE ----------
  $('calculate-btn').addEventListener('click', async () => {
    try {
      const itemName = $('invName').value.trim();
      const costAmount = parseFloat($('invAmount').value);
      const roiPercent = parseFloat($('roiPercent').value);
      const businessDays = parseInt($('busDays').value);
      const currency = currencySelect.value;
      const startDateStr = $('startDate').value;

      if (!itemName) { showToast('Enter an investment name', 'error'); return; }
      if (!costAmount || costAmount <= 0) { showToast('Enter a valid amount', 'error'); return; }
      if (!roiPercent || roiPercent <= 0) { showToast('Enter a valid ROI', 'error'); return; }
      if (!businessDays || businessDays <= 0) { showToast('Enter business days', 'error'); return; }
      if (!startDateStr) { showToast('Pick a start date', 'error'); return; }

      const startDate = new Date(startDateStr);
      const profit = costAmount * (roiPercent / 100);
      const payout = costAmount + profit;

      let payDate = new Date(startDate);
      let added = 0;
      let calendarDays = 0;
      while (added < businessDays) {
        payDate.setDate(payDate.getDate() + 1);
        calendarDays++;
        const d = payDate.getDay();
        if (d !== 0 && d !== 6) added++;
      }

      const fmt = (n) => currency + n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      $('results').style.display = 'block';
      $('payoutAmount').innerText = fmt(payout);
      $('profitText').innerText =
        `+${fmt(profit)} profit (${roiPercent}% of ${fmt(costAmount)})`;
      $('principalVal').innerText = fmt(costAmount);
      $('payDateVal').innerText = payDate.toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
      });
      $('calSpanVal').innerText =
        `${calendarDays} days (${businessDays} business)`;

      // Timeline
      renderTimeline(startDate, payDate, businessDays);

      // Scroll into view
      setTimeout(() => {
        $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

      // Save
      const user = await getUser();
      if (!user) {
        showToast('Sign in to save this record', '');
        return;
      }

      const { error } = await supabase.from('investments').insert({
        user_id: user.id,
        item_name: itemName,
        cost_amount: costAmount,
        roi_percent: roiPercent,
        business_days: businessDays,
        start_date: startDate.toISOString().split('T')[0],
        pay_date: payDate.toISOString().split('T')[0],
        payout_amount: payout,
        currency: currency
      });

      if (error) {
        showToast('Save error: ' + error.message, 'error');
      } else {
        showToast('Saved to your history ✓', 'success');
      }

    } catch (err) {
      showToast('Error: ' + err.message, 'error');
      console.error(err);
    }
  });

  // ---------- TIMELINE RENDERER ----------
  function renderTimeline(startDate, payDate, businessDays) {
    const container = $('timeline');
    container.innerHTML = '';

    let current = new Date(startDate);
    let bizCount = 0;

    while (current <= payDate) {
      const dot = document.createElement('div');
      dot.className = 'timeline-dot';
      const d = current.getDay();
      const isWeekend = (d === 0 || d === 6);

      if (isWeekend) {
        dot.classList.add('weekend');
      } else {
        bizCount++;
        dot.classList.add('business');
        if (bizCount === businessDays) dot.classList.add('final');
      }
      container.appendChild(dot);
      current.setDate(current.getDate() + 1);
    }
  }

  // ---------- HISTORY ----------
  $('history-btn').addEventListener('click', async () => {
    try {
      const user = await getUser();
      if (!user) {
        showModal();
        return;
      }

      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .order('created_at', { ascending: false });

      const container = $('history-list');

      if (error) {
        container.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div>' + error.message + '</div>';
        return;
      }

      if (!data || !data.length) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="icon">📊</div>
            <div>No investments yet</div>
            <div style="font-size:11px;margin-top:6px;">Your calculations will appear here.</div>
          </div>`;
        return;
      }

      container.innerHTML = data.map(r => `
        <div class="history-item">
          <div class="name">${escapeHtml(r.item_name)}</div>
          <div class="payout">${r.currency}${Number(r.payout_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="meta">Principal: ${r.currency}${Number(r.cost_amount).toLocaleString()}</div>
          <div class="meta">Pay date: ${new Date(r.pay_date).toDateString()}</div>
        </div>
      `).join('');

    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

});
