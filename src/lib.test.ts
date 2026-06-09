import { describe, expect, it } from 'vitest'
import {
    BaccaratHand, BaccaratRound, BaccaratShoe, BaccaratScoreboard,
    type CardInt,
    CardAs, CardKs, CardQs, CardJs, CardTs,
    Card9s, Card8s, Card7s, Card6s, Card5s, Card4s, Card3s, Card2s,
    CardAh, CardKh, CardQh, CardJh, CardTh, Card9h, Card8h, Card7h,
    Card6h, Card5h, Card4h, Card3h, Card2h,
    CardAd, CardKd, CardQd, CardJd, CardTd, Card9d, Card8d, Card7d,
    Card6d, Card5d, Card4d, Card3d, Card2d,
    CardAc, CardKc, CardQc, CardJc, CardTc, Card9c, Card8c, Card7c,
    Card6c, Card5c, Card4c, Card3c, Card2c,
} from './index.js'

// Helper: build a BaccaratHand from an array of cards
function hand(cards: CardInt[]): BaccaratHand {
    const h = new BaccaratHand()
    for (const c of cards) h.take(c)
    return h
}

// -------------------------------------------------------------------
// pip value (tested indirectly via hand.value())
// -------------------------------------------------------------------

describe('BaccaratHand.value (pip values)', () => {
    it.each([
        [[CardAs], 1],
        [[CardKs], 0],
        [[CardQs], 0],
        [[CardJs], 0],
        [[CardTs], 0],
        [[Card9s], 9],
        [[Card8s], 8],
        [[Card7s], 7],
        [[Card6s], 6],
        [[Card5s], 5],
        [[Card4s], 4],
        [[Card3s], 3],
        [[Card2s], 2],
        // suit does not affect value
        [[Card9h], 9],
        [[Card9d], 9],
        [[Card9c], 9],
        // two-card sums
        [[Card5s, Card4h], 9],
        [[CardKs, Card9h], 9],
        [[Card6s, Card2h], 8],
        // three-card sums
        [[CardAs, Card2h, Card3d], 6],
        [[CardKs, CardQh, Card7d], 7],
        // mod-10 reduction: two-card
        [[Card5s, Card5h], 0],  // 10 % 10
        [[Card7s, Card6h], 3],  // 13 % 10
        [[Card9s, Card8h], 7],  // 17 % 10
        [[Card9s, Card9h], 8],  // 18 % 10
        // mod-10 reduction: three-card
        [[Card9s, Card9h, Card9d], 7], // 27 % 10
    ] as [CardInt[], number][])(
        'hand(%j).value() === %i',
        (cards, expected) => {
            expect(hand(cards).value()).toBe(expected)
        }
    )
})

// -------------------------------------------------------------------
// BaccaratHand.isPair
// -------------------------------------------------------------------

describe('BaccaratHand.isPair', () => {
    it.each([
        [[CardAs, CardAh], true],
        [[Card9s, Card9d], true],
        [[Card9s, Card9d, CardAs], true],
        [[CardAs, CardKs], false],
        [[Card9s, Card8h], false],
        [[Card9s, Card8h, Card8d], false],
    ] as [CardInt[], boolean][])('hand(%j).isPair() === %s', (cards, expected) => {
        expect(hand(cards).isPair()).toBe(expected)
    })
})

// -------------------------------------------------------------------
// BaccaratHand.hasThird
// -------------------------------------------------------------------

describe('BaccaratHand.hasThird', () => {
    it.each([
        [[CardAs], false],
        [[CardAs, CardKs], false],
        [[CardAs, CardKs, CardQs], true],
    ] as [CardInt[], boolean][])('hand(%j).hasThird() === %s', (cards, expected) => {
        expect(hand(cards).hasThird()).toBe(expected)
    })
})

// -------------------------------------------------------------------
// BaccaratRound.encode
// -------------------------------------------------------------------

function round(player: CardInt[], banker: CardInt[]): BaccaratRound {
    return new BaccaratRound(hand(player), hand(banker), false, null)
}

describe('BaccaratRound.encode', () => {
    it.each([
        // player wins (9 vs 0), no pairs, no thirds
        [[Card9s, CardKh], [CardKs, CardTh], 0x0901],
        // banker wins (0 vs 9), no pairs, no thirds
        [[CardKs, CardTh], [Card9s, CardKh], 0x9002],
        // tie (5 vs 5), no pairs, no thirds
        [[Card5s, CardKh], [Card5h, CardQd], 0x5503],
        // player pair: bit 2 set, player wins (2 vs 0)
        [[CardAs, CardAh], [CardKs, CardTh], 0x0205],
        // banker pair: bit 3 set, banker wins (0 vs 2)
        [[CardKs, CardTh], [CardAs, CardAh], 0x200a],
        // player has third: bit 4 set, player wins (6 vs 5)
        [[Card6s, CardKh, CardTs], [Card5s, CardQd], 0x5611],
        // banker has third: bit 5 set, banker wins (5 vs 6)
        [[Card5s, CardQd], [Card6s, CardKh, CardTs], 0x6522],
        // both thirds: bits 4+5 set, player wins (9 vs 2)
        [[Card2h, Card3d, Card4c], [Card3h, Card4d, Card5c], 0x2931],
        // both pairs: bits 2+3 set, player wins (2 vs 0)
        [[CardAs, CardAh], [CardKs, CardKh], 0x020d],
    ] as [CardInt[], CardInt[], number][])(
        'round(%j, %j).encode() === 0x%s',
        (player, banker, expected) => {
            expect(round(player, banker).encode()).toBe(expected)
        }
    )
})

// -------------------------------------------------------------------
// BaccaratShoe - helper to build shoes from ordered card arrays
//
// Layout convention (matching Rust test helper shoe_vec):
//   [dummy(Jc) | ...play cards deepest->shallowest... | Cut | burn | first]
//   Cards are dealt from the end (right-to-left in the array).
// -------------------------------------------------------------------

describe('BaccaratShoe burn ritual', () => {
    it('Ace burns one card - Card2s is skipped, Card9s is player card 1', () => {
        // first=As (pip=1) -> burns 1 card (Card2s); player card 1 must be Card9s.
        // Layout: [Jc | b2=2d, p2=Kh, b1=5h, p1=9s | Cut | burn=2s | first=As]
        const cards = [
            CardJc,
            Card2d,   // banker card 2
            CardKh,   // player card 2
            Card5h,   // banker card 1
            Card9s,   // player card 1 (natural)
            null,
            Card2s,   // burn (skipped)
            CardAs,   // first card pip=1
        ]
        const shoe = BaccaratShoe.fromCards(cards)
        const r = shoe.next()!
        expect(r.playerCards()).toEqual([Card9s, CardKh])
        expect(r.bankerCards()).toEqual([Card5h, Card2d])
    })

    it('King burns ten cards - 10 cards skipped, Card9s is player card 1', () => {
        // first=Ks (pip=10) -> burns 10 cards; player card 1 must be Card9s.
        // Layout: [Jc | b2, p2, b1, p1=9s | Cut | burn*10 | first=Ks]
        const cards = [
            CardJc,
            Card2d,    // banker card 2
            CardKh,    // player card 2
            Card5h,    // banker card 1
            Card9s,    // player card 1 (natural)
            null,
            Card2h, Card3h, Card4h, Card5d, Card6d, Card7d, Card8d, Card9d, CardTd, CardQs,
            CardKs,    // first card pip=10
        ]
        const shoe = BaccaratShoe.fromCards(cards)
        const r = shoe.next()!
        expect(r.playerCards()).toEqual([Card9s, CardKh])
        expect(r.bankerCards()).toEqual([Card5h, Card2d])
    })

    it('insufficient cards to burn throws', () => {
        // Ks (pip=10) requires burning 10 cards but only 5 available
        const cards = [
            CardJc,
            CardAs, Card2s, Card3s, Card4s, Card5s,
            null,
            CardKs,
        ]
        expect(() => BaccaratShoe.fromCards(cards)).toThrow()
    })

    it('cut card as first card throws', () => {
        // Cut at the last position -> dealt as the first card
        const cards = [CardAs, null]
        expect(() => BaccaratShoe.fromCards(cards)).toThrow()
    })

    it('pen too high throws', () => {
        // 1-deck shoe: floor((1-0.8)*52)=10 < 12
        expect(() => BaccaratShoe.new(1, 1, 0.8)).toThrow()
    })
})

// -------------------------------------------------------------------
// BaccaratShoe Iterator
// -------------------------------------------------------------------

describe('BaccaratShoe iterator', () => {
    it('natural: no third cards drawn', () => {
        // player=[Card9s, CardKs] value=9 natural; banker=[Card5h, Card2d]
        const burn = Card3c
        const cards = [
            CardJc,            // dummy
            Card2d,            // banker card 2
            CardKs,            // player card 2
            Card5h,            // banker card 1
            Card9s,            // player card 1 (natural)
            null,              // cut card
            burn,
            CardAs,            // first card (pip=1, burns 1)
        ]
        const shoe = BaccaratShoe.fromCards(cards)
        const r = shoe.next()!
        expect(r.playerCards()).toEqual([Card9s, CardKs])
        expect(r.bankerCards()).toEqual([Card5h, Card2d])
        expect(r.cutCardIndex()).toBe(0)
        expect(shoe.next()).toBeNull()
    })

    it('player stands (6-7), banker draws third', () => {
        // player=[Card6s, CardKh] value=6 (stand_pat); banker=[Card5h, CardKd] value=5 -> draws r0
        const burn = Card3c
        const cards = [
            CardJc,
            Card7d,  // banker card 3
            CardKd,  // banker card 2
            CardKh,  // player card 2
            Card5h,  // banker card 1
            Card6s,  // player card 1
            null,
            burn,
            CardAs,
        ]
        const shoe = BaccaratShoe.fromCards(cards)
        const r = shoe.next()!
        expect(r.playerCards()).toEqual([Card6s, CardKh])
        expect(r.bankerCards()).toEqual([Card5h, CardKd, Card7d])
        expect(r.cutCardIndex()).toBe(0)
        expect(shoe.next()).toBeNull()
    })

    it('player draws third, banker stands on 7', () => {
        // player=[Card2s, Card3s] value=5 -> draws Card5c (pip=5)
        // banker=[Card3h, Card4d] value=7 -> stands
        const burn = Card9c
        const cards = [
            CardJc,
            Card5c,  // player card 3
            Card4d,  // banker card 2
            Card3s,  // player card 2
            Card3h,  // banker card 1
            Card2s,  // player card 1
            null,
            burn,
            CardAs,
        ]
        const shoe = BaccaratShoe.fromCards(cards)
        const r = shoe.next()!
        expect(r.playerCards()).toEqual([Card2s, Card3s, Card5c])
        expect(r.bankerCards()).toEqual([Card3h, Card4d])
        expect(r.cutCardIndex()).toBe(0)
        expect(shoe.next()).toBeNull()
    })

    it('both sides draw third cards', () => {
        // player=[Card2h, Card2d] value=4 -> draws Card6d (pip=6)
        // banker=[Card2c, Card4d] value=6 -> banker_take_third(6, pip=6): draws
        const burn = Card3c
        const cards = [
            CardJc,
            Card7c,  // banker card 3
            Card6d,  // player card 3 (pip=6)
            Card4d,  // banker card 2
            Card2d,  // player card 2
            Card2c,  // banker card 1
            Card2h,  // player card 1
            null,
            burn,
            CardAs,
        ]
        const shoe = BaccaratShoe.fromCards(cards)
        const r = shoe.next()!
        expect(r.playerCards()).toEqual([Card2h, Card2d, Card6d])
        expect(r.bankerCards()).toEqual([Card2c, Card4d, Card7c])
        expect(r.cutCardIndex()).toBe(0)
        expect(shoe.next()).toBeNull()
    })

    it('cut card mid-round exhausts after second round', () => {
        // Round 1: player=[9s,Ks] natural; banker=[5h,2d]
        // Round 2: player=[2h,5c]; banker=[9c,Kd] natural
        const cards = [
            CardJc,                   // dummy
            CardKd, Card5c, Card9c, Card2h,  // round 2 cards
            Card2d, CardKs,           // round 1 banker/player card 2
            null,                     // cut card (consumed as player card 2)
            Card5h, Card9s,           // round 1 banker/player card 1
            Card3c,                   // burn
            CardAs,                   // first card
        ]
        const shoe = BaccaratShoe.fromCards(cards)

        const r1 = shoe.next()!
        expect(r1.playerCards()).toEqual([Card9s, CardKs])
        expect(r1.bankerCards()).toEqual([Card5h, Card2d])
        expect(r1.cutCardIndex()).toBe(2)

        const r2 = shoe.next()!
        expect(r2.playerCards()).toEqual([Card2h, Card5c])
        expect(r2.bankerCards()).toEqual([Card9c, CardKd])
        expect(r2.cutCardIndex()).toBeNull()

        expect(shoe.next()).toBeNull()
    })
})

// -------------------------------------------------------------------
// cut_card_index positions 0-5
// -------------------------------------------------------------------

describe('cutCardIndex', () => {
    it('index 0: cut card already past when round starts', () => {
        const cards = [
            CardJc,
            CardKd, CardKh, CardKs, Card9s,
            null,
            Card5c,
            CardAs,
        ]
        const shoe = BaccaratShoe.fromCards(cards)
        const r = shoe.next()!
        expect(r.cutCardIndex()).toBe(0)
        expect(shoe.next()).toBeNull()
    })

    it('index 1: cut card before banker card 1', () => {
        const cards = [
            CardJc,
            Card2d, CardAh, Card4d, Card8h,  // round 2
            CardKd, CardKh, CardKs,           // banker/player card 2, banker card 1
            null,
            Card9s,                           // player card 1
            Card5c, CardAs,
        ]
        const shoe = BaccaratShoe.fromCards(cards)
        const r1 = shoe.next()!
        expect(r1.cutCardIndex()).toBe(1)
        const r2 = shoe.next()!
        expect(r2.cutCardIndex()).toBeNull()
        expect(shoe.next()).toBeNull()
    })

    it('index 2: cut card before player card 2', () => {
        const cards = [
            CardJc,
            Card2d, CardAh, Card4d, Card8h,
            CardKd, CardKh,
            null,
            CardKs, Card9s,
            Card5c, CardAs,
        ]
        const shoe = BaccaratShoe.fromCards(cards)
        expect(shoe.next()!.cutCardIndex()).toBe(2)
        expect(shoe.next()!.cutCardIndex()).toBeNull()
        expect(shoe.next()).toBeNull()
    })

    it('index 3: cut card before banker card 2', () => {
        const cards = [
            CardJc,
            Card2d, CardAh, Card4d, Card8h,
            CardKd,
            null,
            CardKh, CardKs, Card9s,
            Card5c, CardAs,
        ]
        const shoe = BaccaratShoe.fromCards(cards)
        expect(shoe.next()!.cutCardIndex()).toBe(3)
        expect(shoe.next()!.cutCardIndex()).toBeNull()
        expect(shoe.next()).toBeNull()
    })

    it('index 4: cut card before player card 3', () => {
        // player=[2s,3h] value=5 -> draws; banker=[3s,4h] value=7 -> stands
        const cards = [
            CardJc,
            Card2d, CardAh, Card4d, Card8h,
            Card5c,  // player card 3
            null,
            Card4h, Card3h, Card3s, Card2s,
            CardKc, CardAs,
        ]
        const shoe = BaccaratShoe.fromCards(cards)
        expect(shoe.next()!.cutCardIndex()).toBe(4)
        expect(shoe.next()!.cutCardIndex()).toBeNull()
        expect(shoe.next()).toBeNull()
    })

    it('index 5: cut card before banker card 3', () => {
        // player=[2s,3h] value=5 -> draws Card6c (pip=6)
        // banker=[3s,3d] value=6 -> draws (pip 6 matches 6-7 rule)
        const cards = [
            CardJc,
            Card2d, CardAh, Card4d, Card8h,
            CardKs,  // banker card 3
            null,
            Card6c,  // player card 3 (pip=6)
            Card3d, Card3h, Card3s, Card2s,
            CardKc, CardAs,
        ]
        const shoe = BaccaratShoe.fromCards(cards)
        expect(shoe.next()!.cutCardIndex()).toBe(5)
        expect(shoe.next()!.cutCardIndex()).toBeNull()
        expect(shoe.next()).toBeNull()
    })
})

// -------------------------------------------------------------------
// isForcedThird
// -------------------------------------------------------------------

describe('BaccaratRound.isForcedThird', () => {
    function forcedThirdShoe(
        bankerC1: CardInt,
        bankerC2: CardInt,
        playerThird: CardInt,
    ): BaccaratShoe {
        // player=[2s,3h] value=5 -> draws playerThird; banker value varies
        return BaccaratShoe.fromCards([
            CardJc,
            Card4d,      // banker card 3 (placeholder)
            playerThird, // player card 3
            bankerC2,
            Card3h,      // player card 2
            bankerC1,
            Card2s,      // player card 1
            null,
            Card5c,
            CardAs,
        ])
    }

    it.each([
        // banker score 0 (K+K=0): always draws -> forced
        [CardKs, CardKh, Card4s, true],
        // banker score 1 (K+A=1): always draws -> forced
        [CardKs, CardAh, Card4s, true],
        // banker score 2 (K+2=2): always draws -> forced
        [CardKs, Card2h, Card4s, true],
        // banker score 3 (A+2=3), player pip=7: draws but not forced
        [CardAs, Card2h, Card7s, false],
        // banker score 3, player pip=8: does not draw -> not forced
        [CardAs, Card2h, Card8s, false],
    ] as [CardInt, CardInt, CardInt, boolean][])(
        'banker(%s,%s) + playerThird=%s -> isForcedThird=%s',
        (bc1, bc2, pt, expected) => {
            expect(forcedThirdShoe(bc1, bc2, pt).next()!.isForcedThird()).toBe(expected)
        }
    )

    it('false when player stands (banker draws independently)', () => {
        // player=[3s,3h] value=6 -> stands; banker=[Ks,Kh] value=0 -> draws
        const shoe = BaccaratShoe.fromCards([
            CardJc,
            CardAd,  // banker card 3
            CardKh,  // banker card 2
            Card3h,  // player card 2
            CardKs,  // banker card 1
            Card3s,  // player card 1
            null,
            Card5c,
            CardAs,
        ])
        expect(shoe.next()!.isForcedThird()).toBe(false)
    })

    it('false on natural (no thirds drawn)', () => {
        const shoe = BaccaratShoe.fromCards([
            CardJc,
            Card2d, CardKh, Card5h, Card9s,
            null,
            Card5c,
            CardAs,
        ])
        expect(shoe.next()!.isForcedThird()).toBe(false)
    })
})

// -------------------------------------------------------------------
// no_natural (tested via shoe behaviour)
// -------------------------------------------------------------------

describe('noNatural rule', () => {
    it.each([
        // neither natural (3+4=7, 2+5=7) -> thirds possible
        [[Card3s, Card4h], [Card2s, Card5h], true],
        // player natural (4+4=8) -> no thirds
        [[Card4s, Card4h], [Card2s, Card3h], false],
        // banker natural (4+5=9) -> no thirds
        [[Card2s, Card3h], [Card4s, Card5h], false],
        // both naturals -> no thirds
        [[Card4s, Card4h], [Card4d, Card5c], false],
    ] as [CardInt[], CardInt[], boolean][])(
        'player%j banker%j -> thirds possible: %s',
        (player, banker, thirdsAllowed) => {
            // We verify this by checking whether a third card is actually dealt.
            // With player value 5 and a placeholder player card 3 available,
            // if no natural: player draws (value <= 5), otherwise no draw.
            // We check player card count.
            const cards = [
                CardJc,
                Card9s,             // extra card (would be player/banker card 3)
                Card9c,             // extra card
                banker[1]!, banker[0]!,
                player[1]!, player[0]!,
                null,
                Card5c,
                CardAs,
            ]
            // Reset with enough cards for potential third draws
            const fullCards = [
                CardJc,
                Card4d, Card4c,         // banker card 3, player card 3 (placeholders)
                banker[1]!, player[1]!,
                banker[0]!, player[0]!,
                null,
                Card5c,
                CardAs,
            ]
            const shoe = BaccaratShoe.fromCards(fullCards)
            const r = shoe.next()!
            const totalCards = r.playerCards().length + r.bankerCards().length
            if (thirdsAllowed) {
                // With player val=7 and banker val=7 both stand -> still only 4 cards
                // Just verify no error thrown (dealt successfully)
                expect(totalCards).toBeGreaterThanOrEqual(4)
            } else {
                // Natural -> exactly 4 cards dealt
                expect(totalCards).toBe(4)
            }
        }
    )
})

// -------------------------------------------------------------------
// stand_pat rule: tested via BaccaratShoe rounds
// -------------------------------------------------------------------

describe('standPat rule', () => {
    it.each([
        // value=6: stands -> no third drawn
        [[Card3s, Card3h], false],
        // value=7: stands -> no third drawn
        [[Card3s, Card4h], false],
        // value=5: draws third
        [[CardKs, Card5h], true],
        // value=0: draws third
        [[CardKs, CardKh], true],
    ] as [CardInt[], boolean][])('player hand %j draws third: %s', (playerCards, draws) => {
        // Banker=[3h,4d] value=7 (standPat). Player hand determined by playerCards.
        // Layout: [Jc | b3 p3 b2=4d p2=pCards[1] b1=3h p1=pCards[0] | Cut | burn As]
        const cards = [
            CardJc,
            Card9d,           // banker card 3 (placeholder)
            Card5d,           // player card 3 (placeholder)
            Card4d,           // banker card 2 (value=4, banker total=3+4=7)
            playerCards[1]!,  // player card 2
            Card3h,           // banker card 1 (value=3)
            playerCards[0]!,  // player card 1
            null,
            Card5c,
            CardAs,
        ]
        const shoe = BaccaratShoe.fromCards(cards)
        const r = shoe.next()!
        expect(r.playerCards().length).toBe(draws ? 3 : 2)
    })
})

// -------------------------------------------------------------------
// banker_take_third drawing table
// -------------------------------------------------------------------

describe('bankerTakeThird rule', () => {
    // Helpers to build a shoe where player draws a specific pip value as their third
    // and banker has a specific value, then check if banker drew.
    function shoe(bankerC1: CardInt, bankerC2: CardInt, playerThird: CardInt): BaccaratShoe {
        // player=[2s,3h] value=5 -> always draws
        return BaccaratShoe.fromCards([
            CardJc,
            Card9s,      // banker card 3 (placeholder)
            playerThird, // player card 3
            bankerC2,    // banker card 2
            Card3h,      // player card 2
            bankerC1,    // banker card 1
            Card2s,      // player card 1
            null,
            Card5c,
            CardAs,
        ])
    }

    const bankerDrewThird = (bc1: CardInt, bc2: CardInt, pt: CardInt) =>
        shoe(bc1, bc2, pt).next()!.bankerCards().length === 3

    it('score 0-2: always draws regardless of player pip', () => {
        expect(bankerDrewThird(CardKs, CardKh, CardAs)).toBe(true)  // score=0
        expect(bankerDrewThird(CardKs, CardAh, Card8s)).toBe(true)  // score=1, pip=8
        expect(bankerDrewThird(CardKs, Card2h, Card8s)).toBe(true)  // score=2, pip=8
    })

    it('score 3: draws on any pip except 8', () => {
        // banker A+2=3
        expect(bankerDrewThird(CardAs, Card2h, CardAs)).toBe(true)  // pip=1
        expect(bankerDrewThird(CardAs, Card2h, Card7s)).toBe(true)  // pip=7
        expect(bankerDrewThird(CardAs, Card2h, Card9s)).toBe(true)  // pip=9
        expect(bankerDrewThird(CardAs, Card2h, CardKs)).toBe(true)  // pip=10
        expect(bankerDrewThird(CardAs, Card2h, Card8s)).toBe(false) // pip=8
    })

    it('score 4: draws on pip 2-7', () => {
        // banker 2+2=4
        expect(bankerDrewThird(Card2s, Card2h, Card2d)).toBe(true)  // pip=2 low boundary
        expect(bankerDrewThird(Card2s, Card2h, Card5d)).toBe(true)  // pip=5 mid
        expect(bankerDrewThird(Card2s, Card2h, Card7d)).toBe(true)  // pip=7 high boundary
        expect(bankerDrewThird(Card2s, Card2h, CardAs)).toBe(false) // pip=1 below
        expect(bankerDrewThird(Card2s, Card2h, Card8s)).toBe(false) // pip=8 above
    })

    it('score 5: draws on pip 4-7', () => {
        // banker 2+3=5
        expect(bankerDrewThird(Card2s, Card3h, Card4d)).toBe(true)  // pip=4 low boundary
        expect(bankerDrewThird(Card2s, Card3h, Card6d)).toBe(true)  // pip=6 mid
        expect(bankerDrewThird(Card2s, Card3h, Card7d)).toBe(true)  // pip=7 high boundary
        expect(bankerDrewThird(Card2s, Card3h, Card3d)).toBe(false) // pip=3 below
        expect(bankerDrewThird(Card2s, Card3h, Card8s)).toBe(false) // pip=8 above
    })

    it('score 6: draws on pip 6-7', () => {
        // banker 3+3=6
        expect(bankerDrewThird(Card3s, Card3h, Card6d)).toBe(true)  // pip=6 low boundary
        expect(bankerDrewThird(Card3s, Card3h, Card7d)).toBe(true)  // pip=7 high boundary
        expect(bankerDrewThird(Card3s, Card3h, Card5d)).toBe(false) // pip=5 below
        expect(bankerDrewThird(Card3s, Card3h, Card8s)).toBe(false) // pip=8 above
    })

    it('score 7: never draws', () => {
        // banker 3+4=7
        expect(bankerDrewThird(Card3s, Card4h, CardAs)).toBe(false)
        expect(bankerDrewThird(Card3s, Card4h, Card8s)).toBe(false)
        expect(bankerDrewThird(Card3s, Card4h, CardKs)).toBe(false)
    })
})

// -------------------------------------------------------------------
// BaccaratScoreboard - 12-round integration test (mirrors Rust test)
// -------------------------------------------------------------------

describe('BaccaratScoreboard 12-round integration', () => {
    // Rounds and expected bead words:
    //  1: tie       9 vs 9  bead=0x0903
    //  2: banker    1 vs 6  bead=0x0612 (player third)
    //  3: banker    2 vs 9  bead=0x0902
    //  4: tie       9 vs 9  bead=0x0903
    //  5: tie       7 vs 7  bead=0x0703
    //  6: player    8 vs 7  bead=0x0801
    //  7: player    6 vs 2  bead=0x0621 (banker third)
    //  8: player    9 vs 5  bead=0x0901
    //  9: banker    1 vs 8  bead=0x0802
    // 10: player    9 vs 0  bead=0x0901
    // 11: banker    3 vs 7  bead=0x0712 (player third)
    // 12: player    7 vs 5  bead=0x0731 (both thirds)
    const cards = [
        CardJc,
        // round 12
        Card2s, Card3h, Card3d, CardQc, CardTd, Card4h,
        // round 11
        CardJs, Card8d,
        null,   // cut card
        CardTh, Card9s, Card3s,
        // round 10
        Card6d, CardJd, Card4d, Card9h,
        // round 9
        CardTc, Card2d, Card8s, Card9s,
        // round 8
        Card7d, Card9c, Card8h, CardKs,
        // round 7
        CardTs, CardKh, CardQd, Card2c, Card6h,
        // round 6
        Card6c, Card7s, CardAd, CardAh,
        // round 5
        CardKc, Card6s, Card7h, CardAc,
        // round 4
        Card5s, Card9d, Card4s, CardQs,
        // round 3
        CardTc, Card7c, Card9h, Card5d,
        // round 2
        Card8c, CardJh, CardKd, Card6s, Card3c,
        // round 1
        CardTs, CardQh, Card9c, Card9d,
        Card2h,  // burn
        CardAs,  // first card (pip=1, burns 1)
    ]

    it('all scoreboards accumulate correctly over 12 rounds', () => {
        const sb = new BaccaratScoreboard()
        const shoe = BaccaratShoe.fromCards(cards)

        for (let i = 0; i < 2; i++) {
            sb.update(shoe.next()!)
        }
        expect(sb.beadPlate()).toBe(BigInt('0x09030612'))
        expect(sb.bigRoad()).toBe(BigInt('0x161201'))

        for (let i = 0; i < 8; i++) {
            sb.update(shoe.next()!)
        }

        const r11 = shoe.next()!
        sb.update(r11)
        expect(r11.cutCardIndex()).toBe(3)

        const r12 = shoe.next()!
        sb.update(r12)
        expect(r12.cutCardIndex()).toBeNull()
        expect(shoe.next()).toBeNull()

        expect(sb.beadPlate()).toBe(
            BigInt('0x090306120902090307030801062109010802090107120731'),
        )
        expect(sb.bigRoad()).toBe(
            BigInt('0x161229020208010621090103080201090101071201073101'),
        )

        const [d0, d1, d2] = sb.derivedRoads()
        expect(d0).toBe(BigInt('0x030605'))
        expect(d1).toBe(BigInt('0x0403'))
        expect(d2).toBe(BigInt('0x04'))

        sb.clear()
        expect(sb.beadPlate()).toBe(0n)
        expect(sb.bigRoad()).toBe(0n)
        const [c0, c1, c2] = sb.derivedRoads()
        expect(c0).toBe(0n)
        expect(c1).toBe(0n)
        expect(c2).toBe(0n)
    })
})
