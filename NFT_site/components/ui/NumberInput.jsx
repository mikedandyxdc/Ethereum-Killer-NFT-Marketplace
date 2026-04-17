'use client'

import { NumericFormat } from 'react-number-format'

// Reusable formatted number input — shows commas as user types (e.g. "50,000").
// Wraps react-number-format. Returns the raw unformatted string via onChange (no commas).
// Supports decimals (e.g. "25,000.5").
export default function NumberInput({ value, onChange, placeholder, className, disabled }) {
  return (
    <NumericFormat
      value={value}
      onValueChange={(values) => onChange(values.value)} // values.value = unformatted string
      thousandSeparator=","
      decimalSeparator="."
      allowNegative={false}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  )
}
