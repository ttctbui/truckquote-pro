import { useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * DocRequestModal — creates a doc_request row for an existing deal-numbered quote.
 * Mirrors MoveRequestModal's UX. Status is always 'pending' on creation.
 */
export default function DocRequestModal({ quote, currentUserId, onClose, onCreated }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [doc, setDoc] = useState({
    salesperson2: '',
    payment_type: 'Wire',
    is_fleet: 'No',
    fin_code: '',
    hvip_incentive: 'No',
    date_of_signing: '',
    time_of_signing: '',
    truck_mileage: '',
    final_workbook_requested: 'No',
    copy_of_license: 'No',
    weight_class: 'GVWR',
    gvwr: '',
    weight_slip_requested: 'No',
    customer_transferred_body: 'No',
  });

  function set(field, value) { setDoc((d) => ({ ...d, [field]: value })); }

  async function submit() {
    if (!quote?.id) {
      setError('Missing quote — cannot create doc request.');
      return;
    }
    setSaving(true);
    setError('');

    const now = new Date().toISOString();
    const row = {
      quote_id: quote.id,
      requester_id: currentUserId,
      status: 'pending',
      pending_at: now,

      // Auto-filled from the quote
      salesperson: quote.salesperson_name || '',
      customer: quote.customer_name || '',
      deal_type: quote.deal_type || 'Finance',
      vin: quote.vin || '',
      stock_number: quote.stock_number || '',
      deal_number: quote.deal_number || '',

      // From the form
      salesperson2: doc.salesperson2,
      payment_type: doc.payment_type,
      is_fleet: doc.is_fleet,
      fin_code: doc.is_fleet === 'Yes' ? doc.fin_code : '',
      hvip_incentive: doc.hvip_incentive,
      date_of_signing: doc.date_of_signing || null,
      time_of_signing: doc.time_of_signing,
      truck_mileage: doc.truck_mileage,
      final_workbook_requested: doc.final_workbook_requested,
      copy_of_license: doc.copy_of_license,
      weight_class: doc.weight_class,
      gvwr: doc.gvwr,
      weight_slip_requested: doc.weight_slip_requested,
      customer_transferred_body: doc.customer_transferred_body,
    };

    const { error: err } = await supabase.from('doc_requests').insert(row);
    setSaving(false);

    if (err) { setError(err.message); return; }

    // TODO: Phase D — notify Joe via email
    onCreated?.();
  }

  const inputClass = "w-full bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text rounded-lg px-3 py-2 border border-gray-300 dark:border-dark-border focus:outline-none focus:border-ttc-blue focus:ring-2 focus:ring-ttc-blue/20 text-sm transition-all";
  const labelClass = "block text-gray-600 dark:text-dark-muted text-xs mb-1 font-medium";
  const toggleSelected = "bg-ttc-blue border-ttc-blue text-white";
  const toggleUnselected = "bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text hover:border-gray-400 dark:hover:border-dark-muted";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-6 w-full max-w-lg shadow-2xl my-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-gray-900 dark:text-dark-text font-semibold text-lg">Doc Request</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-dark-muted dark:hover:text-dark-text text-xl">✕</button>
        </div>
        <p className="text-xs text-gray-500 dark:text-dark-muted mb-5">
          Quote {quote.quote_number} · Deal # {quote.deal_number} · {quote.customer_name}
        </p>

        {error && (
          <div className="mb-4 text-stat-red text-sm bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Salesperson #2 (split deal)</label>
            <input className={inputClass} value={doc.salesperson2} onChange={(e) => set('salesperson2', e.target.value)} placeholder="Optional" />
          </div>

          <div>
            <label className={labelClass}>Payment Type</label>
            <select className={inputClass} value={doc.payment_type} onChange={(e) => set('payment_type', e.target.value)}>
              {['Wire', 'Check', 'ACH'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <YesNoToggle label="Is this a Fleet deal?" options={['Yes', 'No']} value={doc.is_fleet} onChange={(v) => set('is_fleet', v)} labelClass={labelClass} sel={toggleSelected} unsel={toggleUnselected} />

          {doc.is_fleet === 'Yes' && (
            <div>
              <label className={labelClass}>FIN Code</label>
              <input className={inputClass} value={doc.fin_code} onChange={(e) => set('fin_code', e.target.value)} placeholder="Enter FIN code" />
            </div>
          )}

          <YesNoToggle label="HVIP incentive on this vehicle?" options={['Yes', 'No']} value={doc.hvip_incentive} onChange={(v) => set('hvip_incentive', v)} labelClass={labelClass} sel={toggleSelected} unsel={toggleUnselected} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Date of Signing</label>
              <input type="date" className={inputClass} value={doc.date_of_signing} onChange={(e) => set('date_of_signing', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Time of Signing</label>
              <input type="time" className={inputClass} value={doc.time_of_signing} onChange={(e) => set('time_of_signing', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Truck Mileage</label>
            <input className={inputClass} value={doc.truck_mileage} onChange={(e) => set('truck_mileage', e.target.value)} placeholder="0" />
          </div>

          <YesNoToggle label="Final Workbook & Docs from deal # request?" options={['Yes', 'No']} value={doc.final_workbook_requested} onChange={(v) => set('final_workbook_requested', v)} labelClass={labelClass} sel={toggleSelected} unsel={toggleUnselected} />
          <YesNoToggle label="Copy of Driver's License?" options={['Yes', 'No']} value={doc.copy_of_license} onChange={(v) => set('copy_of_license', v)} labelClass={labelClass} sel={toggleSelected} unsel={toggleUnselected} />
          <YesNoToggle label="Weight Class" options={['GVWR', 'CGWR']} value={doc.weight_class} onChange={(v) => set('weight_class', v)} labelClass={labelClass} sel={toggleSelected} unsel={toggleUnselected} />

          <div>
            <label className={labelClass}>{doc.weight_class}</label>
            <input className={inputClass} value={doc.gvwr} onChange={(e) => set('gvwr', e.target.value)} placeholder="e.g. 26,000 lbs" />
          </div>

          <YesNoToggle label="Weight Slip Requested?" options={['Yes', 'No']} value={doc.weight_slip_requested} onChange={(v) => set('weight_slip_requested', v)} labelClass={labelClass} sel={toggleSelected} unsel={toggleUnselected} />
          <YesNoToggle label="Did customer transfer their own body?" options={['Yes', 'No']} value={doc.customer_transferred_body} onChange={(v) => set('customer_transferred_body', v)} labelClass={labelClass} sel={toggleSelected} unsel={toggleUnselected} />

          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
            File uploads (Final Workbook, Signed Recap, Buyers Order, Driver's License, Proof of Insurance, Weight Slip, VIN Verification) coming in a future update.
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} disabled={saving}
            className="flex-1 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg text-gray-700 dark:text-dark-text py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-ttc-blue hover:bg-ttc-blue-dark text-white py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Submitting…' : 'Submit to F&I'}
          </button>
        </div>
      </div>
    </div>
  );
}

function YesNoToggle({ label, options, value, onChange, labelClass, sel, unsel }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        {options.map((v) => (
          <button key={v} onClick={() => onChange(v)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${value === v ? sel : unsel}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
