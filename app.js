document.addEventListener('DOMContentLoaded', () => {

  const SUPABASE_URL = 'https://xuogsjlpkkzdixkgkfng.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_8yl_XleFMsnYisXGwnbM1g_9JwQJ4f-';

  if (typeof window.supabase === 'undefined') {
    alert('Could not load Supabase. Check your connection.');
    return;
  }

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (id) => document.getElementById(id);

  let editingId = null;

  // ---------- TOAST ----------
  let toastTimer;
  function showToast(msg, type = '') {
    const t = $('toast');
    if (!t) return;
    t.innerText = msg;
    t.className = 'toast ' + type;
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
  }

  // ---------- HELPERS ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function calculatePayDate(startDate, businessDays) {
    let payDate = new Date(startDate);
    let added = 0;
    let calendarDays = 0;
    while (added < businessDays) {
      payDate.setDate(payDate.getDate() + 1);
      calendarDays++;
      const d = payDate.getDay();
      if (d !== 0 && d !== 6) added++;
    }
    return { payDate, calendarDays };
  }

  // ---------- CURRENCY PREFIX ----------
  const currencySelect = $('currencySelect');
  const currencyPrefix = $('currencyPrefix');
  currencySelect.addEventListener('change', () => {
    currencyPrefix.innerText = currencySelect.value;
  });

  const editCurrency = $('editCurrency');
  const editCurrencyPrefix = $('editCurrencyPrefix');
  editCurrency.addEventListener('change', () => {
    editCurrencyPrefix.innerText = editCurrency.value;
  });

  // ---------- AUTH ----------
  async function getUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    } catch { return null; }
  }

  function showModal() {
    $('authModal').classList.remove('hidden');
    $('authStatus').innerText = '';
    setTimeout(() => $('authEmail').focus(), 250);
  }
  function hideModal() { $('authModal').classList.add('hidden'); }

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
    $('authStatus').innerText = error
      ? 'Error: ' + error.message
      : '✓ Check your inbox for the sign-in link.';
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
  const sendBtn = $('authSendBtn');
  let lastTap = 0;
  const handleSendTap = (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastTap < 500) return;
    lastTap = now;
    sendMagicLink();
  };
  sendBtn.addEventListener('click', handleSendTap);
  sendBtn.addEventListener('touchend', handleSendTap, { passive: false });

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
      const { payDate, calendarDays } = calculatePayDate(startDate, businessDays);

      const fmt = (n) => currency + n.toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
      });

      $('results').style.display = 'block';
      $('payoutAmount').innerText = fmt(payout);
      $('profitText').innerText =
        `+${fmt(profit)} profit (${roiPercent}% of ${fmt(costAmount)})`;
      $('principalVal').innerText = fmt(costAmount);
      $('payDateVal').innerText = payDate.toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
      });
      $('calSpanVal').innerText = `${calendarDays} days (${businessDays} business)`;

      renderTimeline(startDate, payDate, businessDays);
      window.__lastCalc = { itemName, payDate, payout, currency, profit };

      setTimeout(() => {
        $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

      const user = await getUser();
      if (!user) { showToast('Sign in to save this record', ''); return; }

      const { error } = await supabase.from('investments').insert({
        user_id: user.id,
        item_name: itemName,
        cost_amount: costAmount,
        roi_percent: roiPercent,
        business_days: businessDays,
        start_date: startDate.toISOString().split('T')[0],
        pay_date: payDate.toISOString().split('T')[0],
        payout_amount: payout,
        currency
      });

      showToast(error ? 'Save error: ' + error.message : 'Saved to your history ✓',
                error ? 'error' : 'success');

    } catch (err) {
      showToast('Error: ' + err.message, 'error');
      console.error(err);
    }
  });

  // ---------- ADD TO CALENDAR ----------
  $('calendar-btn').addEventListener('click', () => {
    const d = window.__lastCalc;
    if (!d) { showToast('Calculate first', 'error'); return; }

    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.payDate.getFullYear();
    const mm = pad(d.payDate.getMonth() + 1);
    const dd = pad(d.payDate.getDate());
    const dateStr = `${yyyy}${mm}${dd}`;

    const title = `Payout: ${d.itemName}`;
    const details = `Expected Payout: ${d.currency}${d.payout.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const url = 'https://calendar.google.com/calendar/render'
      + '?action=TEMPLATE'
      + '&text=' + encodeURIComponent(title)
      + '&dates=' + dateStr + '/' + dateStr
      + '&details=' + encodeURIComponent(details)
      + '&reminders=popup:1,email:1';

    window.open(url, '_blank');
  });

  // ---------- TIMELINE ----------
  function renderTimeline(startDate, payDate, businessDays) {
    const container = $('timeline');
    container.innerHTML = '';
    let current = new Date(startDate);
    let bizCount = 0;
    while (current <= payDate) {
      const dot = document.createElement('div');
      dot.className = 'timeline-dot';
      const d = current.getDay();
      if (d === 0 || d === 6) {
        dot.classList.add('weekend');
      } else {
        bizCount++;
        dot.classList.add('business');
        if (bizCount === businessDays)
