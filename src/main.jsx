import React, { memo, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './supabase';
import './styles.css';

const CATEGORIES = ['Food', 'Transport', 'Housing', 'Bills', 'Shopping', 'Health', 'Entertainment', 'Salary', 'Other'];
const STORAGE_KEY = 'pennywise.transactions.v1';
const today = () => new Date().toLocaleDateString('en-CA');
const money = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

function loadLegacyTransactions() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(data) ? data.filter((t) => t && typeof t.id === 'string' && Number.isFinite(t.amount) && t.amount > 0 && ['income', 'expense'].includes(t.type)) : [];
  } catch { return []; }
}

const Icon = ({ name, size = 20 }) => {
  const paths = { wallet: <><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M16 15h.01"/><path d="M6 5V4a1 1 0 0 1 1-1h11"/></>, plus: <path d="M12 5v14m-7-7h14"/>, arrow: <path d="m7 14 5-5 5 5"/>, down: <path d="m7 10 5 5 5-5"/>, search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>, sliders: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="8" cy="18" r="2" fill="currentColor"/></>, calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>, chart: <><path d="M4 19V5m0 14h17"/><path d="m7 15 4-4 3 2 6-7"/></>, coffee: <><path d="M4 9h13v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM17 11h2a2 2 0 1 1 0 4h-2M8 3v3m5-3v3"/></>, car: <><path d="m5 11 1.5-5h11L19 11"/><path d="M3 11h18v8H3zM6 19v2m12-2v2"/><circle cx="7" cy="15" r="1"/><circle cx="17" cy="15" r="1"/></>, house: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10m-9 11v-7h4v7"/></> };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.wallet}</svg>;
};

function App() {
  if (!supabase) return <AuthSetupRequired platform="web"/>;
  return <AuthGate/>;
}

function AuthGate() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="auth-page"><div className="auth-card">Loading your account…</div></div>;
  return session ? <Dashboard user={session.user}/> : <AuthScreen/>;
}

function AuthSetupRequired({ platform }) {
  return <div className="auth-page"><div className="auth-card"><div className="brand-mark"><Icon name="wallet"/></div><h1>Set up secure sign-in</h1><p>Add your Supabase project URL and publishable key to the {platform} environment variables. See the README for setup steps.</p></div></div>;
}

function AuthScreen({ linking = false, user, onCancel = () => {} }) {
  const [method, setMethod] = useState(linking && user?.email ? 'sms' : 'email');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function sendCode(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    const { error } = linking
      ? await supabase.auth.updateUser(method === 'email' ? { email: contact.trim() } : { phone: contact.trim() })
      : await supabase.auth.signInWithOtp(method === 'email' ? { email: contact.trim() } : { phone: contact.trim() });
    setBusy(false);
    if (error) return setMessage(error.message);
    setSent(true); setMessage(`We sent a one-time code to ${contact.trim()}.`);
  }

  async function verifyCode(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    const credentials = method === 'email'
      ? { email: contact.trim(), token: code.trim(), type: linking ? 'email_change' : 'email' }
      : { phone: contact.trim(), token: code.trim(), type: linking ? 'phone_change' : 'sms' };
    const { error } = await supabase.auth.verifyOtp(credentials);
    setBusy(false);
    if (error) setMessage(error.message);
    else if (linking) onCancel();
  }

  return <div className={`auth-page${linking ? ' auth-overlay' : ''}`}><form className="auth-card" onSubmit={sent ? verifyCode : sendCode}>
    <div className="brand-mark"><Icon name="wallet"/></div><p className="eyebrow">PENNYWISE</p><h1>{linking ? 'Link a sign-in method' : 'Sign in securely'}</h1><p>{linking ? 'Add another verified email or phone so you can use either to access this account.' : 'Use a one-time code to access your transactions.'}</p>
    <div className="auth-methods"><button type="button" className={method === 'email' ? 'selected' : ''} onClick={() => { setMethod('email'); setSent(false); setMessage(''); }}>Email</button><button type="button" className={method === 'sms' ? 'selected' : ''} onClick={() => { setMethod('sms'); setSent(false); setMessage(''); }}>SMS</button></div>
    <label className="form-field"><span>{method === 'email' ? 'Email address' : 'Phone number'}</span><input required type={method === 'email' ? 'email' : 'tel'} autoComplete={method === 'email' ? 'email' : 'tel'} placeholder={method === 'email' ? 'you@example.com' : '+1 555 123 4567'} value={contact} onChange={(event) => setContact(event.target.value)} disabled={sent}/></label>
    {sent && <label className="form-field"><span>One-time code</span><input required inputMode="numeric" autoComplete="one-time-code" placeholder="Enter the code" value={code} onChange={(event) => setCode(event.target.value)}/></label>}
    {message && <div className={sent && !code ? 'auth-message' : 'error-message'} role="status">{message}</div>}
    <button className="submit-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : sent ? 'Verify code' : linking ? 'Send verification code' : 'Send one-time code'}</button>
    {sent && <button className="auth-reset" type="button" onClick={() => { setSent(false); setCode(''); setMessage(''); }}>Use a different {method === 'email' ? 'email' : 'phone'}</button>}
    {linking && <button className="auth-reset" type="button" onClick={onCancel}>Cancel</button>}
  </form></div>;
}

function Dashboard({ user }) {
  const [linkingMethod, setLinkingMethod] = useState(false);
  const accountName = user.email || user.phone || 'Your account';
  const [transactions, setTransactions] = useState([]);
  const [ready, setReady] = useState(false);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    let active = true;
    setReady(false);
    setTransactions([]);
    (async () => {
      const { data, error: loadError } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false });
      if (!active) return;
      if (loadError) setError('Transactions could not be loaded. Check the Supabase table and row security setup.');
      else if (data?.length) setTransactions(data);
      else {
        const legacy = loadLegacyTransactions();
        if (legacy.length) {
          const records = [...legacy.filter((t) => t.type === 'income'), ...legacy.filter((t) => t.type === 'expense')].map((t) => ({ ...t, user_id: user.id }));
          const { error: migrationError } = await supabase.from('transactions').insert(records);
          if (migrationError) setError('Your existing local transactions could not be moved to your account. They remain saved on this device.');
          else { setTransactions(records); localStorage.removeItem(STORAGE_KEY); }
        }
      }
      setReady(true);
    })();
    return () => { active = false; };
  }, [user.id]);

  const save = async (transaction) => {
    const record = { ...transaction, user_id: user.id };
    const { error: saveError } = await supabase.from('transactions').insert(record);
    if (saveError) {
      setError(saveError.code === '23514' ? 'This expense exceeds your available balance.' : 'Could not save your transaction. Check your connection and Supabase policies.');
      return false;
    }
    setTransactions((current) => [record, ...current]);
    return true;
  };
  const summary = useMemo(() => transactions.reduce((s, t) => { s[t.type] += t.amount; return s; }, { income: 0, expense: 0 }), [transactions]);
  const breakdown = useMemo(() => {
    const totals = transactions.filter((t) => t.type === 'expense').reduce((out, t) => { out[t.category] = (out[t.category] || 0) + t.amount; return out; }, {});
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [transactions]);
  const visible = useMemo(() => transactions.filter((t) => (filterType === 'all' || t.type === filterType) && (filterCategory === 'all' || t.category === filterCategory) && (!from || t.date >= from) && (!to || t.date <= to)).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [transactions, filterType, filterCategory, from, to]);
  const expenseTotal = summary.expense;
  const maxCategory = Math.max(1, ...breakdown.map(([, v]) => v));

  async function addTransaction(event) {
    event.preventDefault(); setError('');
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError('Enter an amount greater than zero.');
    if (!category || !date) return setError('Choose a category and date.');
    const availableCents = Math.round((summary.income - summary.expense) * 100);
    if (type === 'expense' && Math.round(numericAmount * 100) > availableCents) return setError(`Expense exceeds your available balance of ${money(Math.max(0, availableCents) / 100)}.`);
    const saved = await save({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type, amount: Math.round(numericAmount * 100) / 100, category, date, note: note.trim() });
    if (saved) { setError(''); setAmount(''); setNote(''); }
  }

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Icon name="wallet" size={22}/></div><span>pennywise</span></div><div className="side-label">WORKSPACE</div><div className="nav-item active"><span className="nav-icon"><Icon name="chart"/></span> Overview</div><div className="side-foot"><span className="avatar">{accountName.slice(0, 2).toUpperCase()}</span><div><strong>{accountName}</strong><small>Personal account</small></div><span className="dots">•••</span></div></aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>Overview</b></div><div className="top-actions"><span className="today-label"><Icon name="calendar" size={16}/> {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span><span className="account-label">{accountName}</span>{(!user.email || !user.phone) && <button className="sign-out" onClick={() => setLinkingMethod(true)}>Link email / phone</button>}<button className="sign-out" onClick={() => supabase.auth.signOut()}>Sign out</button></div></header>
      <div className="page"><section className="heading-row"><div><p className="eyebrow">YOUR FINANCES AT A GLANCE</p><h1>Good morning, Jordan <span className="wave">✦</span></h1><p className="subheading">Here's what's happening with your money.</p></div><button className="primary-button" onClick={() => document.getElementById('amount').focus()}><Icon name="plus" size={18}/> Add transaction</button></section>
        <section className="summary-grid" aria-label="Financial summary"><SummaryCard label="Total balance" value={money(summary.income - summary.expense)} icon="wallet" color="purple" change="Your available balance"/><SummaryCard label="Total income" value={money(summary.income)} icon="arrow" color="green" change="Across all transactions"/><SummaryCard label="Total expenses" value={money(summary.expense)} icon="down" color="orange" change="Across all transactions"/></section>
        <section className="content-grid"><div className="panel transactions-panel"><div className="panel-heading"><div><h2>Recent transactions</h2><p>Your latest financial activity</p></div><span className="transaction-count">{visible.length} records</span></div>
          <div className="filters"><label className="filter-select"><Icon name="sliders" size={16}/><select aria-label="Filter by type" value={filterType} onChange={(e) => setFilterType(e.target.value)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option></select></label><label className="filter-select"><select aria-label="Filter by category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}><option value="all">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label><label className="date-filter">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}/></label><label className="date-filter">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)}/></label></div>
          <div className="transaction-list">{!ready ? <div className="empty">Loading transactions…</div> : visible.length ? visible.map((t) => <TransactionRow key={t.id} transaction={t}/>) : <div className="empty"><div className="empty-icon"><Icon name="search" size={22}/></div><strong>No transactions found</strong><span>Try changing your filters or add a transaction.</span></div>}</div>
        </div><div className="right-column"><div className="panel add-panel"><div className="panel-heading"><div><h2>Add transaction</h2><p>Record your income or spending</p></div><div className="add-symbol"><Icon name="plus" size={18}/></div></div><form onSubmit={addTransaction}>
            <div className="type-toggle"><button type="button" className={type === 'expense' ? 'selected expense' : ''} onClick={() => setType('expense')}>Expense</button><button type="button" className={type === 'income' ? 'selected income' : ''} onClick={() => setType('income')}>Income</button></div>
            <label className="form-field"><span>Amount</span><div className="amount-input"><b>$</b><input id="amount" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required/></div></label>
            <div className="form-row"><label className="form-field"><span>Category</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label><label className="form-field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required/></label></div>
            <label className="form-field"><span>Note <em>Optional</em></span><input type="text" maxLength="80" placeholder="What was this for?" value={note} onChange={(e) => setNote(e.target.value)}/></label>
            {error && <div className="error-message" role="alert">{error}</div>}<button className="submit-button" type="submit">Save transaction <span>→</span></button>
          </form></div>
          <div className="panel breakdown-panel"><div className="panel-heading"><div><h2>Spending by category</h2><p>Where your money goes</p></div><div className="breakdown-icon"><Icon name="chart" size={17}/></div></div>{breakdown.length ? <div className="breakdown-list">{breakdown.map(([name, total], i) => <div className="breakdown-row" key={name}><div className="breakdown-label"><CategoryIcon category={name}/><span>{name}</span><b>{money(total)}</b></div><div className="bar-track"><div className={`bar bar-${i}`} style={{ width: `${Math.max(3, total / maxCategory * 100)}%` }}/></div></div>)}</div> : <div className="breakdown-empty">Add an expense to see your spending breakdown.</div>}<div className="breakdown-total"><span>Total spent</span><strong>{money(expenseTotal)}</strong></div></div>
        </div></section><footer>Made for mindful money habits <span>·</span> Your data syncs to your account</footer>
      </div>
    </main>
    {linkingMethod && <AuthScreen linking user={user} onCancel={() => setLinkingMethod(false)}/>}
  </div>;
}

const SummaryCard = memo(function SummaryCard({ label, value, icon, color, change }) { return <article className="summary-card"><div className="summary-top"><span>{label}</span><span className={`summary-icon ${color}`}><Icon name={icon} size={18}/></span></div><strong className="summary-value">{value}</strong><div className="summary-change">{change}</div></article>; });
function CategoryIcon({ category }) { const name = category === 'Food' ? 'coffee' : category === 'Transport' ? 'car' : category === 'Housing' ? 'house' : 'wallet'; return <span className="category-icon"><Icon name={name} size={17}/></span>; }
const TransactionRow = memo(function TransactionRow({ transaction: t }) { return <div className="transaction-row"><CategoryIcon category={t.category}/><div className="transaction-info"><strong>{t.note || t.category}</strong><span>{t.category} <i>·</i> {new Date(`${t.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div><span className={`type-badge ${t.type}`}>{t.type === 'income' ? 'Income' : 'Expense'}</span><strong className={`transaction-amount ${t.type}`}>{t.type === 'income' ? '+' : '−'}{money(t.amount)}</strong></div>; });

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
