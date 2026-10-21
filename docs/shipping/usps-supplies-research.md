# USPS shipping supplies research for Good Luck

Prices checked on 2026-10-21. USPS prices quoted are from Price List Notice 123 effective October 4, 2026, which includes the temporary peak-season increase that runs through January 17, 2027; expect a small drop after that date and a new general increase in January 2027. Shippo gives the store USPS Commercial pricing on every label, so the "Commercial" columns below are what the admin sees in the Shipping Label Modal. Anything marked **unverified** could not be confirmed from an official page.

Origin for all zone examples: the store's ship-from ZIP in the Bronx, NY (the `SHIP_FROM_*` env vars read by `convex/shipping/shipFrom.ts`).

---

## 1. TL;DR

### Shopping list to start

| Item | Spec | Where / SKU | Approx cost | Start with |
|---|---|---|---|---|
| Single-cap box | 8 × 8 × 6 in inside, 200# test kraft | Uline S-4083 | $0.80/box, bundle of 25 (~$20 + freight) | 2 bundles (50) |
| Double-cap box | 10 × 8 × 6 in inside, 200# test kraft | Uline S-4103 | $0.74/box, bundle of 25 (~$18.50) | 1 bundle (25) |
| Master carton (3–4 caps) | 12 × 10 × 8 in inside, 200# test kraft | Uline S-4120 | $1.02/box, bundle of 25 (~$25.50) | 1 bundle (25) |
| Tee poly mailer, 1 tee | 10 × 13 in, 3 mil, self-seal | Uline S-21880 series (black S-21880BL) | $30/100 | 1 case (100) |
| Tee poly mailer, 2 tees or tee + hoodie-size | 12 × 15.5 in, 3 mil, self-seal | Uline S-11483 series (black S-11483BL) | $40/100 | 1 case (100) |
| Tissue paper | 20 × 30 in sheets | Uline, e.g. S-14189 Speckled White | $52/bundle of 240 sheets | 1 bundle |
| Dust bags for caps | cotton or satin drawstring, ~10 × 12 in | Amazon / Alibaba, **unverified** pricing ~$0.50–1.00 each | — | 50 |
| Packing tape | 2 in × 110 yd, 2 mil clear | Uline S-423 ($3.75/roll, 18-roll minimum) or any Amazon 6-pack (~$20, **unverified**) | $20–70 | 6 rolls |
| Postal scale | 0–50 lb, 0.1 oz resolution | Accuteck 8250 (Amazon) | ~$25–35 **unverified** | 1 |
| 4 × 6 thermal label printer | Direct thermal, USB (no ink) | Rollo X1038 (USB) ~$180–200; Rollo X1040 wireless $279 MSRP; MUNBYN ITPP941 ~$65–130 | $65–279 (**ranges unverified**, vary by sale) | 1 |
| 4 × 6 direct-thermal labels | 4 × 6 in fanfold or roll, 500/stack | MUNBYN/Rollo/generic (Amazon) | ~$20–25 per 500 **unverified** | 500 |
| Free USPS Priority Mail boxes | Priority Mail Box 4 (7.25 × 7.25 × 6.5 in outside), Medium Flat Rate Box 1 | store.usps.com, free, packs of 10/25 | $0 | 1 pack of 10 each, only for Priority Mail orders |

Freight note: Uline ships from regional warehouses (NJ/PA for the Bronx); shipping on a mixed order of 4 bundles plus mailers is typically $20–40 (**unverified**). Staples/Quill sell 8 × 8 × 6 25-packs at $26–34 with free delivery if a small first order is preferred.

### One-line rule per order type

- **1 cap** -> own 8 × 8 × 6 box, USPS Ground Advantage. Declared weight about 12 oz (cap 3–4 oz + box 7 oz + dust bag/tissue/tape ~1 oz). Commercial price $7.33 (NYC local) to $8.95 (West Coast, zone 8).
- **2 caps** -> own 10 × 8 × 6 box, Ground Advantage. Declared weight about 19 oz, which is the **2 lb** tier ($8.39 local to $13.42 zone 8). The current preset says 13 oz, which is wrong (see section 2).
- **1 tee** -> 10 × 13 poly mailer, Ground Advantage, about 11–14 oz depending on size, under 1 lb ($7.33–8.95).
- **2 tees** -> 12 × 15.5 poly mailer, about 22–27 oz, 2 lb tier.
- **Cap + tee** -> 10 × 8 × 6 box (tee folded flat under the cap) at about 23–25 oz, 2 lb tier, Ground Advantage.
- **3+ caps** -> 12 × 10 × 8 box, 27–35 oz (2 lb or 3 lb tier). Compare UPS Ground and Ground Advantage in the modal; Ground Advantage will usually be cheaper ($8.39–16.30), UPS Ground protects the carton better. Priority Mail only when the customer needs 1–3 day delivery.
- **Never** put a Ground Advantage label on a USPS Priority Mail branded box or envelope. USPS's Automated Package Verification re-rates it to full Priority Mail price.
- **Never** use a poly mailer for a cap (crown crush). The Crown-Safe Packaging Presets entry in CONTEXT.md already says this; it applies to caps only, not to tees.
- **PO Box address** -> USPS only (the PO Box Routing Safeguard already enforces this).

---

## 2. What the code does today

### Presets (`src/components/admin/ShippingLabelModal.tsx` `BOX_PRESETS` and `convex/shipping/functions.ts` `CAP_BOX_PRESETS`)

| id | Name | L × W × H (in) | Declared weight | Default when |
|---|---|---|---|---|
| `one_cap` | 1 Cap Standard | 8 × 8 × 6 | 8 oz | total item quantity <= 1 |
| `two_caps` | 2 Caps Double | 10 × 8 × 6 | 13 oz | quantity == 2 |
| `three_plus_caps` | 3+ Caps Atelier | 12 × 10 × 8 | 20 oz | quantity >= 3 |

The default preset is picked from `totalCaps`, which is the sum of `order.items[].quantity` regardless of whether the item is a Cap or a Heavyweight Tee. A custom dimensions/weight form exists (`selectedPresetId === "custom"`).

### What is sent to Shippo (`getShippingRates`)

- `shippo.shipments.create({ addressFrom: <ship-from from env>, addressTo, parcels: [{ length, width, height, distanceUnit: "in", weight, massUnit: "oz" }], async: false })`.
- Always a custom parcel. The `template` field (USPS Flat Rate / carrier predefined packages) is never used.
- No `extra.insurance`, no `signature_confirmation`, no carrier-account or service-level filter: Shippo returns every rate on the account (USPS, UPS, and whatever else is enabled) and the code sorts by price, tags `CHEAPEST`/`FASTEST`, marks UPS/FedEx as incompatible for PO Box addresses, and adds a "recommended" tag (USPS cheapest for <= 2 items, UPS for >= 3).
- `buyShippingLabel` calls `shippo.transactions.create({ rate, labelFileType: "PDF_4x6" | "PDF", async: false })` and voids the label with `shippo.refunds.create` if the order cannot be updated afterwards.
- Territory guard (`convex/shipping/territory.ts`) rejects PR, GU, VI, MP, AS, military states and non-US before any rate call, so zone 9 prices never apply.
- Test mode: `shippoMode.ts` treats any key not starting with `shippo_live_` as a test key; simulated rates are allowed only with `SHIPPO_ALLOW_SIMULATION=true` and never with a live key. The SDK is `shippo` ^2.18.0 (`package.json`). There is no `.env.example` entry documenting `SHIPPO_API_KEY` or `SHIPPO_WEBHOOK_SECRET` (used in `convex/http.ts`).

### Mismatches with USPS rules and real weights

1. **Declared weights are too low.** Uline publishes bundle weights, which give the box tare: S-4083 (8 × 8 × 6) 11 lb / 25 = **7.0 oz**, S-4103 (10 × 8 × 6) 12 lb / 25 = **7.7 oz**, S-4120 (12 × 10 × 8) 19 lb / 25 = **12.2 oz**. A structured snapback is 3–4 oz. Realistic packed weights: 1 cap ≈ 12 oz (preset 8), 2 caps ≈ 19 oz (preset 13), 3 caps ≈ 27 oz / 4 caps ≈ 31 oz (preset 20). The 2-cap preset is the costly one: 13 oz buys a sub-1-lb label but the parcel is in the 2 lb tier, so USPS's Automated Package Verification will bill the difference to the Shippo account after the fact (plus the risk of a return to sender). For 1 cap the Oct 2026 Commercial price is identical for every sub-1-lb weight, so the 8 oz figure is harmless on price today, but it is still a false declaration and will matter whenever USPS reinstates separate 4/8/12 oz commercial tiers.
2. **No tee preset.** A tee in a 10 × 8 × 6 box pays the same as a cap, but a tee in a poly mailer is lighter and the mailer costs $0.30 instead of $0.74. The item-count default also puts a single tee into the "1 Cap" box.
3. **Inside dimensions are sent, USPS measures outside.** Uline outside dimensions are +3/8 in on L/W and +5/8 in on H. None of the three presets crosses a cubic or DIM boundary because of that, but 10 × 8 × 6 moves from cubic tier 0.30 (inside) to 0.40 (outside, 10.25 × 8.25 × 6.5 rounded down to 1/4 in = 0.318 cu ft). Shippo computes cubic from the dimensions the store sends, so sending inside dimensions could quote a cubic price USPS later re-rates. Send outside dimensions.
4. **Dimensional weight: not a problem.** DIM weight applies only above 1 cu ft (1,728 cu in) and uses divisor 139 since July 12, 2026 (each side rounded up to the whole inch). The largest preset is 12.375 × 10.375 × 8.625 ≈ 0.64 cu ft outside, so all three presets are billed by actual weight.
5. **Cubic pricing: never cheaper for these boxes.** Ground Advantage Cubic tiers for the presets: 8 × 8 × 6 -> 0.30 (0.269 cu ft outside), 10 × 8 × 6 -> 0.40, 12 × 10 × 8 -> 0.70. At the store's weights the weight-based Commercial price is lower in every zone (e.g. 2 lb zone 8 $13.42 vs cubic 0.40 $18.34), so Shippo will keep showing the weight-based rate. Priority Mail Cubic caps at 0.50 cu ft, so only the two smaller boxes qualify. No code change needed; Shippo picks the lower of weight and cubic automatically.
6. **Insurance.** Ground Advantage and Priority Mail include $100 of USPS coverage. A 2-cap order is $130–240+, above the included amount, and the code never passes `extra.insurance`. See section 6.
7. **Flat Rate is never offered.** Not a loss: no Flat Rate box fits a structured cap at a price that beats Ground Advantage (Medium Flat Rate Box 1 is $22.02 Commercial). If the admin ever wants it, the Shippo `template` field is the way (section 6).

---

## 3. USPS supplies

### 3a. Free USPS packaging (Priority Mail and Priority Mail Express only)

Order at https://store.usps.com (Shipping Supplies). Free, no account approval, shipped by Ground Advantage in 2–5 business days (in-stock orders may take 5–7 business days to leave the warehouse). Most items come as single, pack of 10, or pack of 25; the Small Flat Rate Box page allows up to 5 singles, 2 packs of 10, or 28 packs of 25 per order. Also available at any Post Office counter.

Rule (printed on the USPS store page): "Priority Mail Flat Rate shipping supplies may only be used to ship via Priority Mail Flat Rate." The same applies to all Priority-branded packaging versus Ground Advantage: USPS's Automated Package Verification re-rates a Ground Advantage label in Priority packaging to the full Priority Mail price, and covering the branding is also prohibited. Ground Advantage, Media Mail and First-Class Mail get no free packaging.

| USPS name | Store code / common name | Outside dimensions (in) | Inside (in) | Fits a structured cap? | Priority Cubic tier |
|---|---|---|---|---|---|
| Priority Mail Flat Rate Envelope | EP14F | 12.5 × 9.5 | — | No | Flat Rate |
| Priority Mail Padded Flat Rate Envelope | EP14PE | 12.5 × 9.5 | — | No (tee only, if shipped Priority) | Flat Rate |
| Priority Mail Small Flat Rate Box | P_SMALL_FRB | 8 11/16 × 5 7/16 × 1 3/4 | 8 5/8 × 5 3/8 × 1 5/8 | No | Flat Rate |
| Priority Mail Medium Flat Rate Box 1 (top-loading) | O-FRB1 | 11 1/4 × 8 3/4 × 6 | ~11 × 8.5 × 5.5 | Yes, 1 cap (loose) | Flat Rate |
| Priority Mail Medium Flat Rate Box 2 (side-loading) | O-FRB2 | 14 × 12 × 3.5 | — | No (too shallow) | Flat Rate |
| Priority Mail Large Flat Rate Box | LARGEFRB | 12.25 × 12.25 × 6 | ~12 × 12 × 5.5 | Yes, 2–3 caps | Flat Rate |
| Priority Mail Box 4 | O-BOX4 ("7 × 7 × 6") | 7.25 × 7.25 × 6.5 | ~7 × 7 × 6 | Yes, 1 cap, snug | 0.20 |
| Priority Mail Box 1096L | 1096L | 9.25 × 6.25 × 2 | — | No | 0.10 |
| Priority Mail Box 1097 | 1097 | 13 × 11.25 × 2.25 | — | No | 0.20 |
| Priority Mail Box 1092 (Medium, option 1) | P_O_1092 | 13 11/16 × 12 × 2 7/8 | 13 3/8 × 11 7/8 × 2 3/4 | No | 0.30 |
| Priority Mail Box 1095 | 1095 | 15 × 12 × 3.125 | — | No | 0.40 |
| Priority Mail Shoe Box | O-SHOEBOX | 7.25 × 5.25 × 14.75 | — | No (crown) | 0.40 |
| Regional Rate Boxes A/B | — | — | — | Discontinued January 2023; Shippo still lists the tokens | — |
| Priority Mail Express boxes/envelopes | EP13 family | similar to Priority | — | Not relevant | — |

Store codes other than P_SMALL_FRB and P_O_1092 are the common USPS catalog names and are **unverified** against the current store listing; the store search by product name is reliable.

Practical use for Good Luck: order one pack of 10 of **Priority Mail Box 4** and one of **Medium Flat Rate Box 1**. Use them only when the admin chooses a Priority Mail rate (rush order). Everything shipped Ground Advantage goes in a Uline box.

### 3b. Paid USPS packaging

USPS sells "ReadyPost" retail boxes, bubble mailers and tape at Post Office counters. They are plain (usable with Ground Advantage) but cost $2–5 per box at the counter (**unverified**, varies by location) and the sizes do not match the presets. Not recommended except as an emergency single box.

---

## 4. Rate tables (Notice 123 effective 2026-10-04, checked 2026-10-21)

Columns are USPS zones from the Bronx. Rough mapping from the Bronx: Local = NYC/most of Long Island and nearby NJ; 1–2 = tri-state and Hudson Valley; 3 = New England, PA, MD, DE, VA; 4 = OH, NC, SC, WV, parts of the Midwest; 5 = GA, FL (north), IL, MI, TN; 6 = south FL, TX (east), MN, MO; 7 = mountain states, TX (west); 8 = CA, WA, OR, AK, HI. Zone 9 is territories only, which the store does not ship to. Exact zone comes from the USPS zone chart for ZIP prefix 104.

### 4a. USPS Ground Advantage, Commercial (what Shippo charges)

| Weight (declared) | Local | 1–2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 1–4 oz | 7.33 | 7.34 | 7.70 | 7.86 | 8.24 | 8.41 | 8.62 | 8.95 |
| 5–8 oz | 7.33 | 7.34 | 7.70 | 7.86 | 8.24 | 8.41 | 8.62 | 8.95 |
| 9–12 oz | 7.33 | 7.34 | 7.70 | 7.86 | 8.24 | 8.41 | 8.62 | 8.95 |
| 13–15.99 oz | 7.33 | 7.34 | 7.70 | 7.86 | 8.24 | 8.41 | 8.62 | 8.95 |
| 1 lb (16 oz) | 8.01 | 8.08 | 8.40 | 8.55 | 9.29 | 10.18 | 10.53 | 11.22 |
| 2 lb (16.01–32 oz) | 8.39 | 8.48 | 8.66 | 8.91 | 10.50 | 12.13 | 12.55 | 13.42 |
| 3 lb (32.01–48 oz) | 9.04 | 9.06 | 9.54 | 10.07 | 12.12 | 14.14 | 14.91 | 16.30 |

Under the current (peak) Commercial table every sub-1-lb parcel costs the same as 15.99 oz. Plus Shippo's per-label fee ($0.05 on the free plan per Shippo's blog; **unverified** for the store's plan).

### 4b. USPS Ground Advantage, Retail (Post Office counter, for comparison)

| Weight | Local | 1–2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 1–8 oz | 8.40 | 8.55 | 8.65 | 8.80 | 9.35 | 9.50 | 9.70 | 10.20 |
| 9–15.99 oz | 10.05 | 10.45 | 10.70 | 11.10 | 11.70 | 12.10 | 12.70 | 13.65 |
| 1 lb | 10.05 | 10.45 | 10.70 | 11.10 | 11.70 | 12.10 | 12.70 | 13.65 |
| 2 lb | 11.30 | 12.00 | 12.70 | 13.50 | 14.85 | 15.85 | 17.20 | 19.80 |
| 3 lb | 11.80 | 12.50 | 13.15 | 14.20 | 15.70 | 17.20 | 19.70 | 23.15 |

Shippo saves the store roughly $1.10–1.90 per single-cap label and $3–6 per 2-cap label versus the counter.

### 4c. USPS Ground Advantage Cubic, Commercial

| Tier (cu ft up to) | Local | 1–2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 0.10 | 7.85 | 7.91 | 8.23 | 8.39 | 9.04 | 9.76 | 10.08 | 10.68 |
| 0.20 | 8.22 | 8.29 | 8.54 | 8.74 | 9.92 | 11.21 | 11.60 | 12.39 |
| 0.30 | 8.79 | 8.85 | 9.21 | 9.63 | 11.51 | 13.38 | 14.03 | 15.22 |
| 0.40 | 9.72 | 9.78 | 10.16 | 10.99 | 13.48 | 15.71 | 16.66 | 18.34 |
| 0.50 | 10.24 | 10.31 | 10.68 | 11.58 | 14.37 | 16.75 | 17.94 | 19.95 |

Eligibility (DMM 283.1.3): 1 cu ft or less, 20 lb or less, longest side 22 in or less, no tubes. Cubic feet = L × W × H / 1728 with each outside dimension rounded **down** to the nearest 1/4 in. Soft packs (poly mailers) are tiered by length + width instead: up to 21 in = 0.10, 27 in = 0.20, 31 in = 0.30, 34 in = 0.40, 36 in = 0.50. Shippo shows the cubic price automatically when it is lower than the weight price; no template is needed for boxes. Cubic only wins for heavy small parcels (above about 3–5 lb), which the store never ships.

Store boxes: 8 × 8 × 6 = 0.269 cu ft outside -> tier 0.30; 10 × 8 × 6 = 0.318 -> tier 0.40; 12 × 10 × 8 = 0.618 -> tier 0.70; 10 × 13 poly mailer = 23 in -> 0.20; 12 × 15.5 mailer = 27.5 in -> 0.30.

### 4d. USPS Priority Mail, Commercial (1–3 business days, $100 insurance)

| Weight | Local | 1–2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 1 lb | 9.44 | 9.72 | 10.11 | 10.80 | 13.82 | 15.32 | 15.93 | 16.07 |
| 2 lb | 9.50 | 9.79 | 10.18 | 11.19 | 14.02 | 16.19 | 17.16 | 17.22 |
| 3 lb | 9.85 | 10.11 | 11.15 | 13.08 | 17.41 | 19.71 | 21.36 | 21.42 |

Priority Mail has no sub-1-lb tier; everything under 1 lb pays the 1 lb price.

### 4e. USPS Priority Mail Cubic, Commercial (max 0.50 cu ft)

| Tier | Local | 1–2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| 0.10 | 9.46 | 9.74 | 10.13 | 10.90 | 13.87 | 15.54 | 16.24 | 16.36 |
| 0.20 | 9.50 | 9.79 | 10.18 | 11.19 | 14.02 | 16.19 | 17.16 | 17.22 |
| 0.30 | 9.85 | 10.11 | 11.15 | 13.08 | 17.41 | 19.71 | 21.36 | 21.42 |
| 0.40 | 11.71 | 11.94 | 13.28 | 15.77 | 21.98 | 26.63 | 29.00 | 29.05 |
| 0.50 | 12.24 | 12.35 | 13.88 | 16.75 | 24.06 | 29.02 | 31.99 | 32.31 |

The free Priority Mail Box 4 (0.198 cu ft) is tier 0.20 and the 8 × 8 × 6 Uline box is tier 0.30; for a 12 oz cap the weight-based 1 lb price is equal or lower, so cubic adds nothing here either.

### 4f. USPS Priority Mail Flat Rate (any weight to 70 lb, any zone)

| Packaging | Retail | Commercial (Shippo) |
|---|---|---|
| Flat Rate Envelope / Padded / Legal | 13.90 | 11.97 |
| Small Flat Rate Box | 14.65 | 12.95 |
| Medium Flat Rate Box (1 or 2) | 25.80 | 22.02 |
| Large Flat Rate Box | 36.10 | 32.75 |

Flat Rate beats zone pricing only for Medium at 3 lb+ to zone 8 and never for the store's parcels. The Padded Flat Rate Envelope at $11.97 is the one realistic Priority option for a single tee when a customer wants 1–3 day delivery to the West Coast ($16.07 for Priority zone 8 otherwise).

### 4g. Which tier each likely parcel lands in

Item weights: structured snapback 3–4 oz (retailer listings cluster at 3.0–4.1 oz); foam-front trucker 2.5–3.5 oz (**unverified**, lighter mesh back); 280–300 GSM boxy tee, estimated from fabric area (S ≈ 0.9 m², 2XL ≈ 1.2 m²): S 9.5 oz, M 10 oz, L 10.5 oz, XL 11.5 oz, 2XL 12.5 oz (**estimates, weigh real samples**). Packaging: Uline 8 × 8 × 6 box 7.0 oz, 10 × 8 × 6 box 7.7 oz, 12 × 10 × 8 box 12.2 oz, 10 × 13 3 mil mailer ~0.8 oz, 12 × 15.5 mailer ~1.0 oz, tissue + dust bag + tape ~1 oz per cap.

| Parcel | Packed weight | Ground Advantage tier | Commercial price range (Local -> zone 8) |
|---|---|---|---|
| 1 cap, 8 × 8 × 6 box | 11–12 oz | under 1 lb | 7.33 -> 8.95 |
| 1 trucker, 8 × 8 × 6 box | 10–11 oz | under 1 lb | 7.33 -> 8.95 |
| 2 caps, 10 × 8 × 6 box | 17–19 oz | 2 lb | 8.39 -> 13.42 |
| 3 caps, 12 × 10 × 8 box | 25–28 oz | 2 lb | 8.39 -> 13.42 |
| 4 caps, 12 × 10 × 8 box | 29–32 oz | 2 lb (3 lb if over 32 oz) | 8.39 -> 13.42 (9.04 -> 16.30) |
| 1 tee S–L, 10 × 13 mailer | 11–13 oz | under 1 lb | 7.33 -> 8.95 |
| 1 tee XL–2XL, 10 × 13 mailer | 13–15 oz | under 1 lb | 7.33 -> 8.95 |
| 2 tees, 12 × 15.5 mailer | 21–27 oz | 2 lb | 8.39 -> 13.42 |
| 1 cap + 1 tee, 10 × 8 × 6 box | 22–25 oz | 2 lb | 8.39 -> 13.42 |
| 2 caps + 1 tee, 12 × 10 × 8 box | 31–35 oz | 2 lb or 3 lb | 8.39 -> 16.30 |

Always weigh the sealed parcel on the 0.1 oz scale and round up to the next ounce before buying the label; a parcel at 16.2 oz is a 2 lb label.

---

## 5. Recommended box and mailer specs

All Uline prices are per box/case before freight, checked 2026-10-21, flat across quantity breaks unless noted.

| Use | Vendor SKU | Inside (in) | Outside (in) | Strength | Price | Pack |
|---|---|---|---|---|---|---|
| 1 cap | Uline S-4083 (white: S-18947, price **unverified**) | 8 × 8 × 6 | 8 3/8 × 8 3/8 × 6 5/8 | 200# test (32 ECT) | $0.80 | 25/bundle, 11 lb |
| 2 caps or cap + tee | Uline S-4103 (white: S-14261) | 10 × 8 × 6 | 10 3/8 × 8 3/8 × 6 5/8 | 200# test | $0.74 | 25/bundle, 12 lb |
| 3–4 caps | Uline S-4120 | 12 × 10 × 8 | 12 3/8 × 10 3/8 × 8 5/8 | 200# test | $1.02 | 25/bundle, 19 lb |
| 1 tee | Uline S-21880BL (black; other colors same series) | 10 × 13 + 2 in flap | — | 3 mil poly, self-seal | $30/100 ($26 at 20+ cases) | 100/case |
| 2 tees | Uline S-11483BL (black) | 12 × 15.5 + flap | — | 3 mil poly, self-seal | $40/100 ($34 at 20+) | 100/case, 5 lb |
| Tissue | Uline S-14189 Speckled White (or any 20 × 30 solid) | 20 × 30 sheets | — | — | $52/240 sheets | bundle |
| Tape | Uline S-423 | 2 in × 110 yd, 2 mil | — | — | $3.75/roll, 18-roll minimum | — |

Alternatives for a smaller first order (free delivery, higher unit price): Quill 8 × 8 × 6 32 ECT 25-pack $25.99; Staples 25-pack $33.59; Walmart (The Packaging Wholesalers, white) 25-pack $35.99. Amazon 25-packs of 8 × 8 × 6 run $30–45 (**unverified**, listings change). A 10 × 8 × 6 from International Plastics is $24.05/25.

Why 200# test single-wall, not 32 ECT "economy": the ADR 0012 concern is crown crush under heavier sacks. 200# bursting-strength kraft is the standard mailing grade and is what Uline rates "up to 40 lb" shipments; a cap at 1 lb inside it is well within spec. For the master carton consider the 275# test version of 12 × 10 × 8 (Uline "Heavy-Duty" line, about $1.40–1.60, **unverified**) if UPS Ground damage claims ever appear.

Crown clearance check: a structured snapback crown is roughly 7.5 in front-to-back by 7 in wide by 4.5–5 in tall with the visor adding about 3 in of length when not curled, so 8 × 8 × 6 is a snug but correct fit with a tissue roll inside the crown. Two caps nested (one inverted) need 10 × 8 × 6.

Printer and scale:

- **Rollo X1038** (USB, direct thermal, 4 × 6): works with Shippo's "4x6 in PDF" label format (`PDF_4x6`, which the modal already defaults to). Street price about $180–200 (**unverified**). **Rollo X1040** wireless MSRP $279.
- **MUNBYN ITPP941** (USB) about $65–130 street, AirPrint model $269 MSRP (**unverified**); same 4 × 6 labels; Shippo compatibility is generic PDF printing, not a vendor-listed integration.
- Labels: any 4 × 6 direct-thermal roll or fanfold; MUNBYN/Rollo/Polono stock is cross-compatible, DYMO/Brother stock is not.
- **Accuteck 8250** 50 lb × 0.1 oz postal scale, battery or AC, hold and tare functions, about $25–35 (**unverified**). Alternative Acteck A-CK65GS 65 lb × 0.1 oz.

---

## 6. Recommendations for the code

1. **Fix preset weights to packed weights** in both `CAP_BOX_PRESETS` (`convex/shipping/functions.ts`) and `BOX_PRESETS` (`ShippingLabelModal.tsx`), and keep them in one module (the modal duplicates the server list): `one_cap` 12 oz, `two_caps` 19 oz, `three_plus_caps` 28 oz. Better: compute `weight = sum(item.shippingWeightOz) + box tare + 1 oz per cap` from a per-product `shippingWeightOz` field (cap 4, trucker 3.5, tee by size 10–12.5) with tare 7 / 8 / 12 oz, then let the admin override after weighing. This also fixes the under-declared 2-cap label.
2. **Send outside dimensions.** Change presets to 8.5 × 8.5 × 6.75, 10.5 × 8.5 × 6.75 and 12.5 × 10.5 × 8.75 (Uline outside dims rounded up to the next 1/4 in). None of the three changes a USPS price today, but it is what USPS measures and what Shippo uses for cubic.
3. **Add tee presets** and pick the default by product type, not by item count: `one_tee_mailer` 13 × 10 × 1 in, 13 oz; `two_tees_mailer` 15.5 × 12 × 2 in, 26 oz; cap + tee -> `two_caps` box (10 × 8 × 6) at 24 oz. The `totalCaps` reducer should count only cap items for the box choice and add tees to the weight. Mark the mailer presets "tees only" in the UI so the Crown-Safe rule stays visible.
4. **Insurance above $100.** Order value is known at rate time. When `order.total > 100`, pass `extra: { insurance: { amount: String(order.total), currency: "USD", provider: "..." } }` on the shipment (Shippo parcel/shipment `extra.insurance`; Shippo's own coverage is a few cents per $100 above the included amount, exact rate **unverified** for the store's plan) so the rate list includes the insured price. Keep it optional in the modal.
5. **Signature on 3+ cap orders.** `extra.signature_confirmation: "STANDARD"` at the shipment level adds about $3.90 USPS (**unverified** 2026 figure) and is appropriate for $200+ collector cartons shipped UPS Ground or Priority.
6. **Flat Rate via `template`.** If a Flat Rate preset is ever added, send `parcels: [{ template: "USPS_MediumFlatRateBox1", weight, massUnit: "oz" }]` (no length/width/height needed; the Shippo tokens are `USPS_FlatRateEnvelope`, `USPS_FlatRatePaddedEnvelope`, `USPS_SmallFlatRateBox`, `USPS_MediumFlatRateBox1`, `USPS_MediumFlatRateBox2`, `USPS_LargeFlatRateBox`). Rates come back for USPS only. Given section 4f this is low priority; the padded envelope for a rush single tee is the only realistic case.
7. **Cubic: nothing to do.** Shippo surfaces Ground Advantage Cubic and Priority Mail Cubic automatically from the dimensions; the store's parcels are never cheaper on cubic. Do not add a cubic template.
8. **Service-level filter.** `getShippingRates` returns every rate on the account. Consider dropping non-USPS/UPS providers and Priority Mail Express from the list by `servicelevel.token` (`usps_ground_advantage`, `usps_priority`, `ups_ground`, `ups_second_day_air`) to keep the modal short; the tokens are on Shippo's supported service levels page.
9. **Document env.** Add `SHIPPO_API_KEY`, `SHIPPO_ALLOW_SIMULATION` and `SHIPPO_WEBHOOK_SECRET` to a `.env.example` with the note that `shippo_test_` keys return real-looking USPS rates but labels that are not valid postage.
10. **Peak pricing banner (optional).** Prices in this report include the Oct 4, 2026 to Jan 17, 2027 peak increase. The modal already shows live Shippo rates, so no code depends on the tables; this report's numbers should be refreshed after the January 2027 change.

---

## 7. Sources

USPS official
- Notice 123 Price List, effective October 4, 2026 (Ground Advantage, Priority Mail, Cubic, Flat Rate tables): https://pe.usps.com/text/dmm300/notice123.htm
- DMM 283 Ground Advantage Commercial (cubic eligibility 1.3.1–1.3.4, DIM weight 1.4.1–1.4.3, divisor 139): https://pe.usps.com/text/dmm300/283.htm
- USPS Ground Advantage service page ($100 insurance, 2–5 days, own packaging): https://www.usps.com/ship/ground-advantage.htm
- USPS Store, Priority Mail Small Flat Rate Box (free, pack sizes, 5–7 day processing, Flat Rate-only rule): https://store.usps.com/store/product/priority-mail-flat-rate-small-box-P_SMALL_FRB
- USPS Store, Priority Mail Medium Box 1092 dimensions: https://store.usps.com/store/product/priority-mail-medium-box-option-1-P_O_1092
- USPS peak-season temporary price change announcement (Oct 4, 2026 – Jan 17, 2027): https://about.usps.com/newsroom/national-releases/2026/0825-usps-announces-temporary-price-change-for-2026-holiday-shipping-season.pdf

Shippo
- Supported service levels (`usps_ground_advantage`, `usps_priority`, `usps_priority_express`, `usps_media_mail`): https://docs.goshippo.com/estimate/supported-service-levels
- Shipments API, parcel object (`template`, `distance_unit`, `mass_unit`, `extra.insurance`, `signature_confirmation`): https://docs.goshippo.com/shippoapi/public-api/shipments
- Carrier parcel templates, USPS token list: https://docs.goshippo.com/shippoapi/public-api/carrier-parcel-templates.md
- USPS cubic pricing cheat sheet (eligibility, rounding, auto-selection, sample rates, Oct 12, 2026): https://goshippo.com/blog/a-cheat-sheet-on-usps-cubic-pricing
- USPS Ground Advantage guide (limits, insurance, DIM, 2 cu ft surcharge): https://goshippo.com/blog/usps-ground-advantage-deep-dive-into-uspss-newest-service-level
- Are USPS boxes free (ordering, delivery time, Priority-only rule, APV upcharge): https://goshippo.com/blog/are-usps-boxes-free
- USPS price tiers overview (Commercial pricing for all Shippo users, Priority Mail Cubic): https://goshippo.com/shipping/usps-shipping-price-tiers-overview
- USPS services available in Shippo including insurance ($100 included on Ground Advantage, Priority, Express): https://support.goshippo.com/hc/en-us/articles/360027338952-USPS-Services-Available-in-Shippo-Including-Insurance
- Rollo setup for Shippo (4x6 in PDF default): https://support.rollo.com/support/solutions/articles/29000026788-shippo-setup-for-rollo

Free box list and cubic tiers
- Pirate Ship, free USPS mailing boxes for Priority Mail Cubic (Box 4, 1096L, 1097, 1092, 1095, Shoe Box; regional boxes discontinued): https://support.pirateship.com/en/articles/1831755-free-usps-mailing-boxes-for-priority-mail-cubic
- Stamps.com, USPS Priority Mail box size guide / size changes: https://blog.stamps.com/?p=3426 and https://blog.stamps.com/?p=7958

DIM weight and 2026 changes (third party)
- Ship.com, USPS dimensional weight rules July 2026 (divisor 139, round-up): https://www.ship.com/post/usps-dimensional-weight-rules-2026
- Pitney Bowes USPS rate change overview: https://www.pitneybowes.com/us/postal-information/usps-rate-change-overview.html
- Flat Rate 2026 prices cross-check: https://atoship.com/blog/usps-flat-rate-boxes-sizes-prices-guide and https://resellerindex.com/rates/priority-mail-flat-rate/

Supplies
- Uline S-4083 8 × 8 × 6: https://www.uline.com/Product/Detail/S-4083/Corrugated-Boxes-200-Test/8-x-8-x-6-Corrugated-Boxes
- Uline S-4103 10 × 8 × 6: https://www.uline.com/Product/Detail/S-4103/Corrugated-Boxes-200-Test/10-x-8-x-6-Corrugated-Boxes
- Uline S-4120 12 × 10 × 8: https://www.uline.com/Product/Detail/S-4120/Corrugated-Boxes-200-Test/12-x-10-x-8-Corrugated-Boxes
- Uline S-21880BL 10 × 13 poly mailers: https://www.uline.com/Product/Detail/S-21880BL/Poly-Mailers/Poly-Mailers-10-x-13-Black
- Uline S-11483BL 12 × 15.5 poly mailers: https://www.uline.com/Product/Detail/S-11483BL/Poly-Mailers/Poly-Mailers-12-x-15-1-2-Black
- Uline S-14189 tissue 20 × 30: https://www.uline.com/Product/Detail/S-14189/Retail-Cushioning/Tissue-Paper-Sheets-20-x-30-Speckled-White
- Uline S-423 tape: https://www.uline.com/Product/Detail/S-423/Carton-Sealing-Tape/Uline-Industrial-Tape-2-Mil-2-x-110-yds-Clear
- Quill 8 × 8 × 6 25-pack: https://Quill.com/8-x-8-x-6-32-ect-shipping-boxes-25-pk/cbs/55443143.html
- Staples 8 × 8 × 6 25-pack: https://www.staples.com/8-x-8-x-6-shipping-boxes-25-pack-bs080806/product_24409774
- International Plastics 10 × 8 × 6: https://interplas.com/10-x-8-x-6-standard-boxes-p-bx-100806
- Rollo vs MUNBYN comparison (vendor): https://www.rollo.com/blog/tag/best-thermal-printer/ ; independent guide: https://shippinglabel.co/blog/best-thermal-label-printer-shipping
- Postal scale roundups (Accuteck 8250): https://www.talkofthehouse.com/best-shipping-scales/

Weights
- Snapback listings at 3.0–4.08 oz: https://rainierarms.com/rainier-arms-homebrew-snapback-hat-black-gray ; https://connect.twiza.org/post/how-much-does-a-baseball-hat-weigh
- T-shirt weight guides (GSM to oz/yd², garment ranges): https://www.printful.com/uk/blog/t-shirt-weight-guide ; https://www.shopify.com/blog/how-much-does-shirt-weigh
