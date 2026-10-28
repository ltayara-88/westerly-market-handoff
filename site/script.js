/* Westerly Market demo storefront
 * - All department sections (produce, deli & bakery, meat & seafood, spices, pantry,
 *   beverages, weekly deals) rendered from CATALOG
 * - Demo sign-in (synthetic CUSTOMER_1)
 * - Data 360 Web SDK events (real if the SDK is loaded, otherwise logged locally)
 * - window.Westerly: small API for the Google Agent to read the customer/cart and add items
 */

// ================= DATA (synthetic) =================
// cat: produce | deli | meat | spices | pantry | dairy | beverages
// was: original price (item is on this week's deal list)
const CATALOG = [
  // Fresh produce
  { sku: "PR-STRAW", name: "Organic Strawberries", detail: "1 lb container", price: 4.24, was: 4.99, emoji: "🍓", cat: "produce" },
  { sku: "PR-AVO", name: "Hass Avocados", detail: "Pack of 4", price: 4.67, was: 5.49, emoji: "🥑", cat: "produce" },
  { sku: "PR-BLUE", name: "Wild Blueberries", detail: "6 oz container", price: 3.39, was: 3.99, emoji: "🫐", cat: "produce" },
  { sku: "PR-LEMON", name: "Meyer Lemons", detail: "Bag of 6", price: 3.49, emoji: "🍋", cat: "produce" },
  { sku: "PR-SPINACH", name: "Baby Spinach", detail: "5 oz clamshell", price: 3.39, was: 3.99, emoji: "🥬", cat: "produce" },
  { sku: "PR-TOMATO", name: "Roma Tomatoes", detail: "per lb", price: 2.49, emoji: "🍅", cat: "produce" },
  { sku: "PR-GARLIC", name: "Garlic", detail: "3-bulb pack", price: 1.99, emoji: "🧄", cat: "produce" },
  { sku: "PR-GINGER", name: "Fresh Ginger", detail: "per 4 oz", price: 1.49, emoji: "🫚", cat: "produce" },
  { sku: "PR-ONION", name: "Yellow Onions", detail: "3 lb bag", price: 3.29, emoji: "🧅", cat: "produce" },
  { sku: "PR-CILANTRO", name: "Fresh Cilantro", detail: "1 bunch", price: 0.99, emoji: "🌿", cat: "produce" },

  // Deli & bakery
  { sku: "DB-SOURDOUGH", name: "Country Sourdough Loaf", detail: "Baked this morning", price: 6.49, emoji: "🍞", cat: "deli" },
  { sku: "DB-CROISSANT", name: "Butter Croissants", detail: "Pack of 4", price: 5.99, emoji: "🥐", cat: "deli" },
  { sku: "DB-NAAN", name: "Garlic Naan", detail: "Pack of 4", price: 3.99, emoji: "🫓", cat: "deli" },
  { sku: "DB-BAGUETTE", name: "French Baguette", detail: "1 loaf", price: 2.99, emoji: "🥖", cat: "deli" },
  { sku: "DB-TURKEY", name: "Oven-Roasted Turkey", detail: "1/2 lb, sliced", price: 7.49, emoji: "🦃", cat: "deli" },
  { sku: "DB-HUMMUS", name: "House Hummus", detail: "10 oz", price: 4.49, emoji: "🥙", cat: "deli" },
  { sku: "DB-ROTISSERIE", name: "Rotisserie Chicken", detail: "Whole, hot and ready", price: 8.99, emoji: "🍗", cat: "deli" },
  { sku: "DB-COOKIES", name: "Chocolate Chip Cookies", detail: "Pack of 6", price: 4.99, emoji: "🍪", cat: "deli" },

  // Meat & seafood
  { sku: "MT-CHICKEN", name: "Boneless Chicken Thighs", detail: "1.5 lb", price: 8.99, emoji: "🍗", cat: "meat" },
  { sku: "MT-BREAST", name: "Chicken Breasts", detail: "1.5 lb", price: 9.49, emoji: "🐔", cat: "meat" },
  { sku: "MT-BEEF", name: "Grass-Fed Ground Beef", detail: "1 lb, 85/15", price: 6.79, was: 7.99, emoji: "🥩", cat: "meat" },
  { sku: "MT-PORK", name: "Pork Tenderloin", detail: "About 1.25 lb", price: 8.49, emoji: "🐖", cat: "meat" },
  { sku: "SF-SALMON", name: "Atlantic Salmon Fillet", detail: "1 lb", price: 12.99, emoji: "🐟", cat: "meat" },
  { sku: "SF-SHRIMP", name: "Wild Gulf Shrimp", detail: "1 lb, peeled", price: 11.99, emoji: "🦐", cat: "meat" },

  // Spices
  { sku: "SP-GARAM", name: "Garam Masala", detail: "2 oz jar", price: 4.49, emoji: "🫙", cat: "spices" },
  { sku: "SP-CUMIN", name: "Ground Cumin", detail: "2 oz jar", price: 3.99, emoji: "🟤", cat: "spices" },
  { sku: "SP-TURMERIC", name: "Ground Turmeric", detail: "2 oz jar", price: 3.79, emoji: "🟡", cat: "spices" },
  { sku: "SP-PAPRIKA", name: "Smoked Paprika", detail: "2 oz jar", price: 4.29, emoji: "🌶️", cat: "spices" },
  { sku: "SP-CORIANDER", name: "Ground Coriander", detail: "1.5 oz jar", price: 3.49, emoji: "🌱", cat: "spices" },
  { sku: "SP-CARDAMOM", name: "Green Cardamom Pods", detail: "1 oz jar", price: 6.99, emoji: "🫛", cat: "spices" },
  { sku: "SP-CINNAMON", name: "Cinnamon Sticks", detail: "1 oz bag", price: 3.99, emoji: "🪵", cat: "spices" },
  { sku: "SP-CHILI", name: "Red Chili Flakes", detail: "1.5 oz jar", price: 2.99, emoji: "🔥", cat: "spices" },

  // Pantry
  { sku: "PN-RICE", name: "Basmati Rice", detail: "2 lb bag", price: 5.49, emoji: "🍚", cat: "pantry" },
  { sku: "PN-OIL", name: "Extra Virgin Olive Oil", detail: "500 ml", price: 9.99, emoji: "🫒", cat: "pantry" },
  { sku: "PN-TOMATO", name: "Crushed Tomatoes", detail: "28 oz can", price: 2.79, emoji: "🥫", cat: "pantry" },
  { sku: "PN-COCONUT", name: "Coconut Milk", detail: "13.5 oz can", price: 2.49, emoji: "🥥", cat: "pantry" },
  { sku: "PN-CHICKPEA", name: "Chickpeas", detail: "15 oz can", price: 1.69, emoji: "🫘", cat: "pantry" },
  { sku: "PN-PASTA", name: "Penne Pasta", detail: "1 lb box", price: 1.99, emoji: "🍝", cat: "pantry" },
  { sku: "PN-HONEY", name: "Local Wildflower Honey", detail: "12 oz jar", price: 8.99, emoji: "🍯", cat: "pantry" },
  { sku: "PN-FLOUR", name: "All-Purpose Flour", detail: "5 lb bag", price: 4.29, emoji: "🌾", cat: "pantry" },

  // Dairy & eggs (shown in the Pantry section)
  { sku: "DY-YOGURT", name: "Plain Greek Yogurt", detail: "16 oz", price: 4.29, emoji: "🥣", cat: "dairy" },
  { sku: "PN-CREAM", name: "Heavy Cream", detail: "1 pint", price: 3.99, emoji: "🥛", cat: "dairy" },
  { sku: "DY-EGGS", name: "Free-Range Eggs", detail: "1 dozen", price: 5.49, emoji: "🥚", cat: "dairy" },
  { sku: "DY-BUTTER", name: "Unsalted Butter", detail: "1 lb", price: 4.99, emoji: "🧈", cat: "dairy" },

  // Beverages
  { sku: "BV-OJ", name: "Cold-Pressed Orange Juice", detail: "32 oz", price: 6.99, emoji: "🍊", cat: "beverages" },
  { sku: "BV-SPARKLING", name: "Sparkling Water", detail: "8 x 12 oz cans", price: 4.67, was: 5.49, emoji: "🫧", cat: "beverages" },
  { sku: "BV-ROOTBEER", name: "Craft Root Beer", detail: "4 x 12 oz bottles", price: 6.99, emoji: "🥤", cat: "beverages" },
  { sku: "BV-COLDBREW", name: "Cold Brew Coffee", detail: "32 oz", price: 5.49, emoji: "☕", cat: "beverages" },
  { sku: "BV-KOMBUCHA", name: "Ginger Kombucha", detail: "16 oz", price: 3.99, emoji: "🧉", cat: "beverages" },
  { sku: "BV-OATMILK", name: "Oat Milk", detail: "64 oz", price: 4.79, emoji: "🥛", cat: "beverages" },
  { sku: "BV-TEA", name: "Unsweetened Iced Tea", detail: "59 oz", price: 3.49, emoji: "🍵", cat: "beverages" },
  { sku: "BV-IPA", name: "Local IPA", detail: "6 x 12 oz cans (21+)", price: 11.99, emoji: "🍺", cat: "beverages" },
];

// Card background colors by department
const CAT_BG = {
  produce: ["#d8f3dc", "#a8e6cf"], deli: ["#f3e1cf", "#e0b98f"], meat: ["#ffd9d2", "#f2a99a"],
  spices: ["#f6d7b0", "#e9a86b"], pantry: ["#f4f1e8", "#ddd5bf"], dairy: ["#eef4fb", "#cddcec"],
  beverages: ["#d4eef3", "#9fd3dd"],
};

// Synthetic unified profile, as the Google Agent would read it from Data 360
const PROFILES = {
  "customer1@example.com": {
    customerId: "CUST_001",
    firstName: "Stephanie",
    email: "customer1@example.com",
    insights: { topShopper: true, ordersLast30Days: 7, avgCartValue: 58.4, avgCartItems: 11 },
    usualItems: ["PN-RICE", "PN-OIL", "SP-CUMIN"], // from order history in Snowflake
    recentlyBought: ["PR-GARLIC", "PR-ONION"],
    lastOrder: { id: "W-10482", status: "Not yet picked", items: ["PN-RICE", "MT-CHICKEN"] },
  },
};

// ================= STATE =================
const state = { user: null, cart: {}, nextOrder: 10483 };
const bySku = Object.fromEntries(CATALOG.map((p) => [p.sku, p]));
const $ = (id) => document.getElementById(id);
const money = (n) => "$" + n.toFixed(2);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ================= DATA 360 =================
function getDeviceId() {
  try {
    let id = localStorage.getItem("westerly_device_id");
    if (!id) {
      id = "dev-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("westerly_device_id", id);
    }
    return id;
  } catch (e) {
    return "dev-session-" + Math.random().toString(36).slice(2, 8);
  }
}

// Interaction name -> event developerName in westerly-web-schema.json (the "Westerly site" Website connection).
// Field names on each event must match that schema; the SDK fills in eventId, dateTime, deviceId and sessionId.
const D360_EVENT_TYPES = {
  "Page View": "pageView",
  "Add To Cart": "addToCart",
  "Remove From Cart": "removeFromCart",
  "Order Placed": "orderPlaced",
  "Search": "search",
  "Logout": "logout",
};

const D360 = {
  deviceId: getDeviceId(),
  live: false,

  // The beacon loads its modules asynchronously, so wait briefly for SalesforceInteractions before falling back.
  init(attempt = 0) {
    const sdk = window.SalesforceInteractions;
    if (!(sdk && typeof sdk.init === "function") && attempt < 15) {
      setTimeout(() => this.init(attempt + 1), 200);
      return;
    }
    if (sdk && typeof sdk.init === "function") {
      try {
        // Demo only: every visitor is opted in. A production site must ask for consent first.
        sdk.init({
          consents: [{ provider: "Westerly Demo", purpose: "Tracking", status: sdk.ConsentStatus ? sdk.ConsentStatus.OptIn : "Opt In" }],
        });
        this.live = true;
      } catch (e) {
        console.warn("Data 360 SDK init failed; falling back to local log", e);
      }
    }
    $("d360Mode").textContent = this.live ? "Live: Web SDK" : "Demo mode (SDK not loaded)";
    this.send("Page View", { page: location.hash || "#home" });
  },

  // Engagement events carry no user block: Data 360 ties them to the shopper through deviceId and the identity event.
  send(name, attributes = {}) {
    const eventType = D360_EVENT_TYPES[name];
    if (!eventType) console.warn(`"${name}" is not in the Website connection schema; Data 360 will drop it`);
    // The SDK reserves names like "Add To Cart" for its built-in cart events (which require a lineItem),
    // so send the schema event name as the interaction name instead.
    this.dispatch(name, { interaction: { name: eventType || name, eventType, ...attributes } });
  },

  identify(profile) {
    this.dispatch("Login", {
      interaction: { name: "Login" },
      user: { attributes: { eventType: "identity", isAnonymous: 0, customerId: profile.customerId, email: profile.email } },
    });
  },

  dispatch(name, payload) {
    logD360(name, JSON.parse(JSON.stringify(payload))); // copy first: sendEvent mutates the payload
    if (this.live) {
      try { window.SalesforceInteractions.sendEvent(payload); } catch (e) { console.warn("sendEvent failed", e); }
    }
  },
};

function logD360(name, payload) {
  const li = document.createElement("li");
  const isIdentity = !!(payload.user && payload.user.attributes && payload.user.attributes.eventType === "identity");
  const who = isIdentity ? payload.user.attributes.customerId : state.user ? state.user.customerId : "anonymous " + D360.deviceId;
  li.className = isIdentity ? "identity" : "";
  li.innerHTML = `<span class="ev-name">${esc(name)}</span> <span class="ev-who">${esc(who)}</span>` +
    `<details><summary>payload</summary><pre>${esc(JSON.stringify(payload, null, 2))}</pre></details>`;
  $("d360Events").prepend(li);
}

// ================= PRODUCTS + CART =================
function productCard(p) {
  const [c1, c2] = CAT_BG[p.cat] || ["#eeeeee", "#dddddd"];
  return `<div class="product-card" data-sku="${p.sku}">
      <div class="product-img" style="background: linear-gradient(135deg, ${c1}, ${c2});">
        ${p.was ? `<span class="deal-badge">15% OFF</span>` : ""}
        <span class="product-emoji">${p.emoji}</span>
      </div>
      <h3 class="product-name">${esc(p.name)}</h3>
      <p class="product-detail">${esc(p.detail)}</p>
      <div class="product-bottom">
        <span class="product-price">${money(p.price)}${p.was ? ` <s class="was">${money(p.was)}</s>` : ""}</span>
        <button class="btn btn-primary btn-sm" type="button" data-add="${p.sku}">Add</button>
      </div>
    </div>`;
}

function renderGrids() {
  document.querySelectorAll("[data-grid]").forEach((grid) => {
    const key = grid.dataset.grid;
    const items = key === "deals" ? CATALOG.filter((p) => p.was) : CATALOG.filter((p) => p.cat === key);
    grid.innerHTML = items.map(productCard).join("");
  });
}

function renderSearch(q) {
  const term = q.trim().toLowerCase();
  const box = $("searchResults");
  if (!term) { box.innerHTML = ""; return; }
  const hits = CATALOG.filter((p) => (p.name + " " + p.detail + " " + p.cat).toLowerCase().includes(term));
  box.innerHTML = hits.length ? hits.map(productCard).join("") : `<p class="no-results">No products match "${esc(q)}".</p>`;
  // Send one Search event once the shopper stops typing, not one per keystroke.
  clearTimeout(renderSearch._t);
  renderSearch._t = setTimeout(() => D360.send("Search", { query: term, resultCount: hits.length }), 800);
}

function toast(msg, ms = 3500) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms);
}

function addToCart(sku, qty = 1, source = "site") {
  const p = bySku[sku];
  if (!p) return;
  state.cart[sku] = (state.cart[sku] || 0) + qty;
  D360.send("Add To Cart", { sku, productName: p.name, price: p.price, quantity: qty, source });
  renderCart();
  emit("westerly:cart-changed", { cart: { ...state.cart } });
}

function removeFromCart(sku) {
  if (!state.cart[sku]) return;
  delete state.cart[sku];
  D360.send("Remove From Cart", { sku });
  renderCart();
  emit("westerly:cart-changed", { cart: { ...state.cart } });
}

function cartTotals() {
  let items = 0, total = 0;
  for (const [sku, q] of Object.entries(state.cart)) { items += q; total += bySku[sku].price * q; }
  return { items, total };
}

function renderCart() {
  const { items, total } = cartTotals();
  document.querySelector(".cart-count").textContent = items;
  $("cartItems").innerHTML = Object.keys(state.cart).length
    ? Object.entries(state.cart).map(([sku, q]) => `<li><span>${esc(bySku[sku].name)} &times; ${q}</span><span>${money(bySku[sku].price * q)} <button type="button" data-remove="${sku}" aria-label="Remove">&times;</button></span></li>`).join("")
    : `<li class="empty">Your cart is empty.</li>`;
  $("cartTotal").textContent = money(total);
}

// Demo delivery estimate: a 2-hour same-day slot starting 2 hours from now, inside store hours (Mon–Sat 7am–9pm, Sun 8am–7pm).
function deliveryWindow(now = new Date()) {
  const hours = (day) => (day === 0 ? [8, 19] : [7, 21]);
  const hour = (h) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  const [open, close] = hours(now.getDay());
  const start = Math.max(now.getHours() + 2, open + 2);
  if (start + 2 <= close) return `today ${hour(start)}–${hour(start + 2)}`;
  const next = hours((now.getDay() + 1) % 7)[0] + 2;
  return `tomorrow ${hour(next)}–${hour(next + 2)}`;
}

function checkout() {
  const { items, total } = cartTotals();
  if (!items) return;
  if (!state.user) { openLogin(); return; }
  const orderId = "W-" + state.nextOrder++;
  state.user.lastOrder = { id: orderId, status: "Not yet picked", items: Object.keys(state.cart) };
  // In production the order system writes this order to Snowflake; Data 360 reads it with zero copy.
  D360.send("Order Placed", { orderId, orderValue: Number(total.toFixed(2)), itemCount: items });
  state.cart = {};
  renderCart();
  $("cartDrawer").hidden = true;
  const confirmation = `Thanks, ${state.user.firstName}! Order ${orderId} is placed: ${items} items, ${money(total)}. Delivery ${deliveryWindow()}.`;
  toast(confirmation, 6000);
  agentEndChat(confirmation);
  emit("westerly:order-placed", { orderId, total });
}

// ================= LOGIN =================
function openLogin() { $("loginModal").hidden = false; $("loginEmail").focus(); }

function login(email) {
  const profile = PROFILES[email.trim().toLowerCase()];
  if (!profile) { alert("Demo login: use customer1@example.com"); return; }
  state.user = JSON.parse(JSON.stringify(profile));
  D360.identify(state.user);
  $("loginModal").hidden = true;
  $("userGreeting").hidden = false;
  $("userGreeting").textContent = "Hi, " + state.user.firstName + (state.user.insights.topShopper ? " · Top Shopper" : "");
  $("signInLink").textContent = "Sign Out";
  emit("westerly:login", { customerId: state.user.customerId });
}

function logout() {
  state.user = null;
  $("userGreeting").hidden = true;
  $("signInLink").textContent = "Sign In";
  D360.send("Logout");
  emit("westerly:logout", {});
}

// ================= INTEGRATION API (for the Google Agent) =================
// Events: "westerly:login", "westerly:logout", "westerly:cart-changed", "westerly:order-placed"
//   window.addEventListener("westerly:login", (e) => console.log(e.detail.customerId));
function emit(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }

window.Westerly = {
  getCustomer: () => (state.user ? { customerId: state.user.customerId, firstName: state.user.firstName, lastOrderId: state.user.lastOrder.id } : null),
  getDeviceId: () => D360.deviceId,
  getCart: () => ({ ...state.cart }),
  getCatalog: () => CATALOG.map(({ sku, name, detail, price, cat }) => ({ sku, name, detail, price, category: cat })),
  addToCart: (sku, qty = 1) => addToCart(sku, qty, "google-agent"),
  openLogin: () => openLogin(),
  sendD360Event: (name, attributes) => D360.send(name, attributes),
};

// ================= GOOGLE AGENT CHAT =================
// Sends each message to /api/agent (server.js → ADK agent app) with the shopper's details and cart,
// then adds whatever the agent put in the cart and shows any support case it opened.
const Agent = { sessionId: sessionStorage.getItem("westerlyAgentSession") || crypto.randomUUID(), busy: false };
sessionStorage.setItem("westerlyAgentSession", Agent.sessionId);

function agentSay(who, html) {
  const div = document.createElement("div");
  div.className = "msg msg-" + who;
  const label = { google: "Google Agent", user: "You", system: "Westerly" }[who];
  div.innerHTML = `<span class="msg-label">${label}</span><div class="msg-body">${html}</div>`;
  $("agentMessages").append(div);
  $("agentMessages").scrollTop = $("agentMessages").scrollHeight;
  return div;
}

function agentGreet() {
  agentSay("google", esc(`Hi${state.user ? " " + state.user.firstName : ""}, let me know how I can help you today! I can remind you of your past orders or even help you with your next meal idea.`));
}

function agentNewSession() {
  Agent.sessionId = crypto.randomUUID();
  sessionStorage.setItem("westerlyAgentSession", Agent.sessionId);
}

// Checkout ends the chat: the agent confirms the order, and the shopper can start a new conversation.
function agentEndChat(confirmation) {
  if (!$("agentMessages").children.length) return; // no chat in this tab
  agentSay("google", esc(confirmation));
  agentSay("system", "This chat has ended.");
  agentNewSession();
  $("agentChips").hidden = $("agentForm").hidden = true;
  $("agentRestart").hidden = false;
}

// New chat: a new session id, so the agent starts with no memory of this tab's earlier messages.
function agentNewChat() {
  agentNewSession();
  $("agentMessages").innerHTML = "";
  $("agentChips").hidden = $("agentForm").hidden = false;
  $("agentRestart").hidden = true;
  agentGreet();
  $("agentText").focus();
}

// Replies are plain text: escape them, then allow **bold**, "- " bullets and line breaks.
function formatReply(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .split("\n")
    .map((line) => line.replace(/^\s*[-*] /, "• "))
    .join("<br>");
}

async function askAgent(text) {
  if (Agent.busy || !text.trim()) return;
  Agent.busy = true;
  const sessionId = Agent.sessionId;
  agentSay("user", esc(text));
  const pending = agentSay("google", "…");
  try {
    const r = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        message: text.slice(0, 1000),
        customerName: state.user ? state.user.firstName : null,
        customerId: state.user ? state.user.customerId : null,
        cart: Object.entries(state.cart).map(([sku, quantity]) => ({ sku, quantity })),
        lastOrder: state.user ? state.user.lastOrder : null,
        usualItems: state.user ? state.user.usualItems : [],
      }),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const { reply, actions } = await r.json();
    if (sessionId !== Agent.sessionId) { pending.remove(); return; } // chat ended or restarted meanwhile
    pending.querySelector(".msg-body").innerHTML = formatReply(reply || "Sorry, I didn't catch that. Could you rephrase?");
    for (const a of actions || []) {
      if (a.type === "add_to_cart" && bySku[a.sku]) {
        addToCart(a.sku, a.quantity, "google-agent");
        agentSay("system", esc(`Added ${a.quantity} × ${bySku[a.sku].name} to your cart`));
      } else if (a.type === "case_created") {
        agentSay("system", esc(`Support case ${a.caseNumber} opened. A Westerly team member will follow up.`));
      }
    }
  } catch (e) {
    pending.querySelector(".msg-body").textContent = "The assistant isn't available right now. Please try again in a moment.";
  } finally {
    Agent.busy = false;
  }
}

// ================= WIRING =================
document.addEventListener("DOMContentLoaded", () => {
  renderGrids();
  renderCart();
  D360.init();

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, a");
    if (!t) return;
    if (t.dataset.add) { addToCart(t.dataset.add); t.textContent = "Added"; setTimeout(() => (t.textContent = "Add"), 900); toast(bySku[t.dataset.add].name + " added to cart"); }
    if (t.dataset.info) { e.preventDefault(); toast(t.dataset.info); }
    if (t.classList.contains("nav-link")) $("mainNav").classList.remove("open");
    if (t.dataset.remove) removeFromCart(t.dataset.remove);
    if (t.hasAttribute("data-close-modal")) $("loginModal").hidden = true;
  });

  $("signInLink").addEventListener("click", (e) => { e.preventDefault(); state.user ? logout() : openLogin(); });
  $("loginForm").addEventListener("submit", (e) => { e.preventDefault(); login($("loginEmail").value); });
  $("cartLink").addEventListener("click", (e) => { e.preventDefault(); $("cartDrawer").hidden = !$("cartDrawer").hidden; });
  $("cartClose").addEventListener("click", () => ($("cartDrawer").hidden = true));
  $("checkoutBtn").addEventListener("click", checkout);
  $("agentLauncher").addEventListener("click", () => {
    $("agentPanel").hidden = false;
    $("agentLauncher").hidden = true;
    if (!$("agentMessages").children.length) agentGreet();
    if (!$("agentForm").hidden) $("agentText").focus();
  });
  $("agentNew").addEventListener("click", agentNewChat);
  $("agentRestart").addEventListener("click", agentNewChat);
  $("agentClose").addEventListener("click", () => { $("agentPanel").hidden = true; $("agentLauncher").hidden = false; });
  $("agentChips").addEventListener("click", (e) => { const b = e.target.closest("button[data-prompt]"); if (b) askAgent(b.dataset.prompt); });
  $("agentForm").addEventListener("submit", (e) => { e.preventDefault(); const t = $("agentText").value; $("agentText").value = ""; askAgent(t); });
  $("d360Toggle").addEventListener("click", () => {
    const log = $("d360Log");
    log.classList.toggle("collapsed");
    $("d360Toggle").textContent = log.classList.contains("collapsed") ? "Show" : "Hide";
  });

  document.querySelector(".search-btn").addEventListener("click", () => {
    const bar = $("searchBar");
    bar.hidden = !bar.hidden;
    if (!bar.hidden) $("searchInput").focus();
  });
  $("searchInput").addEventListener("input", (e) => renderSearch(e.target.value));
  $("searchInput").addEventListener("keydown", (e) => { if (e.key === "Escape") $("searchBar").hidden = true; });

  const menu = $("menuToggle");
  if (menu) menu.addEventListener("click", () => $("mainNav").classList.toggle("open"));

  window.addEventListener("hashchange", () => D360.send("Page View", { page: location.hash || "#home" }));
  if (location.hash) { const el = document.querySelector(location.hash); if (el) setTimeout(() => el.scrollIntoView(), 0); }
});
