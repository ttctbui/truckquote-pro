import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

function calcPayment(price, down, tradeValue, tradePayoff, rate, months) {
  const amount = price - down - tradeValue + tradePayoff
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

export default function NewQuote() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showDocRequest, setShowDocRequest] = useState(false)

  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_email: '', company_name: '',
    vehicle_type: 'New',
    year: '', make: 'Isuzu', make_other: '', model: '', model_other: '',
    body_style: '', body_style_other: '', truck_description: '',
    vin: '', stock_number: '', color: '',
    msrp: '',
    price_good: '', price_better: '', price_best: '',
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

  const [docRequest, setDocRequest] = useState({
    salesperson: profile?.full_name || '',
    salesperson2: '',
    customer: '',
    deal_type: 'Finance',
    payment_type: 'Wire',
    is_fleet: 'No',
    fin_code: '',
    hvip_incentive: 'No',
    vin: '',
    stock_number: '',
    deal_number: '',
    date_of_signing: '',
    time_of_signing: '',
    truck_mileage: '',
    final_workbook_requested: 'No',
    copy_of_license: 'No',
    weight_class: 'GVWR',
    gvwr: '',
    weight_slip_requested: 'No',
    customer_transferred_body: 'No',
  })

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }
  function setDoc(field, value) { setDocRequest(d => ({ ...d, [field]: value })) }

  function openDocRequest() {
    setDocRequest(d => ({
      ...d,
      customer: form.customer_name || d.customer,
      deal_type: form.deal_type || d.deal_type,
      vin: form.vin || d.vin,
      stock_number: form.stock_number || d.stock_number,
      deal_number: form.deal_number || d.deal_number,
      salesperson: profile?.full_name || d.salesperson,
    }))
    setShowDocRequest(true)
  }

  function toggleIncentive(incentive) {
    setForm(f => ({
      ...f,
      selected_incentives: f.selected_incentives.includes(incentive)
        ? f.selected_incentives.filter(i => i !== incentive)
        : [...f.selected_incentives, incentive]
    }))
  }

  const selectedPrice = parseFloat(form[`price_${form.selected_tier}`]) || 0
  const payment = calcPayment(
    selectedPrice,
    parseFloat(form.down_payment) || 0,
    parseFloat(form.trade_value) || 0,
    parseFloat(form.trade_payoff) || 0,
    parseFloat(form.interest_rate) || 6.99,
    parseInt(form.term_months) || 60
  )

  const cost = parseFloat(form.cost_of_vehicle) || 0
  const pack = parseFloat(form.pack_amount) || 0
  const incentiveTotal = parseFloat(form.incentive_total) || 0
  const grossProfit = selectedPrice - cost - pack - incentiveTotal
  const commission = grossProfit * 0.25

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

  async function handleSave(submitForApproval = false) {
    if (!form.customer_name) { setError('Customer name is required'); return }
    const finalMake = form.make === 'Other' ? form.make_other : form.make
    const finalModel = form.model === 'Other' ? form.model_other : form.model
    const finalBodyStyle = form.body_style === 'Other' ? form.body_style_other : form.body_style
    if (!finalMake || !finalModel) { setError('Vehicle make and model are required'); return }
    setSaving(true); setError('')

    const { error: err } = await supabase.from('quotes').insert({
      quote_number: genQuoteNumber(),
      status: submitForApproval ? 'pending_approval' : 'draft',
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
      salesperson_id: profile?.id,
    })

    setSaving(false)
    if (err) { setError(err.message); return }
    navigate('/')
  }

  async function submitDocRequest() {
    const { error: err } = await supabase.from('doc_requests').insert({
      salesperson: docRequest.salesperson,
      salesperson2: docRequest.salesperson2,
      customer: docRequest.customer,
      deal_type: docRequest.deal_type,
      payment_type: docRequest.payment_type,
      is_fleet: docRequest.is_fleet,
      fin_code: docRequest.fin_code,
      hvip_incentive: docRequest.hvip_incentive,
      vin: docRequest.vin,
      stock_number: docRequest.stock_number,
      deal_number: docRequest.deal_number,
      date_of_signing: docRequest.date_of_signing || null,
      time_of_signing: docRequest.time_of_signing,
      truck_mileage: docRequest.truck_mileage,
      final_workbook_requested: docRequest.final_workbook_requested,
      copy_of_license: docRequest.copy_of_license,
      weight_class: docRequest.weight_class,
      gvwr: docRequest.gvwr,
      weight_slip_requested: docRequest.weight_slip_requested,
      customer_transferred_body: docRequest.customer_transferred_body,
      status: 'submitted',
    })
    if (err) { alert('Error: ' + err.message); return }
    setShowDocRequest(false)
    alert('Doc Request submitted! Joe De La Rosa has been notified.')
  }

  const inputClass = "w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
  const labelClass = "block text-gray-400 text-xs mb-1"
  const sectionClass = "bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4"

  function YesNo({ field, value, onChange }) {
    return (
      <div className="flex gap-2">
        {['Yes', 'No'].map(v => (
          <button key={v} onClick={() => onChange(field, v)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${value === v ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
            {v}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm">← Back</button>
          <span className="text-gray-600">|</span>
          <span className="text-white font-semibold">New Quote</span>
        </div>
        <div className="flex gap-3">
          <button onClick={openDocRequest}
            className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            Doc Request
          </button>
          <button onClick={() => handleSave(false)} disabled={saving}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            Save Draft
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            Submit for Approval
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && <div className="mb-4 text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-2">{error}</div>}

        {/* Customer Info */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Customer Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Customer Name *</label><input className={inputClass} value={form.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="John Smith" /></div>
            <div><label className={labelClass}>Company Name</label><input className={inputClass} value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="ABC Landscaping" /></div>
            <div><label className={labelClass}>Phone</label><input className={inputClass} value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} placeholder="(562) 555-0100" /></div>
            <div><label className={labelClass}>Email</label><input className={inputClass} value={form.customer_email} onChange={e => set('customer_email', e.target.value)} placeholder="john@abc.com" /></div>
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
            <div><label className={labelClass}>Deal #</label><input className={inputClass} value={form.deal_number} onChange={e => set('deal_number', e.target.value)} placeholder="D-00001" /></div>
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
              <p className="text-gray-400 text-xs mb-1">Commission (25%)</p>
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
            <textarea className={inputClass} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes..." />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white px-4 py-2 text-sm transition-colors">Cancel</button>
          <button onClick={() => handleSave(false)} disabled={saving}
            className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            Save Draft
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="bg-red-700 hover:bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            Submit for Approval
          </button>
        </div>
      </div>

      {/* Doc Request Modal */}
      {showDocRequest && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:50,overflowY:'auto',padding:'2rem 1rem'}}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">Doc Request</h2>
              <button onClick={() => setShowDocRequest(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div><label className={labelClass}>Salesperson</label><input className={inputClass} value={docRequest.salesperson} onChange={e => setDoc('salesperson', e.target.value)} /></div>
              <div><label className={labelClass}>Salesperson #2 (split deal)</label><input className={inputClass} value={docRequest.salesperson2} onChange={e => setDoc('salesperson2', e.target.value)} placeholder="Optional" /></div>
              <div><label className={labelClass}>Customer</label><input className={inputClass} value={docRequest.customer} onChange={e => setDoc('customer', e.target.value)} /></div>
              <div>
                <label className={labelClass}>Deal Type</label>
                <div className="flex gap-2">
                  {['Finance', 'Cash'].map(t => (
                    <button key={t} onClick={() => setDoc('deal_type', t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${docRequest.deal_type === t ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Payment Type</label>
                <select className={inputClass} value={docRequest.payment_type} onChange={e => setDoc('payment_type', e.target.value)}>
                  {['Wire', 'Check', 'ACH'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Is this a Fleet deal?</label>
                <div className="flex gap-2">
                  {['Yes', 'No'].map(v => (
                    <button key={v} onClick={() => setDoc('is_fleet', v)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${docRequest.is_fleet === v ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {docRequest.is_fleet === 'Yes' && (
                <div><label className={labelClass}>FIN Code</label><input className={inputClass} value={docRequest.fin_code} onChange={e => setDoc('fin_code', e.target.value)} placeholder="Enter FIN code" /></div>
              )}

              <div>
                <label className={labelClass}>Is there an HVIP incentive with this vehicle?</label>
                <div className="flex gap-2">
                  {['Yes', 'No'].map(v => (
                    <button key={v} onClick={() => setDoc('hvip_incentive', v)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${docRequest.hvip_incentive === v ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div><label className={labelClass}>VIN #</label><input className={inputClass} value={docRequest.vin} onChange={e => setDoc('vin', e.target.value)} /></div>
              <div><label className={labelClass}>Stock #</label><input className={inputClass} value={docRequest.stock_number} onChange={e => setDoc('stock_number', e.target.value)} /></div>
              <div><label className={labelClass}>Deal #</label><input className={inputClass} value={docRequest.deal_number} onChange={e => setDoc('deal_number', e.target.value)} /></div>
              <div><label className={labelClass}>Date of Signing</label><input type="date" className={inputClass} value={docRequest.date_of_signing} onChange={e => setDoc('date_of_signing', e.target.value)} /></div>
              <div><label className={labelClass}>Time of Signing</label><input type="time" className={inputClass} value={docRequest.time_of_signing} onChange={e => setDoc('time_of_signing', e.target.value)} /></div>
              <div><label className={labelClass}>Truck Mileage</label><input className={inputClass} value={docRequest.truck_mileage} onChange={e => setDoc('truck_mileage', e.target.value)} placeholder="0" /></div>

              <div>
                <label className={labelClass}>Final Workbook &amp; Docs from deal # request?</label>
                <div className="flex gap-2">
                  {['Yes', 'No'].map(v => (
                    <button key={v} onClick={() => setDoc('final_workbook_requested', v)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${docRequest.final_workbook_requested === v ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Copy of Driver's License?</label>
                <div className="flex gap-2">
                  {['Yes', 'No'].map(v => (
                    <button key={v} onClick={() => setDoc('copy_of_license', v)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${docRequest.copy_of_license === v ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Select One</label>
                <div className="flex gap-2">
                  {['GVWR', 'CGWR'].map(v => (
                    <button key={v} onClick={() => setDoc('weight_class', v)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${docRequest.weight_class === v ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className={labelClass}>GVWR</label><input className={inputClass} value={docRequest.gvwr} onChange={e => setDoc('gvwr', e.target.value)} placeholder="e.g. 26,000 lbs" /></div>

              <div>
                <label className={labelClass}>Weight Slip Requested?</label>
                <div className="flex gap-2">
                  {['Yes', 'No'].map(v => (
                    <button key={v} onClick={() => setDoc('weight_slip_requested', v)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${docRequest.weight_slip_requested === v ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Did customer transfer their own body?</label>
                <div className="flex gap-2">
                  {['Yes', 'No'].map(v => (
                    <button key={v} onClick={() => setDoc('customer_transferred_body', v)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${docRequest.customer_transferred_body === v ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-blue-950 border border-blue-800 rounded-lg p-3 text-xs text-blue-300">
                File uploads (Final Workbook, Signed Recap, Buyers Order, Driver's License, Proof of Insurance, Weight Slip, VIN Verification) will be available in the next update.
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowDocRequest(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors">
                Cancel
              </button>
              <button onClick={submitDocRequest}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors">
                Submit to F&I
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}