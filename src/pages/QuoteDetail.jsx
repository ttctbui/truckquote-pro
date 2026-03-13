import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate, useParams } from 'react-router-dom'

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
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [commissionRate, setCommissionRate] = useState(25)

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
  }, [id])

  async function fetchSettings() {
    const { data } = await supabase.from('settings').select('*').eq('id', 'global').single()
    if (data) setCommissionRate(parseFloat(data.commission_rate) || 25)
  }

  async function fetchQuote() {
    const { data, error } = await supabase.from('quotes').select('*').eq('id', id).single()
    if (error || !data) { navigate('/'); return }

    const makeInList = makes.includes(data.make)
    const modelInList = data.make && models[data.make] ? models[data.make].includes(data.model) : false

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
      selected_incentives: [],
      incentive_total: data.incentive_total || '0',
      notes: data.notes || '',
      docs_submitted: data.docs_submitted || 'No',
      status: data.status || 'draft',
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

  async function handleSave(newStatus) {
    if (!form.customer_name) { setError('Customer name is required'); return }
    const finalMake = form.make === 'Other' ? form.make_other : form.make
    const finalModel = form.model === 'Other' ? form.model_other : form.model
    const finalBodyStyle = form.body_style === 'Other' ? form.body_style_other : form.body_style
    if (!finalMake || !finalModel) { setError('Vehicle make and model are required'); return }
    setSaving(true); setError('')

    const { error: err } = await supabase.from('quotes').update({
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
      deal_number: form.deal_number,
      cost_of_vehicle: parseFloat(form.cost_of_vehicle) || null,
      pack_amount: parseFloat(form.pack_amount) || 500,
      gross_profit: grossProfit,
      commission: commission,
      notes: form.notes,
      docs_submitted: form.docs_submitted,
      status: newStatus || form.status,
    }).eq('id', id)

    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    if (newStatus) navigate('/')
  }

  const inputClass = "w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
  const labelClass = "block text-gray-400 text-xs mb-1"
  const sectionClass = "bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4"

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading...</div>
  if (!form) return null

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm">← Back</button>
          <span className="text-gray-600">|</span>
          <span className="text-white font-semibold">{form.quote_number}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            form.status === 'won' ? 'bg-emerald-900 text-emerald-300' :
            form.status === 'lost' ? 'bg-red-900 text-red-400' :
            form.status === 'pending_approval' ? 'bg-yellow-900 text-yellow-300' :
            form.status === 'approved' ? 'bg-green-900 text-green-300' :
            'bg-gray-700 text-gray-300'}`}>
            {form.status === 'won' ? 'Sold' : form.status === 'pending_approval' ? 'Pending' : form.status}
          </span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleSave()} disabled={saving}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            {saved ? '✓ Saved!' : 'Save'}
          </button>
          <button onClick={() => handleSave('pending_approval')} disabled={saving}
            className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            Submit for Approval
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && <div className="mb-4 text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-2">{error}</div>}

        {/* Status */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Quote Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="sent">Sent</option>
                <option value="won">Sold</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div><label className={labelClass}>Deal #</label><input className={inputClass} value={form.deal_number} onChange={e => set('deal_number', e.target.value)} placeholder="D-00001" /></div>
          </div>
        </div>

        {/* Customer Info */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Customer Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Customer Name *</label><input className={inputClass} value={form.customer_name} onChange={e => set('customer_name', e.target.value)} /></div>
            <div><label className={labelClass}>Company Name</label><input className={inputClass} value={form.company_name} onChange={e => set('company_name', e.target.value)} /></div>
            <div><label className={labelClass}>Phone</label><input className={inputClass} value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} /></div>
            <div><label className={labelClass}>Email</label><input className={inputClass} value={form.customer_email} onChange={e => set('customer_email', e.target.value)} /></div>
          </div>
        </div>

        {/* Vehicle Info */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Vehicle Information</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Vehicle Type</label>
              <div className="flex gap-2">
                {['New', 'Pre-Owned'].map(t => (
                  <button key={t} onClick={() => set('vehicle_type', t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${form.vehicle_type === t ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
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
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Deal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Deal Type</label>
              <div className="flex gap-2">
                {['Finance', 'Cash'].map(t => (
                  <button key={t} onClick={() => set('deal_type', t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${form.deal_type === t ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* GBB Pricing */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Good · Better · Best Pricing</h2>
          <div className="grid grid-cols-3 gap-4">
            {['good', 'better', 'best'].map(tier => (
              <div key={tier} onClick={() => set('selected_tier', tier)}
                className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${form.selected_tier === tier ? 'border-red-600 bg-red-950' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-gray-400">{tier}</p>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
                  <input className="w-full bg-gray-900 text-white rounded-lg pl-7 pr-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
                    value={form[`price_${tier}`]} onChange={e => set(`price_${tier}`, e.target.value)} placeholder="0" onClick={e => e.stopPropagation()} />
                </div>
                {form.selected_tier === tier && <p className="text-xs text-red-400 mt-2">✓ Selected</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Finance */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Financing</h2>
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
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
              <p className="text-gray-400 text-xs mb-1">Est. Monthly Payment</p>
              <p className="text-2xl font-bold text-white">${payment.toFixed(2)}</p>
              <p className="text-gray-500 text-xs">{form.selected_tier} price · {form.term_months} mo</p>
            </div>
          </div>
        </div>

        {/* RECAP */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">RECAP — Deal Summary</h2>
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
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${form.selected_incentives.includes(inc) ? 'bg-blue-700 border-blue-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                  {inc}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
              <p className="text-gray-400 text-xs mb-1">Sale Price</p>
              <p className="text-xl font-bold text-white">${selectedPrice.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
              <p className="text-gray-400 text-xs mb-1">Gross Profit</p>
              <p className={`text-xl font-bold ${grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>${grossProfit.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
              <p className="text-gray-400 text-xs mb-1">Commission ({commissionRate}%)</p>
              <p className="text-xl font-bold text-yellow-400">${commission.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4">
            <label className={labelClass}>Docs Submitted</label>
            <div className="flex gap-2 w-48">
              {['Yes', 'No'].map(v => (
                <button key={v} onClick={() => set('docs_submitted', v)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${form.docs_submitted === v ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
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
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white px-4 py-2 text-sm transition-colors">Cancel</button>
          <button onClick={() => handleSave()} disabled={saving}
            className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            {saved ? '✓ Saved!' : 'Save'}
          </button>
          <button onClick={() => handleSave('pending_approval')} disabled={saving}
            className="bg-red-700 hover:bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            Submit for Approval
          </button>
        </div>
      </div>
    </div>
  )
}