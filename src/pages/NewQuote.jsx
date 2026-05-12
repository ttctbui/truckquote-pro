import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import TTCHeader from '../components/TTCHeader'
import ttcLogo from '../assets/ttc-logo.png'
// ── Phase B additions ────────────────────────────────────────────────
import { buildNewQuoteRow, logNewQuoteEvent } from '../lib/quoteActions'
// ── Feature A: Local Installations ───────────────────────────────────
import LocalInstallsTable from '../components/LocalInstallsTable'
// ─────────────────────────────────────────────────────────────────────

function calcPayment(price, down, tradeValue, tradePayoff, incentive, rate, months) {
  // Incentives act like cash down — reduce amount financed
  const amount = price - down - tradeValue + tradePayoff - incentive
  if (amount <= 0 || months <= 0) return 0
  const r = rate / 100 / 12
  if (r === 0) return amount / months
  return (amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

function genQuoteNumber() {
  const now = new Date()
  return `TTC-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(Math.floor(Math.random()*9000)+1000)}`
}

const INCENTIVE_OPTIONS = [
  'CPA', 'Dealer Cash', 'Fleet Assistance', 'Loyalty Rebate',
  'Commercial Upfit Allowance', 'Government/Municipal Discount',
  'Trade Assist', 'Conquest Rebate', 'Finance Rate Support', 'Other'
]

const DEFAULT_COMMISSION_RATE = 30

export default function NewQuote() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_email: '', company_name: '',
    vehicle_type: 'New',
    year: '', make: 'Isuzu', make_other: '', model: '', model_other: '',
    body_style: '', body_style_other: '', truck_description: '',
    vin: '', stock_number: '', color: '',
    msrp: '',
    // New: GP per tier (replaces price_*)
    gross_profit_good: '', gross_profit_better: '', gross_profit_best: '',
    selected_tier: 'better',
    down_payment: '0', trade_value: '0', trade_payoff: '0',
    term_months: '60', interest_rate: '6.99',
    deal_type: 'Finance', deal_number: '',
    cost_of_vehicle: '', pack_amount: '500',
    selected_incentives: [],
    incentive_total: '0',
    notes: '',
    docs_submitted: 'No',
  })

  // Feature A: staged installs
  const [installs, setInstalls] = useState([])

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function toggleIncentive(incentive) {
    setForm(f => ({
      ...f,
      selected_incentives: f.selected_incentives.includes(incentive)
        ? f.selected_incentives.filter(i => i !== incentive)
        : [...f.selected_incentives, incentive]
    }))
  }

  // Live install totals
  const installTotals = installs.reduce(
    (acc, r) => ({
      dnp: acc.dnp + (parseFloat(r.dnp_amount) || 0),
      customer: acc.customer + (parseFloat(r.customer_total) || 0),
      markup: acc.markup + (parseFloat(r.markup_amount) || 0),
    }),
    { dnp: 0, customer: 0, markup: 0 }
  )

  // ── GP-per-tier math ────────────────────────────────────────────────
  const baseCost = parseFloat(form.cost_of_vehicle) || 0
  const pack = parseFloat(form.pack_amount) || 0
  const incentiveTotal = parseFloat(form.incentive_total) || 0

  const gpByTier = {
    good:   parseFloat(form.gross_profit_good)   || 0,
    better: parseFloat(form.gross_profit_better) || 0,
    best:   parseFloat(form.gross_profit_best)   || 0,
  }

  const salePriceByTier = {
    good:   baseCost + installTotals.customer + gpByTier.good   + pack,
    better: baseCost + installTotals.customer + gpByTier.better + pack,
    best:   baseCost + installTotals.customer + gpByTier.best   + pack,
  }

  const selectedTier = form.selected_tier
  const selectedGp = gpByTier[selectedTier]
  const selectedSalePrice = salePriceByTier[selectedTier]
  const commission = selectedGp * (DEFAULT_COMMISSION_RATE / 100)

  const payment = calcPayment(
    selectedSalePrice,
    parseFloat(form.down_payment) || 0,
    parseFloat(form.trade_value) || 0,
    parseFloat(form.trade_payoff) || 0,
    incentiveTotal,
    parseFloat(form.interest_rate) || 6.99,
    parseInt(form.term_months) || 60
  )

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

  async function handleSave() {
    if (!form.customer_name) { setError('Customer name is required'); return }
    const finalMake = form.make === 'Other' ? form.make_other : form.make
    const finalModel = form.model === 'Other' ? form.model_other : form.model
    const finalBodyStyle = form.body_style === 'Other' ? form.body_style_other : form.body_style
    if (!finalMake || !finalModel) { setError('Vehicle make and model are required'); return }
    setSaving(true); setError('')

    const rawRow = {
      quote_number: genQuoteNumber(),
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
      // New: GP per tier
      gross_profit_good:   parseFloat(form.gross_profit_good)   || null,
      gross_profit_better: parseFloat(form.gross_profit_better) || null,
      gross_profit_best:   parseFloat(form.gross_profit_best)   || null,
      // Also write derived sale prices into the legacy price_* columns
      // (so Dashboard/Stats keep working with no further changes)
      price_good:   salePriceByTier.good   || null,
      price_better: salePriceByTier.better || null,
      price_best:   salePriceByTier.best   || null,
      selected_tier: form.selected_tier,
      down_payment: parseFloat(form.down_payment) || 0,
      trade_value: parseFloat(form.trade_value) || 0,
      trade_payoff: parseFloat(form.trade_payoff) || 0,
      term_months: parseInt(form.term_months) || 60,
      interest_rate: parseFloat(form.interest_rate) || 6.99,
      monthly_payment: payment,
      deal_type: form.deal_type,
      deal_number: form.deal_number?.trim() || null,
      cost_of_vehicle: parseFloat(form.cost_of_vehicle) || null,
      pack_amount: parseFloat(form.pack_amount) || 500,
      gross_profit: selectedGp,
      commission: commission,
      selected_incentives: form.selected_incentives,
      incentive_total: parseFloat(form.incentive_total) || 0,
      notes: form.notes,
      docs_submitted: form.docs_submitted,
    }

    const { row, autoApproved } = buildNewQuoteRow(rawRow, profile)

    const { data: newQuote, error: err } = await supabase
      .from('quotes')
      .insert(row)
      .select()
      .single()

    if (err) { setSaving(false); setError(err.message); return }

    // Feature A: bulk-insert any installs that were filled in
    const installRows = installs
      .filter((r) => r.description || r.dnp_amount || r.markup_amount || r.customer_total)
      .map((r, idx) => ({
        quote_id: newQuote.id,
        position: idx + 1,
        description: r.description || null,
        vendor: r.vendor || null,
        po_number: r.po_number || null,
        dnp_amount: r.dnp_amount ? parseFloat(r.dnp_amount) : null,
        markup_amount: r.markup_amount ? parseFloat(r.markup_amount) : null,
        customer_total: r.customer_total ? parseFloat(r.customer_total) : null,
      }))

    if (installRows.length) {
      const { error: instErr } = await supabase.from('quote_installs').insert(installRows)
      if (instErr) console.error('install insert failed (non-fatal):', instErr)
    }

    setSaving(false)

    await logNewQuoteEvent({ quoteId: newQuote.id, autoApproved, profile, quote: newQuote })

    navigate(`/quote/${newQuote.id}`)
  }

  const inputClass = "w-full bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text rounded-lg px-3 py-2 border border-gray-300 dark:border-dark-border focus:outline-none focus:border-ttc-blue focus:ring-2 focus:ring-ttc-blue/20 text-sm transition-all"
  const labelClass = "block text-gray-600 dark:text-dark-muted text-xs mb-1 font-medium"
  const sectionClass = "bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-5 mb-4 shadow-ttc-card"
  const toggleSelected = "bg-ttc-blue border-ttc-blue text-white"
  const toggleUnselected = "bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text hover:border-gray-400 dark:hover:border-dark-muted"

  const isAutoApprover = ['sales_admin', 'manager', 'admin'].includes(profile?.role)
  const submitLabel = isAutoApprover ? 'Save & Approve' : 'Submit for Approval'

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

      <div className="bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-gray-500 dark:text-dark-muted hover:text-gray-900 dark:hover:text-dark-text text-sm">← Back</button>
            <span className="text-gray-300 dark:text-dark-border">|</span>
            <span className="text-gray-900 dark:text-dark-text font-semibold">New Quote</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-ttc-blue hover:bg-ttc-blue-dark text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : submitLabel}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 text-stat-red text-sm bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        {isAutoApprover && (
          <div className="mb-4 text-sm bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 rounded-lg px-4 py-2">
            As a {profile.role.replace('_', ' ')}, your quotes are auto-approved on save.
          </div>
        )}

        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4 uppercase tracking-wider">Customer Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Customer Name *</label><input className={inputClass} value={form.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="John Smith" /></div>
            <div><label className={labelClass}>Company Name</label><input className={inputClass} value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="ABC Landscaping" /></div>
            <div><label className={labelClass}>Phone</label><input className={inputClass} value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} placeholder="(562) 555-0100" /></div>
            <div><label className={labelClass}>Email</label><input className={inputClass} value={form.customer_email} onChange={e => set('customer_email', e.target.value)} placeholder="john@abc.com" /></div>
          </div>
        </div>

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
            <div><label className={labelClass}>Year</label><input className={inputClass} value={form.year} onChange={e => set('year', e.target.value)} placeholder="2025" /></div>
            <div><label className={labelClass}>Color</label><input className={inputClass} value={form.color} onChange={e => set('color', e.target.value)} placeholder="White" /></div>
            <div>
              <label className={labelClass}>Make *</label>
              <select className={inputClass} value={form.make} onChange={e => { set('make', e.target.value); set('model', '') }}>
                {makes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {form.make === 'Other' && (
              <div><label className={labelClass}>Make (specify)</label><input className={inputClass} value={form.make_other} onChange={e => set('make_other', e.target.value)} placeholder="Enter make" /></div>
            )}
            <div>
              <label className={labelClass}>Model *</label>
              <select className={inputClass} value={form.model} onChange={e => set('model', e.target.value)}>
                <option value="">Select model</option>
                {(models[form.make] || models.Other).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {form.model === 'Other' && (
              <div><label className={labelClass}>Model (specify)</label><input className={inputClass} value={form.model_other} onChange={e => set('model_other', e.target.value)} placeholder="Enter model" /></div>
            )}
            <div>
              <label className={labelClass}>Body Style</label>
              <select className={inputClass} value={form.body_style} onChange={e => set('body_style', e.target.value)}>
                <option value="">Select body style</option>
                {bodyStyles.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {form.body_style === 'Other' && (
              <div><label className={labelClass}>Body Style (specify)</label><input className={inputClass} value={form.body_style_other} onChange={e => set('body_style_other', e.target.value)} placeholder="Enter body style" /></div>
            )}
            <div><label className={labelClass}>Stock #</label><input className={inputClass} value={form.stock_number} onChange={e => set('stock_number', e.target.value)} placeholder="T-12345" /></div>
            <div><label className={labelClass}>MSRP</label><input className={inputClass} value={form.msrp} onChange={e => set('msrp', e.target.value)} placeholder="85000" /></div>
            <div className="col-span-3"><label className={labelClass}>VIN</label><input className={inputClass} value={form.vin} onChange={e => set('vin', e.target.value)} placeholder="JALC4B16X7700000" /></div>
            <div className="col-span-3"><label className={labelClass}>Truck Description</label><textarea className={inputClass} rows={2} value={form.truck_description} onChange={e => set('truck_description', e.target.value)} placeholder="e.g. 16ft box truck, liftgate, diesel, automatic..." /></div>
          </div>
        </div>

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
            <div><label className={labelClass}>Deal #</label><input className={inputClass} value={form.deal_number} onChange={e => set('deal_number', e.target.value)} placeholder="D-00001" /></div>
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

        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4 uppercase tracking-wider">Financing</h2>
          <p className="text-xs text-gray-500 dark:text-dark-muted mb-3">
            Note: Out The Door Price section with fees + tax coming next. For now, monthly payment is based on Sale Price minus down/trade/incentives.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={labelClass}>Down Payment</label><input className={inputClass} value={form.down_payment} onChange={e => set('down_payment', e.target.value)} placeholder="0" /></div>
            <div><label className={labelClass}>Trade-In Value</label><input className={inputClass} value={form.trade_value} onChange={e => set('trade_value', e.target.value)} placeholder="0" /></div>
            <div><label className={labelClass}>Trade Payoff</label><input className={inputClass} value={form.trade_payoff} onChange={e => set('trade_payoff', e.target.value)} placeholder="0" /></div>
            <div>
              <label className={labelClass}>Term</label>
              <select className={inputClass} value={form.term_months} onChange={e => set('term_months', e.target.value)}>
                {[24,36,48,60,72,84].map(t => <option key={t} value={t}>{t} months</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Interest Rate %</label><input className={inputClass} value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} placeholder="6.99" /></div>
            <div className="bg-gray-50 dark:bg-dark-bg rounded-xl p-3 border border-gray-200 dark:border-dark-border">
              <p className="text-gray-500 dark:text-dark-muted text-xs mb-1">Est. Monthly Payment</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-dark-text font-numeric">${payment.toFixed(2)}</p>
              <p className="text-gray-500 dark:text-dark-muted text-xs">{form.selected_tier} price · {form.term_months} mo</p>
            </div>
          </div>
        </div>

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
              <p className="text-gray-500 dark:text-dark-muted text-xs mb-1">Commission ({DEFAULT_COMMISSION_RATE}%)</p>
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
            <textarea className={inputClass} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes..." />
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-border">
            <LocalInstallsTable
              installs={installs}
              onChange={setInstalls}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => navigate('/')} className="text-gray-500 dark:text-dark-muted hover:text-gray-900 dark:hover:text-dark-text px-4 py-2 text-sm transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="bg-ttc-blue hover:bg-ttc-blue-dark text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
