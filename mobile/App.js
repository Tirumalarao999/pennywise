import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const KEY = 'pennywise.transactions.v1';
const CATEGORIES = ['Food', 'Transport', 'Housing', 'Bills', 'Shopping', 'Health', 'Entertainment', 'Salary', 'Other'];
const CATEGORY_FILTERS = CATEGORIES.map((x) => ({ value: x, label: x }));
const ALL_CATEGORY_FILTERS = [{ value: 'all', label: 'All categories' }, ...CATEGORY_FILTERS];
const TYPE_FILTERS = [{ value: 'all', label: 'All' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }];
const today = () => new Date().toLocaleDateString('en-CA');
const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const dateLabel = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function App() {
  if (!supabase) return <AuthSetupRequired/>;
  return <AuthGate/>;
}

function AuthSetupRequired() {
  return <SafeAreaView style={styles.safe}><View style={styles.authWrap}><View style={styles.authCard}><Text style={styles.brand}>pennywise</Text><Text style={styles.sectionTitle}>Set up secure sign-in</Text><Text style={styles.muted}>Add the Supabase project URL and publishable key to the Expo environment variables. See the README for setup steps.</Text></View></View></SafeAreaView>;
}

function AuthGate() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.unsubscribe();
  }, []);
  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.authWrap}><Text style={styles.muted}>Loading your account…</Text></View></SafeAreaView>;
  return session ? <Dashboard key={session.user.id} user={session.user}/> : <AuthScreen/>;
}

function AuthScreen({ linking = false, user, onCancel = () => {} }) {
  const [method, setMethod] = useState(linking && user?.email ? 'sms' : 'email');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sendCode = async () => {
    setBusy(true); setMessage('');
    const { error } = linking
      ? await supabase.auth.updateUser(method === 'email' ? { email: contact.trim() } : { phone: contact.trim() })
      : await supabase.auth.signInWithOtp(method === 'email' ? { email: contact.trim() } : { phone: contact.trim() });
    setBusy(false);
    if (error) return setMessage(error.message);
    setSent(true); setMessage(`A one-time code was sent to ${contact.trim()}.`);
  };
  const verifyCode = async () => {
    setBusy(true); setMessage('');
    const credentials = method === 'email'
      ? { email: contact.trim(), token: code.trim(), type: linking ? 'email_change' : 'email' }
      : { phone: contact.trim(), token: code.trim(), type: linking ? 'phone_change' : 'sms' };
    const { error } = await supabase.auth.verifyOtp(credentials);
    setBusy(false);
    if (error) setMessage(error.message);
    else if (linking) onCancel();
  };
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.authWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.authCard}>
    <Text style={styles.brand}>pennywise</Text><Text style={styles.kicker}>SECURE SIGN-IN</Text><Text style={styles.title}>{linking ? 'Link a sign-in method' : 'Sign in with a code'}</Text><Text style={styles.muted}>{linking ? 'Add another verified email or phone so you can use either to access this account.' : 'Choose where to receive your one-time code.'}</Text>
    <View style={styles.authMethods}><Pressable onPress={() => { setMethod('email'); setSent(false); setMessage(''); }} style={[styles.authMethod, method === 'email' && styles.authMethodOn]}><Text style={[styles.authMethodText, method === 'email' && styles.authMethodTextOn]}>Email</Text></Pressable><Pressable onPress={() => { setMethod('sms'); setSent(false); setMessage(''); }} style={[styles.authMethod, method === 'sms' && styles.authMethodOn]}><Text style={[styles.authMethodText, method === 'sms' && styles.authMethodTextOn]}>SMS</Text></Pressable></View>
    <Text style={styles.label}>{method === 'email' ? 'Email address' : 'Phone number'}</Text><TextInput value={contact} onChangeText={setContact} editable={!sent} keyboardType={method === 'email' ? 'email-address' : 'phone-pad'} autoCapitalize="none" placeholder={method === 'email' ? 'you@example.com' : '+1 555 123 4567'} style={styles.input}/>
    {sent && <><Text style={styles.label}>One-time code</Text><TextInput value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" placeholder="Enter the code" style={styles.input}/></>}
    {!!message && <Text accessibilityRole="alert" style={sent && !code ? styles.authInfo : styles.error}>{message}</Text>}
    <Pressable disabled={busy} onPress={sent ? verifyCode : sendCode} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? 'Please wait…' : sent ? 'Verify code' : linking ? 'Send verification code' : 'Send one-time code'}</Text></Pressable>
    {sent && <Pressable onPress={() => { setSent(false); setCode(''); setMessage(''); }}><Text style={styles.authReset}>Use a different {method === 'email' ? 'email' : 'phone'}</Text></Pressable>}
    {linking && <Pressable onPress={onCancel}><Text style={styles.authReset}>Cancel</Text></Pressable>}
  </View></KeyboardAvoidingView></SafeAreaView>;
}

function Dashboard({ user }) {
  const [linkingMethod, setLinkingMethod] = useState(false);
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

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: loadError } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false });
      if (!active) return;
      if (loadError) setError('Transactions could not be loaded. Check the Supabase table and row security setup.');
      else if (data?.length) setTransactions(data);
      else {
        try {
          const raw = await AsyncStorage.getItem(KEY);
          const saved = raw ? JSON.parse(raw) : [];
          const legacy = Array.isArray(saved) ? saved.filter((t) => t && typeof t.id === 'string' && Number.isFinite(t.amount) && t.amount > 0 && ['income', 'expense'].includes(t.type)) : [];
          if (legacy.length) {
            const records = [...legacy.filter((t) => t.type === 'income'), ...legacy.filter((t) => t.type === 'expense')].map((t) => ({ ...t, user_id: user.id }));
            const { error: migrationError } = await supabase.from('transactions').insert(records);
            if (migrationError) setError('Your existing local transactions could not be moved to your account. They remain saved on this device.');
            else { setTransactions(records); await AsyncStorage.removeItem(KEY); }
          }
        } catch { setError('Your existing local transactions could not be moved to your account. They remain saved on this device.'); }
      }
      setReady(true);
    })();
    return () => { active = false; };
  }, [user.id]);
  const persist = useCallback(async (transaction) => {
    const record = { ...transaction, user_id: user.id };
    const { error: saveError } = await supabase.from('transactions').insert(record);
    if (saveError) {
      setError(saveError.code === '23514' ? 'This expense exceeds your available balance.' : 'Could not save your transaction. Check your connection and Supabase policies.');
      return false;
    }
    setTransactions((current) => [record, ...current]);
    return true;
  }, [user.id]);
  const summary = useMemo(() => transactions.reduce((s, t) => { s[t.type] += t.amount; return s; }, { income: 0, expense: 0 }), [transactions]);
  const breakdown = useMemo(() => {
    const totals = transactions.filter((t) => t.type === 'expense').reduce((out, t) => { out[t.category] = (out[t.category] || 0) + t.amount; return out; }, {});
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [transactions]);
  const visible = useMemo(() => transactions.filter((t) => (filterType === 'all' || t.type === filterType) && (filterCategory === 'all' || t.category === filterCategory) && (!from || t.date >= from) && (!to || t.date <= to)).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [transactions, filterType, filterCategory, from, to]);

  const add = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than zero.');
    if (!date || !category) return setError('Choose a category and date.');
    const availableCents = Math.round((summary.income - summary.expense) * 100);
    if (type === 'expense' && Math.round(value * 100) > availableCents) return setError(`Expense exceeds your available balance of ${money(Math.max(0, availableCents) / 100)}.`);
    const saved = await persist({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type, amount: Math.round(value * 100) / 100, category, date, note: note.trim() });
    if (saved) { setError(''); setAmount(''); setNote(''); }
  };

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor="#f6f7fb"/><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><View><Text style={styles.brand}>pennywise</Text><Text style={styles.kicker}>YOUR FINANCES AT A GLANCE</Text><Text style={styles.title}>Overview</Text><Text style={styles.muted}>Track your money, one day at a time.</Text></View><View style={styles.accountActions}>{(!user.email || !user.phone) && <Pressable onPress={() => setLinkingMethod(true)} style={styles.signOut}><Text style={styles.signOutText}>Link email / phone</Text></Pressable>}<Pressable onPress={() => supabase.auth.signOut()} style={styles.signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable></View></View>
    <View style={styles.summaryCard}><Text style={styles.cardLabel}>TOTAL BALANCE</Text><Text style={styles.balance}>{money(summary.income - summary.expense)}</Text><View style={styles.summaryLine}><View><Text style={styles.cardLabel}>INCOME</Text><Text style={styles.income}>{money(summary.income)}</Text></View><View><Text style={styles.cardLabel}>EXPENSES</Text><Text style={styles.expense}>{money(summary.expense)}</Text></View></View></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Add transaction</Text><Text style={styles.muted}>Record your income or spending</Text><View style={styles.toggleRow}><Pressable style={[styles.toggle, type === 'expense' && styles.expenseToggle]} onPress={() => setType('expense')}><Text style={[styles.toggleText, type === 'expense' && styles.expenseToggleText]}>Expense</Text></Pressable><Pressable style={[styles.toggle, type === 'income' && styles.incomeToggle]} onPress={() => setType('income')}><Text style={[styles.toggleText, type === 'income' && styles.incomeToggleText]}>Income</Text></Pressable></View>
      <Text style={styles.label}>Amount</Text><View style={styles.amountBox}><Text style={styles.dollar}>$</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" style={styles.amountInput}/></View>
      <Text style={styles.label}>Category</Text><FilterChips values={CATEGORY_FILTERS} value={category} onChange={setCategory}/>
      <View style={styles.fieldRow}><View style={styles.flex}><Text style={styles.label}>Date (YYYY-MM-DD)</Text><TextInput value={date} onChangeText={setDate} placeholder="2026-10-14" style={styles.input}/></View></View>
      <Text style={styles.label}>Note (optional)</Text><TextInput value={note} onChangeText={setNote} maxLength={80} placeholder="What was this for?" style={styles.input}/>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Pressable style={styles.primary} onPress={add}><Text style={styles.primaryText}>Save transaction  →</Text></Pressable></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Spending by category</Text><Text style={styles.muted}>Where your money goes</Text>{breakdown.length ? breakdown.map(([name, total]) => <View key={name} style={styles.breakdownRow}><View style={styles.breakdownLine}><Text style={styles.rowTitle}>{name}</Text><Text style={styles.rowAmount}>{money(total)}</Text></View><View style={styles.track}><View style={[styles.bar, { width: `${Math.max(3, total / Math.max(1, ...breakdown.map(([, v]) => v)) * 100)}%` }]}/></View></View>) : <Text style={styles.emptyHint}>Add an expense to see your spending breakdown.</Text>}</View>
    <View style={styles.section}><View style={styles.listHeading}><View><Text style={styles.sectionTitle}>Transactions</Text><Text style={styles.muted}>{visible.length} records</Text></View></View><Text style={styles.label}>Type</Text><FilterChips values={TYPE_FILTERS} value={filterType} onChange={setFilterType}/><Text style={styles.label}>Category</Text><FilterChips values={ALL_CATEGORY_FILTERS} value={filterCategory} onChange={setFilterCategory}/><View style={styles.fieldRow}><View style={styles.flex}><Text style={styles.label}>From (YYYY-MM-DD)</Text><TextInput value={from} onChangeText={setFrom} placeholder="Any date" style={styles.input}/></View><View style={styles.flex}><Text style={styles.label}>To (YYYY-MM-DD)</Text><TextInput value={to} onChangeText={setTo} placeholder="Any date" style={styles.input}/></View></View>
      {!ready ? <Text style={styles.emptyHint}>Loading saved transactions…</Text> : <FlatList data={visible} scrollEnabled={false} keyExtractor={(item) => item.id} ListEmptyComponent={<Text style={styles.emptyHint}>No transactions match these filters.</Text>} renderItem={({ item }) => <View style={styles.transaction}><View style={styles.transactionIcon}><Text style={styles.iconText}>{item.category.slice(0, 1)}</Text></View><View style={styles.flex}><Text style={styles.rowTitle}>{item.note || item.category}</Text><Text style={styles.rowMeta}>{item.category} · {dateLabel(item.date)}</Text></View><Text style={[styles.rowAmount, item.type === 'income' ? styles.income : styles.expense]}>{item.type === 'income' ? '+' : '−'}{money(item.amount)}</Text></View>}/>}</View>
    <Text style={styles.footer}>Your data syncs to your account</Text>
  </ScrollView></KeyboardAvoidingView><Modal visible={linkingMethod} animationType="slide" onRequestClose={() => setLinkingMethod(false)}><AuthScreen linking user={user} onCancel={() => setLinkingMethod(false)}/></Modal></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f6f7fb' }, authWrap: { flex: 1, justifyContent: 'center', padding: 22 }, authCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eceef3', borderRadius: 14, padding: 22 }, authMethods: { flexDirection: 'row', gap: 8, backgroundColor: '#f6f6f9', padding: 4, borderRadius: 8, marginTop: 16 }, authMethod: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 6 }, authMethodOn: { backgroundColor: '#fff' }, authMethodText: { color: '#777686', fontSize: 12 }, authMethodTextOn: { color: '#6958ce', fontWeight: '700' }, authInfo: { color: '#6251c5', backgroundColor: '#f1effe', padding: 9, borderRadius: 5, fontSize: 11, marginTop: 8 }, disabled: { opacity: 0.65 }, authReset: { color: '#6958ce', fontSize: 11, textAlign: 'center', marginTop: 12 }, accountActions: { gap: 8, alignItems: 'flex-end' }, signOut: { borderWidth: 1, borderColor: '#e9e9ef', borderRadius: 6, paddingVertical: 7, paddingHorizontal: 10 }, signOutText: { color: '#6251c5', fontSize: 10 }, page: { padding: 18, paddingBottom: 36 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }, brand: { color: '#29253c', fontSize: 18, fontWeight: '800', marginBottom: 24 }, kicker: { color: '#948bbd', fontSize: 9, letterSpacing: 1, fontWeight: '700' }, title: { color: '#242330', fontSize: 25, fontWeight: '800', marginTop: 6 }, muted: { color: '#9998a5', fontSize: 11, marginTop: 5 }, avatar: { backgroundColor: '#f5d8c8', width: 34, height: 34, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#94563d', fontWeight: '700', fontSize: 11 }, summaryCard: { backgroundColor: '#7161d6', borderRadius: 12, padding: 18, marginBottom: 14 }, cardLabel: { fontSize: 9, letterSpacing: 1, color: '#e3ddff', fontWeight: '700' }, balance: { color: '#fff', fontSize: 29, fontWeight: '800', marginTop: 7 }, summaryLine: { borderTopWidth: 1, borderColor: '#9387e1', marginTop: 17, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between' }, income: { color: '#28a87d', fontSize: 12, fontWeight: '700', marginTop: 5 }, expense: { color: '#d2884e', fontSize: 12, fontWeight: '700', marginTop: 5 }, section: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eceef3', borderRadius: 10, padding: 16, marginBottom: 13 }, sectionTitle: { color: '#302e3c', fontSize: 15, fontWeight: '700' }, toggleRow: { flexDirection: 'row', backgroundColor: '#f6f6f9', padding: 3, borderRadius: 7, marginTop: 15, marginBottom: 14 }, toggle: { flex: 1, alignItems: 'center', padding: 9, borderRadius: 5 }, toggleText: { color: '#9998a4', fontSize: 11, fontWeight: '600' }, expenseToggle: { backgroundColor: '#fff' }, expenseToggleText: { color: '#c7834c' }, incomeToggle: { backgroundColor: '#fff' }, incomeToggleText: { color: '#309d76' }, label: { color: '#656371', fontSize: 10, fontWeight: '600', marginTop: 9, marginBottom: 6 }, amountBox: { height: 42, borderWidth: 1, borderColor: '#e9e9ef', borderRadius: 6, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }, dollar: { color: '#999', fontSize: 15 }, amountInput: { flex: 1, padding: 8, color: '#373644', fontSize: 16, fontWeight: '600' }, input: { height: 39, borderWidth: 1, borderColor: '#e9e9ef', borderRadius: 6, paddingHorizontal: 10, color: '#4b4a58', fontSize: 11 }, fieldRow: { flexDirection: 'row', gap: 10 }, flex: { flex: 1 }, chips: { flexDirection: 'row', gap: 6, paddingVertical: 3 }, chip: { paddingVertical: 7, paddingHorizontal: 10, backgroundColor: '#f6f6f9', borderRadius: 15 }, chipOn: { backgroundColor: '#efedfc' }, chipText: { color: '#81808e', fontSize: 10 }, chipTextOn: { color: '#6656c8', fontWeight: '700' }, error: { color: '#b34d4d', backgroundColor: '#fff0f0', padding: 8, borderRadius: 5, fontSize: 10, marginTop: 8 }, primary: { backgroundColor: '#7161d6', borderRadius: 6, alignItems: 'center', padding: 12, marginTop: 11 }, primaryText: { color: '#fff', fontSize: 11, fontWeight: '700' }, breakdownRow: { marginTop: 15 }, breakdownLine: { flexDirection: 'row', justifyContent: 'space-between' }, rowTitle: { color: '#3a3946', fontSize: 11, fontWeight: '600' }, rowAmount: { color: '#363543', fontSize: 11, fontWeight: '600' }, track: { height: 5, borderRadius: 4, backgroundColor: '#f1f1f5', marginTop: 7 }, bar: { height: 5, borderRadius: 4, backgroundColor: '#8879df' }, emptyHint: { color: '#a2a1ac', fontSize: 11, paddingVertical: 18, textAlign: 'center' }, listHeading: { marginBottom: 10 }, transaction: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f1f1f4' }, transactionIcon: { width: 33, height: 33, backgroundColor: '#f3f1ff', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, iconText: { color: '#796cce', fontWeight: '700' }, rowMeta: { color: '#a2a1ad', fontSize: 9, marginTop: 4 }, footer: { textAlign: 'center', color: '#aaa9b3', fontSize: 9, paddingTop: 8 } });

const FilterChips = memo(function FilterChips({ values, value, onChange }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{values.map((item) => <Pressable key={item.value} onPress={() => onChange(item.value)} style={[styles.chip, value === item.value && styles.chipOn]}><Text style={[styles.chipText, value === item.value && styles.chipTextOn]}>{item.label}</Text></Pressable>)}</ScrollView>;
});
