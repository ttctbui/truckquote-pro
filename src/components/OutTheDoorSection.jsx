// src/components/OutTheDoorSection.jsx
//
// "Out The Door Price" section: shows all fees, taxes, and the calculated
// Amount Financed below the Sale Price.
//
// Math (matches Excel buyer's order):
//   Sales Tax       = (Sale Price + Pack + Warranty) × (tax_rate / 100)
//   License/Reg     = auto: ROUNDUP((Sale + Pack + Tax) × 0.65% + 192, -10), or manual override
//   Total Fees      = doc_prep + fire_ext + dmv + admin + tire + warranty + license_reg
//   OTD Price       = Sale Price + Total Fees + Tax
//   Amount Financed = OTD - Down Payment - Incentive Total - Net Trade-In
//
// Net Trade-In = trade_value - trade_payoff (positive = equity, negative = roll into loan)
//
// Tax lookup: calls Supabase Edge Function `lookup-tax-rate` with ZIP, gets back rate.
// Manual entry always available (toggle off "Auto" mode for non-CA).

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ── helpers ──────────────────────────────────────────────────────────
function numOrDefault(val, def = 0) {
  if (val === '' || val == null) return def
  const n = typeof val === 'string' ? parseFloat(val) : Number(val)
  return Number.isFinite(n) ? n : def
}

// Excel license/reg formula:
//   ROUNDUP((Sale + Pack + Tax) × 0.0065 + 192, -10)
// The -10 in Excel's ROUNDUP rounds UP to the nearest $10.
function calcLicenseReg(salePrice, pack, tax) {
  const base = (salePrice + pack + tax) * 0.0065 + 192
  // Round up to nearest 10
  return Math.ceil(base / 10) * 10
}

function fmt(n) {
  if (!Number.isFinite(n)) return '$0.00'
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── component ────────────────────────────────────────────────────────
export default function OutTheDoorSection({
  // Inputs from parent (already-calculated values)
  salePrice = 0,
  packAmount = 0,
  downPayment = 0,
  tradeValue = 0,
  tradePayoff = 0,
  incentiveTotal = 0,
  // OTD form state (lifted to parent so it can be saved with the quote)
  otd,           // object: { tax_zip, tax_state, tax_rate, tax_city, tax_county, fee_*, ... }
  onChange,      // (patch) => void — parent merges patch into its form state
  // Computed totals callback so parent can use Amount Financed for monthly payment
  onTotalsChange, // ({ totalTax, totalFees, otdPrice, amountFinanced }) => void
}) {
  const [taxLookupLoading, setTaxLookupLoading] = useState(false)
  const [taxLookupError, setTaxLookupError] = useState('')

  // Pull values from `otd` (with defaults if not yet set)
  const tax_zip       = otd?.tax_zip || ''
  const tax_state     = otd?.tax_state || 'CA'
  const tax_rate      = numOrDefault(otd?.tax_rate, 10.50)
  const tax_city      = otd?.tax_city || ''
  const tax_county    = otd?.tax_county || ''

  const fee_doc_prep  = numOrDefault(otd?.fee_doc_prep, 85)
  const fee_fire_ext  = numOrDefault(otd?.fee_fire_ext, 250)
  const fee_dmv       = numOrDefault(otd?.fee_dmv, 37)
  const fee_admin     = numOrDefault(otd?.fee_admin, 395)
  const fee_tire      = numOrDefault(otd?.fee_tire, 10.50)
  const fee_warranty  = numOrDefault(otd?.fee_warranty, 0)

  const license_reg_manual = !!otd?.fee_license_reg_manual

  // Tax base = Sale Price + Pack + Warranty (matches Excel "tax on" formula)
  const taxBase = salePrice + packAmount + fee_warranty
  const totalTax = taxBase * (tax_rate / 100)

  // License/Reg: auto-calculated unless user manually entered
  const autoLicenseReg = calcLicenseReg(salePrice, packAmount, totalTax)
  const fee_license_reg = license_reg_manual
    ? numOrDefault(otd?.fee_license_reg, autoLicenseReg)
    : autoLicenseReg

  const totalFees =
    fee_doc_prep + fee_fire_ext + fee_dmv + fee_admin +
    fee_tire + fee_warranty + fee_license_reg

  const otdPrice = salePrice + totalFees + totalTax

  // Net trade-in: positive = customer has equity (reduces financed amount)
  //               negative = trade payoff exceeds value (rolls into loan)
  const netTradeIn = tradeValue - tradePayoff

  const amountFinanced = Math.max(
    0,
    otdPrice - downPayment - incentiveTotal - netTradeIn
  )

  // Notify parent of computed totals only when they actually change.
  // Using useEffect prevents the infinite render loop that occurred when
  // we called onTotalsChange directly during render.
  useEffect(() => {
    if (!onTotalsChange) return
    onTotalsChange({
      totalTax,
      totalFees,
      otdPrice,
      amountFinanced,
      autoLicenseReg,
      effectiveLicenseReg: fee_license_reg,
    })
  }, [totalTax, totalFees, otdPrice, amountFinanced, autoLicenseReg, fee_license_reg, onTotalsChange])

  // ── tax lookup handler ─────────────────────────────────────────────
  async function handleTaxLookup() {
    if (!/^\d{5}$/.test(tax_zip.trim())) {
      setTaxLookupError('Enter a 5-digit ZIP code')
      return
    }
    setTaxLookupLoading(true)
    setTaxLookupError('')
    try {
      const { data, error } = await supabase.functions.invoke('lookup-tax-rate', {
        body: { zip: tax_zip.trim() },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      onChange({
        tax_rate: data.rate,
        tax_city: data.city || '',
        tax_county: data.county || '',
        tax_state: data.state || 'CA',
      })
    } catch (err) {
      console.error('Tax lookup failed:', err)
      setTaxLookupError(err.message || 'Lookup failed — enter rate manually')
    } finally {
      setTaxLookupLoading(false)
    }
  }

  // ── styles ─────────────────────────────────────────────────────────
  const inputClass = "w-full bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text rounded-lg px-3 py-2 border border-gray-300 dark:border-dark-border focus:outline-none focus:border-ttc-blue focus:ring-2 focus:ring-ttc-blue/20 text-sm transition-all"
  const smallInputClass = "w-24 bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text rounded px-2 py-1 border border-gray-300 dark:border-dark-border focus:outline-none focus:border-ttc-blue focus:ring-1 focus:ring-ttc-blue/30 text-sm font-numeric text-right"
  const labelClass = "block text-gray-600 dark:text-dark-muted text-xs mb-1 font-medium"

  // ── render ─────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-dark-surface border-2 border-ttc-blue rounded-xl p-5 mb-4 shadow-ttc-card">
      <h2 className="text-sm font-semibold text-ttc-blue mb-4 uppercase tracking-wider">
        Out The Door Price — Fees &amp; Taxes
      </h2>

      {/* Tax lookup row */}
      <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-3 mb-4 border border-gray-200 dark:border-dark-border">
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-3">
            <label className={labelClass}>ZIP (for tax lookup)</label>
            <input
              className={inputClass}
              value={tax_zip}
              onChange={(e) => onChange({ tax_zip: e.target.value })}
              placeholder="90670"
              maxLength={5}
            />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>State</label>
            <select
              className={inputClass}
              value={tax_state}
              onChange={(e) => onChange({ tax_state: e.target.value })}
            >
              <option value="CA">CA</option>
              <option value="AZ">AZ</option>
              <option value="NV">NV</option>
              <option value="OR">OR</option>
              <option value="WA">WA</option>
              <option value="TX">TX</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="col-span-3">
            <label className={labelClass}>Tax Rate %</label>
            <input
              className={inputClass}
              value={tax_rate}
              onChange={(e) => onChange({ tax_rate: e.target.value })}
              placeholder="10.5"
            />
          </div>
          <div className="col-span-4">
            {tax_state === 'CA' ? (
              <button
                onClick={handleTaxLookup}
                disabled={taxLookupLoading || !tax_zip}
                className="w-full bg-ttc-blue hover:bg-ttc-blue-dark text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {taxLookupLoading ? 'Looking up…' : 'Lookup CA tax rate'}
              </button>
            ) : (
              <div className="text-xs text-gray-500 dark:text-dark-muted">
                Non-CA: enter tax rate manually
              </div>
            )}
          </div>
        </div>
        {(tax_city || tax_county) && (
          <p className="text-xs text-gray-500 dark:text-dark-muted mt-2">
            {tax_city && <>City: <span className="font-semibold">{tax_city}</span> · </>}
            {tax_county && <>County: <span className="font-semibold">{tax_county}</span></>}
          </p>
        )}
        {taxLookupError && (
          <p className="text-xs text-stat-red mt-2">{taxLookupError}</p>
        )}
      </div>

      {/* Fee breakdown */}
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-gray-100 dark:border-dark-border">
            <td className="py-2 text-gray-600 dark:text-dark-muted">Cash Price of Vehicle &amp; Accessories</td>
            <td className="py-2 text-right font-numeric">{fmt(salePrice)}</td>
          </tr>
          <tr className="border-b border-gray-100 dark:border-dark-border">
            <td className="py-2 text-gray-600 dark:text-dark-muted">Documentary Preparation Charge</td>
            <td className="py-2 text-right">
              <input
                className={smallInputClass}
                value={otd?.fee_doc_prep ?? '85'}
                onChange={(e) => onChange({ fee_doc_prep: e.target.value })}
              />
            </td>
          </tr>
          <tr className="border-b border-gray-100 dark:border-dark-border">
            <td className="py-2 text-gray-600 dark:text-dark-muted">Fire Ext., Flares &amp; First Aid Kit</td>
            <td className="py-2 text-right">
              <input
                className={smallInputClass}
                value={otd?.fee_fire_ext ?? '250'}
                onChange={(e) => onChange({ fee_fire_ext: e.target.value })}
              />
            </td>
          </tr>
          <tr className="border-b border-gray-100 dark:border-dark-border">
            <td className="py-2 text-gray-600 dark:text-dark-muted">
              Sales Tax @ {tax_rate}% <span className="text-xs text-gray-400 dark:text-dark-muted">(on Sale + Pack + Warranty)</span>
            </td>
            <td className="py-2 text-right font-numeric">{fmt(totalTax)}</td>
          </tr>
          <tr className="border-b border-gray-100 dark:border-dark-border">
            <td className="py-2 text-gray-600 dark:text-dark-muted">Maintenance &amp; Extended Warranty</td>
            <td className="py-2 text-right">
              <input
                className={smallInputClass}
                value={otd?.fee_warranty ?? '0'}
                onChange={(e) => onChange({ fee_warranty: e.target.value })}
              />
            </td>
          </tr>
          <tr className="border-b border-gray-100 dark:border-dark-border">
            <td className="py-2 text-gray-600 dark:text-dark-muted">DMV Electronic Filing Fee</td>
            <td className="py-2 text-right">
              <input
                className={smallInputClass}
                value={otd?.fee_dmv ?? '37'}
                onChange={(e) => onChange({ fee_dmv: e.target.value })}
              />
            </td>
          </tr>
          <tr className="border-b border-gray-100 dark:border-dark-border">
            <td className="py-2 text-gray-600 dark:text-dark-muted">Admin Fee</td>
            <td className="py-2 text-right">
              <input
                className={smallInputClass}
                value={otd?.fee_admin ?? '395'}
                onChange={(e) => onChange({ fee_admin: e.target.value })}
              />
            </td>
          </tr>
          <tr className="border-b border-gray-100 dark:border-dark-border">
            <td className="py-2 text-gray-600 dark:text-dark-muted">California Tire Fee</td>
            <td className="py-2 text-right">
              <input
                className={smallInputClass}
                value={otd?.fee_tire ?? '10.50'}
                onChange={(e) => onChange({ fee_tire: e.target.value })}
              />
            </td>
          </tr>
          <tr className="border-b border-gray-100 dark:border-dark-border">
            <td className="py-2 text-gray-600 dark:text-dark-muted">
              Est. License, Trans., Reg. &amp; Other Fees
              <button
                onClick={() => onChange({
                  fee_license_reg_manual: !license_reg_manual,
                  // when flipping to manual, seed the manual value with the current auto-calc
                  fee_license_reg: license_reg_manual ? null : autoLicenseReg.toFixed(2),
                })}
                className="ml-2 text-xs text-ttc-blue hover:underline"
              >
                {license_reg_manual ? '(switch to auto)' : '(switch to manual)'}
              </button>
            </td>
            <td className="py-2 text-right">
              {license_reg_manual ? (
                <input
                  className={smallInputClass}
                  value={otd?.fee_license_reg ?? autoLicenseReg.toFixed(2)}
                  onChange={(e) => onChange({ fee_license_reg: e.target.value })}
                />
              ) : (
                <span className="font-numeric">{fmt(autoLicenseReg)}</span>
              )}
            </td>
          </tr>

          {/* Subtotal */}
          <tr className="border-t-2 border-gray-300 dark:border-dark-border">
            <td className="py-3 font-semibold text-gray-900 dark:text-dark-text">Total Cash Price (Out The Door)</td>
            <td className="py-3 text-right font-semibold text-base font-numeric text-gray-900 dark:text-dark-text">{fmt(otdPrice)}</td>
          </tr>

          {/* Reductions */}
          <tr>
            <td className="py-1 text-gray-600 dark:text-dark-muted text-sm">— Down Payment</td>
            <td className="py-1 text-right font-numeric text-stat-green">−{fmt(downPayment)}</td>
          </tr>
          <tr>
            <td className="py-1 text-gray-600 dark:text-dark-muted text-sm">— Incentives / Rebates (cash down)</td>
            <td className="py-1 text-right font-numeric text-stat-green">−{fmt(incentiveTotal)}</td>
          </tr>
          <tr>
            <td className="py-1 text-gray-600 dark:text-dark-muted text-sm">
              — Net Trade-In Allowance
              <span className="text-xs text-gray-400 dark:text-dark-muted"> (value − payoff)</span>
            </td>
            <td className={`py-1 text-right font-numeric ${netTradeIn >= 0 ? 'text-stat-green' : 'text-stat-red'}`}>
              {netTradeIn >= 0 ? `−${fmt(netTradeIn)}` : `+${fmt(Math.abs(netTradeIn))}`}
            </td>
          </tr>

          {/* Final */}
          <tr className="border-t-2 border-ttc-blue bg-ttc-blue-light dark:bg-ttc-blue/10">
            <td className="py-3 px-2 font-bold text-ttc-blue uppercase text-xs tracking-wider">Amount Financed</td>
            <td className="py-3 px-2 text-right font-bold text-xl font-numeric text-ttc-blue">{fmt(amountFinanced)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
