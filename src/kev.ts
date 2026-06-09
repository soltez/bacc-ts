// Cactus Kev 32-bit card integer encoding.
//
// Bit layout:
//   bits 28-16: one-hot rank bit
//   bits 15-12: suit nibble (8=clubs, 4=diamonds, 2=hearts, 1=spades)
//   bits 11-8:  rank index (0=Deuce, ..., 12=Ace)
//   bits  5-0:  rank prime  (Deuce=2, Trey=3, ..., Ace=41)

export type CardInt = number

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41] as const

export function makeCard(rank: number, suit: number): CardInt {
    return PRIMES[rank]! | (rank << 8) | (suit << 12) | ((1 << rank) << 16)
}

// rank index extracted from bits 11-8
export function rankOf(card: CardInt): number {
    return (card >>> 8) & 0xf
}

// suit nibble extracted from bits 15-12
export function suitOf(card: CardInt): number {
    return (card >>> 12) & 0xf
}

// rank 0=Deuce, 1=Trey, ..., 12=Ace
// suit 1=spade, 2=heart, 4=diamond, 8=club

export const Card2s = makeCard(0, 1)
export const Card3s = makeCard(1, 1)
export const Card4s = makeCard(2, 1)
export const Card5s = makeCard(3, 1)
export const Card6s = makeCard(4, 1)
export const Card7s = makeCard(5, 1)
export const Card8s = makeCard(6, 1)
export const Card9s = makeCard(7, 1)
export const CardTs = makeCard(8, 1)
export const CardJs = makeCard(9, 1)
export const CardQs = makeCard(10, 1)
export const CardKs = makeCard(11, 1)
export const CardAs = makeCard(12, 1)

export const Card2h = makeCard(0, 2)
export const Card3h = makeCard(1, 2)
export const Card4h = makeCard(2, 2)
export const Card5h = makeCard(3, 2)
export const Card6h = makeCard(4, 2)
export const Card7h = makeCard(5, 2)
export const Card8h = makeCard(6, 2)
export const Card9h = makeCard(7, 2)
export const CardTh = makeCard(8, 2)
export const CardJh = makeCard(9, 2)
export const CardQh = makeCard(10, 2)
export const CardKh = makeCard(11, 2)
export const CardAh = makeCard(12, 2)

export const Card2d = makeCard(0, 4)
export const Card3d = makeCard(1, 4)
export const Card4d = makeCard(2, 4)
export const Card5d = makeCard(3, 4)
export const Card6d = makeCard(4, 4)
export const Card7d = makeCard(5, 4)
export const Card8d = makeCard(6, 4)
export const Card9d = makeCard(7, 4)
export const CardTd = makeCard(8, 4)
export const CardJd = makeCard(9, 4)
export const CardQd = makeCard(10, 4)
export const CardKd = makeCard(11, 4)
export const CardAd = makeCard(12, 4)

export const Card2c = makeCard(0, 8)
export const Card3c = makeCard(1, 8)
export const Card4c = makeCard(2, 8)
export const Card5c = makeCard(3, 8)
export const Card6c = makeCard(4, 8)
export const Card7c = makeCard(5, 8)
export const Card8c = makeCard(6, 8)
export const Card9c = makeCard(7, 8)
export const CardTc = makeCard(8, 8)
export const CardJc = makeCard(9, 8)
export const CardQc = makeCard(10, 8)
export const CardKc = makeCard(11, 8)
export const CardAc = makeCard(12, 8)

// Standard 52-card deck in suit order: spades, hearts, diamonds, clubs.
// Within each suit: A K Q J T 9 8 7 6 5 4 3 2 (rank 12 down to 0).
export const DECK: CardInt[] = [
    CardAs, CardKs, CardQs, CardJs, CardTs, Card9s, Card8s, Card7s, Card6s, Card5s, Card4s, Card3s, Card2s,
    CardAh, CardKh, CardQh, CardJh, CardTh, Card9h, Card8h, Card7h, Card6h, Card5h, Card4h, Card3h, Card2h,
    CardAd, CardKd, CardQd, CardJd, CardTd, Card9d, Card8d, Card7d, Card6d, Card5d, Card4d, Card3d, Card2d,
    CardAc, CardKc, CardQc, CardJc, CardTc, Card9c, Card8c, Card7c, Card6c, Card5c, Card4c, Card3c, Card2c,
]
