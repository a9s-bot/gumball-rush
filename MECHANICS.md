# Gumball Rush Mechanics

## Physics and dispensing

Every visible gumball is a Matter.js body with its own color and rarity. The three bodies nearest the bottom-center intake are highlighted. Nudges and shakes apply forces to those same bodies.

When the player dispenses, the timing grade applies an additional pull to the leading intake candidate. After the short mixing window, the body closest to the intake is removed from the simulation and shown in the chute. A replacement is then spawned at the top of the globe.

## Timing

The timing cursor oscillates across the gauge. The grade is captured when the dispense action starts.

| Grade | Center distance | Order bonus | Intake behavior |
| --- | ---: | ---: | --- |
| Perfect | 9.5% or less | +75 | Locks the primary highlighted body |
| Good | 25% or less | +30 | 72% closest body, 28% secondary body |
| Risky | Outside the good zone | +0 | 15% primary body, 85% secondary body |

Timing bonuses apply when an order is completed. Perfect non-golden drops also count toward the Precision Expert achievement.

## Orders

Three orders are available simultaneously:

| Queue position | Base value |
| --- | ---: |
| First | 100 |
| Second | 65 |
| Third | 40 |

- **Pick:** accepts one color.
- **Either:** accepts either of two colors.
- **Recipe:** requires two colors in sequence. An intermediate recipe step awards 35 points but does not advance the streak.
- **Rush:** accepts one color and applies a 1.5x multiplier.

Completing any queue position replaces that order with a new one.

## Streaks

Completing an order increases the streak by one. The current streak multiplies the order's base value, starting at 1x. Matching no available order resets the streak. Recipe steps and golden gumballs preserve it.

The interface displays five streak segments, but the numerical multiplier can continue beyond 5x.

## Scoring order

For a completed order:

```text
subtotal = queue base value * streak + timing bonus + speed bonus
score = subtotal * rush bonus * round-phase bonus * golden multiplier * power-up multiplier
```

- Speed bonus: +50 when the order is completed within 4.5 seconds of appearing.
- Rush-order bonus: 1.5x.
- Final-phase bonus: 1.5x during the last 10 seconds, or final four Precision drops.
- Golden multiplier: 2x or 4x on the next scoring drop.
- Double Dip: 2x on the next scoring drop.
- A non-matching ball awards a 20-point tray bonus, affected by the final-phase multiplier.

### Example

Completing the first queue order at a 3x streak with Perfect timing and the speed bonus:

```text
100 * 3 + 75 + 50 = 425 points
```

If it is also a Rush order during the final phase with a stored golden multiplier:

```text
425 * 1.5 * 1.5 * 2 = 1,912.5, rounded to 1,913 points
```

## Golden gumballs

Golden gumballs are visible inside the globe. Dispensing one awards 100 points and stores a 2x multiplier for the next scoring drop. Dispensing another before scoring can raise the stored multiplier to 4x.

## Power-ups

Completing three orders charges one randomly selected power-up:

- **Color Bomb:** the next non-golden ball completes the best available order.
- **Double Dip:** doubles the next scoring drop.
- **Freeze Pop:** adds four seconds in timed modes.
- **Candy Magnet:** pulls colors used by current orders toward the intake.

Only one power-up can be held at a time.

## Modes

- **Rush:** score as much as possible in 45 seconds.
- **Precision:** score as much as possible with 18 drops.
- **Daily:** a 45-second challenge whose ball colors and initial orders are seeded by the date.

## Controls

| Action | Keyboard |
| --- | --- |
| Start or dispense | Space |
| Nudge left or right | Left / Right |
| Full shake | Up / Down / S |
| Activate power-up | P |
