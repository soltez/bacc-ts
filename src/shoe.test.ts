import { describe, expect, it } from 'vitest'
import { Shoe } from './shoe.js'
import {
    CardAs, CardKs, CardQs, CardJs,
    Card9s, Card8s, Card7s, Card6s, Card5s, Card4s, Card3s, Card2s,
    CardAh, CardKh,
} from './kev.js'

// null = cut card
describe('Shoe.new', () => {
    // The shoe stores cards in a 0-indexed array where index 0 is a sentinel
    // never returned by deal(). After cut(), cursor = n*52, so exactly n*52
    // cards are dealt before deal() returns undefined (n*52-1 play + 1 cut).
    it.each([1, 4, 6, 8])('%i-deck shoe has n*52 total deals after cut', (n) => {
        const shoe = Shoe.new(n)
        shoe.cut(0.5)
        let count = 0
        while (shoe.deal() !== undefined) count++
        expect(count).toBe(n * 52)
    })

    it('deal returns undefined before cut is called', () => {
        const shoe = Shoe.new(1)
        expect(shoe.deal()).toBeUndefined()
    })

    it('hasReachedCutCard is true before cut is called', () => {
        const shoe = Shoe.new(1)
        expect(shoe.hasReachedCutCard()).toBe(true)
    })

    it('stubSize is 0 before cut is called', () => {
        const shoe = Shoe.new(1)
        expect(shoe.stubSize()).toBe(0)
    })

    it('stubSize reflects penetration', () => {
        // 1-deck shoe: last index = 52; cut_pos = floor((1-0.75)*52) = 13
        const shoe = Shoe.new(1)
        shoe.cut(0.75)
        expect(shoe.stubSize()).toBe(13)
    })

    it('stubSize is 0 at full penetration', () => {
        const shoe = Shoe.new(1)
        shoe.cut(1.0)
        expect(shoe.stubSize()).toBe(0)
    })

    it('stubSize is 0 after shuffle resets state', () => {
        const shoe = Shoe.new(1)
        shoe.cut(0.75)
        shoe.shuffle(1)
        expect(shoe.stubSize()).toBe(0)
    })

    it('shuffle and cut restores full dealing capacity', () => {
        const shoe = Shoe.new(1)
        shoe.cut(0.75)
        // deal some cards
        for (let i = 0; i < 10; i++) shoe.deal()
        shoe.shuffle(1)
        shoe.cut(0.75)
        let count = 0
        while (shoe.deal() !== undefined) count++
        expect(count).toBe(52)
    })

    it('exhausted shoe returns undefined', () => {
        const shoe = Shoe.new(1)
        shoe.cut(1.0)
        let count = 0
        while (shoe.deal() !== undefined) count++
        expect(count).toBe(52) // 52 play cards + cut card
        expect(shoe.deal()).toBeUndefined()
    })
})

describe('Shoe.from', () => {
    it('deals in reverse order (last element first)', () => {
        // [As, Cut, Ks] -> cursor=2, deals Ks then Cut then undefined
        const cards = [CardAs, null, CardKs]
        const shoe = Shoe.from(cards)
        expect(shoe.deal()).toBe(CardKs)
        expect(shoe.deal()).toBeNull()
        expect(shoe.deal()).toBeUndefined()
    })

    it('cut_pos set to index of null', () => {
        // [As, Ks, Cut, Qs, Js] -> cut_pos=2
        const cards = [CardAs, CardKs, null, CardQs, CardJs]
        const shoe = Shoe.from(cards)
        expect(shoe.hasReachedCutCard()).toBe(false) // cursor=4 > cut_pos=2
        shoe.deal() // cursor=3
        expect(shoe.hasReachedCutCard()).toBe(false)
        shoe.deal() // cursor=2
        expect(shoe.hasReachedCutCard()).toBe(true)
    })

    it('stubSize is count of cards before the cut card index', () => {
        // [As, Cut, Ks, Qs] -> cut_pos=1, stubSize=1
        const cards = [CardAs, null, CardKs, CardQs]
        const shoe = Shoe.from(cards)
        expect(shoe.stubSize()).toBe(1)
    })

    it('throws when no cut card', () => {
        expect(() => Shoe.from([CardAs, CardKs])).toThrow()
    })

    it('throws when multiple cut cards', () => {
        expect(() => Shoe.from([null, CardAs, null])).toThrow()
    })
})

describe('Shoe.burn', () => {
    it('burn reduces available cards', () => {
        const shoe = Shoe.from([CardAs, null, CardKs, CardQs, CardJs, Card9s])
        // cursor=5, cut_pos=1; burn 2 is ok (1+2=3 <= 5)
        shoe.burn(2)
        expect(shoe.deal()).toBe(CardQs) // cards[3]
    })

    it('burn throws when too many cards burned', () => {
        const shoe = Shoe.from([CardAs, null, CardKs, CardQs])
        // cursor=3, cut_pos=1; burn 3 would require 1+3=4 > 3
        expect(() => shoe.burn(3)).toThrow()
    })
})
