import { type CardInt, DECK } from './kev.js'

// A Card is either a play card (CardInt) or a cut card (null).
export type Card = CardInt | null

function fisherYates(arr: unknown[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
}

// Multi-deck dealing shoe. Cards are stored in an array and dealt from the end
// (cursor starts at the last index and decrements with each deal).
//
// Index 0 is a sentinel position that is never dealt: deal() returns undefined
// when cursor reaches 0, signalling an empty shoe.
export class Shoe {
    private cards: Card[]
    private cursor: number
    private cutPos: number

    private constructor(cards: Card[], cursor: number, cutPos: number) {
        this.cards = cards
        this.cursor = cursor
        this.cutPos = cutPos
    }

    // Creates a new shoe with numDecks standard 52-card decks. The cut card is
    // placed at index 0 (out of dealing range). Call cut() before dealing.
    static new(numDecks: number): Shoe {
        const capacity = numDecks * DECK.length
        const cards: Card[] = []
        for (let i = 0; i < numDecks; i++) {
            for (const c of DECK) cards.push(c)
        }
        fisherYates(cards)
        cards.push(null) // cut card at index capacity
        // swap cards[0] and cards[capacity]: cut card moves to index 0
        ;[cards[0], cards[capacity]] = [cards[capacity]!, cards[0]!]
        return new Shoe(cards, 0, 0)
    }

    // Creates a Shoe from an ordered array of Cards. The array must contain
    // exactly one cut card (null). Dealing begins from the last element.
    static from(cards: Card[]): Shoe {
        let cutPos = -1
        let extraCut = false
        for (let i = 0; i < cards.length; i++) {
            if (cards[i] === null) {
                if (cutPos === -1) cutPos = i
                else extraCut = true
            }
        }
        if (cutPos === -1) throw new Error('cards must contain a cut card')
        if (extraCut) throw new Error('cards must contain exactly one cut card')
        return new Shoe([...cards], cards.length - 1, cutPos)
    }

    // Returns true when the cursor has reached or passed the cut card position.
    // Also true before cut() has been called (cursor=0 <= cutPos=0).
    hasReachedCutCard(): boolean {
        return this.cursor <= this.cutPos
    }

    // Deals the next card. Returns the card (null for cut, CardInt for play),
    // or undefined when the shoe is exhausted (cursor=0).
    deal(): Card | undefined {
        if (this.cursor > 0) {
            const card = this.cards[this.cursor]!
            this.cursor--
            return card
        }
        return undefined
    }

    // Shuffles all cards n times, moves the cut card back to index 0, and
    // resets cursor and cutPos to 0. Call cut() after this to enable dealing.
    shuffle(n: number): void {
        for (let i = 0; i < n; i++) {
            fisherYates(this.cards)
        }
        // Move cut card (null) back to index 0
        const cutIdx = this.cards.indexOf(null)
        if (cutIdx !== 0) {
            ;[this.cards[0], this.cards[cutIdx]] = [this.cards[cutIdx]!, this.cards[0]!]
        }
        this.cursor = 0
        this.cutPos = 0
    }

    // Places the cut card at a position determined by the penetration ratio pen,
    // where pen is the fraction of the shoe dealt before reshuffling (0.5-1.0).
    // Enables dealing by setting cursor to the last index.
    cut(pen: number): void {
        const last = this.cards.length - 1
        const cutPos = Math.floor((1 - pen) * last)
        // Move cut card from index 0 to cutPos
        ;[this.cards[0], this.cards[cutPos]] = [this.cards[cutPos]!, this.cards[0]!]
        this.cursor = last
        this.cutPos = cutPos
    }

    // Discards n cards by advancing the cursor past them.
    burn(n: number): void {
        if (this.cutPos + n > this.cursor) throw new Error('burning too many cards')
        this.cursor -= n
    }

    // Returns the number of cards that remain after the cut card (stub size).
    stubSize(): number {
        return this.cutPos
    }
}
