# bacc-ts

A fast and memory-efficient Baccarat engine for calculating results, scoreboards,
and related statistics. TypeScript port of
[bacc-rs](https://github.com/soltez/bacc-rs).

## Features

- Cactus Kev 32-bit card integer encoding for compact, fast card representation
- Multi-deck shoe with configurable penetration, shuffle passes, and burn ritual
- Full baccarat third-card rules (natural, player draw, banker draw table)
- Round encoding: full card sequence and metadata packed into a 16-char hex string
  compatible with `BaccRound::encode()` in bacc-core-rs
- Scoreboard encoding: bead plate returned as a hex string compatible with
  `BaccScoreboard::encode()` in bacc-core-rs
- Five standard scoreboards tracked internally: bead plate, big road, Big Eye Boy,
  Small Road, Cockroach Pig
- `BaccaratShoe` implements the `Iterable` protocol -- use a `for...of` loop
  or call `next()` manually
- Deterministic shoe construction via `fromCards()` for testing and simulation

## Installation

```sh
npm install bacc-ts
```

## Usage

### Run a full shoe

```ts
import { BaccaratShoe, BaccaratScoreboard } from 'bacc-ts'

const shoe = BaccaratShoe.new(
    8,      // number of decks
    5,      // shuffle passes
    0.965,  // penetration (fraction of shoe dealt before cut card)
)

const scoreboard = new BaccaratScoreboard()

for (const round of shoe) {
    scoreboard.update(round)
}

// hex string compatible with BaccScoreboard::encode() in bacc-core-rs
console.log(scoreboard.encode())
```

### Inspect individual rounds

```ts
const shoe = BaccaratShoe.new(6, 3, 0.965)

let round = shoe.next()
while (round !== null) {
    // 16-char hex string (u64) compatible with BaccRound::encode() in bacc-core-rs
    console.log('encoded:', round.encode())
    console.log('player cards:', round.playerCards())
    console.log('banker cards:', round.bankerCards())
    console.log('forced third:', round.isForcedThird())

    // null if cut card not seen this round; index 0-5 if seen
    if (round.cutCardIndex() !== null) {
        console.log('cut card at position', round.cutCardIndex())
    }

    round = shoe.next()
}
```

### Deterministic shoe from a card list

Useful for unit tests or exact simulations. The array is dealt from the end
(last element first). Exactly one `null` marks the cut card position.

```ts
import { BaccaratShoe, CardAs, CardKs, CardQs, CardJs, Card9s, Card8s } from 'bacc-ts'

// Layout: [stub..., null, ...cards dealt last->first]
// Dealt order: Card8s, Card9s, CardJs, CardQs, CardKs, CardAs
const shoe = BaccaratShoe.fromCards([
    null,
    Card8s, Card9s, CardJs, CardQs, CardKs, CardAs,
    Card8s, Card9s, CardJs, CardQs, CardKs, CardAs,
])
```

### Low-level shoe access

```ts
import { Shoe, DECK, CardAs } from 'bacc-ts'

const shoe = Shoe.new(6)
shoe.shuffle(5)
shoe.cut(0.965)

console.log('stub size:', shoe.stubSize())

let card = shoe.deal()
while (card !== undefined) {
    if (card === null) console.log('cut card reached')
    else console.log('dealt:', card)
    card = shoe.deal()
}
```

## Round encoding

`BaccaratRound.encode()` returns a 16-char lowercase hex string (big-endian u64)
encoding the full card sequence and metadata. Compatible with `BaccRound::encode()`
in bacc-core-rs.

| Bits  | Field          | Notes                                                         |
|-------|----------------|---------------------------------------------------------------|
| 55-48 | Aux nibble     | bit 3 = forced third, bits 2-0 = cut card index (1-indexed)  |
| 47-40 | Banker card 3  | `cdhsrrrr`, or `00` if not drawn                             |
| 39-32 | Player card 3  | `cdhsrrrr`, or `00` if not drawn                             |
| 31-24 | Banker card 2  | `cdhsrrrr`                                                    |
| 23-16 | Player card 2  | `cdhsrrrr`                                                    |
| 15-8  | Banker card 1  | `cdhsrrrr`                                                    |
|  7-0  | Player card 1  | `cdhsrrrr`                                                    |

Each `cdhsrrrr` byte is bits 15-8 of the Cactus Kev integer -- `cdhs` = one-hot suit
nibble (c=clubs, d=diamonds, h=hearts, s=spades), `rrrr` = rank index (0=deuce ... 12=ace).
Absent card slots are `00`.

## Scoreboard encoding

`BaccaratScoreboard.encode()` returns a lowercase hex string of bead words in
chronological order (oldest at MSB). Compatible with `BaccScoreboard::encode()`
in bacc-core-rs.

- **Bead plate** -- 2 bytes per round; bits 15-8 = winner hand value, bits 5-4 = third
  flags, bits 3-2 = pair flags, bits 1-0 = outcome (1=player, 2=banker, 3=tie).
- **Big road**, **derived roads** (Big Eye Boy, Small Road, Cockroach Pig) -- tracked
  internally; use bacc-core-rs `BaccScoreboard::decode()` to reconstruct and simulate.

## License

LGPL-3.0-only
