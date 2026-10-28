const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const { applyTheme } = require(path.join(process.env.PPTX_SKILL_DIR || ".", "scripts/apply_theme.js"));

const OUT = process.argv[2] || "westerly-architecture.pptx";

// Salesforce reference-architecture palette: navy titles, teal flows, Salesforce blue for Salesforce products.
const THEME = {
  name: "Westerly Market",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "181818", lt1: "FFFFFF", dk2: "032D60", lt2: "C9C9C9",
    accent1: "0B827C", accent2: "0176D3", accent3: "BA5A00", accent4: "5C5C5C",
    accent5: "29B5E8", accent6: "5A1BA9", hlink: "0176D3", folHlink: "5C5C5C",
  },
};
const HEX = THEME.colors;

async function icon(Comp, color) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: 256 }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pres.title = "Westerly Market architecture";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  pres.defineSlideMaster({
    title: "Title only",
    background: { color: C.background1 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.35, w: 12.1, h: 0.75, fontSize: 36, bold: true, color: C.text2, margin: 0, align: "left", valign: "top" }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 1.1, w: 12.1, h: 0.45, fontSize: 16, color: C.accent4, margin: 0, valign: "top" }, text: "" } },
      { text: { text: "Westerly Market × Salesforce", options: { x: 0.6, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: C.accent4, margin: 0 } } },
    ],
    slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: C.accent4, align: "right" },
  });

  const icons = {
    site: await icon(fa.FaStore, HEX.accent1),
    erp: await icon(fa.FaWarehouse, HEX.accent1),
    snow: await icon(fa.FaSnowflake, HEX.accent5),
    service: await icon(fa.FaHeadset, HEX.accent2),
    mw: await icon(fa.FaExchangeAlt, HEX.accent4),
    d360: await icon(fa.FaProjectDiagram, HEX.accent6),
    cloud: await icon(fa.FaCloud, HEX.accent2),
    agent: await icon(fa.FaRobot, HEX.accent1),
    bi: await icon(fa.FaChartBar, HEX.accent5),
    bus: await icon(fa.FaStream, HEX.accent4),
  };

  // A system box: rounded card, icon, name and a few short lines.
  function box(slide, o) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: o.x, y: o.y, w: o.w, h: o.h, rectRadius: 0.08, objectName: o.name,
      fill: { color: o.fill || C.background1 }, line: { color: o.line || C.accent4, width: 1, dashType: o.dash ? "dash" : "solid" },
    });
    slide.addImage({ data: o.icon, x: o.x + 0.2, y: o.y + 0.2, w: 0.4, h: 0.4, objectName: o.name + " icon", altText: o.title + " icon" });
    slide.addText(o.title, {
      x: o.x + 0.7, y: o.y + 0.15, w: o.w - 0.85, h: 0.5, fontSize: 16, bold: true, color: o.titleColor || C.text2,
      margin: 0, valign: "middle", isTextBox: true, objectName: o.name + " title",
    });
    slide.addText(o.lines.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < o.lines.length - 1 } })), {
      x: o.x + 0.2, y: o.y + 0.75, w: o.w - 0.35, h: o.h - 0.9, fontSize: 12, color: o.textColor || C.text1,
      margin: 0, valign: "top", paraSpaceAfter: 3, isTextBox: true, objectName: o.name + " details",
    });
  }

  function arrow(slide, x1, y1, x2, y2, o = {}) {
    const flipH = x2 < x1, flipV = y2 < y1;
    slide.addShape(pres.shapes.LINE, {
      x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH, flipV,
      line: { color: o.color || C.accent1, width: o.width || 1.75, dashType: o.dash ? "dash" : "solid",
        endArrowType: o.noHead ? undefined : "triangle", beginArrowType: o.both ? "triangle" : undefined },
      objectName: o.name,
    });
  }

  function label(slide, text, x, y, w, h, o = {}) {
    slide.addText(text, { x, y, w, h, fontSize: 11, color: o.color || C.accent4, italic: !o.bold, bold: !!o.bold,
      align: o.align || "center", valign: o.valign || "middle", margin: 0, isTextBox: true, objectName: o.name });
  }

  function step(slide, n, x, y, color) {
    slide.addShape(pres.shapes.OVAL, { x, y, w: 0.36, h: 0.36, fill: { color }, line: { color: C.background1, width: 1.5 }, objectName: "step " + n });
    slide.addText(String(n), { x, y, w: 0.36, h: 0.36, fontSize: 13, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "step " + n + " number" });
  }

  // ---------- Slide 1: current state ----------
  pres.addSection({ title: "Architecture" });
  const s1 = pres.addSlide({ masterName: "Title only", sectionTitle: "Architecture" });
  s1.addText("Today: orders, analytics and service live apart", { placeholder: "title" });

  const R1 = 1.5, H1 = 1.95;
  box(s1, { name: "Website", x: 0.6, y: R1, w: 2.5, h: H1, icon: icons.site, title: "Westerly website",
    lines: ["Online shop and checkout", "Shows prices and stock", "No shopper history"] });
  box(s1, { name: "ERP", x: 7.0, y: R1, w: 2.5, h: H1, icon: icons.erp, title: "ERP",
    lines: ["System of record", "Orders and fulfillment", "Products, prices, inventory"] });
  box(s1, { name: "Snowflake", x: 10.25, y: R1, w: 2.45, h: H1, icon: icons.snow, title: "Snowflake",
    lines: ["Analytics warehouse", "Copy of ERP data", "BI reports, forecasts"] });

  const mid1 = R1 + H1 / 2;
  arrow(s1, 3.1, mid1 - 0.25, 7.0, mid1 - 0.25, { name: "site to ERP" });
  arrow(s1, 7.0, mid1 + 0.25, 3.1, mid1 + 0.25, { name: "ERP to site" });
  label(s1, "Integration layer", 3.1, mid1 - 0.2, 3.9, 0.4, { bold: true, color: C.text2, name: "Integration label" });
  label(s1, "Orders", 3.1, mid1 - 0.62, 3.9, 0.3, { name: "orders label" });
  label(s1, "Stock and prices", 3.1, mid1 + 0.32, 3.9, 0.3, { name: "stock label" });
  label(s1, "iPaaS or custom APIs, e.g. MuleSoft, Boomi", 3.1, mid1 + 0.65, 3.9, 0.3, { name: "Integration tools label" });
  arrow(s1, 9.5, mid1, 10.25, mid1, { name: "ERP to Snowflake", color: C.accent4, dash: true });
  step(s1, 1, 3.3, mid1 - 0.7, C.accent1);
  step(s1, 2, 6.45, mid1 + 0.35, C.accent1);
  step(s1, 3, 9.7, mid1 - 0.5, C.accent4);

  box(s1, { name: "Service Cloud", x: 7.0, y: 4.1, w: 5.7, h: 1.95, icon: icons.cloud, title: "Salesforce Service Cloud", titleColor: C.accent2,
    lines: ["Cases and contacts for support reps", "No order, inventory or website data inside",
      "Reps switch to the ERP screen to answer \"where's my order?\""] });
  arrow(s1, 8.25, 4.1, 8.25, R1 + H1, { name: "rep lookup in ERP", color: C.accent3, dash: true, both: true });
  step(s1, 4, 8.45, 3.55, C.accent3);

  // How the data moves today.
  const legend = [
    ["1", "Checkout sends the order to the ERP in real time through the integration layer (order API or message queue)."],
    ["2", "The ERP sends stock and prices back to the site, every few minutes or on change."],
    ["3", "A scheduled ELT tool (e.g. Fivetran, Matillion, Informatica) copies ERP tables into Snowflake hourly or nightly."],
    ["4", "Reps look up orders in the ERP by hand. Service Cloud has no link to Snowflake or the website."],
  ];
  s1.addText(legend.map(([n, t], i) => ([
    { text: n + "  ", options: { bold: true, color: n === "4" ? C.accent3 : (n === "3" ? C.accent4 : C.accent1) } },
    { text: t, options: { breakLine: i < legend.length - 1 } },
  ])).flat(), {
    x: 0.6, y: 4.1, w: 5.95, h: 1.95, fontSize: 12, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 6,
    isTextBox: true, objectName: "How data moves today",
  });

  s1.addNotes([
    "Current state (illustrative). The demo has no real ERP: Snowflake is seeded by a setup script, and the site's checkout only sends Web SDK events.",
    "",
    "1. Website to ERP: when a shopper checks out, the commerce platform or site backend calls the ERP's sales order API, usually through an integration layer (MuleSoft, Boomi, or custom middleware with a message queue). It's real time because the ERP has to reserve stock, take payment and start picking right away.",
    "2. ERP to website: stock levels and prices flow back to the site, on change or every few minutes, so the shop doesn't sell what's out of stock.",
    "3. ERP to Snowflake: a scheduled ELT job (Fivetran, Matillion, Informatica, or the ERP vendor's own connector), often using change data capture, copies the ERP tables into Snowflake hourly or nightly. Why ELT and why batch: the ERP is a transactional system and isn't built for heavy reporting queries, so the data is copied out on a schedule to protect its performance, then transformed inside Snowflake where compute is cheap and scales. Snowflake becomes the one place for analytics across orders, inventory and products.",
    "4. Service Cloud: cases live in Salesforce, but the order, inventory and website data don't. Reps swivel between Service Cloud and the ERP screen, and nobody sees what the shopper did on the site.",
  ].join("\n"));

  // ---------- Slide 2: future state, Data 360 at the center ----------
  const s2 = pres.addSlide({ masterName: "Title only", sectionTitle: "Architecture" });
  s2.addText("Unified Customer View at the heart of D360", { placeholder: "title" });

  // A small component tile inside a group, like the reference architecture.
  function tile(slide, o) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: o.x, y: o.y, w: o.w, h: o.h, rectRadius: 0.06, fill: { color: C.background1 }, line: { color: C.accent4, width: 1 }, objectName: o.title });
    slide.addText([
      { text: o.title, options: { fontSize: o.size || 13, color: C.text1, breakLine: !!o.sub } },
      ...(o.sub ? [{ text: o.sub, options: { fontSize: 10, color: C.accent4 } }] : []),
    ], { x: o.x + 0.05, y: o.y, w: o.w - 0.1, h: o.h, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: o.title + " text" });
  }
  function small(slide, text, x, y, w, h, o = {}) {
    slide.addText(text, { x, y, w, h, fontSize: 10, color: o.color || C.accent4, align: o.align || "left", valign: o.valign || "middle", margin: 0, rotate: o.rotate, isTextBox: true, objectName: o.name || text });
  }

  // Top: the Salesforce org and the website.
  s2.addShape(pres.shapes.RECTANGLE, { x: 4.0, y: 1.05, w: 5.4, h: 0.28, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: "Salesforce org label" });
  s2.addText("Westerly Salesforce org", { x: 4.0, y: 1.05, w: 5.4, h: 0.28, fontSize: 13, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "Salesforce org label text" });
  s2.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.0, y: 1.33, w: 5.4, h: 1.07, rectRadius: 0.06, fill: { color: C.background1 }, line: { color: C.accent4, width: 1 }, objectName: "Service Cloud" });
  s2.addImage({ data: icons.cloud, x: 4.12, y: 1.4, w: 0.3, h: 0.3, objectName: "Service Cloud icon", altText: "Salesforce cloud icon" });
  s2.addText("Service Cloud + Agentforce", { x: 4.5, y: 1.38, w: 4.7, h: 0.35, fontSize: 14, bold: true, color: C.accent2, margin: 0, valign: "middle", isTextBox: true, objectName: "Service Cloud title" });
  s2.addText("Reps and Coworker see the unified shopper profile on every case", { x: 4.5, y: 1.75, w: 4.75, h: 0.55, fontSize: 11, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Service Cloud details" });

  s2.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 1.33, w: 2.6, h: 1.07, rectRadius: 0.06, fill: { color: C.background1 }, line: { color: C.accent4, width: 1 }, objectName: "Website" });
  s2.addImage({ data: icons.agent, x: 0.62, y: 1.4, w: 0.3, h: 0.3, objectName: "Website icon", altText: "Agent icon" });
  s2.addText("Website + ADK agent", { x: 1.0, y: 1.38, w: 2.05, h: 0.35, fontSize: 14, bold: true, color: C.text2, margin: 0, valign: "middle", isTextBox: true, objectName: "Website title" });
  s2.addText("Gemini shopping agent, live stock, the shopper's orders", { x: 0.62, y: 1.75, w: 2.4, h: 0.55, fontSize: 11, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Website details" });
  arrow(s2, 3.1, 1.95, 4.0, 1.95, { name: "agent opens case", dash: true });
  small(s2, "Opens Case (API)", 3.12, 1.42, 0.86, 0.48, { align: "center", valign: "bottom" });

  // Center: Data 360.
  const DX = 1.25, DY = 2.75, DW = 8.35, DH = 2.7;
  s2.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: DX, y: DY, w: DW, h: DH, rectRadius: 0.15, fill: { color: C.background1 }, line: { color: C.accent4, width: 1.25 }, objectName: "Data 360" });
  s2.addImage({ data: icons.d360, x: DX + 0.18, y: DY + 0.1, w: 0.36, h: 0.36, objectName: "Data 360 icon", altText: "Data 360 icon" });
  s2.addText("Data 360", { x: DX + 0.62, y: DY + 0.07, w: 3, h: 0.42, fontSize: 22, bold: true, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "Data 360 title" });

  const Q1 = 3.3, Q2 = 4.5, QH = 0.8;
  s2.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 1.45, y: Q1, w: 2.0, h: Q2 + QH - Q1, rectRadius: 0.06, fill: { color: C.background1 }, line: { color: C.accent4, width: 1 }, objectName: "Data streams" });
  s2.addText([
    { text: "Data streams", options: { fontSize: 13, bold: true, color: C.text1, align: "center", breakLine: true } },
    { text: "Streaming", options: { fontSize: 11, bold: true, underline: { style: "sng" }, color: C.text1, breakLine: true } },
    { text: "Web SDK or Ingestion API: pages, cart, orders, agent handoffs", options: { fontSize: 10, color: C.text1, breakLine: true } },
    { text: "CRM connector: cases, contacts", options: { fontSize: 10, color: C.text1, breakLine: true } },
    { text: "Virtual (zero copy)", options: { fontSize: 11, bold: true, underline: { style: "sng" }, color: C.text1, breakLine: true } },
    { text: "Snowflake: orders, items, products, inventory", options: { fontSize: 10, color: C.text1 } },
  ], { x: 1.55, y: Q1 + 0.08, w: 1.8, h: Q2 + QH - Q1 - 0.16, margin: 0, valign: "top", paraSpaceAfter: 4, isTextBox: true, objectName: "Data streams text" });

  const TY = 3.85, TH = 0.9, TM = TY + TH / 2;
  tile(s2, { x: 3.85, y: TY, w: 1.65, h: TH, title: "Customer 360 data model" });
  tile(s2, { x: 5.85, y: TY, w: 1.65, h: TH, title: "Unified profiles" });
  tile(s2, { x: 7.85, y: TY, w: 1.55, h: TH, title: "Calculated insights", sub: "Top Shopper" });
  arrow(s2, 3.45, TM, 3.85, TM, { name: "streams to model", color: C.text1, width: 1 });
  arrow(s2, 5.5, TM, 5.85, TM, { name: "model to profiles", color: C.text1, width: 1 });
  arrow(s2, 7.5, TM, 7.85, TM, { name: "profiles to insights", color: C.text1, width: 1 });

  // Data 360 to the top consumers.
  arrow(s2, 1.9, 2.4, 1.9, Q1, { name: "web events in" });
  small(s2, "Web SDK or Ingestion API", 1.98, 2.4, 0.95, 0.35);
  // Service Cloud cases and contacts flow into the data streams through the CRM connector.
  arrow(s2, 4.3, 2.4, 4.3, 3.6, { name: "CRM data down", noHead: true });
  arrow(s2, 4.3, 3.6, 3.45, 3.6, { name: "CRM data in" });
  small(s2, "Cases, contacts (CRM connector)", 4.38, 2.4, 2.2, 0.35);
  arrow(s2, 2.95, DY, 2.95, 2.4, { name: "profile to site", dash: true });
  small(s2, "Shopper profile", 3.03, 2.4, 0.95, 0.35);
  arrow(s2, 6.7, DY, 6.7, 2.4, { name: "profile to service" });
  small(s2, "Profile and grounding", 6.78, 2.4, 1.6, 0.35);

  // Right: data shares to Snowflake for analytics, and what changes.
  arrow(s2, DX + DW, Q2 + 0.4, 10.1, Q2 + 0.4, { name: "data shares out" });
  small(s2, "Data shares", DX + DW + 0.02, Q2 + 0.1, 0.5, 0.28, { align: "center" });
  box(s2, { name: "Snowflake analytics", x: 10.1, y: Q2 - 0.35, w: 2.75, h: 1.5, icon: icons.snow, title: "Snowflake",
    lines: ["Profiles, web activity and insights for analysts"] });
  s2.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.1, y: 1.33, w: 2.75, h: 2.5, rectRadius: 0.06, fill: { color: C.background1 }, line: { color: C.accent1, width: 1.25 }, objectName: "What changes" });
  s2.addText([
    { text: "What changes", options: { fontSize: 14, bold: true, color: C.accent1, breakLine: true } },
    { text: "Snowflake is streamed in seconds, not loaded nightly", options: { bullet: true, breakLine: true } },
    { text: "Site, agent and reps share one profile", options: { bullet: true, breakLine: true } },
    { text: "Stock and checkout stay on the ERP", options: { bullet: true } },
  ], { x: 10.25, y: 1.43, w: 2.5, h: 2.3, fontSize: 12, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 6, isTextBox: true, objectName: "What changes text" });

  // Bottom: sources.
  const BY = 5.95, BHt = 0.95;
  box(s2, { name: "ERP", x: 0.5, y: BY, w: 2.2, h: BHt, icon: icons.erp, title: "ERP", lines: ["System of record"] });
  box(s2, { name: "Snowflake source", x: 5.8, y: BY, w: 2.4, h: BHt, icon: icons.snow, title: "Snowflake", lines: ["Streamed in seconds"] });
  arrow(s2, 2.7, BY + 0.48, 5.8, BY + 0.48, { name: "ERP to Snowflake" });
  small(s2, "Streaming (CDC + Snowpipe Streaming)", 2.7, BY + 0.12, 3.1, 0.3, { align: "center" });
  // Zero copy into the data streams.
  const ZY = 5.7;
  arrow(s2, 7.0, BY, 7.0, ZY, { name: "zero copy up", noHead: true });
  arrow(s2, 7.0, ZY, 2.45, ZY, { name: "zero copy across", noHead: true });
  arrow(s2, 2.45, ZY, 2.45, Q2 + QH, { name: "zero copy in" });
  small(s2, "Virtual (zero copy)", 4.6, ZY - 0.26, 1.6, 0.24, { align: "center", color: C.accent1 });
  // Operational lane: checkout and live stock between the site and the ERP, outside Data 360.
  arrow(s2, 0.72, 2.4, 0.72, BY, { name: "checkout and live stock", both: true, color: C.accent4 });
  small(s2, "Checkout, live stock", 0.03, 4.0, 1.9, 0.3, { align: "center", rotate: 270, name: "checkout lane label" });

  s2.addNotes([
    "Future state: Data 360 at the center of the shopper view; real-time operations stay on the ERP.",
    "",
    "Sources (bottom): the ERP stays the system of record and streams every order and stock change to Snowflake (change data capture plus Snowpipe Streaming) within seconds, replacing the nightly ELT.",
    "Data streams: Data 360 reads the Snowflake orders, order items, products and inventory tables in place (virtual, zero copy). Because Snowflake is now streamed, Data 360 is as current as the ERP. The site streams page views, cart and order events to Data 360 in real time, through the Web SDK in the browser or the Ingestion API (streaming) from the site backend and the agent. The Salesforce CRM connector brings Service Cloud cases and contacts into Data 360, so each shopper's cases join the unified profile.",
    "Inside Data 360: the data maps to the Customer 360 data model, is unified into shopper profiles, and calculated insights such as Top Shopper are computed on them.",
    "Consumers (top): Service Cloud shows the profile on the Case page (Westerly panel, Website Activity) and Agentforce Coworker grounds its answers on it. The site backend and the Google ADK agent read the same profile (likely the Data Graph API) for a signed-in shopper's orders, status and offers. To test: lookup speed over zero-copy data with acceleration off. Agent handoff: when the shopper asks for a person, the agent creates the Case directly in Service Cloud (Salesforce REST API, or Pub/Sub API with a Platform Event) so the shopper gets a case number right away. In the same step it sends a handoff event (reason, conversation summary, SKUs discussed) to Data 360 through the Web SDK or Ingestion API, so the rep and Coworker see why the shopper asked for help.",
    "Data shares (right): Data 360 shares unified profiles, website engagement and insights back to Snowflake, zero copy, for Westerly's analysts.",
    "Operational lane (left): checkout calls the ERP order API, which reserves stock, and the site gets live stock and order status from the ERP. This stays off Data 360: each page view would run a query and cost credits, and only the ERP can settle the last unit.",
  ].join("\n"));

  // ---------- Slide 3: how the future state works ----------
  const s3 = pres.addSlide({ masterName: "Title only", sectionTitle: "Architecture" });
  s3.addText("How the unified customer view works", { placeholder: "title" });
  const points = [
    ["1", "The ERP stays the system of record and streams every order and stock change to Snowflake in seconds (CDC + Snowpipe Streaming), replacing the nightly ELT."],
    ["2", "Data 360 reads the Snowflake orders, order items, products and inventory in place with zero copy: no new pipeline, no duplicate data."],
    ["3", "The website sends page views, cart and order events to Data 360 in real time through the Web SDK or the Ingestion API."],
    ["4", "Service Cloud cases and contacts flow into Data 360 through the CRM connector."],
    ["5", "Data 360 maps it all to the Customer 360 data model, builds one unified profile per shopper and computes insights such as Top Shopper."],
    ["6", "Reps and Agentforce Coworker see that profile on every case. The website and the Google ADK agent read the same profile for signed-in shoppers."],
    ["7", "When a shopper asks for a person, the agent opens the Case directly in Service Cloud and sends the handoff context to Data 360."],
    ["8", "Data 360 shares profiles, web activity and insights back to Snowflake for analysts, zero copy."],
    ["9", "Checkout and live stock stay on the ERP: only it can reserve the last unit."],
  ];
  s3.addText(points.map(([n, t], i) => ([
    { text: n + "  ", options: { bold: true, color: n === "9" ? C.accent4 : C.accent1 } },
    { text: t, options: { breakLine: i < points.length - 1 } },
  ])).flat(), {
    x: 0.6, y: 1.35, w: 12.1, h: 5.3, fontSize: 16, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 10,
    isTextBox: true, objectName: "How the future state works",
  });
  s3.addNotes("Walk the previous diagram from the bottom up: sources (1-4), Data 360 (5), the people and agents who use the profile (6-7), analytics (8), and what stays on the ERP (9).");

  // ---------- Slide 4: demo flow as a journey ----------
  pres.addSection({ title: "Demo" });
  const s4 = pres.addSlide({ masterName: "Title only", sectionTitle: "Demo" });
  s4.addText("Shopper & Rep Experience | Web + Agent", { placeholder: "title" });
  s4.addText("Our shopper, Maya, ordered groceries for tonight's curry on the Westerly site, then noticed the garam masala is missing. Maya asks the Westerly shopping agent for help, and a rep picks up from there.",
    { placeholder: "body", italic: true });

  const G = C.accent3, SF = C.accent2;   // Google, Salesforce
  // [who, runs]: who is "g", "sf" or "both"; runs are [text, highlight?].
  const stops = [
    ["sf", [["Maya signs in and shops. The "], ["Data 360 Web SDK", 1], [" streams every page view, search and cart add."]]],
    ["g", [["The "], ["Google ADK agent", 1], [" (Gemini) suggests a curry recipe, finds the ingredients in the catalog and adds them to the cart."]]],
    ["sf", [["Maya places the order. "], ["Data 360", 1], [" joins the web activity with the Snowflake order history (zero copy) into one "], ["unified profile", 1], [": a Top Shopper."]]],
    ["both", [["Maya asks the "], ["agent", 1, G], [" to add garam masala. It confirms the order, then opens a "], ["Case", 1], [" in "], ["Service Cloud", 1], [" with the order ID and a chat summary."]]],
    ["sf", [["Case routing", 1], [" sends the case to the "], ["Westerly Support", 1], [" queue, and it lands with Jordan in the "], ["Service Console", 1], ["."]]],
    ["sf", [["Jordan sees the "], ["Westerly panel", 1], [": the agent's summary, the unified profile, recent orders and "], ["Website Activity", 1], ["."]]],
    ["sf", [["Jordan asks "], ["Agentforce Coworker", 1], [" if the item can be added. Coworker sees the order is not yet picked and cites the "], ["knowledge article", 1], ["."]]],
    ["sf", [["Jordan confirms the garam masala can be added, updates Maya and "], ["closes the case", 1], [". The case history flows back to "], ["Data 360", 1], ["."]]],
  ].map(([who, runs], i) => ({ who, runs, x: 1.65 + i * 1.4, y: [5.75, 3.4, 5.75, 3.35, 5.7, 3.4, 5.75, 3.4][i], top: i % 2 === 1 }));

  // The trail winds through every stop; the bends between stops vary so it reads as a path, not a wave.
  const bends = [
    [[0.8, 5.25]],
    [[2.4, 5.35], [2.25, 4.45]],
    [[3.8, 3.5], [4.1, 4.3], [3.8, 5.0]],
    [[5.25, 5.45], [5.4, 4.5]],
    [[6.65, 3.5], [6.85, 4.55]],
    [[8.05, 5.55], [8.35, 4.75], [8.05, 4.05]],
    [[9.5, 3.5], [9.7, 4.4], [9.45, 5.1]],
    [[10.8, 5.45], [10.95, 4.45]],
    [[12.25, 3.45], [12.8, 4.0]],
  ];
  const way = [{ x: 0.45, y: 4.2 }];
  bends.forEach((b, i) => {
    b.forEach(([x, y]) => way.push({ x, y }));
    if (stops[i]) way.push({ x: stops[i].x, y: stops[i].y });
  });
  const pts = [{ x: way[0].x, y: way[0].y }];
  for (let i = 0; i < way.length - 1; i++) {
    const p0 = way[Math.max(i - 1, 0)], p1 = way[i], p2 = way[i + 1], p3 = way[Math.min(i + 2, way.length - 1)];
    pts.push({ x: p2.x, y: p2.y, curve: { type: "cubic",
      x1: p1.x + (p2.x - p0.x) / 6, y1: p1.y + (p2.y - p0.y) / 6, x2: p2.x - (p3.x - p1.x) / 6, y2: p2.y - (p3.y - p1.y) / 6 } });
  }
  s4.addShape(pres.shapes.CUSTOM_GEOMETRY, { x: 0, y: 0, w: 13.333, h: 7.5, points: pts,
    fill: { color: C.background1, transparency: 100 }, line: { color: C.accent1, width: 20, transparency: 82 }, objectName: "Journey glow" });
  s4.addShape(pres.shapes.CUSTOM_GEOMETRY, { x: 0, y: 0, w: 13.333, h: 7.5, points: pts,
    fill: { color: C.background1, transparency: 100 }, line: { color: C.accent1, width: 9 }, objectName: "Journey path" });

  // A stop: a solid circle, or a circle split between Google and Salesforce.
  function stopMark(slide, cx, cy, who, name, d = 0.46, num) {
    const x = cx - d / 2, y = cy - d / 2;
    if (num) slide.addShape(pres.shapes.OVAL, { x: x - 0.05, y: y - 0.05, w: d + 0.1, h: d + 0.1, fill: { color: C.background1 }, line: { color: C.background1, width: 0 },
      shadow: { type: "outer", blur: 5, offset: 1.5, angle: 90, color: "000000", opacity: 0.3 }, objectName: name + " ring" });
    if (who === "both") {
      slide.addShape(pres.shapes.PIE, { x, y, w: d, h: d, angleRange: [135, 315], fill: { color: G }, line: { color: G, width: 0 }, objectName: name + " Google half" });
      slide.addShape(pres.shapes.PIE, { x, y, w: d, h: d, angleRange: [315, 135], fill: { color: SF }, line: { color: SF, width: 0 }, objectName: name + " Salesforce half" });
      slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: C.background1, transparency: 100 }, line: { color: C.background1, width: 2 }, objectName: name });
    } else {
      slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: who === "g" ? G : SF }, line: { color: C.background1, width: 2 }, objectName: name });
    }
    if (num) slide.addText(String(num), { x, y, w: d, h: d, fontSize: 13, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: name + " number" });
  }

  stops.forEach((s, i) => {
    stopMark(s4, s.x, s.y, s.who, "stop " + (i + 1), 0.5, i + 1);
    const top = s.top, W = 2.55;
    s4.addText(s.runs.map(([t, hi, col]) => ({ text: t, options: hi ? { bold: true, color: col || (s.who === "g" ? G : SF) } : {} })), {
      x: Math.max(0.4, s.x - W / 2), y: top ? 1.75 : s.y + 0.36, w: W, h: top ? s.y - 0.36 - 1.75 : 6.95 - (s.y + 0.36),
      fontSize: 11, bold: true, color: C.text2, align: "center", valign: top ? "bottom" : "top", margin: 0,
      isTextBox: true, objectName: "stop " + (i + 1) + " text" });
  });

  // Trail key.
  const KX = 11.35, KY = 5.15;
  s4.addShape(pres.shapes.RECTANGLE, { x: KX, y: KY, w: 1.6, h: 0.26, fill: { color: SF }, line: { color: SF, width: 0 }, objectName: "Trail key label" });
  s4.addText("TRAIL KEY", { x: KX, y: KY, w: 1.6, h: 0.26, fontSize: 9, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "Trail key title" });
  [["both", "Google + Salesforce"], ["sf", "Salesforce"], ["g", "Google"]].forEach(([who, t], i) => {
    const y = KY + 0.5 + i * 0.36;
    stopMark(s4, KX + 0.15, y, who, "key " + t, 0.26);
    s4.addText(t, { x: KX + 0.38, y: y - 0.14, w: 1.4, h: 0.28, fontSize: 10, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "key " + t + " text" });
  });
  const jy = KY + 0.5 + 3 * 0.36;
  s4.addShape(pres.shapes.LINE, { x: KX + 0.02, y: jy, w: 0.26, h: 0, line: { color: C.accent1, width: 5 }, objectName: "key journey line" });
  s4.addText("Journey", { x: KX + 0.38, y: jy - 0.14, w: 1.4, h: 0.28, fontSize: 10, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "key journey text" });

  s4.addNotes([
    "Demo flow, in eight stops. Maya and Jordan are stand-in names; use the demo contact's name when presenting.",
    "1. The shopper signs in on the Heroku site; the Data 360 Web SDK streams page views, searches and cart adds.",
    "2. The Google ADK agent (Westerly Shopper, Gemini) suggests a recipe, searches the catalog and adds the ingredients to the cart.",
    "3. The order is placed. Data 360 unifies web activity with the Snowflake order history (zero copy) through identity resolution; the Westerly Shopper Metrics insight flags a Top Shopper.",
    "4. The shopper asks the agent to add garam masala to the order. The agent confirms the signed-in shopper and the order, shows the case summary, waits for a yes, then creates a Case through the Salesforce API with the customer ID, order ID and conversation summary (no payment data). It also sends the handoff context to Data 360.",
    "5. Case routing puts the case in the Westerly Support queue and assigns it to the rep in the Service - Console app.",
    "6. The Westerly panel on the Case shows the agent's summary, the unified shopper profile, recent orders with the case's order highlighted, and Website Activity from the Web SDK.",
    "7. The rep asks Agentforce Coworker whether the item can be added. Coworker reads the order status on the case (Not yet picked) and cites the Westerly knowledge article: items can be added until the order is picked.",
    "8. The rep confirms with the shopper and closes the case; the CRM connector brings the case back into Data 360.",
  ].join("\n"));

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
