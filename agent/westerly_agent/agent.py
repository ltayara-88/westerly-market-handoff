# Westerly Market shopping agent (Google ADK): recipe ideas, the cart, and support cases for order requests.
# The site's chat widget calls it through main.py; the shopper's details and cart arrive in session state.
import json
import logging
import re
from pathlib import Path

from google.adk.agents import LlmAgent
from google.adk.agents.readonly_context import ReadonlyContext
from google.adk.tools import ToolContext

from . import salesforce

CATALOG = json.loads((Path(__file__).parent / "catalog.json").read_text())
BY_SKU = {p["sku"]: p for p in CATALOG}
MAX_RESULTS = 8
ORDER_ID = re.compile(r"^W-\d{1,10}$")
log = logging.getLogger(__name__)

INSTRUCTION = """You are the Google shopping assistant on the Westerly Market website, a neighborhood supermarket.
Help shoppers plan meals and fill their cart.
- Suggest recipes and meal ideas from your own knowledge. Keep them short: a few lines and an ingredient list.
- Only recommend products from the Westerly catalog. Use search_catalog to find them, and give names and prices
  exactly as it returns them. If something isn't in the catalog, say Westerly doesn't carry it.
- Call add_to_cart only for items the shopper asked for or agreed to, then say what you added.
- When the shopper is signed in, their last order and usual items are listed below. You can remind them of these
  and add usual items to the cart if they ask.
- For order requests (changes, adding or removing items, cancellations, refunds, delivery problems, older orders),
  offer to open a case so a Westerly Support team member follows up. The shopper must be signed in; if not, ask
  them to sign in first. Before calling create_support_case, show the subject and a one-line summary and ask them
  to confirm. One case per chat: if a case is already open, give its number instead.
- You can't change orders, payments or deliveries yourself. Never say a change is done; say the team will follow up.
- Never ask for payment details, passwords or other personal information.
- Reply in plain text with short "- " bullet lists. No tables or headings."""


def search_catalog(query: str) -> dict:
    """Finds Westerly products whose name, detail or category matches words in the query.

    Args:
        query: words such as "garam masala" or "chicken thighs".
    """
    words = [w for w in query.lower().split() if len(w) > 1]
    scored = []
    for p in CATALOG:
        text = f'{p["name"]} {p["detail"]} {p["category"]}'.lower()
        score = sum(w in text for w in words)
        if score:
            scored.append((score, p))
    scored.sort(key=lambda s: -s[0])
    return {"products": [p for _, p in scored[:MAX_RESULTS]]}


def add_to_cart(sku: str, quantity: int = 1) -> dict:
    """Adds a Westerly product to the shopper's cart on the website. Only for items the shopper asked for or agreed to.

    Args:
        sku: the product's sku from search_catalog, e.g. "SP-GARAM".
        quantity: how many, 1 to 10.
    """
    product = BY_SKU.get(sku)
    if not product:
        return {"ok": False, "error": f"No product with sku {sku}; search the catalog first."}
    if not 1 <= quantity <= 10:
        return {"ok": False, "error": "Quantity must be 1 to 10."}
    # main.py turns ok results into cart actions for the widget.
    return {"ok": True, "sku": sku, "name": product["name"], "quantity": quantity, "price": product["price"]}


def create_support_case(subject: str, details: str, tool_context: ToolContext, order_id: str = "") -> dict:
    """Opens a Westerly Support case so a human team member follows up on an order request.
    Only call it after the shopper confirmed the subject and summary you showed them.

    Args:
        subject: short title, e.g. "Add garam masala to order W-10482".
        details: what the shopper asked for, in a few sentences. No payment details.
        order_id: the order it's about, e.g. "W-10482", or "" if none.
    """
    state = tool_context.state
    if not state.get("customer_id"):
        return {"ok": False, "error": "The shopper isn't signed in; ask them to sign in first."}
    if state.get("case_number"):
        return {"ok": False, "error": f'Case {state["case_number"]} is already open for this chat.'}
    order = state.get("last_order") or {}
    order_id = order_id if ORDER_ID.match(order_id or "") else ""
    status = order.get("status", "") if order_id and order_id == order.get("id") else ""
    try:
        number = salesforce.create_case(state["customer_id"], subject, f"{details}\n\nOpened by the Google shopping "
                                        "agent from the Westerly website chat.", order_id, status)
    except Exception:
        log.exception("create_support_case failed")
        return {"ok": False, "error": "The case couldn't be opened right now; ask the shopper to try again later."}
    state["case_number"] = number
    return {"ok": True, "case_number": number}


def _names(skus) -> str:
    return ", ".join(f'{BY_SKU[s]["name"]} ({s})' for s in skus or [] if s in BY_SKU)


def instruction(ctx: ReadonlyContext) -> str:
    name = ctx.state.get("customer_name") or "not signed in"
    cart = ", ".join(
        f'{c["quantity"]} x {BY_SKU[c["sku"]]["name"]}' for c in ctx.state.get("cart") or [] if c["sku"] in BY_SKU
    )
    order = ctx.state.get("last_order")
    last = f'{order["id"]}, {order["status"]}: {_names(order["items"])}' if order else "none"
    return (
        f"{INSTRUCTION}\n\nShopper: {name}\nCart: {cart or 'empty'}\n"
        f"Last order: {last}\nUsual items: {_names(ctx.state.get('usual_items')) or 'none'}\n"
        f"Support case: {ctx.state.get('case_number') or 'none'}"
    )


root_agent = LlmAgent(
    model="gemini-flash-latest",
    name="westerly_shopper",
    instruction=instruction,
    tools=[search_catalog, add_to_cart, create_support_case],
)
