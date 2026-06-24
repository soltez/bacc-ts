import { type CardInt, rankOf, cardToU8 } from './kev.js'
import { type Card, Shoe } from './shoe.js'

export { type CardInt, makeCard, rankOf, suitOf, cardToU8, DECK } from './kev.js'
export * from './kev.js'
export { type Card, Shoe } from './shoe.js'

// Returns the baccarat pip value of a single card.
//
// | Rank                   | Value |
// |------------------------|-------|
// | Ace                    | 1     |
// | 2-9                    | pip   |
// | Ten, Jack, Queen, King | 10    |
function pipValue(card: CardInt): number {
    const rank = rankOf(card)
    if (rank === 12) return 1  // Ace
    if (rank >= 8) return 10   // Ten/Jack/Queen/King (ranks 8-11)
    return rank + 2            // Deuce(0) through Nine(7)
}

// Holds the cards dealt to one side (player or banker), up to three cards.
export class BaccaratHand {
    private _cards: CardInt[] = []

    take(card: CardInt): void {
        this._cards.push(card)
    }

    // Returns the baccarat point value of the hand (0-9).
    value(): number {
        return this._cards.reduce((sum, c) => sum + pipValue(c), 0) % 10
    }

    // Returns true if the first two cards share the same rank.
    isPair(): boolean {
        return rankOf(this._cards[0]!) === rankOf(this._cards[1]!)
    }

    // Returns true if the hand contains exactly three cards.
    hasThird(): boolean {
        return this._cards.length === 3
    }

    cards(): readonly CardInt[] {
        return this._cards
    }
}

// A single resolved baccarat round, holding the final hands for both sides.
export class BaccaratRound {
    private player: BaccaratHand
    private banker: BaccaratHand
    private _isForcedThird: boolean
    private _cutCardIndex: number | null

    constructor(
        player: BaccaratHand,
        banker: BaccaratHand,
        isForcedThird: boolean,
        cutCardIndex: number | null,
    ) {
        this.player = player
        this.banker = banker
        this._isForcedThird = isForcedThird
        this._cutCardIndex = cutCardIndex
    }

    // Encodes the full card sequence and metadata of this round as a 16-char hex string (u64).
    //
    // Bit layout (big-endian u64):
    //   bits 55-48: auxNib = (forcedThird << 3) | cut_card_index_1indexed
    //   bits 47-40: banker card 3 (cdhsrrrr), or 0 if not drawn
    //   bits 39-32: player card 3 (cdhsrrrr), or 0 if not drawn
    //   bits 31-24: banker card 2 (cdhsrrrr)
    //   bits 23-16: player card 2 (cdhsrrrr)
    //   bits 15-8:  banker card 1 (cdhsrrrr)
    //   bits  7-0:  player card 1 (cdhsrrrr)
    //
    // Each cdhsrrrr byte: bits 7-4 = suit nibble, bits 3-0 = rank index.
    encode(): string {
        const cut = this._cutCardIndex === null ? 0 : this._cutCardIndex + 1
        const auxNib = ((this._isForcedThird ? 1 : 0) << 3) | cut
        const pc = this.player.cards()
        const bc = this.banker.cards()
        const p2 = pc.length > 2 ? cardToU8(pc[2]!) : 0
        const b2 = bc.length > 2 ? cardToU8(bc[2]!) : 0
        const n = BigInt(auxNib) << 48n
            | BigInt(b2) << 40n
            | BigInt(p2) << 32n
            | BigInt(cardToU8(bc[1]!)) << 24n
            | BigInt(cardToU8(pc[1]!)) << 16n
            | BigInt(cardToU8(bc[0]!)) << 8n
            | BigInt(cardToU8(pc[0]!))
        return n.toString(16).padStart(16, '0')
    }

    playerCards(): readonly CardInt[] {
        return this.player.cards()
    }

    bankerCards(): readonly CardInt[] {
        return this.banker.cards()
    }

    // Returns true if the banker's pre-draw score was 0-2 and the player drew a third card.
    isForcedThird(): boolean {
        return this._isForcedThird
    }

    // Returns the index of the cut card within this round's dealing sequence, or null.
    //
    // Index counts dealt positions starting at 0:
    //   0=player card 1, 1=banker card 1, 2=player card 2, 3=banker card 2,
    //   4=player card 3 (if drawn), 5=banker card 3 (if drawn).
    //
    // 0: cut card was past when round started; this is the last round.
    // 1-5: cut card consumed mid-round; one more round will be dealt.
    // null: cut card not seen this round.
    cutCardIndex(): number | null {
        return this._cutCardIndex
    }
}

// A baccarat shoe that deals BaccaratRounds. Implements the Iterable protocol
// so rounds can be consumed with a for...of loop.
export class BaccaratShoe implements Iterable<BaccaratRound> {
    private shoe: Shoe
    private isExhausted: boolean

    private constructor(shoe: Shoe) {
        this.shoe = shoe
        this.isExhausted = false
        this.applyBurnRitual()
    }

    // Creates a new BaccaratShoe with a freshly shuffled shoe of numDecks decks.
    // passes controls the number of shuffle passes applied before cutting.
    // pen sets what fraction of the shoe is dealt before the cut card (e.g. 0.965).
    // The burn ritual is applied: first card is exposed and that many cards are discarded.
    static new(numDecks: number, passes: number, pen: number): BaccaratShoe {
        const shoe = Shoe.new(numDecks)
        shoe.shuffle(passes)
        shoe.cut(pen)
        if (shoe.stubSize() < 12) {
            throw new Error(
                `pen leaves fewer than 12 cards after the cut card for a ${numDecks}-deck shoe`,
            )
        }
        return new BaccaratShoe(shoe)
    }

    // Creates a BaccaratShoe from a pre-built array of Cards (useful for testing).
    // The array must contain exactly one cut card (null).
    static fromCards(cards: Card[]): BaccaratShoe {
        return new BaccaratShoe(Shoe.from(cards))
    }

    private applyBurnRitual(): void {
        const first = this.shoe.deal()
        if (first === undefined) throw new Error('shoe is non-empty')
        if (first === null) throw new Error('cut card dealt as first card')
        this.shoe.burn(pipValue(first))
    }

    // Deals and returns the next BaccaratRound, or null when the shoe is exhausted.
    //
    // Third-card rules applied per standard baccarat:
    //   - natural (8 or 9) on either side: no further cards drawn.
    //   - player draws on 0-5; stands on 6-7.
    //   - if player drew: banker draws per the standard drawing table.
    //   - if player stood: banker draws independently on 0-5.
    next(): BaccaratRound | null {
        if (this.isExhausted) return null

        const player = new BaccaratHand()
        const banker = new BaccaratHand()
        let bankerForcedThird = false
        let cutCardIndex: number | null = null
        let cardIndex = 0

        if (this.shoe.hasReachedCutCard()) this.isExhausted = true

        const deal = (): CardInt => {
            let sawCut = false
            for (;;) {
                const card = this.shoe.deal()
                if (card === undefined) throw new Error('shoe unexpectedly empty')
                if (card === null) { sawCut = true; continue }
                if (sawCut) cutCardIndex = cardIndex
                cardIndex++
                return card
            }
        }

        player.take(deal())
        banker.take(deal())
        player.take(deal())
        banker.take(deal())

        if (noNatural(player, banker)) {
            if (!standPat(player)) {
                const playerThird = deal()
                player.take(playerThird)
                if (bankerTakeThird(banker, playerThird)) {
                    bankerForcedThird = banker.value() <= 2
                    banker.take(deal())
                }
            } else if (!standPat(banker)) {
                banker.take(deal())
            }
        }

        return new BaccaratRound(player, banker, bankerForcedThird, cutCardIndex)
    }

    [Symbol.iterator](): Iterator<BaccaratRound> {
        return {
            next: () => {
                const round = this.next()
                if (round === null) return { done: true as const, value: undefined }
                return { done: false, value: round }
            },
        }
    }
}

// Returns true if neither hand holds a natural (8 or 9). Third-card rules
// only apply when both sides score 0-7 on their initial two cards.
function noNatural(p: BaccaratHand, b: BaccaratHand): boolean {
    return p.value() <= 7 && b.value() <= 7
}

// Returns true if the hand scores 6 or 7 and must stand pat.
function standPat(hand: BaccaratHand): boolean {
    const v = hand.value()
    return v === 6 || v === 7
}

// Returns true if the banker draws a third card given the player's third card.
//
// | Banker score | Draws when player third card pip is |
// |--------------|-------------------------------------|
// | 0-2          | Always                              |
// | 3            | Any except 8                        |
// | 4            | 2-7                                 |
// | 5            | 4-7                                 |
// | 6            | 6-7                                 |
// | 7            | Never                               |
function bankerTakeThird(bankerHand: BaccaratHand, playerThirdCard: CardInt): boolean {
    const p = pipValue(playerThirdCard)
    switch (bankerHand.value()) {
        case 0: case 1: case 2: return true
        case 3: return p !== 8
        case 4: return p >= 2 && p <= 7
        case 5: return p >= 4 && p <= 7
        case 6: return p === 6 || p === 7
        default: return false
    }
}

// Tracks the five standard baccarat scoreboards for a running shoe.
//
// Call update() after each round dealt by BaccaratShoe to advance them.
// All scoreboards are stored as byte arrays; bead_plate(), big_road(), and
// derived_roads() return them as bigints via big-endian byte interpretation.
export class BaccaratScoreboard {
    // Two bytes per bead in chronological order (oldest at index 0, newest at end).
    // Each bead word: bits 11-8=winner value, bits 5-4=third flags,
    //   bits 3-2=pair flags, bits 1-0=outcome.
    private beadPlateBytes: number[] = []

    // Columns in chronological order (oldest at index 0, newest at end).
    // Each column: [val0, out0, ..., valn, outn, rowCount] = (2*rowCount+1) bytes.
    // val=winner value byte, out=outcome/pair/third byte.
    private bigRoadBytes: number[] = []

    // Row counts of the five most recent columns (index 0=current). Updated O(1) per round.
    private colHeights: number[] = [0, 0, 0, 0, 0]

    // [BigEyeBoy, SmallRoad, CockroachPig] - run-length encoded, oldest at index 0.
    // Each byte: bits 7-1=run length, bit 0=icon (1=red, 0=blue).
    private derivedRoadBytes: [number[], number[], number[]] = [[], [], []]

    // Updates all five scoreboards immediately after a completed round.
    update(round: BaccaratRound): void {
        const bead = BaccaratScoreboard.beadWord(round)
        const isTie = (bead & 0x3) === 0x3
        this.updateBeadPlate(bead)
        this.updateBigRoad(bead, isTie)
        if (!isTie) this.updateDerivedRoads()
    }

    // Resets all five scoreboards to zero.
    clear(): void {
        this.beadPlateBytes = []
        this.bigRoadBytes = []
        this.colHeights = [0, 0, 0, 0, 0]
        this.derivedRoadBytes = [[], [], []]
    }

    // Returns the bead plate as a lowercase hex string (oldest bead at MSB).
    // Matches BaccScoreboard::encode() in bacc-core-rs.
    encode(): string {
        return this.beadPlateBytes.map(b => b.toString(16).padStart(2, '0')).join('')
    }

    // Computes the 16-bit bead word from a round's outcome.
    //
    // Result bit layout:
    //   bits 11-8: winner's hand value (banker value if banker wins, else player)
    //   bits  5-4: third card flags
    //   bits  3-2: pair flags
    //   bits  1-0: outcome (1=player, 2=banker, 3=tie)
    private static beadWord(round: BaccaratRound): number {
        const pc = round.playerCards()
        const bc = round.bankerCards()
        const pv = pc.reduce((s, c) => s + pipValue(c), 0) % 10
        const bv = bc.reduce((s, c) => s + pipValue(c), 0) % 10
        const marker = pv > bv ? 1 : pv < bv ? 2 : 3
        const playerPair = rankOf(pc[0]!) === rankOf(pc[1]!) ? 1 : 0
        const bankerPair = rankOf(bc[0]!) === rankOf(bc[1]!) ? 1 : 0
        const playerThird = pc.length === 3 ? 1 : 0
        const bankerThird = bc.length === 3 ? 1 : 0
        const handVal = marker === 2 ? bv : pv
        const lowByte = marker | (playerPair << 2) | (bankerPair << 3) | (playerThird << 4) | (bankerThird << 5)
        return (handVal << 8) | lowByte
    }

    private updateBeadPlate(bead: number): void {
        this.beadPlateBytes.push((bead >>> 8) & 0xff, bead & 0xff)
    }

    // Advances the big road by one round.
    //
    // Transitions:
    //   initial round         - write first bead, set rowCount=1.
    //   tie                   - increment tie counter nibble; column unchanged.
    //   opening ties resolved - write first real bead into the pending-tie column.
    //   column hit (same side)  - grow current column by one row.
    //   new column (other side) - archive current column, start a fresh one.
    private updateBigRoad(bead: number, isTie: boolean): void {
        const val = (bead >>> 8) & 0xff
        const out = bead & 0xff

        if (this.bigRoadBytes.length === 0) {
            if (isTie) {
                this.bigRoadBytes.push(0x10, out, 0)
                // colHeights stays [0,...]: rowCount=0 signals no real row yet
            } else {
                this.bigRoadBytes.push(val, out, 1)
                this.colHeights[0] = 1
            }
            return
        }

        const len = this.bigRoadBytes.length
        const lastOutcome = this.bigRoadBytes[len - 2]! & 0x3
        const isShoeTieStart = lastOutcome === 0x3
        const isColumnHit = lastOutcome === (out & 0x3)

        if (isTie) {
            const b = this.bigRoadBytes[len - 3]!
            this.bigRoadBytes[len - 3] = b < 0xf0 ? b + 0x10 : b
        } else if (isShoeTieStart) {
            this.bigRoadBytes[len - 3] = this.bigRoadBytes[len - 3]! | val
            this.bigRoadBytes[len - 2] = out
            this.bigRoadBytes[len - 1] = 1
            this.colHeights[0] = 1
        } else if (isColumnHit) {
            const rowCnt = this.bigRoadBytes.pop()!
            this.bigRoadBytes.push(val, out, rowCnt + 1)
            this.colHeights[0]++
        } else {
            this.bigRoadBytes.push(val, out, 1)
            this.colHeights.copyWithin(1, 0, 4)
            this.colHeights[0] = 1
        }
    }

    // Pushes one run-length-encoded icon onto derivedRoadBytes[roadIdx].
    // Matching icon: increment run length (byte += 2).
    // New icon: push fresh byte (2 | icon).
    private pushDerivedRoadIcon(roadIdx: number, icon: number): void {
        const road = this.derivedRoadBytes[roadIdx]!
        if (road.length === 0) {
            road.push(2 | icon)
        } else {
            const lastIcon = road[road.length - 1]! & 1
            if (icon === lastIcon) {
                road[road.length - 1]! += 2
            } else {
                road.push(2 | icon)
            }
        }
    }

    // Updates BigEyeBoy (i=1), SmallRoad (i=2), CockroachPig (i=3).
    //
    // For each road at offset i:
    //   new column (height=1): red (1) if colHeights[i]==colHeights[i+1], else blue (0).
    //   growing column:        red (1) if colHeights[0]!=colHeights[i]+1, else blue (0).
    private updateDerivedRoads(): void {
        for (let i = 1; i <= 3; i++) {
            const hasRefCol = this.colHeights[i + 1]! > 0
            const hasGrowingCol = this.colHeights[i]! > 0 && this.colHeights[0]! > 1
            if (!hasRefCol && !hasGrowingCol) continue

            const icon =
                this.colHeights[0] === 1
                    ? (this.colHeights[i] === this.colHeights[i + 1] ? 1 : 0)
                    : (this.colHeights[0] !== this.colHeights[i]! + 1 ? 1 : 0)

            this.pushDerivedRoadIcon(i - 1, icon)
        }
    }
}

