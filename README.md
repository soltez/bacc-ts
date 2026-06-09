# bacc-ts

A fast and memory-efficient Baccarat engine for calculating results, scoreboards,
and related statistics. TypeScript port of
[bacc-rs](https://github.com/soltez/bacc-rs).

## Features

- Cactus Kev 32-bit card integer encoding for compact, fast card representation
- Multi-deck shoe with configurable penetration, shuffle passes, and burn ritual
- Full baccarat third-card rules (natural, player draw, banker draw table)
- Round encoding: outcome, pair flags, third-card flags, and hand values packed
  into a single integer
- Five standard scoreboards: bead plate, big road, Big Eye Boy, Small Road,
  Cockroach Pig
- All scoreboards returned as `bigint` (big-endian byte stream) for compact
  serialization
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

console.log(scoreboard.beadPlate().toString(16))
console.log(scoreboard.bigRoad().toString(16))

const [bigEyeBoy, smallRoad, cockroachPig] = scoreboard.derivedRoads()
```

### Inspect individual rounds

```ts
const shoe = BaccaratShoe.new(6, 3, 0.8)

let round = shoe.next()
while (round !== null) {
    const encoded = round.encode()
    const outcome = encoded & 0x3           // 1=player, 2=banker, 3=tie
    const playerPair = (encoded >>> 2) & 1
    const bankerPair = (encoded >>> 3) & 1
    const playerValue = (encoded >>> 8) & 0xf
    const bankerValue = (encoded >>> 12) & 0xf

    console.log({ outcome, playerPair, bankerPair, playerValue, bankerValue })
    console.log('player cards:', round.playerCards())
    console.log('banker cards:', round.bankerCards())

    // null if cut card not seen this round; index 0-5 if seen
    if (round.cutCardIndex() !== null) {
        console.log('cut card encountered at position', round.cutCardIndex())
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
shoe.cut(0.8)

console.log('stub size:', shoe.stubSize())

let card = shoe.deal()
while (card !== undefined) {
    if (card === null) console.log('cut card reached')
    else console.log('dealt:', card)
    card = shoe.deal()
}
```

## Round encoding

`BaccaratRound.encode()` packs the round result into a single 32-bit integer:

| Bits  | Field               | Values                        |
|-------|---------------------|-------------------------------|
| 1-0   | Outcome             | 1=player, 2=banker, 3=tie     |
| 2     | Player pair         | 1=yes, 0=no                   |
| 3     | Banker pair         | 1=yes, 0=no                   |
| 4     | Player drew third   | 1=yes, 0=no                   |
| 5     | Banker drew third   | 1=yes, 0=no                   |
| 11-8  | Player hand value   | 0-9                           |
| 15-12 | Banker hand value   | 0-9                           |

## Scoreboard encoding

All scoreboards are returned as `bigint` values where the oldest entry sits at
the most significant byte. Pass them directly to a WASM layer or serialize with
`.toString(16)`.

- **Bead plate** -- 2 bytes per round in chronological order.
- **Big road** -- variable-width columns; each column is `2*rowCount+1` bytes.
- **Derived roads** (Big Eye Boy, Small Road, Cockroach Pig) -- run-length
  encoded; each byte is `(runLength << 1) | icon` where icon 1=red, 0=blue.

## License

LGPL-3.0-only
