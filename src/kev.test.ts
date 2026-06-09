import { describe, expect, it } from 'vitest'
import {
    makeCard,
    rankOf,
    suitOf,
    CardAs, CardKs, CardQs, CardJs, CardTs,
    Card9s, Card8s, Card7s, Card6s, Card5s, Card4s, Card3s, Card2s,
    CardAh, CardKh, Card9h, Card9d, Card9c,
    DECK,
} from './kev.js'

describe('makeCard / rankOf / suitOf', () => {
    it.each([
        // [rank, suit, expected bits]
        [12, 1, 0x10001c29], // CardAs
        [11, 1, 0x08001b25], // CardKs
        [ 0, 1, 0x00011002], // Card2s
        [12, 2, 0x10002c29], // CardAh
        [12, 8, 0x10008c29], // CardAc
    ])('makeCard(%i, %i) === 0x%s', (rank, suit, expected) => {
        expect(makeCard(rank, suit)).toBe(expected)
    })

    it.each([
        [CardAs,  12],
        [CardKs,  11],
        [CardQs,  10],
        [CardJs,   9],
        [CardTs,   8],
        [Card9s,   7],
        [Card8s,   6],
        [Card7s,   5],
        [Card6s,   4],
        [Card5s,   3],
        [Card4s,   2],
        [Card3s,   1],
        [Card2s,   0],
    ])('rankOf card %i === %i', (card, expected) => {
        expect(rankOf(card)).toBe(expected)
    })

    it('same rank across suits', () => {
        expect(rankOf(CardAh)).toBe(rankOf(CardAs))
        expect(rankOf(Card9h)).toBe(rankOf(Card9s))
        expect(rankOf(Card9d)).toBe(rankOf(Card9s))
        expect(rankOf(Card9c)).toBe(rankOf(Card9s))
    })

    it.each([
        [CardAs, 1], // spade
        [CardAh, 2], // heart
        [makeCard(12, 4), 4], // diamond
        [makeCard(12, 8), 8], // club
    ])('suitOf card %i === %i', (card, expected) => {
        expect(suitOf(card)).toBe(expected)
    })
})

describe('DECK', () => {
    it('contains 52 cards', () => {
        expect(DECK.length).toBe(52)
    })

    it('all cards are unique', () => {
        expect(new Set(DECK).size).toBe(52)
    })

    it('first card is CardAs', () => {
        expect(DECK[0]).toBe(CardAs)
    })

    it('last card is Card2c (clubs 2)', () => {
        expect(DECK[51]).toBe(makeCard(0, 8))
    })
})
