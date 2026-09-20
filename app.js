const SUPABASE_URL = 'https://xuogsjlpkkzdixkgkfng.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8yl_XleFMsnYisXGwnbM1g_9JwQJ4f-';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- DOM HELPERS ----------
const $ = (id) => document.getElementById(id);

// ---------- AUTH ----------
async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function showModal() {
  $('authModal').classList.remove('hidden');
  $('authStatus').innerText = '';
}
function hideModal() {
  $('authModal').classList.add('hidden');
}

async function sendMagicLink() {
  const email = $('authEmail').value.trim();
  if (!email) { $('authStatus').innerText = 'Please enter your email.'; return; }
  $('authStatus').innerText = 'Sending…';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin }
  });
  if (error) {
    $('authStatus').innerText = 'Error: ' + error.message;
  } else {
    $('authStatus').innerText = '✓ Check your inbox for the sign-in link.';
  }
}

async function signOut() {
  await supabase.auth.signOut();
  updateAuthUI();
}

function updateAuthUI() {
  getUser().then(user => {
    const btn = $('auth-btn');
    const info = $('user-info');
    if (user) {
      btn.innerText = 'Sign Out';
      btn.onclick = signOut;
      info.innerText = 'Signed in as ' + user.email;
    } else {
      btn.innerText = 'Sign In';
      btn.onclick = showModal;
      info.innerText = '';
    }
  });
}

// Wire modal buttons
$('modalClose').addEventListener('click', hideModal);
$('authSendBtn').addEventListener('click', sendMagicLink);

updateAuthUI();
supabase.auth.onAuthStateChange(() => updateAuthUI());

// ---------- CALCULATE ----------
$('calculate-btn').addEventListener('click', async () => {
  try {
    const itemName = $('invName').value;
    const costAmount = parseFloat($('invAmount').value);
    const roiPercent = parseFloat($('roiPercent').value);
    const businessDays = parseInt($('busDays').value);
    const currency = $('currencySelect').value;
    const startDate = new Date($('startDate').value);

    if (!costAmount || !roiPercent || !businessDays || isNaN(startDate)) {
      alert('Please fill in all fields.');
      return;
    }

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

    const fmt = (n) => currency + n.toLocaleString('en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    $('results').style.display = 'block';
    $('payoutAmount').innerText = fmt(payout);
    $('profitText').innerText =
      `Profit: ${fmt(profit)} (${roiPercent}% of ${fmt(costAmount)})`;
    $('principalVal').innerText = fmt(costAmount);
    $('payDateVal').innerText = payDate.toLocaleDateString('en-US',
      { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    $('calSpanVal').innerText =
      `${calendarDays} calendar days (${businessDays} business days)`;

    const user = await getUser();
    if (!user) {
      console.log('Not signed in — record not saved.');
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

    if (error) console.error('Save error:', error);
  } catch (err) {
    alert('Error: ' + err.message);
    console.error(err);
  }
});

// ---------- HISTORY ----------
$('history-btn').addEventListener('click', async () => {
  try {
    const user = await getUser();
    if (!user) { showModal(); return; }

    const { data, error } = await supabase
      .from('investments')
      .select('*')
      .order('created_at', { ascending: false });

    const container = $('history-list');
    container.innerHTML = '';

    if (error) { container.innerHTML = 'Error: ' + error.message; return; }
    if (!data || !data.length) {
      container.innerHTML = '<p style="color:#9d93b8;">No investments yet.</p>';
      return;
    }

    data.forEach(r => {
      container.innerHTML += `
        <div class="history-item">
          <div class="name">${r.item_name}</div>
          <div class="meta">Principal: ${r.currency}${r.cost_amount}</div>
          <div class="payout">${r.currency}${Number(r.payout_amount).toFixed(2)}</div>
          <div class="meta">Pay date: ${new Date(r.pay_date).toDateString()}</div>
        </div>`;
    });
  } catch (err) {
    alert('Error: ' + err.message);
  }
});
