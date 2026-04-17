import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('computeAllRarityScores', () => {
  let computeAllRarityScores

  // Reimport fresh each test to reset cached scores
  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../../utils/metadata.js')
    computeAllRarityScores = mod.computeAllRarityScores
  })

  it('follows rarity.tools formula: score = sum of (totalItems / itemsWithTrait)', () => {
    // 4 tokens, 2 traits each
    const metadata = {
      '0000': { attributes: [{ trait_type: 'Background', value: 'Red' }, { trait_type: 'Hat', value: 'Crown' }] },
      '0001': { attributes: [{ trait_type: 'Background', value: 'Red' }, { trait_type: 'Hat', value: 'Cap' }] },
      '0002': { attributes: [{ trait_type: 'Background', value: 'Blue' }, { trait_type: 'Hat', value: 'Cap' }] },
      '0003': { attributes: [{ trait_type: 'Background', value: 'Blue' }, { trait_type: 'Hat', value: 'Cap' }] },
    }

    const scores = computeAllRarityScores(metadata)

    // Token 0000: Red(4/2=2) + Crown(4/1=4) = 6
    expect(scores['0000']).toBe(6)
    // Token 0001: Red(4/2=2) + Cap(4/3=1.33) = 3.33
    expect(scores['0001']).toBe(3.33)
    // Token 0002: Blue(4/2=2) + Cap(4/3=1.33) = 3.33
    expect(scores['0002']).toBe(3.33)
    // Token 0003: Blue(4/2=2) + Cap(4/3=1.33) = 3.33
    expect(scores['0003']).toBe(3.33)
  })

  it('rarest token gets highest score', () => {
    const metadata = {
      '0000': { attributes: [{ trait_type: 'Color', value: 'Gold' }] },   // 1 of 1
      '0001': { attributes: [{ trait_type: 'Color', value: 'Silver' }] }, // 1 of 2
      '0002': { attributes: [{ trait_type: 'Color', value: 'Silver' }] },
      '0003': { attributes: [{ trait_type: 'Color', value: 'Bronze' }] }, // 1 of 3
      '0004': { attributes: [{ trait_type: 'Color', value: 'Bronze' }] },
      '0005': { attributes: [{ trait_type: 'Color', value: 'Bronze' }] },
    }

    const scores = computeAllRarityScores(metadata)

    // Gold (6/1=6) > Silver (6/2=3) > Bronze (6/3=2)
    expect(scores['0000']).toBe(6)
    expect(scores['0001']).toBe(3)
    expect(scores['0003']).toBe(2)
    expect(scores['0000']).toBeGreaterThan(scores['0001'])
    expect(scores['0001']).toBeGreaterThan(scores['0003'])
  })

  it('tokens with same traits get same score', () => {
    const metadata = {
      '0000': { attributes: [{ trait_type: 'A', value: 'X' }, { trait_type: 'B', value: 'Y' }] },
      '0001': { attributes: [{ trait_type: 'A', value: 'X' }, { trait_type: 'B', value: 'Y' }] },
      '0002': { attributes: [{ trait_type: 'A', value: 'Z' }, { trait_type: 'B', value: 'W' }] },
    }

    const scores = computeAllRarityScores(metadata)
    expect(scores['0000']).toBe(scores['0001'])
  })

  it('more rare traits = higher score', () => {
    const metadata = {
      '0000': { attributes: [
        { trait_type: 'A', value: 'Rare' },
        { trait_type: 'B', value: 'Rare' },
        { trait_type: 'C', value: 'Rare' },
      ]},
      '0001': { attributes: [
        { trait_type: 'A', value: 'Common' },
        { trait_type: 'B', value: 'Common' },
        { trait_type: 'C', value: 'Common' },
      ]},
      '0002': { attributes: [
        { trait_type: 'A', value: 'Common' },
        { trait_type: 'B', value: 'Common' },
        { trait_type: 'C', value: 'Common' },
      ]},
    }

    const scores = computeAllRarityScores(metadata)

    // Rare traits (3/1=3 each) = 9 total
    expect(scores['0000']).toBe(9)
    // Common traits (3/2=1.5 each) = 4.5 total
    expect(scores['0001']).toBe(4.5)
    expect(scores['0000']).toBeGreaterThan(scores['0001'])
  })

  it('handles tokens with no attributes', () => {
    const metadata = {
      '0000': { attributes: [{ trait_type: 'A', value: 'X' }] },
      '0001': {},
      '0002': { attributes: [] },
    }

    const scores = computeAllRarityScores(metadata)
    expect(scores['0001']).toBe(0)
    expect(scores['0002']).toBe(0)
  })

  it('manual calculation matches rarity.tools formula exactly', () => {
    // 10 tokens: backgrounds split 7/3, hats split 5/5
    const metadata = {}
    for (let i = 0; i < 10; i++) {
      metadata[String(i).padStart(4, '0')] = {
        attributes: [
          { trait_type: 'Background', value: i < 7 ? 'Common' : 'Rare' },
          { trait_type: 'Hat', value: i < 5 ? 'Fedora' : 'Crown' },
        ]
      }
    }

    const scores = computeAllRarityScores(metadata)
    const total = 10

    // Token 0000: Common BG (10/7) + Fedora (10/5) = 1.43 + 2 = 3.43
    const expected0 = Math.round((total/7 + total/5) * 100) / 100
    expect(scores['0000']).toBe(expected0)

    // Token 0007: Rare BG (10/3) + Crown (10/5) = 3.33 + 2 = 5.33
    const expected7 = Math.round((total/3 + total/5) * 100) / 100
    expect(scores['0007']).toBe(expected7)

    expect(scores['0007']).toBeGreaterThan(scores['0000'])
  })
})
