import { describe, it, expect } from 'vitest'
import { parseXDC } from '../../utils/format.js'
import { parseEther } from 'viem'

describe('parseXDC with comma support', () => {
  it('parses plain number string', () => {
    expect(parseXDC('25000')).toBe(parseEther('25000'))
  })

  it('parses comma-formatted number string', () => {
    expect(parseXDC('25,000')).toBe(parseEther('25000'))
  })

  it('parses large comma-formatted number', () => {
    expect(parseXDC('1,234,567')).toBe(parseEther('1234567'))
  })

  it('parses number with decimal', () => {
    expect(parseXDC('25000.5')).toBe(parseEther('25000.5'))
  })

  it('parses comma-formatted number with decimal', () => {
    expect(parseXDC('25,000.5')).toBe(parseEther('25000.5'))
  })

  it('parses large comma-formatted number with decimal', () => {
    expect(parseXDC('10,000,000.123456789')).toBe(parseEther('10000000.123456789'))
  })

  it('returns 0n for empty string', () => {
    expect(parseXDC('')).toBe(BigInt(0))
  })

  it('returns 0n for invalid input', () => {
    expect(parseXDC('not a number')).toBe(BigInt(0))
  })

  it('handles 25,000 (the MIN_PRICE typical case)', () => {
    expect(parseXDC('25,000')).toBe(parseEther('25000'))
  })

  it('handles 10 million special token price', () => {
    expect(parseXDC('10,000,000')).toBe(parseEther('10000000'))
  })
})
