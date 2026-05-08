import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate, useParams } from 'react-router-dom'
import TTCHeader from '../components/TTCHeader'
import ttcLogo from '../assets/ttc-logo.png'
// ── Phase B additions ────────────────────────────────────────────────
import QuoteActionBar from '../components/QuoteActionBar'
import { QuoteStatusBadge } from '../components/StatusBadge'
import LastEditedLine from '../components/LastEditedLine'
import DocRequestPanel from '../components/DocRequestPanel'
import { saveQuoteEdits } from '../lib/quoteActions'
// ─────────────────────────────────────────────────────────────────────

function calcPayment(price, down, tradeValue, tradePayoff, rate, months) {
  const amount = price - down - tradeValue + tradePayoff
  if (amount <= 0 || months <= 0) return 0
  const r = rate / 100 / 12
  if (r === 0) return amount / months
  return (amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

const INCENTIVE_OPTIONS = [
  'CPA', 'Dealer Cash', 'Fleet Assistance', 'Loyalty Rebate',
  'Commercial Upfit Allowance', 'Government/Municipal Discount',
  'Trade Assist', 'Conquest Rebate', 'Finance Rate Support', 'Other'
]

export default function QuoteDetail() {
  const { id } = useParams()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [commissionRate, setCommissionRate] = useState(25)

  // Phase B: keep the full quote row for action bar + last-edited line
  const [quote, setQuote] = useState(null)
  // Phase B: doc request lives on existing quotes
  const [docRequest, setDocRequest] = useState(null)

  const [form, setForm] = useState(null)

  const makes = ['Isuzu', 'Ford', 'Hino', 'Mitsubishi Fuso', 'UD Trucks', 'Other']
  const models = {
    Isuzu: ['NPR', 'NPR-HD', 'NQR', 'NRR', 'NRR EV', 'FTR', 'FVR', 'FXR', 'Other'],
    Ford: ['F-350', 'F-450', 'F-550', 'F-600', 'F-650', 'F-750', 'Other'],
    Hino: ['155', '195', '258', '268', '338', 'XL7', 'XL8', 'Other'],
    'Mitsubishi Fuso': ['FE130', 'FE160', 'FE180', 'FG140', 'FK200', 'Other'],
    'UD Trucks': ['Condor', 'Quon', 'Other'],
    Other: ['Other']
  }
  const bodyStyles = ['Cab & Chassis', 'Box Truck', 'Flatbed', 'Dump', 'Stake', 'Refrigerated', 'Service Body', 'Crane/Boom', 'Other']

  useEffect(() => {
    fetchQuote()
    fetchSettings()
    fetchDocRequest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function fetchSettings() {
    const { data } = await supabase.from('settings').select('*').eq('id', 'global').single()
    if (data) setCommissionRate(parseFloat(data.commission_rate) || 25)
  }

  async function fetchDocRequest() {
    const { data } = await supabase
      .from('doc_requests')
      .select('*')
      .eq('quote_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setDocRequest(data || null)
  }

  async function fetchQuote() {
    const { data, error } = await supabase.from('quotes').select('*').eq('id', id).single()
    if (error || !data) { navigate('/'); return }

    const makeInList = makes.includes(data.make)
    const modelInList = data.make && models[data.make] ? models[data.make].includes(data.model) : false

    // Phase B: hold the full row for the action bar / last-edited line
    setQuote(data)

    setForm({
      customer_name: data.customer_name || '',
      customer_phone: data.customer_phone || '',
      customer_email: data.customer_email || '',
      company_name: data.company_name || '',
      vehicle_type: data.vehicle_type || 'New',
      year: data.year || '',
      make: makeInList ? data.make : 'Other',
      make_other: makeInList ? '' : data.make || '',
      model: modelInList ? data.model : 'Other',
      model_other: modelInList ? '' : data.model || '',
      body_style: data.body_style || '',
      body_style_other: '',
      truck_description: data.truck_description || '',
      vin: data.vin || '',
      stock_number: data.stock_number || '',
      color: data.color || '',
      msrp: data.msrp || '',
      price_good: data.price_good || '',
      price_better: data.price_better || '',
      price_best: data.price_best || '',
      selected_tier: data.selected_tier || 'better',
      down_payment: data.down_payment || '0',
      trade_value: data.trade_value || '0',
      trade_payoff: data.trade_payoff || '0',
      term_months: data.term_months || '60',
      interest_rate: data.interest_rate || '6.99',
      deal_type: data.deal_type || 'Finance',
      deal_number: data.deal_number || '',
      cost_of_vehicle: data.cost_of_vehicle || '',
      pack_amount: data.pack_amount || '500',
      // Phase B: round-trip incentives properly (was hardcoded to [])
      selected_incentives: Array.isArray(data.selected_incentives) ? data.selected_incentives : [],
      incentive_total: data.incentive_total || '0',
      notes: data.notes || '',
      docs_submitted: data.docs_submitted || 'No',
      // Status is now read-only on the form — controlled by ActionBar
      quote_number: data.quote_number || '',
    })
    setLoading(false)
  }

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function toggleIncentive(incentive) {
    setForm(f => ({
      ...f,
      selected_incentives: f.selected_incentives.includes(incentive)
        ? f.selected_incentives.filter(i => i !== incentive)
        : [...f.selected_incentives, incentive]
    }))
  }

  const selectedPrice = form ? parseFloat(form[`price_${form.selected_tier}`]) || 0 : 0
  const payment = form ? calcPayment(
    selectedPrice,
    parseFloat(form.down_payment) || 0,
    parseFloat(form.trade_value) || 0,
    parseFloat(form.trade_payoff) || 0,
    parseFloat(form.interest_rate) || 6.99,
    parseInt(form.term_months) || 60
  ) : 0

  const cost = form ? parseFloat(form.cost_of_vehicle) || 0 : 0
  const pack = form ? parseFloat(form.pack_amount) || 0 : 0
  const incentiveTotal = form ? parseFloat(form.incentive_total) || 0 : 0
  const grossProfit = selectedPrice - cost - pack - incentiveTotal
  const commission = grossProfit * (commissionRate / 100)

  // Phase B: Save now goes through saveQuoteEdits() so last_edited_at + audit_log get written.
  // Status transitions are no longer triggered here — use the ActionBar instead.
  async function handleSave() {
    if (!form.customer_name) { setError('Customer name is required'); return }
    const finalMake = form.make === 'Other' ? form.make_other : form.make
    const finalModel = form.model === 'Other' ? form.model_other : form.model
    const finalBodyStyle = form.body_style === 'Other' ? form.body_style_other : form.body_style
    if (!finalMake || !finalModel) { setError('Vehicle make and model are required'); return }
    setSaving(true); setError('')

    const patch = {
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_email: form.customer_email,
      company_name: form.company_name,
      vehicle_type: form.vehicle_type,
      year: parseInt(form.year) || null,
      make: finalMake,
      model: finalModel,
      body_style: finalBodyStyle,
      truck_description: form.truck_description,
      vin: form.vin,
      stock_number: form.stock_number,
      color: form.color,
      msrp: parseFloat(form.msrp) || null,
      price_good: parseFloat(form.price_good) || null,
      price_better: parseFloat(form.price_better) || null,
      price_best: parseFloat(form.price_best) || null,
      selected_tier: form.selected_tier,
      down_payment: parseFloat(form.down_payment) || 0,
      trade_value: parseFloat(form.trade_value) || 0,
      trade_payoff: parseFloat(form.trade_payoff) || 0,
      term_months: parseInt(form.term_months) || 60,
      interest_rate: parseFloat(form.interest_rate) || 6.99,
      monthly_payment: payment,
      deal_type: form.deal_type,
      // Phase 5 fix: empty deal_number stored as null, not ''
      deal_number: form.deal_number?.trim() || null,
      cost_of_vehicle: parseFloat(form.cost_of_vehicle) || null,
      pack_amount: parseFloat(form.pack_amount) || 500,
      gross_profit: grossProfit,
      commission: commission,
      // Phase B: incentives are now saved
      selected_incentives: form.selected_incentives,
      notes: form.notes,
      docs_submitted: form.docs_submitted,
    }

    const { data, error: err } = await saveQuoteEdits({ quoteId: id, patch, profile })

    setSaving(false)
    if (err) { setError(err.message); return }
    if (data) setQuote(data)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputClass = "w-full bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text rounded-lg px-3 py-2 border border-gray-300 dark:border-dark-border focus:outline-none focus:border-ttc-blue focus:ring-2 focus:ring-ttc-blue/20 text-sm transition-all"
  const labelClass = "block text-gray-600 dark:text-dark-muted text-xs mb-1 font-medium"
  const sectionClass = "bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-5 mb-4 shadow-ttc-card"
  const toggleSelected = "bg-ttc-blue border-ttc-blue text-white"
  const toggleUnselected = "bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text hover:border-gray-400 dark:hover:border-dark-muted"

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center text-gray-500 dark:text-dark-muted">Loading...</div>
  if (!form || !quote) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-dark-text">
      <TTCHeader
        logoSrc={ttcLogo}
        appName="TruckQuote Pro"
        userName={profile?.full_name ?? profile?.email}
        userRole={profile?.role}
        rightNav={[{ label: 'Dashboard', href: '/' }]}
        onSignOut={signOut}
      />

      {/* Action toolbar — top-right action bar replaces old Submit button */}
      <div className="bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/')} className="text-gray-500 dark:text-dark-muted hover:text-gray-900 dark:hover:text-dark-text text-sm whitespace-nowrap">← Back</button>
            <span className="text-gray-300 dark:text-dark-border">|</span>
            <span className="text-gray-900 dark:text-dark-text font-semibold font-numeric truncate">{form.quote_number}</span>
            <QuoteStatusBadge quote={quote} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg text-gray-700 dark:text-dark-text px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
              {saved ? '✓ Saved!' : 'Save'}
            </button>
            {/* Phase B: dynamic action buttons by role + status (Approve / Mark Delivered / Mark Lost / Archive / Unarchive) */}
            <QuoteActionBar
              quote={quote}
              profile={profile}
              onUpdated={(updated) => setQuote(updated)}
              onError={(msg) => setError(msg)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 text-stat-red text-sm bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        {/* Phase B: Doc Request panel (Joe + salesperson actions) */}
        <div className="mb-4">
          <DocRequestPanel
            doc={docRequest}
            quote={quote}
            profile={profile}
            onUpdated={(updated) => setDocRequest(updated)}
            onError={(msg) => setError(msg)}
          />
        </div>

        {/* Quote # / Deal # — status dropdown removed (controlled by ActionBar now) */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4 uppercase tracking-wider">Deal Number</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Deal #</label><input className={inputClass} value={form.deal_number} onChange={e => set('deal_number', e.target.value)} placeholder="D-00001" /></div>
          </div>
        </div>

        {/* Customer Info */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4 uppercase tracking-wider">Customer Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Customer Name *</label><input className={inputClass} value={form.customer_name} onChange={e => set('customer_name', e.target.value)} /></div>
            <div><label className={labelClass}>Company Name</label><input className={inputClass} value={form.company_name} onChange={e => set('company_name', e.target.value)} /></div>
            <div><label className={labelClass}>Phone</label><input className={inputClass} value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} /></div>
            <div><label className={labelClass}>Email</label><input className={inputClass} value={form.customer_email} onChange={e => set('customer_email', e.target.value)} /></div>
          </div>
        </div>

        {/* Vehicle Info */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4 uppercase tracking-wider">Vehicle Information</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Vehicle Type</label>
              <div className="flex gap-2">
                {['New', 'Pre-Owned'].map(t => (
                  <button key={t} onClick={() => set('vehicle_type', t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${form.vehicle_type === t ? toggleSelected : toggleUnselected}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div><label className={labelClass}>Year</label><input className={inputClass} value={form.year} onChange={e => set('year', e.target.value)} /></div>
            <div><label className={labelClass}>Color</label><input className={inputClass} value={form.color} onChange={e => set('color', e.target.value)} /></div>
            <div>
              <label className={labelClass}>Make *</label>
              <select className={inputClass} value={form.make} onChange={e => { set('make', e.target.value); set('model', '') }}>
                {makes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {form.make === 'Other' && (
              <div><label className={labelClass}>Make (specify)</label><input className={inputClass} value={form.make_other} onChange={e => set('make_other', e.target.value)} /></div>
            )}
            <div>
              <label className={labelClass}>Model *</label>
              <select className={inputClass} value={form.model} onChange={e => set('model', e.target.value)}>
                <option value="">Select model</option>
                {(models[form.make] || models.Other).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {form.model === 'Other' && (
              <div><label className={labelClass}>Model (specify)</label><input className={inputClass} value={form.model_other} onChange={e => set('model_other', e.target.value)} /></div>
            )}
            <div>
              <label className={labelClass}>Body Style</label>
              <select className={inputClass} value={form.body_style} onChange={e => set('body_style', e.target.value)}>
                <option value="">Select body style</option>
                {bodyStyles.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {form.body_style === 'Other' && (
              <div><label className={labelClass}>Body Style (specify)</label><input className={inputClass} value={form.body_style_other} onChange={e => set('body_style_other', e.target.value)} /></div>
            )}
            <div><label className={labelClass}>Stock #</label><input className={inputClass} value={form.stock_number} onChange={e => set('stock_number', e.target.value)} /></div>
            <div><label className={labelClass}>MSRP</label><input className={inputClass} value={form.msrp} onChange={e => set('msrp', e.target.value)} /></div>
            <div className="col-span-3"><label className={labelClass}>VIN</label><input className={inputClass} value={form.vin} onChange={e => set('vin', e.target.value)} /></div>
            <div className="col-span-3"><label className={labelClass}>Truck Description</label><textarea className={inputClass} rows={2} value={form.truck_description} onChange={e => set('truck_description', e.target.value)} /></div>
          </div>
        </div>

        {/* Deal Type */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4 uppercase tracking-wider">Deal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Deal Type</label>
              <div className="flex gap-2">
                {['Finance', 'Cash'].map(t => (
                  <button key={t} onClick={() => set('deal_type', t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${form.deal_type === t ? toggleSelected : toggleUnselected}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* GBB Pricing */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4 uppercase tracking-wider">Good · Better · Best Pricing</h2>
          <div className="grid grid-cols-3 gap-4">
            {['good', 'better', 'best'].map(tier => (
              <div key={tier} onClick={() => set('selected_tier', tier)}
                className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                  form.selected_tier === tier
                    ? 'border-ttc-blue bg-ttc-blue-light dark:bg-ttc-blue/10'
                    : 'border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg hover:border-gray-300 dark:hover:border-dark-muted'
                }`}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-gray-500 dark:text-dark-muted">{tier}</p>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400 dark:text-dark-muted text-sm">$</span>
                  <input
                    className="w-full bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text rounded-lg pl-7 pr-3 py-2 border border-gray-300 dark:border-dark-border focus:outline-none focus:border-ttc-blue focus:ring-2 focus:ring-ttc-blue/20 text-sm transition-all font-numeric"
                    value={form[`price_${tier}`]} onChange={e => set(`price_${tier}`, e.target.value)} placeholder="0" onClick={e => e.stopPropagation()}
                  />
                </div>
                {form.selected_tier === tier && <p className="text-xs text-ttc-blue mt-2 font-semibold">✓ Selected</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Finance */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4 uppercase tracking-wider">Financing</h2>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={labelClass}>Down Payment</label><input className={inputClass} value={form.down_payment} onChange={e => set('down_payment', e.target.value)} /></div>
            <div><label className={labelClass}>Trade-In Value</label><input className={inputClass} value={form.trade_value} onChange={e => set('trade_value', e.target.value)} /></div>
            <div><label className={labelClass}>Trade Payoff</label><input className={inputClass} value={form.trade_payoff} onChange={e => set('trade_payoff', e.target.value)} /></div>
            <div>
              <label className={labelClass}>Term</label>
              <select className={inputClass} value={form.term_months} onChange={e => set('term_months', e.target.value)}>
                {[24,36,48,60,72,84].map(t => <option key={t} value={t}>{t} months</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Interest Rate %</label><input className={inputClass} value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} /></div>
            <div className="bg-gray-50 dark:bg-dark-bg rounded-xl p-3 border border-gray-200 dark:border-dark-border">
              <p className="text-gray-500 dark:text-dark-muted text-xs mb-1">Est. Monthly Payment</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-dark-text font-numeric">${payment.toFixed(2)}</p>
              <p className="text-gray-500 dark:text-dark-muted text-xs">{form.selected_tier} price · {form.term_months} mo</p>
            </div>
          </div>
        </div>

        {/* RECAP */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4 uppercase tracking-wider">RECAP — Deal Summary</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div><label className={labelClass}>Cost of Vehicle</label><input className={inputClass} value={form.cost_of_vehicle} onChange={e => set('cost_of_vehicle', e.target.value)} placeholder="0" /></div>
            <div><label className={labelClass}>Pack Amount</label><input className={inputClass} value={form.pack_amount} onChange={e => set('pack_amount', e.target.value)} placeholder="500" /></div>
            <div><label className={labelClass}>Incentive Total</label><input className={inputClass} value={form.incentive_total} onChange={e => set('incentive_total', e.target.value)} placeholder="0" /></div>
          </div>
          <div className="mb-4">
            <label className={labelClass}>Incentives / Rebates (select all that apply)</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {INCENTIVE_OPTIONS.map(inc => (
                <button key={inc} onClick={() => toggleIncentive(inc)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    form.selected_incentives.includes(inc)
                      ? 'bg-ttc-blue border-ttc-blue text-white'
                      : 'bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text hover:border-gray-400 dark:hover:border-dark-muted'
                  }`}>
                  {inc}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-gray-50 dark:bg-dark-bg rounded-xl p-3 border border-gray-200 dark:border-dark-border">
              <p className="text-gray-500 dark:text-dark-muted text-xs mb-1">Sale Price</p>
              <p className="text-xl font-bold text-gray-900 dark:text-dark-text font-numeric">${selectedPrice.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 dark:bg-dark-bg rounded-xl p-3 border border-gray-200 dark:border-dark-border">
              <p className="text-gray-500 dark:text-dark-muted text-xs mb-1">Gross Profit</p>
              <p className={`text-xl font-bold font-numeric ${grossProfit >= 0 ? 'text-stat-green' : 'text-stat-red'}`}>${grossProfit.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 dark:bg-dark-bg rounded-xl p-3 border border-gray-200 dark:border-dark-border">
              <p className="text-gray-500 dark:text-dark-muted text-xs mb-1">Commission ({commissionRate}%)</p>
              <p className="text-xl font-bold text-stat-yellow font-numeric">${commission.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4">
            <label className={labelClass}>Docs Submitted</label>
            <div className="flex gap-2 w-48">
              {['Yes', 'No'].map(v => (
                <button key={v} onClick={() => set('docs_submitted', v)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${form.docs_submitted === v ? toggleSelected : toggleUnselected}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <label className={labelClass}>Notes</label>
            <textarea className={inputClass} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => navigate('/')} className="text-gray-500 dark:text-dark-muted hover:text-gray-900 dark:hover:text-dark-text px-4 py-2 text-sm transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg text-gray-700 dark:text-dark-text px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            {saved ? '✓ Saved!' : 'Save'}
          </button>
        </div>

        {/* Phase B: Last edited footer */}
        <div className="mt-4 flex justify-end">
          <LastEditedLine quote={quote} />
        </div>
      </div>
    </div>
  )
}
