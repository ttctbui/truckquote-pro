import { useState } from 'react';
import { supabase } from '../lib/supabase';

const MOVE_TYPES = [
  'Delivery', 'Body/Paint', 'Service', 'Store Transfer',
  'Dealer Trade', 'Rental', 'Wash', 'Other',
];
const REGIONS = ['OC', 'LA'];
const DEPARTMENTS = ['Sales', 'Service', 'Parts', 'F&I', 'Body Shop', 'Other'];

const CHECK_ITEM_FIELDS = [
  { key: 'fuel',             label: 'Fuel' },
  { key: 'wash',             label: 'Delivery Wash' },
  { key: 'weight_slip',      label: 'Weight Slip' },
  { key: 'mudflaps',         label: 'Mudflaps' },
  { key: 'safety_kit',       label: 'Safety Kit' },
  { key: 'owners_manual',    label: "Owner's Manual" },
  { key: 'vin_verification', label: 'VIN Verification' },
];

/**
 * Modal form for creating a move request.
 * Pass `quote` to pre-fill for a quote-tied request. Pass `quote={null}` for standalone.
 */
export default function MoveRequestModal({ quote, currentUserId, onClose, onCreated }) {
  const [form, setForm] = useState({
    requester_department: 'Sales',
    customer: quote?.customer_name ?? '',
    vin_stock_tag: quote?.vehicle_vin ?? '',
    from_location: '',
    to_location: '',
    street_address: '',
    city: '',
    move_type: 'Delivery',
    date_needed: '',
    region: 'OC',
    is_urgent: false,
    fuel_request: false,
    po_number: '',
    deal_ro_number: quote?.deal_number ?? '',
    special_instructions: '',
    check_items: CHECK_ITEM_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: false }), {}),
  });
  const [saving, setSaving] = useState(false);

  function update(patch) { setForm((s) => ({ ...s, ...patch })); }
  function toggleCheck(k) {
    setForm((s) => ({ ...s, check_items: { ...s.check_items, [k]: !s.check_items[k] } }));
  }

  async function submit() {
    if (!form.from_location || !form.to_location) {
      alert('From and To locations are required.');
      return;
    }
    setSaving(true);

    const payload = {
      ...form,
      requester_id: currentUserId,
      quote_id: quote?.id ?? null,
      date_needed: form.date_needed || null,
      status: 'pending',
    };

    const { error } = await supabase.from('move_requests').insert(payload);
    setSaving(false);

    if (error) {
      alert('Could not create move request: ' + error.message);
      return;
    }
    onCreated?.();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border shadow-2xl w-full max-w-3xl my-8">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-dark-border">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text">New Move Request</h2>
            {quote && (
              <div className="text-sm text-gray-500 dark:text-dark-muted">
                For quote <span className="font-numeric text-ttc-blue">{quote.quote_number}</span> · {quote.customer_name}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-dark-muted dark:hover:text-dark-text text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Department">
            <select
              value={form.requester_department}
              onChange={(e) => update({ requester_department: e.target.value })}
              className="ttc-input"
            >
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>

          <Field label="Region">
            <select
              value={form.region}
              onChange={(e) => update({ region: e.target.value })}
              className="ttc-input"
            >
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>

          <Field label="Customer">
            <input
              value={form.customer}
              onChange={(e) => update({ customer: e.target.value })}
              className="ttc-input"
            />
          </Field>

          <Field label="VIN / Stock / Tag #">
            <input
              value={form.vin_stock_tag}
              onChange={(e) => update({ vin_stock_tag: e.target.value })}
              className="ttc-input"
            />
          </Field>

          <Field label="From Location *">
            <input
              value={form.from_location}
              onChange={(e) => update({ from_location: e.target.value })}
              placeholder="e.g. TTC LA"
              className="ttc-input"
            />
          </Field>

          <Field label="To Location *">
            <input
              value={form.to_location}
              onChange={(e) => update({ to_location: e.target.value })}
              placeholder="e.g. Customer site, H-Truck, etc."
              className="ttc-input"
            />
          </Field>

          <Field label="Street Address">
            <input
              value={form.street_address}
              onChange={(e) => update({ street_address: e.target.value })}
              className="ttc-input"
            />
          </Field>

          <Field label="City">
            <input
              value={form.city}
              onChange={(e) => update({ city: e.target.value })}
              className="ttc-input"
            />
          </Field>

          <Field label="Move Type">
            <select
              value={form.move_type}
              onChange={(e) => update({ move_type: e.target.value })}
              className="ttc-input"
            >
              {MOVE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>

          <Field label="Date Needed">
            <input
              type="date"
              value={form.date_needed}
              onChange={(e) => update({ date_needed: e.target.value })}
              className="ttc-input"
            />
          </Field>

          <Field label="PO Number">
            <input
              value={form.po_number}
              onChange={(e) => update({ po_number: e.target.value })}
              className="ttc-input"
            />
          </Field>

          <Field label="Deal / RO #">
            <input
              value={form.deal_ro_number}
              onChange={(e) => update({ deal_ro_number: e.target.value })}
              className="ttc-input"
            />
          </Field>

          <div className="md:col-span-2 flex gap-6">
            <label className="flex items-center gap-2 text-gray-900 dark:text-dark-text">
              <input
                type="checkbox"
                checked={form.is_urgent}
                onChange={(e) => update({ is_urgent: e.target.checked })}
                className="rounded text-ttc-blue focus:ring-ttc-blue"
              />
              <span className="text-stat-red font-semibold">🔥 Urgent</span>
            </label>
            <label className="flex items-center gap-2 text-gray-900 dark:text-dark-text">
              <input
                type="checkbox"
                checked={form.fuel_request}
                onChange={(e) => update({ fuel_request: e.target.checked })}
                className="rounded text-ttc-blue focus:ring-ttc-blue"
              />
              Fuel Request
            </label>
          </div>

          <div className="md:col-span-2">
            <div className="text-sm text-gray-500 dark:text-dark-muted mb-2 font-medium">Check Items</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CHECK_ITEM_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-gray-900 dark:text-dark-text text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.check_items[f.key]}
                    onChange={() => toggleCheck(f.key)}
                    className="rounded text-ttc-blue focus:ring-ttc-blue"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          <Field label="Special Instructions" full>
            <textarea
              value={form.special_instructions}
              onChange={(e) => update({ special_instructions: e.target.value })}
              rows={3}
              className="ttc-input"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-surface rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 bg-ttc-blue hover:bg-ttc-blue-dark text-white rounded-lg font-semibold disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Create Move Request'}
          </button>
        </div>

        {/* Local input style — applies inside the modal only */}
        <style>{`
          .ttc-input {
            background: white;
            border: 1px solid #d1d5db;
            color: #111827;
            padding: 0.5rem 0.75rem;
            border-radius: 0.375rem;
            width: 100%;
            font-size: 0.875rem;
          }
          .ttc-input:focus {
            outline: none;
            border-color: #1E1BB8;
            box-shadow: 0 0 0 3px rgba(30, 27, 184, 0.1);
          }
          html.dark .ttc-input {
            background: #18191C;
            border-color: #2A2B30;
            color: #E4E4E7;
          }
          html.dark .ttc-input:focus {
            border-color: #1E1BB8;
            box-shadow: 0 0 0 3px rgba(30, 27, 184, 0.2);
          }
        `}</style>
      </div>
    </div>
  );
}

function Field({ label, full, children }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-sm text-gray-600 dark:text-dark-muted mb-1 font-medium">{label}</label>
      {children}
    </div>
  );
}
