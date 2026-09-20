const SUPABASE_URL = 'https://xuogsjlpkkzdixkgkfng.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8yl_XleFMsnYisXGwnbM1g_9JwQJ4f-';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- AUTH ----------
async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function signIn() {
  const email = prompt("Enter your email to receive a sign-in link:");
  if (!email) return;
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) alert(error.message);
  else alert("Check your inbox for the sign-in link!");
}

async function signOut() {
  await supabase.auth.signOut();
  updateAuthUI();
}

function updateAuthUI() {
  getUser().then(user => {
    const btn = document.getElementById('auth-btn');
    const info = document.getElementById('user-info');
    if (user) {
      btn.innerText = 'Sign Out';
      btn.onclick = signOut;
      info.innerText = user.email;
    } else {
      btn.innerText = 'Sign In';
      btn.onclick = signIn;
      info.innerText = '';
    }
  });
}
updateAuthUI();
supabase.auth.onAuthStateChange(() => updateAuthUI());

// ---------- CALCULATE ----------
document.getElementById('calculate-btn').addEventListener('click', async () => {
  const itemName = document.getElementById('invName').value;
  const costAmount = parseFloat(document.getElementById('invAmount').value);
  const roiPercent = parseFloat(document.getElementById('roiPercent').value);
  const businessDays = parseInt(document.getElementById('busDays').value);
  const currency = document.getElementById('currencySelect').value;
  const startDate = new Date(document.getElementById('startDate').value);

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

  document.getElementById('results').style.display = 'block';
  document.getElementById('payoutAmount').innerText = fmt(payout);
  document.getElementById('profitText').innerText =
    `Profit: ${fmt(profit)} (${roiPercent}% of ${fmt(costAmount)})`;
  document.getElementById('principalVal').innerText = fmt(costAmount);
  document.getElementById('payDateVal').innerText =
    payDate.toLocaleDateString('en-US',
      { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  document.getElementById('calSpanVal').innerText =
    `${calendarDays} calendar days (${businessDays} business days)`;

  const user = await getUser();
  if (!user) {
    console.log("Not signed in — record not saved.");
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

  if (error) console.error(error);
});

// ---------- HISTORY ----------
document.getElementById('history-btn').addEventListener('click', async () => {
  const user = await getUser();
  if (!user) { alert("Please sign in first."); return; }

  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .order('created_at', { ascending: false });

  const container = document.getElementById('history-list');
  container.innerHTML = '';

  if (error) { container.innerHTML = 'Error: ' + error.message; return; }
  if (!data.length) {
    container.innerHTML = '<p style="color:#9d93b8;">No investments yet.</p>';
    return;
  }

  data.forEach(r => {
    container.innerHTML += `
      <div class="history-item">
        <div class="name">${r.item_name}</div>
        <div class="meta">Principal: ${r.currency}${r.cost_amount}</div>
        <div class="payout">${r.currency}${r.payout_amount.toFixed(2)}</div>
        <div class="meta">Pay date: ${new Date(r.pay_date).toDateString()}</div>
      </div>`;
  });
});
