# Westerly Market help center: Knowledge articles

Draft content for Step 15, Part 3. Agentforce Coworker grounds its answers on these when a rep asks what to do
with a case such as "I forgot to add garam masala". They're laid out like a grocery-delivery help center (topics:
Placing Orders, Order in Progress, Delivery & Pickup, Refunds & Returns) but written for Westerly.

Every article uses the **FAQ** record type (`SDO_Knowledge_FAQ`) and these fields:

| Field | Use |
|---|---|
| Title | Shopper-facing question |
| UrlName | `westerly-…`, so nothing collides with the org's demo articles |
| Summary | One line; shows in search results |
| FAQ_Question__c | The question as shoppers ask it |
| Chat_Answer__c | Short answer, 255 characters max |
| FAQ_Answer__c | Full answer (rich text) |
| FAQ_Internal_Comments__c | Rep-only guidance: what the rep can and can't do |
| Article_Confidence__c | Validated |
| Visibility | Internal app only (no public knowledge base or community site yet) |

Order facts the articles rely on (from Data 360 and the Westerly site):
- Order statuses: **Not yet picked**, **Picked**, **Delivered**.
- Curbside pickup is free on orders over $35. Same-day home delivery within 10 miles of the store.
- Returns within 30 days for a full refund.

---

## Placing Orders

### 1. Can I add items to an order I already placed?
- **UrlName:** `westerly-add-items-to-an-order`
- **Summary:** You can add items while the order is "Not yet picked". After that, place a new order or add the items to your next one.
- **Chat answer:** Yes, as long as your order shows "Not yet picked". Once it's picked or delivered we can't add to it, but you can place a new order or add the items to your next one.
- **Full answer:**
  You can add items to an order until our team starts picking it.
  - **Not yet picked:** contact Westerly Support with your order number and the items you want. We add them to the
    same order and delivery or pickup time, and your total is updated before you're charged.
  - **Picked:** your groceries are already bagged, so we can't add to this order. Place a new order (free curbside
    pickup over $35), or tell us and we'll note the items for your next order.
  - **Delivered:** place a new order, or add the items to your next one.

  Added items are subject to what's in stock. If an item is out, we'll suggest a substitute.
- **Internal comments (reps):**
  1. Check the order status in the Westerly Shopper panel on the case.
  2. **Not yet picked:** add the item to the same order, confirm the item, size and price with the shopper, and
     reply with the new total. No payment details are needed; the card on file is charged at pickup or delivery.
  3. **Picked or Delivered:** don't reopen the order. Offer a new order, or add a note to the shopper's profile so
     the item goes on their next order.
  4. Never ask for card numbers in a case or chat.

### 2. How do I remove an item or cancel my order?
- **UrlName:** `westerly-remove-items-or-cancel`
- **Summary:** Remove items or cancel any time before the order is picked.
- **Chat answer:** You can remove items or cancel any time before your order is picked. After it's picked, you can still return unwanted items within 30 days for a full refund.
- **Full answer:**
  Before your order is picked, contact Westerly Support to remove items or cancel. Nothing is charged for a canceled
  order. Once the order is picked, we can't change it. You can refuse an item at the door or curbside, or return it
  within 30 days for a full refund.
- **Internal comments (reps):** Cancel or edit only orders that are "Not yet picked". For picked orders, point the
  shopper to returns (article 6).

---

## Order in Progress

### 3. What does my order status mean?
- **UrlName:** `westerly-order-status`
- **Summary:** "Not yet picked", "Picked" and "Delivered", and what you can still change at each step.
- **Chat answer:** "Not yet picked" means you can still add, remove or cancel. "Picked" means it's bagged and ready. "Delivered" means it's with you or was collected.
- **Full answer:**
  | Status | What it means | What you can still change |
  |---|---|---|
  | Not yet picked | We have your order and haven't started shopping it | Add or remove items, change the time, cancel |
  | Picked | Your groceries are bagged and waiting for delivery or pickup | Nothing on this order; start a new one |
  | Delivered | Delivered to your door or collected curbside | Report a problem or return items |
- **Internal comments (reps):** The status in the Westerly Shopper panel comes from Data 360 and decides which
  actions are allowed. When in doubt, treat the order as picked.

### 4. What happens if an item is out of stock?
- **UrlName:** `westerly-substitutions`
- **Summary:** We pick the closest match at the same or lower price, or refund the item.
- **Chat answer:** We'll pick the closest match at the same price or lower. If there isn't a good match, we leave it out and you're not charged for it.
- **Full answer:**
  If something you ordered is out of stock, our team picks the closest match: same brand in a different size, or a
  similar product. A substitute never costs more than the original item. If there's no good match, we leave it out
  and you aren't charged. Don't want a substitute? Refuse it at delivery or pickup and we'll refund it.
- **Internal comments (reps):** If a shopper is unhappy with a substitute, refund the item; no return is needed for
  perishables.

---

## Delivery & Pickup

### 5. How do delivery and curbside pickup work?
- **UrlName:** `westerly-delivery-and-pickup`
- **Summary:** Same-day home delivery within 10 miles; free curbside pickup on orders over $35.
- **Chat answer:** We offer same-day home delivery within 10 miles of the store, and curbside pickup that's free on orders over $35. Choose a time at checkout.
- **Full answer:**
  - **Home delivery:** same-day, within 10 miles of the store. Choose a delivery window at checkout.
  - **Curbside pickup:** free on orders over $35. Choose a pickup time at checkout, park in a curbside spot, and
    we'll bring your order out.

  Need a different time? Contact us before your order is picked.
- **Internal comments (reps):** Time changes follow the same rule as item changes: only while "Not yet picked".

### 6. An item is missing, damaged or wrong. What do I do?
- **UrlName:** `westerly-missing-or-damaged-items`
- **Summary:** Tell us within 30 days and we'll refund or replace the item.
- **Chat answer:** Sorry about that! Tell us which item and your order number within 30 days and we'll refund it or send a replacement with your next order.
- **Full answer:**
  Contact Westerly Support with your order number and the item. Within 30 days of delivery or pickup we'll refund
  the item or add a free replacement to your next order. For damaged or spoiled food you don't need to bring it back.
- **Internal comments (reps):** Refund to the original payment method; don't ask for card details.

---

## Refunds & Returns

### 7. How do returns and refunds work?
- **UrlName:** `westerly-returns-and-refunds`
- **Summary:** Return any item within 30 days for a full refund to your original payment method.
- **Chat answer:** Not happy with an item? Return it within 30 days for a full refund. Refunds go back to your original payment method.
- **Full answer:**
  Bring the item back to the store, or tell us at your next delivery or pickup, within 30 days. We refund the full
  item price to your original payment method. Refunds usually show up in 3–5 business days, depending on your bank.
- **Internal comments (reps):** Refunds always go to the original payment method. Never take payment details in a
  case.
