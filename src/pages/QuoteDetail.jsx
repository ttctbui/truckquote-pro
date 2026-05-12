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
// ── Feature A: Local Installations ───────────────────────────────────
import LocalInstallsTable from '../components/LocalInstallsTable'
// ── Feature B: Out The Door Price ────────────────────────────────────
import OutTheDoorSection from '../components/OutTheDoorSection'
// ─────────────────────────────────────────────────────────────────────

// Robust number parser: empty string → default, "0" → 0, "abc" → default
function numOrDefault(val, def = 0) {
  if (val === '' || val == null) return def
  const n = typeof val === 'string' ? parseFloat(val) : Number(val)
  return Number.isFinite(n) ? n : def
}

// Same idea but returns null on missing (for nullable DB columns like price_*)
function numOrNull(val) {
  if (val === '' || val == null) return null
  const n = typeof val === 'string' ? parseFloat(val) : Number(val)
  return Number.isFinite(n) ? n : null
}

function calcPayment(amountFinanced, rate, months) {
  // Amount Financed is already net of down payment, incentives, and trade
  // (calculated in OutTheDoorSection from OTD price minus reductions)
  if (amountFinanced <= 0 || months <= 0) return 0
  const r = rate / 100 / 12
  if (r === 0) return amountFinanced / months
  return (amountFinanced * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
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
  const [commissionRate, setCommissionRate] = useState(30)

  const [quote, setQuote] = useState(null)
  const [docRequest, setDocRequest] = useState(null)
  const [form, setForm] = useState(null)
  const [installTotals, setInstallTotals] = useState({ dnp: 0, customer: 0, markup: 0 })
  // Feature B: OTD calculated totals (populated by OutTheDoorSection.onTotalsChange)
  const [otdTotals, setOtdTotals] = useState({
    totalTax: 0,
    totalFees: 0,
    otdPrice: 0,
    amountFinanced: 0,
    autoLicenseReg: 0,
    effectiveLicenseReg: 0,
  })

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
    // NOTE: install totals are populated by LocalInstallsTable's onChange callback
    // when it loads its rows. Don't fetch them separately here — causes a race
    // condition where the RECAP renders before installs are loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function fetchSettings() {
    const { data } = await supabase.from('settings').select('*').eq('id', 'global').single()
    if (data) setCommissionRate(numOrDefault(data.commission_rate, 30))
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

  // Called by LocalInstallsTable's onChange with the current install rows.
  // No DB query here — we just compute totals from the rows the table already has.
  function recomputeInstallTotals(rows) {
    const totals = (rows || []).reduce(
      (acc, r) => ({
        dnp: acc.dnp + numOrDefault(r.dnp_amount, 0),
        customer: acc.customer + numOrDefault(r.customer_total, 0),
        markup: acc.markup + numOrDefault(r.markup_amount, 0),
      }),
      { dnp: 0, customer: 0, markup: 0 }
    )
    setInstallTotals(totals)
  }

  async function fetchQuote() {
    const { data, error } = await supabase.from('quotes').select('*').eq('id', id).single()
    if (error || !data) { navigate('/'); return }

    const makeInList = makes.includes(data.make)
    const modelInList = data.make && models[data.make] ? models[data.make].includes(data.model) : false

    setQuote(data)

    // Backfill: derive GP from old price - cost for legacy quotes
    const baseCost = numOrDefault(data.cost_of_vehicle, 0)
    const fallbackGp = (price) => {
      if (price == null) return ''
      const p = numOrDefault(price, 0)
      if (p && baseCost) return Math.max(0, p - baseCost).toString()
      return ''
    }

    // toFormStr: load value as a string, preserving "0" (don't lose it to falsy)
    const toFormStr = (v, fallback = '') => {
      if (v == null || v === '') return fallback
      return String(v)
    }

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
      msrp: toFormStr(data.msrp, ''),
      gross_profit_good: data.gross_profit_good != null
        ? String(data.gross_profit_good)
        : fallbackGp(data.price_good),
      gross_profit_better: data.gross_profit_better != null
        ? String(data.gross_profit_better)
        : fallbackGp(data.price_better),
      gross_profit_best: data.gross_profit_best != null
        ? String(data.gross_profit_best)
        : fallbackGp(data.price_best),
      selected_tier: data.selected_tier || 'better',
      // CRITICAL: use toFormStr so "0" loads as "0", not gets replaced by default
      down_payment: toFormStr(data.down_payment, '0'),
      trade_value: toFormStr(data.trade_value, '0'),
      trade_payoff: toFormStr(data.trade_payoff, '0'),
      term_months: toFormStr(data.term_months, '60'),
      interest_rate: toFormStr(data.interest_rate, '6.99'),
      deal_type: data.deal_type || 'Finance',
      deal_number: data.deal_number || '',
      cost_of_vehicle: toFormStr(data.cost_of_vehicle, ''),
      pack_amount: toFormStr(data.pack_amount, '500'),
      selected_incentives: Array.isArray(data.selected_incentives) ? data.selected_incentives : [],
      incentive_total: toFormStr(data.incentive_total, '0'),
      notes: data.notes || '',
      docs_submitted: data.docs_submitted || 'No',
      quote_number: data.quote_number || '',
      // Feature B: Out The Door Price fields
      tax_zip: data.tax_zip || '',
      tax_state: data.tax_state || 'CA',
      tax_rate: toFormStr(data.tax_rate, '10.50'),
      tax_city: data.tax_city || '',
      tax_county: data.tax_county || '',
      fee_doc_prep: toFormStr(data.fee_doc_prep, '85'),
      fee_fire_ext: toFormStr(data.fee_fire_ext, '250'),
      fee_dmv: toFormStr(data.fee_dmv, '37'),
      fee_admin: toFormStr(data.fee_admin, '395'),
      fee_tire: toFormStr(data.fee_tire, '10.50'),
      fee_warranty: toFormStr(data.fee_warranty, '0'),
      fee_license_reg: data.fee_license_reg != null ? String(data.fee_license_reg) : '',
      fee_license_reg_manual: !!data.fee_license_reg_manual,
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

  // GP-per-tier math
  const baseCost = form ? numOrDefault(form.cost_of_vehicle, 0) : 0
  const pack = form ? numOrDefault(form.pack_amount, 0) : 0
  const incentiveTotal = form ? numOrDefault(form.incentive_total, 0) : 0

  const gpByTier = form ? {
    good:   numOrDefault(form.gross_profit_good,   0),
    better: numOrDefault(form.gross_profit_better, 0),
    best:   numOrDefault(form.gross_profit_best,   0),
  } : { good: 0, better: 0, best: 0 }

  const salePriceByTier = {
    good:   baseCost + installTotals.customer + gpByTier.good   + pack,
    better: baseCost + installTotals.customer + gpByTier.better + pack,
    best:   baseCost + installTotals.customer + gpByTier.best   + pack,
  }

  const selectedTier = form?.selected_tier || 'better'
  const selectedGp = gpByTier[selectedTier]
  const selectedSalePrice = salePriceByTier[selectedTier]
  const commission = selectedGp * (commissionRate / 100)

  const payment = form ? calcPayment(
    otdTotals.amountFinanced,
    numOrDefault(form.interest_rate, 6.99),
    parseInt(form.term_months) || 60
  ) : 0

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
      msrp: numOrNull(form.msrp),
      gross_profit_good:   numOrNull(form.gross_profit_good),
      gross_profit_better: numOrNull(form.gross_profit_better),
      gross_profit_best:   numOrNull(form.gross_profit_best),
      // Write derived sale prices into legacy price_* columns
      price_good:   salePriceByTier.good   || null,
      price_better: salePriceByTier.better || null,
      price_best:   salePriceByTier.best   || null,
      selected_tier: form.selected_tier,
      // Use numOrDefault so "0" saves as 0, not as the fallback
      down_payment: numOrDefault(form.down_payment, 0),
      trade_value:  numOrDefault(form.trade_value,  0),
      trade_payoff: numOrDefault(form.trade_payoff, 0),
      term_months:  parseInt(form.term_months) || 60,
      interest_rate: numOrDefault(form.interest_rate, 6.99),
      monthly_payment: payment,
      deal_type: form.deal_type,
      deal_number: form.deal_number?.trim() || null,
      cost_of_vehicle: numOrNull(form.cost_of_vehicle),
      // CRITICAL FIX: was "|| 500" before, which broke when user entered 0
      pack_amount: numOrDefault(form.pack_amount, 500),
      gross_profit: selectedGp,
      commission: commission,
      selected_incentives: form.selected_incentives,
      incentive_total: numOrDefault(form.incentive_total, 0),
      notes: form.notes,
      docs_submitted: form.docs_submitted,
      // Feature B: OTD fields
      tax_zip: form.tax_zip?.trim() || null,
      tax_state: form.tax_state || 'CA',
      tax_rate: numOrDefault(form.tax_rate, 10.50),
      tax_city: form.tax_city || null,
      tax_county: form.tax_county || null,
      fee_doc_prep: numOrDefault(form.fee_doc_prep, 85),
      fee_fire_ext: numOrDefault(form.fee_fire_ext, 250),
      fee_dmv: numOrDefault(form.fee_dmv, 37),
      fee_admin: numOrDefault(form.fee_admin, 395),
      fee_tire: numOrDefault(form.fee_tire, 10.50),
      fee_warranty: numOrDefault(form.fee_warranty, 0),
      fee_license_reg: form.fee_license_reg_manual
        ? numOrDefault(form.fee_license_reg, 0)
        : otdTotals.autoLicenseReg,
      fee_license_reg_manual: !!form.fee_license_reg_manual,
      total_tax: otdTotals.totalTax,
      total_fees: otdTotals.totalFees,
      out_the_door_price: otdTotals.otdPrice,
      amount_financed: otdTotals.amountFinanced,
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

  const hasInstalls = installTotals.dnp !== 0 || installTotals.customer !== 0

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

      {/* Action toolbar */}
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

        {/* Phase B: Doc Request panel */}
        <div className="mb-4">
          <DocRequestPanel
            doc={docRequest}
            quote={quote}
            profile={profile}
            onUpdated={(updated) => setDocRequest(updated)}
            onError={(msg) => setError(msg)}
          />
        </div>

        {/* Deal Number */}
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

        {/* GBB Pricing — GP-per-tier */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4 uppercase tracking-wider">Good · Better · Best Pricing</h2>
          <p className="text-xs text-gray-500 dark:text-dark-muted mb-3">
            Enter the Gross Profit target for each tier. Sale Price is calculated as Cost + Local Installs + GP + Pack.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {['good', 'better', 'best'].map(tier => (
              <div key={tier} onClick={() => set('selected_tier', tier)}
                className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                  form.selected_tier === tier
                    ? 'border-ttc-blue bg-ttc-blue-light dark:bg-ttc-blue/10'
                    : 'border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg hover:border-gray-300 dark:hover:border-dark-muted'
                }`}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-gray-500 dark:text-dark-muted">{tier}</p>
                <label className="text-xs text-gray-500 dark:text-dark-muted mb-1 block">Gross Profit target</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400 dark:text-dark-muted text-sm">$</span>
                  <input
                    className="w-full bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text rounded-lg pl-7 pr-3 py-2 border border-gray-300 dark:border-dark-border focus:outline-none focus:border-ttc-blue focus:ring-2 focus:ring-ttc-blue/20 text-sm transition-all font-numeric"
                    value={form[`gross_profit_${tier}`]}
                    onChange={e => set(`gross_profit_${tier}`, e.target.value)}
                    placeholder="0"
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-dark-border">
                  <p className="text-xs text-gray-500 dark:text-dark-muted mb-0.5">Calculated Sale Price</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-dark-text font-numeric">
                    ${salePriceByTier[tier].toLocaleString()}
                  </p>
                </div>
                {form.selected_tier === tier && <p className="text-xs text-ttc-blue mt-2 font-semibold">✓ Selected</p>}
              </div>
            ))}
          </div>
        </div>

        {/* RECAP */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4 uppercase tracking-wider">RECAP — Deal Summary</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div><label className={labelClass}>Cost of Vehicle</label><input className={inputClass} value={form.cost_of_vehicle} onChange={e => set('cost_of_vehicle', e.target.value)} placeholder="0" /></div>
            <div><label className={labelClass}>Pack Amount</label><input className={inputClass} value={form.pack_amount} onChange={e => set('pack_amount', e.target.value)} placeholder="500" /></div>
            <div>
              <label className={labelClass}>Incentive Total <span className="text-gray-400 dark:text-dark-muted font-normal">(applied as cash down)</span></label>
              <input className={inputClass} value={form.incentive_total} onChange={e => set('incentive_total', e.target.value)} placeholder="0" />
            </div>
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

          <div className="mb-3 text-xs text-gray-500 dark:text-dark-muted bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg px-3 py-2">
            Selected tier: <span className="font-semibold capitalize">{selectedTier}</span> · GP ${selectedGp.toLocaleString()}
            {hasInstalls && (
              <> · includes ${installTotals.dnp.toLocaleString()} install costs and ${installTotals.customer.toLocaleString()} install customer charges</>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-gray-50 dark:bg-dark-bg rounded-xl p-3 border border-gray-200 dark:border-dark-border">
              <p className="text-gray-500 dark:text-dark-muted text-xs mb-1">Sale Price (calculated)</p>
              <p className="text-xl font-bold text-gray-900 dark:text-dark-text font-numeric">${selectedSalePrice.toLocaleString()}</p>
              <p className="text-xs text-gray-500 dark:text-dark-muted">cost + installs + GP + pack</p>
            </div>
            <div className="bg-gray-50 dark:bg-dark-bg rounded-xl p-3 border border-gray-200 dark:border-dark-border">
              <p className="text-gray-500 dark:text-dark-muted text-xs mb-1">Gross Profit</p>
              <p className={`text-xl font-bold font-numeric ${selectedGp >= 0 ? 'text-stat-green' : 'text-stat-red'}`}>${selectedGp.toLocaleString()}</p>
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

          {/* Feature A: Local Installations */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-border">
            <LocalInstallsTable
              quoteId={id}
              onChange={recomputeInstallTotals}
            />
          </div>
        </div>

        {/* Feature B: Out The Door Price */}
        <OutTheDoorSection
          salePrice={selectedSalePrice}
          packAmount={pack}
          downPayment={numOrDefault(form.down_payment, 0)}
          tradeValue={numOrDefault(form.trade_value, 0)}
          tradePayoff={numOrDefault(form.trade_payoff, 0)}
          incentiveTotal={incentiveTotal}
          otd={form}
          onChange={(patch) => setForm(f => ({ ...f, ...patch }))}
          onTotalsChange={setOtdTotals}
        />

        {/* Financing */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4 uppercase tracking-wider">Financing</h2>
          <p className="text-xs text-gray-500 dark:text-dark-muted mb-3">
            Customer finances the full Out The Door Price minus down payment, incentives, and net trade-in.
          </p>
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
              <p className="text-gray-500 dark:text-dark-muted text-xs">on ${otdTotals.amountFinanced.toLocaleString(undefined, { maximumFractionDigits: 0 })} financed · {form.term_months} mo</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => navigate('/')} className="text-gray-500 dark:text-dark-muted hover:text-gray-900 dark:hover:text-dark-text px-4 py-2 text-sm transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg text-gray-700 dark:text-dark-text px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            {saved ? '✓ Saved!' : 'Save'}
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <LastEditedLine quote={quote} />
        </div>
      </div>
    </div>
  )
}
