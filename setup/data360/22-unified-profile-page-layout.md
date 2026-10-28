# Westerly Unified Shopper profile page: layout

Page `Westerly_Unified_Shopper` (Data 360 record page for `UnifiedssotIndividualWstr__dlm`).
Readable summary of `27k-unified-profile-page-name-column-only.json`; earlier layouts are in `22a-…`, `22b-…`, `27e-…`, `27f-…`, `27i-…` and `27j-…`.

## Header

| Card | Shows |
|---|---|
| Shopper name (card title "Customer IDs") | Identification Number only (`UnifiedssotPartyIdentificationWstr__dlm`): the `Full Name` row shows the name; the card also lists the customer ID row, since it can't filter by type |
| Insight tile | Orders last 30 days (`Westerly_Orders_Last_30_Days__cio`) |
| Insight tile | Total orders (`Westerly_Total_Orders__cio`) |
| Insight tile | Avg cart value, as currency (`Westerly_Avg_Cart_Value__cio`) |

## Main

| Card | Shows |
|---|---|
| Email | Email address |
| Phone | Telephone number |
| Address | Address line 1, city, state, postal code, country |

## Sidebar

| Card | Shows |
|---|---|
| Engagements | Sales orders only (Product Browse removed 2026-10-26) |

## What changed on 2026-10-26

- Email card moved from the header to the top of main.
- Product Browse removed from Engagements.
- Shopper name card removed (it can't read the custom DMO); the name now comes from a `Full Name` Party
  Identification row, and the Customer IDs card moved to the top of main.
- Shopper name card back at the top of the header, now reading unified Party Identification (copy of the
  Customer IDs card, which stays in main).
- Customer IDs card removed from main; the header name card shows the same rows.
- Identification Name column removed from the header name card.
