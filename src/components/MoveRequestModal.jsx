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
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-3xl my-8">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white">New Move Request</h2>
            {quote && (
              <div className="text-sm text-gray-400">
                For quote {quote.quote_number} · {quote.customer_name}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Department">
            <select
              value={form.requester_department}
              onChange={(e) => update({ requester_department: e.target.value })}
              className="input"
            >
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>

          <Field label="Region">
            <select
              value={form.region}
              onChange={(e) => update({ region: e.target.value })}
              className="input"
            >
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>

          <Field label="Customer">
            <input
              value={form.customer}
              onChange={(e) => update({ customer: e.target.value })}
              className="input"
            />
          </Field>

          <Field label="VIN / Stock / Tag #">
            <input
              value={form.vin_stock_tag}
              onChange={(e) => update({ vin_stock_tag: e.target.value })}
              className="input"
            />
          </Field>

          <Field label="From Location *">
            <input
              value={form.from_location}
              onChange={(e) => update({ from_location: e.target.value })}
              placeholder="e.g. TTC LA"
              className="input"
            />
          </Field>

          <Field label="To Location *">
            <input
              value={form.to_location}
              onChange={(e) => update({ to_location: e.target.value })}
              placeholder="e.g. Customer site, H-Truck, etc."
              className="input"
            />
          </Field>

          <Field label="Street Address">
            <input
              value={form.street_address}
              onChange={(e) => update({ street_address: e.target.value })}
              className="input"
            />
          </Field>

          <Field label="City">
            <input
              value={form.city}
              onChange={(e) => update({ city: e.target.value })}
              className="input"
            />
          </Field>

          <Field label="Move Type">
            <select
              value={form.move_type}
              onChange={(e) => update({ move_type: e.target.value })}
              className="input"
            >
              {MOVE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>

          <Field label="Date Needed">
            <input
              type="date"
              value={form.date_needed}
              onChange={(e) => update({ date_needed: e.target.value })}
              className="input"
            />
          </Field>

          <Field label="PO Number">
            <input
              value={form.po_number}
              onChange={(e) => update({ po_number: e.target.value })}
              className="input"
            />
          </Field>

          <Field label="Deal / RO #">
            <input
              value={form.deal_ro_number}
              onChange={(e) => update({ deal_ro_number: e.target.value })}
              className="input"
            />
          </Field>

          <div className="md:col-span-2 flex gap-6">
            <label className="flex items-center gap-2 text-white">
              <input
                type="checkbox"
                checked={form.is_urgent}
                onChange={(e) => update({ is_urgent: e.target.checked })}
              />
              <span className="text-red-400 font-semibold">🔥 Urgent</span>
            </label>
            <label className="flex items-center gap-2 text-white">
              <input
                type="checkbox"
                checked={form.fuel_request}
                onChange={(e) => update({ fuel_request: e.target.checked })}
              />
              Fuel Request
            </label>
          </div>

          <div className="md:col-span-2">
            <div className="text-sm text-gray-400 mb-2">Check Items</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CHECK_ITEM_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-white text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.check_items[f.key]}
                    onChange={() => toggleCheck(f.key)}
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
              className="input"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create Move Request'}
          </button>
        </div>

        <style>{`
          .input {
            background: #111827;
            border: 1px solid #374151;
            color: white;
            padding: 0.5rem 0.75rem;
            border-radius: 0.375rem;
            width: 100%;
          }
          .input:focus {
            outline: none;
            border-color: #f97316;
          }
        `}</style>
      </div>
    </div>
  );
}

function Field({ label, full, children }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
