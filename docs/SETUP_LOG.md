# Westerly Market × Data 360: setup log

A running record of every step used to build the Westerly Market demo: Snowflake source tables, the Heroku
grocery site, and the Data 360 org (streams, data model, identity resolution, calculated insights, Web SDK).
It is the source material for the handoff GitHub repo. Keep it updated as each step lands.

- **Status legend:** ✅ done and verified · 🟡 done, with a known gap · ⏳ pending
- **Exact request payloads** for every org change are in [`setup/data360/`](../setup/data360), numbered to match
  the steps below. Each file is `{toolName, params}` for the Data 360 MCP server's `execute` endpoint.
- **Placeholders:** `<ORG_ALIAS>`, `<MY_DOMAIN>`, `<CONSUMER_KEY>`, `<SNOWFLAKE_CONNECTION_ID>`,
  `<HEROKU_APP_URL>`, `<WEB_CONNECTOR_ID>`. No credentials or keys are stored in this repo.

---

## 0. Tooling and org access ✅

**Goal:** let Claude Code change the Data 360 org through the org's hosted MCP server.

1. **Salesforce CLI login:** `sf org login web --alias <ORG_ALIAS> --instance-url https://<MY_DOMAIN>.my.salesforce.com`
2. **External Client App** (Setup → External Client App Manager → New External Client App):
   - Name `Claude MCP`, Distribution State **Local**.
   - Enable OAuth. Callback URL `http://localhost:8080/callback` (add `https://claude.ai/api/mcp/auth_callback`
     for Claude Desktop).
   - Scopes: **Access Salesforce hosted MCP servers (mcp_api)** and **Perform requests at any time
     (refresh_token, offline_access)**.
   - Flow Enablement: all unchecked.
   - Security: only **Require PKCE** and **Issue JWT-based access tokens for named users**. Leave both
     "Require secret…" boxes unchecked.
   - Wait 10–30 minutes for activation, then copy the **Consumer Key** (not the secret).
3. **Register the MCP server in Claude Code:**
   ```bash
   claude mcp add --transport http --scope user --client-id <CONSUMER_KEY> --callback-port 8080 \
     <SERVER_NAME> https://api.salesforce.com/platform/mcp/v1/d/<MY_DOMAIN>/platform/headless-360
   ```
   Then `/mcp` → sign in with the target org's user (use a private window) → Allow.

**Gotchas**
- `OAUTH_AUTHORIZATION_BLOCKED: Cross-org OAuth flows are not supported` means the External Client App was
  created in a different org from the one you signed in to. Create it in the target org.
- `redirect_uri_mismatch` / `invalid_client` right after creating the app: it isn't active yet; wait.
- Calls go to `POST /services/data/v67.0/ssot/mcp/execute` with body
  `{"toolName": "...", "paramsJson": "<params as a JSON string>"}`. Don't send a `userType` field (rejected).
  In this org the read-only dispatch route returned `ROUTE_NOT_FOUND`, so reads also used `dispatch`.

## 1. Snowflake source tables and connection ✅

- **Script:** run [`setup/snowflake/westerly_snowflake_setup.sql`](../setup/snowflake/westerly_snowflake_setup.sql)
  top to bottom in a Snowsight worksheet as ACCOUNTADMIN. It creates:
  - warehouse `WESTERLY_WH` (XSMALL, auto-suspend 60s)
  - database `WESTERLY_MARKET`, schemas `SALES` (CUSTOMERS, ORDERS, ORDER_ITEMS) and `INVENTORY`
    (PRODUCTS, STORE_INVENTORY)
  - fictional demo data: 5 customers, 26 orders, 258 order items, 52 products, 104 inventory rows. Order
    dates are relative to the run time, so CUST_001 stays a Top Shopper (8 orders in the last 30 days).
  - read-only role `DATA360_READER` (warehouse usage, SELECT on all and future tables) and service user
    `DATA360_SVC` for the Data 360 connection
  - check queries and commented "live demo" stock updates (set an item to 0, then restock)
- **Connection:** a Snowflake connection named `Westerly_Snowflake` in Data 360 (Setup → Data Cloud →
  Other Connectors → Snowflake), using **key-pair authentication**. The private key stays with the Snowflake
  admin and is never committed. Generate the pair with `openssl`, set the public key on `DATA360_SVC`
  (the commented `ALTER USER … SET RSA_PUBLIC_KEY` line in the script), and paste the private key only into
  the Data 360 connection form.

## 2. Snowflake data streams (zero copy) ✅

Payloads: `02-stream-*.json` (`d360_datastream_create_snowflake`). All in the `default` data space,
`dataAccessMode: DIRECT_ACCESS`, acceleration **off** (always live).

| Stream / DLO | Source | Category | Primary key | Event date |
|---|---|---|---|---|
| `Westerly_Customers` / `Westerly_Customers__dll` | SALES.CUSTOMERS | Profile | CUSTOMER_ID | none |
| `Westerly_Customer_Ids` / `Westerly_Customer_Ids__dll` | SALES.CUSTOMERS_V (view, step 7) | Profile | CUSTOMER_ID | none |
| `Westerly_Orders` / `Westerly_Orders__dll` | SALES.ORDERS | Engagement | ORDER_ID | `order_date` |
| `Westerly_Order_Items` / `Westerly_Order_Items__dll` | SALES.ORDER_ITEMS | Other | ORDER_ITEM_ID | none |
| `Westerly_Products` / `Westerly_Products__dll` | INVENTORY.PRODUCTS | Other | SKU | none |
| `Westerly_Store_Inventory` / `Westerly_Store_Inventory__dll` | INVENTORY.STORE_INVENTORY | Other | INVENTORY_ID | none |

**Gotchas**
- `eventDateTimeFieldName` must be the Data 360 field name (`order_date`), not the Snowflake column
  (`ORDER_DATE`). Otherwise: "There can be only one eventDate field of type date for category Engagement".
- Zero-copy streams can't take formula fields or new DLO fields. Constant columns must come from a Snowflake
  view (see step 7).

## 3. Custom DMO: Store Inventory ✅

Payload: `03-dmo-store-inventory.json` (`d360_dmo_create`). `Store_Inventory__dlm`, category Other, fields
`Inventory_Id__c` (PK), `Store_Id__c`, `SKU__c`, `Quantity_On_Hand__c`, `Last_Modified__c`.

## 4. Snowflake DLO → DMO mappings ✅

Payloads: `04-map-*.json` (`d360_dmo_mapping_create`). The system adds `KQ_` key-qualifier mappings itself.

| Source DLO | Target DMO | Key fields |
|---|---|---|
| Westerly_Customers | Individual | customer_id → Id; first/last name; created_at; last_modified |
| Westerly_Customers | Contact Point Email | customer_id → Id, Party; email → Email Address |
| Westerly_Orders | Sales Order | order_id → Id; customer_id → Sold To Customer; store, date, status, channel, total |
| Westerly_Order_Items | Sales Order Product | order_item_id → Id; order, sku → Product, quantity, unit price, line total |
| Westerly_Products | Goods Product | sku → Id; name; category; regular price |
| Westerly_Store_Inventory | Store Inventory (custom) | all five fields |

Customer Party Identification comes from the `CUSTOMERS_V` view instead (step 7).

🟡 Unmapped Snowflake fields: `item_count` (orders), `price` and `pack_size` (products).

## 5. Identity resolution: ruleset `wstr` ✅

Payloads: `05-identity-resolution-ruleset.json` (`d360_ir_create`), `05-identity-resolution-run.json`
(`d360_ir_run`). Ruleset "Westerly Customer Match", Individual, manual runs. Reconciliation: Last Updated.
Match rule: **exact normalized email** on Contact Point Email. Output link object:
`UnifiedLinkssotIndividualWstr__dlm`. The **exact customer ID** rule is added in step 7.

## 6. Calculated insight: Westerly Shopper Metrics ✅

Payloads: `06-calculated-insight-shopper-metrics.json` (`d360_ci_create`), `06-calculated-insight-run.json`.
`Westerly_Shopper_Metrics__cio`, per unified customer: orders in the last 30 days, total orders, average cart
value, and a Top Shopper flag (> 5 orders).

**Gotchas**
- `INTERVAL` syntax is rejected; use `DATEDIFF(CURRENT_DATE(), <date>) <= 30`.
- `d360_ci_create` needs a schedule start date.
- `d360_ci_validate` and `d360_ci_run_status` returned "not supported for this org"; create and run worked.

## 7. Customer ID match rule (Party Identification) 🟡

A Party Identification match rule only compares rows whose `Name` and `Type` equal the rule's party name and
type, so both sources must fill them with the same constant, `Westerly Customer ID`. Zero-copy Snowflake
streams can't add formula fields, so the Snowflake side gets the constants from a view.

1. In Snowflake, create a view over CUSTOMERS with the two constant columns Party Identification needs:
   ```sql
   CREATE OR REPLACE VIEW WESTERLY_MARKET.SALES.CUSTOMERS_V AS
     SELECT c.*, 'Westerly Customer ID' AS PARTY_ID_NAME, 'Westerly Customer ID' AS PARTY_ID_TYPE
     FROM WESTERLY_MARKET.SALES.CUSTOMERS c;
   ```
   `DATA360_READER` has SELECT on future tables only, so also run
   `GRANT SELECT ON VIEW WESTERLY_MARKET.SALES.CUSTOMERS_V TO ROLE DATA360_READER;`
   Check with `USE WAREHOUSE WESTERLY_WH;` then `SELECT CUSTOMER_ID, PARTY_ID_NAME, PARTY_ID_TYPE FROM
   WESTERLY_MARKET.SALES.CUSTOMERS_V;` (5 rows).
2. **Stream** `Westerly_Customer_Ids` / `Westerly_Customer_Ids__dll` over SALES.CUSTOMERS_V (Profile, PK
   CUSTOMER_ID, zero copy): `10-stream-customer-ids.json` (`d360_datastream_create_snowflake`).
3. **Mapping** → Party Identification: customer_id → Id, Party, Identification Number; party_id_name → Name;
   party_id_type → Party Identification Type: `10-map-customer-ids-party-identification.json`.
4. **Web identity stream formula fields** `party_id_name` and `party_id_type` = `"Westerly Customer ID"`:
   `11-web-stream-party-id-formula-fields.json` (`d360_datastream_update`, sparse: only the new `mappings`).
5. **Web Party Identification mapping**: add party_id_name → Name and party_id_type → Party Identification
   Type: `12-map-web-identity-party-id-name-type.json` (`d360_dmo_field_mapping_add`).
6. **Ruleset**: add an Exact rule on Party Identification `Identification Number` with party name/type
   `Westerly Customer ID`, keep the email rule, then run: `13-identity-resolution-*.json`
   (`d360_ir_update` publishes automatically; `d360_ir_run`).

**Gotchas**
- The Type field is `ssot__PartyIdentificationTypeId__c`. A wrong target field name in a mapping is dropped
  silently (the call still succeeds), so check the returned `fieldMappings`.
- Formula fields only apply to events ingested after the change: log in on the site again to get web
  Party Identification rows with Name/Type.
- Don't map Party Identification from both `Westerly_Customers` and `Westerly_Customer_Ids`; they share the
  same Id, so the rows overwrite each other.

**Verified 2026-10-22:** after the run, the web Individual for the CUST_001 login links to the same unified
profile as Snowflake's CUST_001 in `UnifiedLinkssotIndividualWstr__dlm`; anonymous visitors stay separate.
That web row predates the formula fields (no Name/Type), so this merge came from the email rule.

⏳ Verify the customer ID rule on its own: once a new login lands with `party_id_name`/`party_id_type` set,
rerun `wstr` and check the link again (ideally with a login whose email differs from Snowflake's).

**Timing:** the `wstr` run took ~40 minutes, and web events took 30+ minutes to land (some logins from
2026-10-22 had not landed after 45 minutes while the panel showed "Live: Web SDK").

## 8. Heroku website ✅

- Static grocery storefront (`index.html`, `styles.css`, `script.js`) served by `server.js` (Node) via
  `Procfile`. Local run: `node server.js` (port 5173).
- Deploy: push to the Heroku app; both `index.html` and `script.js` must ship together.
- `script.js` exposes `window.Westerly` (`getCustomer`, `getDeviceId`, `getCart`, `getCatalog`, `addToCart`,
  `openLogin`, `sendD360Event`) and an on-page "Data 360 events" panel that shows each event and whether the
  SDK is live.
- 2026-10-27: the "Data 360 events" panel is hidden on the site (`hidden` on `#d360Log` in `index.html`, plus a
  `.d360-log[hidden]` rule in `styles.css`). The Web SDK still sends every event; remove `hidden` to show the panel
  for a demo. Deploy `index.html` and `styles.css` together.
- 2026-10-27: favicon `favicon.svg` (the header logo: green rounded square, white "W"), linked from `index.html`.
  Deploy `index.html` and `favicon.svg` together.
- 2026-10-27: order confirmation after checkout: a 6-second pop-up with the order number, item count, total and a
  demo delivery window (`deliveryWindow()` in `script.js`: a 2-hour same-day slot starting 2 hours out, inside store
  hours; otherwise tomorrow morning). Deploy `script.js`.

## 9. Data 360 Web SDK ✅

1. **Website connection** (Setup → Websites & Mobile Apps → New, type Website): `Westerly site`, base URL
   `<HEROKU_APP_URL>`.
2. **Schema:** upload [`westerly-web-schema.json`](../westerly-web-schema.json). Engagement events: `pageView`,
   `addToCart`, `removeFromCart`, `orderPlaced`, `search`, `logout`. Profile event: `identity` (PK `deviceId`).
   Format is `{"records":[{masterLabel, developerName, category, externalDataTranFields:[…]}]}`. Required
   fields: category, dateTime, deviceId, eventId, eventType, sessionId (+ interactionName for engagement).
   After upload you can add events and optional fields but can't rename fields or change "required".
3. **Script tag** in `index.html`'s `<head>`:
   `<script src="https://cdn.c360a.salesforce.com/beacon/c360a/<WEB_CONNECTOR_ID>/scripts/c360a.min.js"></script>`
4. **script.js** (`D360` object): waits for `SalesforceInteractions`, calls `init` with an opt-in consent
   (demo only), sends `{interaction: {name: <schema eventType>, eventType, …fields}}`, and on login sends
   `user.attributes = {eventType: "identity", isAnonymous: 0, customerId, email}`.
5. **Data streams** (`08-web-stream-*.json`, `d360_datastream_create_streaming_app`): one Engagement stream
   (DLO `Westerly_site_Behavioral_Events_<suffix>__dll`, PK eventId, event date dateTime) and one Profile
   stream (DLO `Westerly_site_identity_<suffix>__dll`, PK deviceId). Names are auto-generated.
6. **Mappings** (`09-map-web-*.json`):
   - Engagement DLO → **Product Browse Engagement**: eventId → Id, dateTime, deviceId → Individual,
     sessionId, eventType, page/URL/referrer, addToCart sku/quantity/price, search query, orderPlaced orderId,
     browser/device/user agent.
   - Identity DLO → **Individual** (deviceId), **Contact Point Email** (email), **Party Identification**
     (customerId → Identification Number).

**Verified 2026-10-21** on Heroku: 7 engagement rows and 3 identity rows landed within 10 minutes, and all four
DMOs got rows with the mapped values.

**Gotchas**
- **Events are only ingested from the connection's base URL.** Tests from `localhost` got HTTP 204 but never
  landed: no rows, no problem records. Test on the deployed site, or create a second connection for localhost.
- SDK reserved interaction names ("Add To Cart", "Remove From Cart", "Replace Cart", "Purchase", "View
  Catalog Object", …) trigger built-in handling ("missing required option lineItem"). Send the schema
  developerName (e.g. `addToCart`) as the interaction name.
- `sendEvent` mutates the payload; copy it before logging.
- A WebApp connection allows only one Engagement stream, so all engagement events share one DLO with
  event-prefixed columns (`addToCart_sku__c`). One DMO field can take only one source column.
- Debug in the browser with `SalesforceInteractions.setLoggingLevel(5)` to see "Events translated for Data Cloud".
- The SDK also emits a "Login" engagement event; it isn't in the schema and is dropped (harmless).

🟡 Open items
- Anonymous visits create empty Contact Point Email / Party Identification rows; add a mapping filter on
  `isAnonymous = 0`.
- Two Page Views were logged but one landed; not investigated.

## 10. Unified profile page: Westerly Unified Shopper ✅
Data 360 record page for `UnifiedssotIndividualWstr__dlm` (opened from Profile Explorer at
`/lightning/cdp/UnifiedssotIndividualWstr__dlm/<unified id>/view`). Target layout in
`setup/data360/14-unified-profile-record-page.flexipage.xml`, created with FlexiPageList `create_FlexiPage_1`
(POST `/headless/metadata`, `fullName` `Westerly_Unified_Shopper`).

| Region | Components |
|---|---|
| header | 3 × `cdpProfileInsights`, one per CI: `Westerly_Orders_Last_30_Days__cio`, `Westerly_Total_Orders__cio`, `Westerly_Avg_Cart_Value__cio` (`measureCurrency` true on this one only) |
| main | 4 × `cdpProfileRelatedRecords` (email, phone, address, party identification) |
| sidebar | `cdpProfileEngagements` (Sales Order, Product Browse Engagement) |

**Status 2026-10-22:** the page exists with the 4 related-record cards (read back and confirmed). Saves that
include `cdpProfileInsights` or `cdpProfileEngagements` time out through the API and never apply.
Next: add those in Lightning App Builder, then Activate (no activation API found).

**Gotchas**
- DMOs are not FlexiPage-enabled for `RecordPage`; use `type` `CdpRecordPage` with template
  `runtime_cdp:cdpRecordHomeTemplateDesktop` and property `cdpEntityName` = the unified DMO.
- Only components implementing `runtime_cdp:availableForCdpRecordHome` are allowed. The Contact/Account
  unified profile, timeline and Agentforce components don't work on this page type.
- String[] properties (`relatedObjectField`, `engagementObjects`) must be a `<valueList>`; comma-separated
  values fail with "Value is not allowed for Array attribute type in API version 49 and above."
- A create or update that times out may not have saved; query FlexiPage by DeveloperName before retrying.
- In Lightning App Builder the Profile Insights "Calculated insight" dropdown showed no matches for
  `Westerly_Shopper_Metrics__cio` (dimension built from `UnifiedLinkssotIndividualWstr__dlm.UnifiedRecordId__c`).
  Created `Westerly_Profile_Metrics__cio` (`15-calculated-insight-profile-metrics.json` + `-run.json`): same
  measures, extra join so the dimension is `UnifiedssotIndividualWstr__dlm.ssot__Id__c`. First run: 5 profiles,
  26 orders. Confirmed 2026-10-23: it appears in the dropdown, so Profile Insights needs a CI whose dimension is selected from the unified individual DMO itself. Note: `d360_ci_get` reports a different
  dimension `dataSource` on each read, so don't rely on it; `d360_ci_validate` and `d360_ci_run_status` return
  "not supported for this org".
- Profile Engagements "Engagement objects" dropdown (2026-10-23) was empty. It depends on Data space and Unified
  link object being picked first, and it only lists engagement DMOs with a DMO relationship to
  `ssot__Individual__dlm`. `ssot__ProductBrowseEngagement__dlm.ssot__IndividualId__c` has one (standard);
  `ssot__SalesOrder__dlm` had none (`ssot__SoldToCustomerId__c` wasn't related to anything). Fixed 2026-10-23 with
  a custom ManyToOne relationship `ssot__SalesOrder__dlm.ssot__SoldToCustomerId__c` → `ssot__Individual__dlm.ssot__Id__c`
  (`16-dmo-relationship-salesorder-individual.json`, tool `d360_dmo_relationship_create`; status went
  CREATING → ACTIVE within ~30 s). Confirmed 2026-10-23: both Sales Order and Product Browse Engagement now
  appear in the dropdown.
- **Working 2026-10-23** when opened from Profile Explorer search (CUST_001): tiles show 8 orders in the last
  30 days, 13 total orders, avg cart 72.560769 (not formatted as currency); email and both Party Identification
  rows (CUST_001) load; Activity shows Product Browse Engagement first (newer than the last order, 2026-10-21;
  orders are under Show More). Phone and Address show "No record found", which is correct: no CUST_001 phone or
  address rows are mapped. The errors below came only from the hand-built direct URL.
- Profile Insights has no title property: each tile is titled with the CI's display name. For distinct titles,
  created three single-measure CIs (`17a/b/c-calculated-insight-*.json` + `-run.json`), same dimension, join and
  schedule as `Westerly_Profile_Metrics__cio`: `Westerly_Orders_Last_30_Days__cio` "Orders (Last 30 Days)",
  `Westerly_Total_Orders__cio` "Total Orders", `Westerly_Avg_Cart_Value__cio` "Avg Cart Value" (`ROUND(AVG(...), 2)`).
  First run (~3 min): 5 profiles each; CUST_001 = 8 / 13 / 72.56. In Lightning App Builder, point each tile at
  its CI and check `measureCurrency` on Avg Cart Value.
  Confirmed in metadata 2026-10-23: `measureCurrency` false on Total Orders, true on Avg Cart Value (it had been
  left on the Total Orders tile, which showed "$13.00"). The first App Builder save didn't apply; re-read the
  FlexiPage after saving to confirm. Verified on the profile (after a hard refresh): 8 / 13 / $72.56.
- Related-records cards have no title property (design attributes: data space, unified, bridge, related object,
  fields, icon); each card is titled with the related unified DMO's label. Renamed the labels with `d360_dmo_update`
  (`input.label` only; API names unchanged, fields intact) via `18a/b/c/d-dmo-label-*.json`: Email, Phone, Address,
  Customer IDs (verified on the profile page). The response echoes the old label; a GET shows the new one. Labels apply everywhere in Data Cloud
  and may revert if identity resolution regenerates the unified DMOs.
- First/Last Name (2026-10-23, 🔴 card can't read the custom DMO, even as category Profile; see the end of this bullet): the page template has no header, and no name/highlights
  component exists for `CdpRecordPage`. A Related Records card can't use the unified individual itself or
  `ssot__Individual__dlm` ("There is no relationship between parent and child table"), and a CI as child fails
  ("Child Object is not a DLM"). A SQL DMO (`isSqlDmo`) over the unified individual failed every read with "the view
  definition is invalid" and was deleted with its relationship. Replacement, all via the MCP tools:
  1. Regular custom DMO `Westerly_Shopper_Name__dlm` "Shopper Name", category Profile since the rebuild below (`19a-dmo-shopper-name.json`,
     `d360_dmo_create`): `Id__c` (pk), `PartyId__c`, `FirstName__c`, `LastName__c`.
  2. Batch DCSQL transform `Westerly_Shopper_Name_Transform` (`20a-transform-shopper-name.json`, `d360_transform_validate`
     then `d360_transform_create`): `SELECT ssot__Id__c AS Id__c, ssot__Id__c AS PartyId__c, ssot__FirstName__c …
     FROM UnifiedssotIndividualWstr__dlm` into DLO `Westerly_Shopper_Name__dll` (created by the transform).
  3. DLO added to data space `default` (`20b-…json`, `d360_dataspace_member_add`), then DLO → DMO mapping, all four
     fields (`20c-…json`, `d360_dmo_mapping_create`).
  4. ManyToOne relationship `PartyId__c` → `UnifiedssotIndividualWstr__dlm.ssot__Id__c` (`19b-…json`).
  5. Full run (`d360_transform_run`, `shouldForceFullRun` true), then daily at 06:00 America/Los_Angeles
     (`20d-…json`, `d360_transform_schedule_set`). DMO has 121 rows, same as the unified individual.
  Verified: `GET /ssot/profile/UnifiedssotIndividualWstr__dlm/<CUST_001 unified id>/Westerly_Shopper_Name__dlm?fields=FirstName__c,LastName__c`
  returns Customer / One. Gotchas: a transform can't write straight to a DMO ("External data lake objects can't be
  used as output objects"; target it at a DLO and map it); the relationship fails until the DMO has a mapping ("No
  ObjectSourceTargetMaps were found"); `schedule_set` needs `"interval": 1`, which its schema doesn't list; run history
  came back empty right after the run even though the data had landed.
  Card: in Lightning App Builder the Related Records "Fields" picker stayed empty for Shopper Name, even after a full
  reload (the DMO, its mapping and the profile metadata API all list the fields; cause unknown). Added the card
  through the API instead: `PUT /headless/metadata` with `21-unified-profile-page-with-name-card.flexipage.xml`
  (current page + a `cdpProfileRelatedRecords` card at the top of main: related object `Westerly_Shopper_Name__dlm`,
  fields `FirstName__c`, `LastName__c`, icon Individual). This whole-page save (insights and engagements included)
  returned success with no timeout; read back and confirmed (header 3 tiles, main 5 cards, sidebar unchanged).
  Result on the CUST_001 profile: the card renders, titled `Westerly_Shopper_Name__dlm`, with "This component can't run
  because the configured data model object or it's fields doesn't exist". The title is a placeholder: the LWC
  (`runtime_cdp:profileExplorerRelated`) shows the related object's API name until its server call
  (`ProfileExplorerController.getRelatedObjectData`) succeeds, then switches to the DMO label ("Shopper Name"). So
  there's no title setting to change; fixing the data call fixes the title. The REST profile API with the same
  object, fields, limit and data space returns Customer / One, and both DMOs report category OTHER. The difference
  from the four working cards: their DMOs are system-derived unified objects (`creationType` Derived), while Shopper
  Name is `Custom` with key-qualifier fields. The browser's `getRelatedObjectData` response narrows it down: the
  action returns `SUCCESS` with full metadata (label "Shopper Name", First/Last Name, primary key `Id__c`), plus the
  error above. So the server resolves the object and fields, and it's the data query after that which fails. That
  response's metadata has no `sourceObjectId`, which the LWC uses to dedupe rows. A SQL read of every Shopper Name
  column (key-qualifier and system fields included) works, so no column is missing from storage. The working Phone
  card's response has the same metadata shape (name, label, fields, primaryKey, no `sourceObjectId`), so that isn't
  it. Its `data` is empty, which matches the REST API: CUST_001 has no phone. Neither DMO has FieldPermissions or
  ObjectPermissions rows. The REST profile API nests Shopper Name and Email in the same shape. Remaining suspects: the
  custom DMO's key qualifiers (`KQ_Id__c`, `KQ_PartyId__c`, added automatically; `d360_dmo_create` has no option to
  turn them off), or a check in the card's server code that accepts only unification-derived objects. Unresolved.
  Experiment, 2026-10-23: rebuilt the DMO as category Profile. `d360_dmo_update` refused with "Data Object Category
  cannot be updated". `d360_dmo_mapping_delete` refused because a DMO's only mapping can't be removed on its own.
  So: deleted the relationship, then deleted the DMO (`d360_dmo_delete`, which took the mapping with it), then
  recreated all three from `19a` (now category Profile), `20c` and `19b`. New DMO 0gjjV000002J8iHQAS; it has no
  `KQ_PartyId__c` this time. The 121 rows came back as soon as the mapping was active, so no transform run was
  needed. A forced run was refused anyway ("status is PENDING"; `lastRunStatus` has read PENDING since the first run).
  The schedule is unchanged (next run 2026-10-24 13:00 UTC). The REST profile API returns Customer / One again.
  Card result: same error and API-name title on the CUST_001 profile, so category isn't the cause. Working
  conclusion: this card's server code doesn't read custom DMOs, only the unification-derived ones. Still open.
  Experiment, 2026-10-26 (🔴 reverted, see below): the card's `bridgeObject` is `UnifiedLinkssotIndividualWstr__dlm`, which
  maps a unified profile to its source Individuals, and the working Sales Order engagements link to
  `ssot__Individual__dlm`. Shopper Name linked straight to the unified individual, so the bridge path may find nothing.
  Changes (before state in `26a-…json`): transform SQL now reads `FROM ssot__Individual__dlm` (`26b-…json`,
  `d360_transform_update`; full-replace body from `_get`, minus `id`); relationship swapped to
  `PartyId__c` → `ssot__Individual__dlm.ssot__Id__c` (`26c-…json`; old one deleted with `d360_dmo_relationship_delete`,
  param `name`). Three full runs (with `WHERE ssot__FirstName__c IS NOT NULL`, a retry, then without the WHERE) all
  failed after ~80 s with 0 rows and "Hmm, that didn't work… Error ID: 2000-1bf63508". The same SELECT run as a
  query returns 125 rows with unique IDs, so the SQL itself works. Status cycles PENDING → IN_PROGRESS → PENDING
  (internal retries) for ~30 min before FAILURE. The DLO still holds the 122 rows from the 13:07 UTC run (unified
  IDs), which no longer match the relationship. Card untested.
  Reverted the same day: SQL back to `FROM UnifiedssotIndividualWstr__dlm` through the same `d360_transform_update`
  call, and the relationship recreated from `19b` (the source-Individual one deleted). The next full run succeeded on
  its first attempt (122 rows), so the update call wasn't the problem: this batch transform fails whenever it reads
  `ssot__Individual__dlm`, though the same SELECT works as a query (cause unknown). The profile API returns the
  Shopper Name row for a unified profile again. Note: the `qGu…` key in a Data 360 profile page URL is the record's
  platform `Id` (`qGu` is the key prefix of `UnifiedssotIndividualWstr__dlm`), not its `ssot__Id__c`. To map it, run
  `SELECT Id, ssot__Id__c FROM UnifiedssotIndividualWstr__dlm LIMIT 500` (SOQL) and match `Id` locally: `WHERE Id = …`
  fails with UNKNOWN_EXCEPTION. With the mapped `ssot__Id__c`, the profile API returns that shopper's Shopper Name and
  Email rows. Card: still the original error.
- Name via Party Identification (2026-10-26, ✅): Related Records cards do read the unified
  Party Identification object (Customer IDs card), and the match rule only compares `Westerly Customer ID` rows, so a
  `Full Name` row per customer can carry the name without affecting matching. First try: a batch transform
  `Westerly_Customer_Name_Transform` (`27a-transform-customer-name.json`, validated clean) from
  `Westerly_Customers__dll` into a new Profile DLO `Westerly_Customer_Names__dll`. Its run failed the same way
  (Error ID 2000-1bf63508, 0 rows), though the SELECT works as a query (5 rows). **Root cause of every failed
  transform run today:** the Snowflake streams are zero copy with acceleration off, so `Westerly_Customers__dll`
  and the `ssot__Individual__dlm` rows mapped from it are read live from Snowflake, and batch transforms can't read
  them. `UnifiedssotIndividualWstr__dlm` is materialized by identity resolution, so the original Shopper Name
  transform works. New plan: build the rows in Snowflake as a view (`setup/snowflake/westerly_customer_names.sql`,
  `SALES.CUSTOMER_NAMES_V`), then stream it (zero copy, Profile, PK CUSTOMER_NAME_ID), map it to Party
  Identification (CUSTOMER_NAME_ID → Id; CUSTOMER_ID → Party; FULL_NAME → Identification Number; PARTY_ID_NAME →
  Name; PARTY_ID_TYPE → Party Identification Type), run identity resolution, and drop the broken Name card.
  Built:
  1. View `SALES.CUSTOMER_NAMES_V` (5 rows). The first stream attempt failed with "Object does not exist" because
     `DATA360_READER` had no grant on the view (`CREATE OR REPLACE VIEW` drops grants). Fixed by re-running the
     GRANT; the script now uses `COPY GRANTS` and ends with `SHOW GRANTS TO ROLE DATA360_READER`.
  2. Stream `Westerly_Customer_Names_Sf` / `Westerly_Customer_Names_Sf__dll` (`27b-stream-customer-names.json`),
     zero copy, Profile, PK CUSTOMER_NAME_ID. ACTIVE, 5 rows.
  3. Mapping to `ssot__PartyIdentification__dlm` (`27c-map-customer-names-party-identification.json`); all 7 field
     mappings saved.
  4. Identity resolution run on `Individual_wstr` (`27d-identity-resolution-run.json`). Unified Party
     Identification now has 5 `Full Name` rows next to the 6 `Westerly Customer ID` rows, and the profile API
     returns both types for a profile.
  5. Profile page: broken Name card removed from the header; Customer IDs card moved to the top of main, where it
     shows the full name and the customer ID. Before/after in `27e-…` and `27f-…`.
  6. `Westerly_Customer_Name_Transform` deleted, then its empty output DLO `Westerly_Customer_Names__dll` (0 rows,
     `27g-delete-customer-names-dlo.json`).
  7. Name card back at the top of the header, as a copy of the Customer IDs card (unified Party Identification,
     ID number + name). It also lists the `Westerly Customer ID` row; the card has no type filter. Before/after in
     `27h-…` and `27i-…`.
  8. Customer IDs card removed from main, since the header name card shows the same rows (`27j-…`).
  9. Identification Name column removed from the header card; it shows Identification Number only (`27k-…`).
- Custom shopper card test (2026-10-26, 🟡 blocked): goal was one styled card (name, city, customer ID, email,
  phone, address, lifetime value) like a marketing mockup. New SFDX project `setup/salesforce/`: Apex
  `WesterlyShopperCardController` (Data 360 SQL through `ConnectApi.CdpQuery.queryAnsiSqlV2`, id checked
  against a pattern) and test LWC `westerlyProfileProbe` (`lightning__RecordPage`, object
  `UnifiedssotIndividualWstr__dlm`). Both deployed. Adding the probe to the profile page failed in every region:
  "The c:westerlyProfileProbe component isn't allowed in the … region. The component doesn't implement any of
  the region's allowed interfaces." Dry-run deploys with other targets: `lightning__CdpRecordPage` is a known
  target but "invalid" for custom components; made-up names are "not a valid TARGETS". So the Data 360 profile
  page (`CdpRecordPage`) accepts only the built-in `runtime_cdp` cards. The page is unchanged (`28a-…` is its
  backup; `28b-…` was the rejected sidebar attempt).
- Shopper card for the Data Explorer record page (2026-10-26, 🟡 blocked): probe LWC deleted. Apex
  `WesterlyShopperCardController.getProfile` (name from the `Full Name` Party ID row, else first + last; customer ID;
  first email, phone and address, using `ssot__CityName__c` / `ssot__StateProvinceName__c` /
  `ssot__PostalCodeText__c` / `ssot__CountryName__c`, since the `…Id__c` address fields are empty; order count, sum and
  average through `UnifiedLinkssotIndividualWstr__dlm`) and LWC `westerlyShopperCard` (gradient card, initials
  avatar, no segment, propensity or engagement) deployed. Anonymous Apex check on one demo profile: every field
  filled. Deploying a RecordPage `Westerly_Shopper_Record` for `UnifiedssotIndividualWstr__dlm` failed: "the entity
  does not have FlexiPage enabled". Standard unified DMOs can't have Lightning record pages (the blog example used a
  custom DMO). The card is deployed but not on any page.
- Westerly Shopper 360 app page (2026-10-26, ✅): `WesterlyShopperCardController.searchShoppers(term)`
  matches the `Westerly Customer ID` Party ID rows or the unified individual's first + last name (LOWER … LIKE,
  max 20; term limited to letters, digits, spaces and `. _ @ -`, so it can't break out of the SQL string). New LWC
  `westerlyShopper360` (`lightning__AppPage`): search box, match list, then `westerlyShopperCard`, which now takes
  `unified-id` and is no longer exposed in App Builder. Checks through anonymous Apex: `cust_00` → 5 matches,
  `customer` → 6, nonsense → 0; an injection-style term is rejected by `checkTerm`. Deployed app page
  `Westerly_Shopper_360` (`flexipage:defaultAppHomeTemplate`) and custom tab `Westerly_Shopper_360`. The tab is
  hidden for every profile and permission set by default. Fixed with permission set `Westerly_Shopper_360`
  (`setup/salesforce/force-app/main/default/permissionsets/`): tab Visible plus Apex class access to
  `WesterlyShopperCardController`, assigned to the admin user. `TabDefinition` now lists the tab. Open it from the
  App Launcher ("Westerly Shopper 360") or `/lightning/n/Westerly_Shopper_360`. Assign the same permission set to any
  other demo user.
  The `Westerly_Shopper_Name__dlm` transform and relationship still exist but nothing on the page uses them.
- 2026-10-23, resolved (direct URL only): on the CUST_001 profile every component shows "We can't process your request now" with the
  same gack (Activity has a different one). The saved page XML matches the builder's values (`dataSpaceObject`
  `default` everywhere) and the profile REST API (`/ssot/profile/UnifiedssotIndividualWstr__dlm/<id>`) returns
  the record, so the data is fine. Delphi: the gack is `CDPHandledException` from
  `ProfileExplorerController.getUnifiedRecordId` (Aura action that maps the URL record id to a unified id), caught
  and rethrown as a generic UI error, so every component fails on that one call. The trace doesn't include the
  underlying cause. Suspect: opening the page by direct URL with the unified id instead of from Profile Explorer search.
- Profile Explorer search on the unified DMO doesn't match source IDs like `CUST_001` (they live on the
  link object, not the unified profile). Search First Name or Last Name (the indexed fields): exact,
  case-sensitive match (`Customer`, not `customer`), then press Enter. Or open
  `/lightning/cdp/UnifiedssotIndividualWstr__dlm/<unified id>/view` directly. Find the unified id with
  `d360_query_sql`: `SELECT UnifiedRecordId__c FROM UnifiedLinkssotIndividualWstr__dlm WHERE SourceRecordId__c = '<customer id>'`.

---

## 11. Dummy phone and address for the Westerly customers ✅

On 2026-10-23, CUST_001–005 had name, email and customer ID but no phone or address. The other 114 unified profiles
come from the org's sample contacts and already have all three. The 2 anonymous web visitors with no name, email or
ID were left alone.

1. **Snowflake:** run [`setup/snowflake/westerly_customer_contacts.sql`](../setup/snowflake/westerly_customer_contacts.sql)
   with **Run All**. It creates `SALES.CUSTOMER_CONTACTS`, one fictional row per customer (`+1 555-01xx`,
   placeholder streets). The future-tables grant covers `DATA360_READER`. Gotcha: plain **Run** executes only the
   statement under the cursor, which gives "Object … does not exist or not authorized" on the final SELECT.
2. **Stream** `Westerly_Customer_Contacts` / `Westerly_Customer_Contacts__dll` (Profile, PK CUSTOMER_ID, zero
   copy): `23-stream-customer-contacts.json`.
3. **Mappings**, both with customer_id → Id and Party, plus last_modified:
   - → Contact Point Phone: phone → Telephone Number (`24a-…json`)
   - → Contact Point Address: street, city, state, postal code, country → Address Line 1, City Name, State
     Province Name, Postal Code Text, Country Name (`24b-…json`)
   Every field came back in the returned `fieldMappings`. All 5 rows show in the source DMOs immediately.
4. **Identity resolution:** `Individual_wstr` run submitted 2026-10-23 (`25-identity-resolution-run.json`).
   ✅ Verified 2026-10-23: through `UnifiedLinkssotIndividualWstr__dlm`, each of CUST_001–005 has exactly one
   unified phone (`UnifiedssotContactPointPhoneWstr__dlm`) and one unified address
   (`UnifiedssotContactPointAddressWstr__dlm`) matching the Snowflake rows, with no duplicates. The Phone and
   Address cards read these objects, so they should now show data (not yet checked in the browser).

### 11b. Realistic customer names ✅

On 2026-10-26 the placeholder names "Customer One" to "Customer Five" were swapped for fictional ones: CUST_001
Stephanie Smith, CUST_002 Marcus Johnson, CUST_003 Priya Patel, CUST_004 Daniel Kim, CUST_005 Elena Rodriguez.
Emails stay `customerN@example.com`.

1. **Snowflake:** run [`setup/snowflake/westerly_customer_real_names.sql`](../setup/snowflake/westerly_customer_real_names.sql)
   with **Run All**. It updates `SALES.CUSTOMERS`; `CUSTOMER_NAMES_V` (the "Full Name" Party Identification rows)
   follows automatically. The seed INSERT in `westerly_snowflake_setup.sql` now uses the same names.
2. **Website:** the demo profile in `script.js` greets the shopper as "Stephanie". Redeploy to Heroku to pick it up.
3. **Identity resolution:** `Individual_wstr` re-run submitted 2026-10-26 (`setup/data360/29-identity-resolution-run-real-names.json`).
   ✅ Verified 2026-10-26: 5 unified individuals carry the new names, none are still named "Customer", and no unified
   "Full Name" Party Identification row starts with "Customer".

## 12. Google agent (ADK) 🟡

Plan: an ADK agent on Cloud Run (Gemini) calls a Westerly MCP server on Heroku (`/mcp`, Spoonacular
behind it) for recipes, and a chat widget on the page adds the chosen SKUs through `window.Westerly.addToCart`.

1. ⏳ Gemini API key from Google AI Studio, pasted into the local `.env` only.
2. ✅ Agent folder created at `~/westerly-agent/` (outside the site folder, because `server.js` serves every file
   in the site folder, so a `.env` there could be downloaded): `westerly_agent/agent.py`, `__init__.py`,
   `.env` (local only, chmod 600), `.env.example`, and a `.gitignore` for `.env`.
3. ✅ No-code agent `Westerly Shopper` built in Google Cloud Agent Platform → Studio → Agents (project "Westerly
   Project"): Gemini Flash, Google Search tool for recipes, the 42-product catalog pasted into the instructions.
   Recipes come from the web, not Spoonacular. Not connected to the site or cart.
4. ⏳ Later (optional): Spoonacular through a Westerly MCP server and `/api/recipes` in the Heroku app.
5. 🟡 Phase 1 (2026-10-27): ADK agent as a second Heroku app (Python), chat widget on the site. Chosen over Cloud
   Run: same deploy flow as the site, no Google Cloud setup. The recipes come from Gemini itself; the MCP and
   Spoonacular scaffold was removed from `agent.py`.
   - **Agent app** (`~/westerly-agent/`):
     - `westerly_agent/agent.py`: `LlmAgent` on `gemini-flash-latest` with tools `search_catalog` and `add_to_cart`.
       The instruction adds the shopper's first name and cart from session state.
     - `westerly_agent/catalog.json`: copy of `CATALOG` from the site's `script.js` (52 products), generated with a
       Node one-liner. Regenerate it when the catalog changes.
     - `main.py`: FastAPI `POST /chat` (ADK `Runner`, in-memory sessions) and `GET /health`. Rejects calls without
       the `X-Westerly-Agent-Secret` header, and returns the reply plus `add_to_cart` actions.
     - `requirements.txt` (google-adk 2.12.0, uvicorn 0.54.0), `Procfile`, `.python-version` (3.14), `.env.example`.
   - **Site:**
     - `server.js`: `POST /api/agent` proxies to the agent app's `/chat` and adds the shared secret, so the browser
       never sees it. Config vars `AGENT_URL`, `AGENT_SHARED_SECRET`; 503 if they're unset, 502 if the agent is down.
     - `index.html`, `styles.css`, `script.js`: a "Google Agent" launcher and chat panel. Items the agent adds go
       through the normal `addToCart` (source `google-agent`), so Data 360 still gets Add To Cart events.
       Gotcha: the global `section { padding }` rule padded the panel; `.agent-panel` sets `padding: 0`.
   - ✅ Checked locally:
     - Agent app: `/health` works, and a missing or wrong secret gets 401.
     - Tools: `search_catalog("garam masala")` returns SP-GARAM, and bad SKUs and quantities are refused.
     - With a fake model, `/chat` returns the reply and the cart action, rejects a bad session ID (400) and caps the
       message length (422).
     - Through the site proxy in the browser, the widget showed the reply and added Garam Masala to the cart.
     - With the agent down, the widget shows "The assistant isn't available right now".
   - With Gemini (`gemini-flash-latest`, after adding AI Studio credits; the first try got 402 "prepayment credits
     are depleted"):
     - "I want to make chicken tikka masala tonight" got a short recipe and a list of catalog products with the
       catalog's prices, then a question before adding anything.
     - "Add the garam masala and the chicken please" added SP-GARAM and asked thighs or breasts; "The thighs" added
       MT-CHICKEN.
     - In the browser, "Add a garlic naan and basmati rice" added both through the proxy (cart badge 2).
     - Replies take a few seconds; no errors in the agent log.
   - Known limits: the shopper's name and cart come from the browser (fine for search and cart; phase 2 must check
     the customer on the server before creating Cases). No rate limit. Conversations reset when the dyno restarts.
6. ✅ Deploy (2026-10-27):
   - Private GitHub repo `<github-user>/westerly-agent` from `~/westerly-agent/`, pushed with `git` (not the web
     upload, which ignores `.gitignore` and could upload `.env` and `.venv/`). `.DS_Store` added to `.gitignore`.
   - Second Heroku app (`<agent-app>`) deploying from that repo, with config vars `GOOGLE_API_KEY` (AI Studio key,
     starts with `AIza`) and `AGENT_SHARED_SECRET` (`openssl rand -hex 32 | tr -d '\n' | pbcopy`). `/health` returns
     `{"ok":true}`.
   - Site app: config vars `AGENT_URL` (`https://<agent-app>.herokuapp.com`) and the same `AGENT_SHARED_SECRET`;
     `server.js`, `index.html`, `styles.css` and `script.js` uploaded to the site repo.
   - Checked: `POST /api/agent` on the live site returns 200 with a catalog answer (about 13 s on the first call
     after a restart).
   - Gotchas: config var names are case-sensitive (`Agent_Shared_Secret` is not `AGENT_SHARED_SECRET`; the agent then
     returns 401 to every call). A 401 in the site's router log for `/api/agent` means the secrets don't match; 503
     means the site's vars are missing; 502 means `AGENT_URL` is wrong or the agent is down. The Google Cloud Agent
     Platform page's API keys are not AI Studio keys.
6b. 🟡 Chat updates (2026-10-27; checked locally with Gemini, not yet deployed):
   - Greeting: "Hi <first name>, let me know how I can help you today! I can remind you of your past orders or even
     help you with your next meal idea."
   - The site sends the signed-in shopper's `lastOrder` and `usualItems` (from the demo profile in `script.js`, not
     Data 360) with each message; the agent lists them in its instructions (catalog SKUs only; order ID checked
     against `W-<digits>`). Checked: "What did I order last time?" gives W-10482 and its items; "Add my usual items"
     adds rice, oil and cumin; signed out, it asks the shopper to sign in.
   - **New chat** button in the chat header: new session ID, so the agent forgets the conversation; the cart stays.
   - Checkout ends the chat (if one is open in the tab): the agent posts the order confirmation, "This chat has
     ended." follows, and **Start a new chat** replaces the text box. A reply that arrives after the chat ended or
     restarted is dropped, so it can't add to the cart.
   - Deploy: push the agent repo; upload `index.html`, `styles.css`, `script.js` to the site repo. Either order works.
7. ⏳ Phase 2: order status from Data 360 and creating the support Case (step 15), through a Salesforce integration
   user and External Client App.

## 13. Agentforce service agent: Westerly Support ✅

Order questions (status, date, total, items) answered from Data 360, verified by order number + email inside the flows.
The Google agent hands order questions over to this agent (planned).

1. ✅ Flow `Westerly_Get_Order_Status` (autolaunched, reads `ssot__SalesOrder__dlm` + `ssot__ContactPointEmail__dlm`):
   `setup/agentforce/26b-flow-get-order-status-v2.json`. Active.
2. ✅ Flow `Westerly_Get_Order_Items` (adds `ssot__SalesOrderProduct__dlm` lines as `[qty x SKU - $amount]`):
   `setup/agentforce/27-flow-get-order-items.json`. Active.
3. ✅ Agent Spec: `setup/agentforce/28-Westerly_Support-AgentSpec.md` (one `start_agent order_support` block, two flow
   actions, escalation).
4. ✅ sfdx project `setup/agentforce/sfdx/`; Agent Script bundle
   `force-app/main/default/aiAuthoringBundles/Westerly_Support/` generated with
   `sf agent generate authoring-bundle --no-spec --name "Westerly Support" --api-name Westerly_Support`, then written by
   hand. `default_agent_user` is the org's existing ServiceAgent Agentforce user (`<SERVICE_AGENT_USERNAME>`; change it
   per org). `sf agent validate authoring-bundle` passed.
5. ✅ Data Cloud license `GenieDataPlatformStarterPsl` assigned to the agent user (it already had
   `AgentforceServiceAgentUserPsl`), plus the Data Cloud User permission set `GenieUserEnhancedSecurity` (see 8).
6. ✅ Draft deployed: `sf project deploy start --metadata AiAuthoringBundle:Westerly_Support`.
7. ✅ Preview with simulated actions: asks for order number + email, calls the right action, lists items, refuses
   recipes, escalates on request.
8. ✅ Preview with live actions: the agent user also needs the **Data Cloud User** permission set (`GenieUserEnhancedSecurity`);
   without it every flow faults with `INVALID_TYPE`. After assigning it: verified order → status, date, total and items;
   wrong email → Not Verified; unknown order → Not Found.
9. ✅ Published (`sf agent publish authoring-bundle --api-name Westerly_Support`) and activated
   (`sf agent activate --api-name Westerly_Support`): bot `Westerly_Support` version 1 Active.
10. ⏳ Messaging for In-App and Web channel on the Heroku site; Google agent handoff.

## 14. Agentforce Coworker ✅

On 2026-10-26 the admin user got the Coworker licenses (`AISearchAdminPsl`, `AISearchUserPsl`) and permission
sets (`AISearchAdmin`, `AISearchUser`); steps in [`setup/salesforce/30-coworker-access.md`](../setup/salesforce/30-coworker-access.md).
✅ `UserPermissionAccess` shows `PermissionsAISearchUser` and `PermissionsAISearchAdmin` true.
Not yet checked in the browser: whether Coworker also needs an org-level toggle in Setup. The profile summary and
"Ask Coworker" belong to the standard unified profile components (Contact/Account record pages), not the Data 360
unified profile page or Westerly Shopper 360.

**Read-only check 2026-10-27:** Coworker itself isn't turned on. The org has no `Access_Ai_Search` permission set
group and no Coworker agent. Turning it on creates both, plus DMOs, in the chosen data space. Per the Salesforce
Developers guide ("Turn On Agentforce Coworker"), the remaining steps are:
1. Setup → Quick Find "Agentforce Coworker" → **Get Started with Agentforce Coworker** → **Turn On** → **Confirm**.
   This turns on Einstein too and lists any missing prerequisite (Data 360 activated, Flex Credits or a seat
   license). The confirm window has terms, so the admin does this in the browser.
2. In Coworker Setup → **Manage Users** → assign the admin user (adds `Access_Ai_Search`).
3. Nothing to add to Service - Console: Coworker appears in the global search bar and the **Ask** button in every
   Lightning app.

✅ Turned on 2026-10-27 by the admin in Setup (Turn On, then Manage Users). Read-only check afterwards:
- Permission set group `Access_Ai_Search` ("Agentforce Coworker User") created and assigned to the admin user.
- Agent `SearchAgent` ("Search Agent", InternalCopilot) created, version 1 Active.
- `PermissionsAISearchUser` and `PermissionsAISearchAdmin` true.
Not yet checked in the browser. Coworker has no Westerly knowledge to ground on until Part 3 of step 15.

## 15. Step 5: support Case for a human rep ✅

New Step 5 (2026-10-26): for an order-support question, the Google agent creates a Case on the customer (verified
customer ID, order ID, conversation summary, no payment data). A rep picks it up in the Service Console, sees the
unified profile and order history on the Case, and asks Coworker what the internal knowledge base allows. This
replaces the Agentforce Westerly Support handoff (step 13); that agent stays in the org.

**Part 1: contacts and Case fields**
1. Account **Westerly Market Shoppers** with 5 Contacts, one per Westerly customer, same name and email as
   Snowflake ([`setup/salesforce/31-westerly-contacts.csv`](../setup/salesforce/31-westerly-contacts.csv); the
   Description holds the customer ID). Phone and address stay in Data 360 only.
2. Case fields **Westerly Order ID** (`Westerly_Order_Id__c`, text 40) and **Westerly Customer ID**
   (`Westerly_Customer_Id__c`, text 20); read/edit added to the `Westerly_Shopper_360` permission set. The
   conversation summary goes in the standard Description field.
3. `Contact_Home` stream refresh started so the contacts reach Data 360; then re-run `Individual_wstr`. The
   "Email backup" match rule (exact normalized email) links each contact to its Snowflake shopper
   (`setup/data360/30-identity-resolution-run-contacts.json`).
   ✅ Verified 2026-10-26: all 5 contacts are in `UnifiedLinkssotIndividualWstr__dlm`, on 5 different unified
   profiles, and each of those profiles carries a Westerly Customer ID, so no contact formed a profile of its own.

**Part 2: the rep's view in the Service Console** (metadata in `setup/salesforce/force-app/`)
1. Case queue **Westerly Support** (`queues/Westerly_Support.queue-meta.xml`); the admin user added as a member
   through a GroupMember record (kept out of the metadata so no username is in the repo).
2. Case list view **Westerly - Open Cases** (`objects/Case/listViews/Westerly_Support_Open…`): every open case
   with a Westerly Customer ID, whoever owns it, with case number, contact, subject, Westerly Order ID, status,
   owner, opened date. First created as "Westerly Support - Open Cases" scoped to the queue; changed because of the
   routing gotcha below.
3. `WesterlyShopperCardController` gained `getUnifiedIdForContact` (Contact → `UnifiedLinkssotIndividualWstr__dlm`)
   and `getRecentOrders` (up to 20 orders, newest first). ✅ Checked with Anonymous Apex: CUST_001's contact resolves
   to the CUST_001 unified profile and returns its orders, newest one "Not yet picked".
4. LWC **Westerly Case Shopper** (`westerlyCaseShopper`, Case record pages): the Google agent's conversation summary
   (Case Description) and order ID, then `westerlyShopperCard` and the recent orders with the case's order
   highlighted.
5. Added at the top of the left column of `SDO_Service_Case_Service_Console_Collapsable`, the Case page the
   **Service - Console** app (`SDO_Service_Console`) uses. Before/after: `setup/salesforce/backups/32a-…`, `32b-…`.
6. Also added at the top of the right sidebar, above Details, on `SDO_Service_Case_Default` ("Case - Default").
   Before/after: `setup/salesforce/backups/34a-…`, `34b-…`. ✅ Re-queried: the sidebar holds `c:westerlyCaseShopper`
   and then the Details tabset. Gotcha: that page isn't assigned anywhere. Case View uses the Salesforce built-in page
   org-wide, and the "Service" app (`standard__Service`) is a Classic app, which can't get a page of its own. Decision:
   demo from the **Service - Console** app (item 5), and leave the org default alone.
7. Removed the Milestones component (`support:milestones`) from the first tab of the right panel on
   `SDO_Service_Case_Service_Console_Collapsable`, at the user's request. Before/after:
   `setup/salesforce/backups/35a-…`, `35b-…`. ✅ Re-queried: that tab starts with Next Best Action; the Westerly panel
   is still first in the left column.
   Later on 2026-10-27 the page was edited in Lightning App Builder (kept as is): the left column holds only the
   Westerly panel (Customer 360 card and the three related-record cards removed), Next Best Action was removed, and an
   Action Launcher was added to the middle column. Gotcha: the standard **Service Console** app (no hyphen,
   `standard__LightningService`) shows the built-in Case page without the panel; demo from **Service - Console**.
8. **View unified profile** button in the Westerly Case Shopper header (shown once the case contact has a unified
   profile). It opens `/lightning/cdp/UnifiedssotIndividualWstr__dlm/<unified id>/view` (the Westerly Unified Shopper
   page, step 10) in a new console tab through `lightning/platformWorkspaceApi` `openTab`, or in the same window
   outside a console. Deployed 2026-10-27, then removed the same day at the user's request (code reverted and
   redeployed).
9. Sample Case 00001068 "Add garam masala to order W-10482" on Stephanie Smith (CUST_001), created for the queue
   ([`setup/salesforce/33-sample-case.apex`](../setup/salesforce/33-sample-case.apex)). Gotcha: the demo org's Case
   automation reroutes new Cases. On insert the owner moved to the "General" queue and a "Starter Kit" asset was
   attached; after setting the owner back to Westerly Support, routing assigned it to the admin user. ✅ The list
   view's results show case 00001068 / W-10482 with the admin user as owner. Still open: clearing the Asset doesn't
   stick. None of the record-triggered Case flows set it; something else (likely Einstein Case Classification
   auto-fill, not confirmed) adds "Starter Kit" again on every save. Not yet checked in the browser.
10. LWC **Westerly Website Activity** (`westerlyCaseWebActivity`, Case record pages): the case contact's recent
    website events from the Web SDK (`ssot__ProductBrowseEngagement__dlm` through the unified link), newest 20 first:
    viewed page, searched, added/removed from cart (SKU × qty), placed order, signed out; the case's order is
    highlighted. New Apex method `WesterlyShopperCardController.getRecentWebEvents`. Added under the Westerly panel in
    the left column of `SDO_Service_Case_Service_Console_Collapsable` on 2026-10-27. Before/after:
    `setup/salesforce/backups/39a-…`, `39b-…`. Profile Engagements (`cdpProfileEngagements`) can't be used here: it
    only works on Data 360 profile pages.
    ✅ Verified 2026-10-27: deploys succeeded; page read back with `westerlyCaseWebActivity` under
    `westerlyCaseShopper`; Anonymous Apex on case 00001076 returns 8 events (pageView, addToCart ×2, removeFromCart,
    search, orderPlaced, logout, pageView; 2026-10-21/22). Gaps: removeFromCart has no SKU (only the addToCart SKU
    column is mapped), and the web order isn't W-10482, so nothing is highlighted on that case. Not yet checked in
    the browser.

**Part 3: Westerly knowledge for Coworker**
1. Seven help-center articles laid out like a grocery-delivery help center (Placing Orders, Order in Progress,
   Delivery & Pickup, Refunds & Returns). Content and field mapping:
   [`setup/salesforce/36-westerly-knowledge-articles.md`](../setup/salesforce/36-westerly-knowledge-articles.md). The key
   one, "Can I add items to an order I already placed?", has the rule: add while "Not yet picked"; once Picked or
   Delivered, offer a new order or add the item to the next one. Rep-only guidance is in Internal Comments.
   Some policy details are made up for the demo: substitutes never cost more, items can be refused at delivery or
   pickup, a free replacement on the next order, refunds in 3–5 business days, card charged at pickup or delivery.
2. Created as drafts with [`37a-create-westerly-articles.apex`](../setup/salesforce/37a-create-westerly-articles.apex)
   (generated from the .md): FAQ record type, en_US, UrlName `westerly-…`, customer/partner/public visibility off.
   Gotcha: `IsVisibleInApp` isn't writeable (internal visibility is always on); setting it fails to compile.
3. Published with [`37b-publish-westerly-articles.apex`](../setup/salesforce/37b-publish-westerly-articles.apex)
   (`KbManagement.PublishingService.publishArticle`, only `westerly-` drafts).
   ✅ Verified 2026-10-27: all 7 Online, version 1, internal app only; the demo articles unchanged (53 Online, 1 Draft).
   ✅ Checked in Coworker 2026-10-27: asked as a policy question ("can a shopper add items to an order…"), it quoted
   the add-items article. Asked with only "W-10482", it searched that term alone and found just the case.

**Part 4: order status on the Case, for Coworker**

Gotcha: Coworker couldn't answer "what's the status of W-10482?". Orders live only in Data 360 (`ssot__SalesOrder__dlm`,
fed zero copy from Snowflake), and Sales Order doesn't show in Coworker's Add Data Source list (likely because the
stream isn't accelerated; not confirmed). Decision: skip a Data 360 index and leave acceleration off. Instead the case
carries the status, which Coworker finds with its normal CRM search.
1. Case field **Westerly Order Status** (`Westerly_Order_Status__c`, text 40); read/edit added to the
   `Westerly_Shopper_360` permission set. The Google agent sets it when it creates the case (Part 5).
   It's a snapshot from when the case was opened and isn't updated later; the Westerly Case Shopper panel still shows
   the live status from Data 360.
2. Sample Case 00001068 set to "Not yet picked"; `33-sample-case.apex` sets it on insert.
   ✅ Verified 2026-10-27: deploy succeeded (2 components); SOSL for `W\-10482` returns case 00001068 with status
   "Not yet picked", and SOSL for "Not yet picked" finds it too, so the field is in the search index.
   ✅ Checked in Coworker 2026-10-27 on case 00001076 (opened by the Google agent): asked for the status of W-10482
   on the case, it answered "Not yet picked"; asked whether the shopper can add garam masala, it cited the add-items
   article and said yes.

**Part 5: the Google agent opens the Case** ✅

Order requests in the website chat (changes, adding items, cancel, refund, delivery problems) become a Case that a
human rep handles with Coworker. The shopper must be signed in, the agent confirms before it opens the case, one case
per chat, and no payment data. Last-order reminders and usual items stay as chat answers.
1. Contact field **Westerly Customer ID** (`Westerly_Customer_Id__c`, text 20, unique, external ID) so the agent can
   find the shopper's Contact. Read/edit added to `Westerly_Shopper_360`. `36-contact-customer-ids.apex` copies each
   `CUST_` ID from the Contact description into it.
   ✅ Verified 2026-10-27: deploy succeeded; script printed `CHECK 5`; the 5 Westerly contacts have 5 distinct IDs.
2. Permission set **Westerly Google Agent** for the agent's integration user: Case create/read, Contact and Account
   read, read/edit on the three Case Westerly fields, read on the Contact customer ID. Added for step 4: read/edit on
   Case Subject, Description, Origin and ContactId (without them the integration user can create a Case but can't
   set those fields). The Case's Account is filled in from the Contact automatically.
   Gotchas:
   - In metadata, `<license>` takes the API name, `SalesforceAPIIntegrationPsl`, not the label "Salesforce API
     Integration".
   - On that license, leave out the `ApiEnabled` user permission. The license already includes API access, and the
     deploy fails with "doesn't allow the permission: ApiEnabled".
   - On the user license "Salesforce Integration", the deploy succeeds but the object permissions are silently
     dropped. A permission set's license can't be changed later ("License can't be updated").
   - A failed deploy rolls back everything in it, including components shown as "Created".
   - To delete a permission set, deploy an empty `package.xml` with `--post-destructive-changes`;
     `--metadata-dir --single-package` failed with "No package.xml found".
   ✅ Verified 2026-10-27: the unassigned first version (wrong license) was deleted and the fixed one deployed. It's
   on the Salesforce API Integration license. Case create/read; Account and Contact read only; no edit, delete, View
   All or Modify All. Read/edit on the 3 Case fields, read on the Contact customer ID.
3. Integration user, External Client App and agent config vars (the admin does these) ✅. Sharing defaults are public
   (Account read/write, Contact controlled by parent, Case read/write/transfer), so no sharing rules are needed.
   - **Integration user**: Setup → Users → New User. Name `Westerly Google Agent`; Email = the admin's email;
     Username `<INTEGRATION_USERNAME>` (unique, email format, no real mailbox needed); User License
     `Salesforce Integration` (pick it first); Profile `Minimum Access - API Only Integrations`; no role; uncheck
     "Generate new password and notify user immediately". Save.
   - **License, then permission set** (in this order, or the permission set isn't listed): on the user's page,
     Permission Set License Assignments → Edit Assignments → `Salesforce API Integration`; then Permission Set
     Assignments → Edit Assignments → `Westerly Google Agent`.
   - **External Client App**: Setup → External Client App Manager → New External Client App.
     - Name `Westerly Google Agent`; Contact Email; Distribution State `Local`.
     - Enable OAuth; Callback URL `https://login.salesforce.com/services/oauth2/callback` (required, unused); scope
       "Manage user data via APIs (api)" only; check Enable Client Credentials Flow; security defaults. Create.
     - Policies tab → Edit → OAuth Policies: Enable Client Credentials Flow, Run As = `<INTEGRATION_USERNAME>`;
       Permitted Users left at default. Save.
     - Settings tab → OAuth Settings → Consumer Key and Secret (emailed verification code). Copy them straight into
       Heroku; never into chat, a repo file or a screenshot. Changes can take a few minutes to apply.
   - **Agent Heroku app** (not the site app) → Settings → Reveal Config Vars, case-sensitive names:
     `SF_DOMAIN` = `<MY_DOMAIN>.my.salesforce.com` (no `https://`, no trailing `/`; from Setup → My Domain),
     `SF_CLIENT_ID` = Consumer Key, `SF_CLIENT_SECRET` = Consumer Secret. Unused until the step 4 code ships.
   - **Local testing**: add the same three lines to `~/westerly-agent/westerly_agent/.env` (gitignored; the ADK reads it
     from the agent folder, not the repo root). Check names only:
     `grep -o '^SF_[A-Z_]*' ~/westerly-agent/westerly_agent/.env`.
   - **Token check** (prints only the HTTP status):
     ```bash
     (cd ~/westerly-agent/westerly_agent && set -a && . ./.env && set +a && curl -s -o /dev/null -w '%{http_code}\n' -X POST "https://$SF_DOMAIN/services/oauth2/token" -d grant_type=client_credentials --data-urlencode "client_id=$SF_CLIENT_ID" --data-urlencode "client_secret=$SF_CLIENT_SECRET")
     ```
     200 = works; 400 = Run As not set or not applied yet; 401 = wrong key or secret (or a stray space).
   - If the secret leaks, generate a new one on the app's Settings tab and update Heroku and `.env`.
   - Gotchas: the `read -s` prompts hide pasted values, so they look empty; paste only at a prompt, never as a
     command (it lands in shell history). Commands with prompts must run in a real terminal, not the chat `!` box.
   ✅ Verified 2026-10-27: token check returns 200 locally; one active user on `Minimum Access - API Only
   Integrations` (Salesforce Integration license) with the Salesforce API Integration permission set license and
   `Westerly_Google_Agent`; External Client App `Westerly Google Agent` exists. Consumer key and secret rotated once
   after the key showed in a screenshot. Heroku config vars set by the admin (not checked from here).
4. Agent and site code ✅ (deployed and checked live 2026-10-27).
   - `~/westerly-agent/westerly_agent/salesforce.py`: client credentials token (refreshed every 15 min, and once on a
     401), finds the Westerly Support queue and the Contact by `Westerly_Customer_Id__c`, inserts the Case (Origin
     Website, Status New, the three Westerly fields) and returns its CaseNumber. `requests` pinned in requirements.
   - `agent.py`: tool `create_support_case(subject, details, order_id)`. It needs a signed-in shopper, allows one case
     per chat (number kept in session state), copies the order status only when the case is about the last order,
     and adds "Opened by the Google shopping agent from the Westerly website chat." to the description. Instruction:
     offer a case for order requests, show subject + summary and ask to confirm first, never say a change is done.
   - `main.py`: `customerId` (`^CUST_\d{1,10}$`, else 422) into state; `case_created` action with the case number.
     `.env.example` lists the `SF_` names.
   - Site `script.js`: sends `customerId`; shows "Support case N opened. A Westerly team member will follow up."
   ✅ Checked locally 2026-10-27 (real Gemini, real org):
   - Signed out: asks the shopper to sign in; no case.
   - Signed in: shows subject + summary, waits for "yes", then opens the case. Test cases 00001069 (add garam
     masala to W-10482), 00001070 (refund, older order W-99999, no status) and 00001071 (from the browser:
     missing rice on W-10482, note shown in the chat). Each has Origin Website, Status New, the Contact and
     Westerly Market Shoppers account, CUST_001, the order ID, and the order status for W-10482 only; created by
     the integration user.
   - Second request in the same chat: gives the existing case number instead of opening another.
   - Bad customer ID: 422. No errors in the agent log or browser console.
   Gotcha: the org's existing Case automation moved all three from Westerly Support to the **General** queue
   (as with the sample case). The Westerly open-cases list view still shows them. Fixed later the same day (routing
   fix below).
   Limitation: the demo sign-in isn't real auth; anyone calling `/api/agent` could open a case on another
   customer ID. Fine for the demo, not for production.
   To deploy: push the agent repo (`git -C ~/westerly-agent push`), check the agent app's `SF_` config vars have
   the rotated key and secret, and upload `script.js` to the site repo.
   ✅ Checked live 2026-10-27 (through the site's `/api/agent`, CUST_001, last order W-10482): the agent offered a
   case, showed subject + summary, and opened **00001072** on "yes" (`case_created` action returned). In the org:
   Origin Website, Status New, Contact set, CUST_001, W-10482, "Not yet picked", created by the integration user;
   moved to the General queue by org automation as before.
   Gotcha: Heroku config var names are case-sensitive. `SF_Domain` gave `KeyError: 'SF_DOMAIN'`, and renaming it
   in place didn't take; deleting the var and adding `SF_DOMAIN` again did (check Activity for "Set SF_DOMAIN
   config vars" and a restart).
   Routing fix 2026-10-27 (cases stay in Westerly Support). Two automations moved every new case: the REST API
   applies the active Case assignment rule ("Einstein Case Routing Only"; no entry matches, so the case goes to the
   default case owner), then the demo flow "SDO Service - Case - On Create" calls **SDO Service - Case - Routing**,
   whose default outcome sets the General queue.
   - Agent: `salesforce.py` sends `Sforce-Auto-Assign: FALSE` on the Case insert, so the assignment rule is skipped.
   - Org: new first outcome **Westerly Cases** in `SDO_Service_Case_Routing` (`Westerly_Customer_Id__c` not empty, no
     next step), so the flow leaves the owner alone; other cases route as before. Active version 2. Before/after:
     `setup/salesforce/backups/38a-…`, `38b-…`.
   ✅ Checked locally (real org): test case **00001074** stayed in Westerly Support with no owner change in its
   history. Agent change committed (1b3fa1b), pushed and deployed to Heroku.
   ✅ Checked live: case **00001076** (from the site's `/api/agent`) stayed in Westerly Support, no owner change.
   Cases 00001068–00001073 moved to Westerly Support afterwards (anonymous Apex, owner only); all 9 Westerly cases
   (00001068–00001076) now in the queue.
   ✅ End to end 2026-10-27 on case 00001076: in Service - Console the Westerly panel showed the agent's summary, the
   shopper card and the recent orders with W-10482 highlighted; Coworker gave the order status and the add-items
   policy (Part 4).
   Secrets rotated 2026-10-27 after a config-vars screenshot: new Gemini key (same AI Studio project) and new
   `AGENT_SHARED_SECRET` on both apps; Salesforce key and secret were already new. Live retest opened **00001073**
   (same fields as 00001072).
   Gotcha: `openssl rand -hex 32 | pbcopy` copies a trailing newline, and the two apps ended up with different
   values (agent returned 401 Unauthorized). Use `openssl rand -hex 32 | tr -d '\n' | pbcopy` and paste the same
   clipboard into both apps.

## Changelog
- 2026-10-21: Steps 0–6 and 8–9 completed; web ingestion verified on Heroku.
- 2026-10-22: Log and payloads collected for the handoff repo. Original `westerly_snowflake_setup.sql` recovered (Oct 20 session) and adopted.
  Step 7 built: `CUSTOMERS_V` view, `Westerly_Customer_Ids` stream and mapping, web formula fields, customer ID
  rule on `wstr`. The `Westerly_Customers` → Party Identification mapping was deleted (its payload removed).
  Web login merged into CUST_001's unified profile (via email; customer ID rule still to be confirmed).
- 2026-10-22: Step 10: `Westerly_Unified_Shopper` profile page created (related-record cards only; insights and
  engagements pending in Lightning App Builder).
- 2026-10-23: Step 10: `Westerly_Profile_Metrics__cio` created and run for the profile page insight tiles.
- 2026-10-23: Step 10: three single-measure CIs created and run so each insight tile has its own title.
- 2026-10-23: Step 10: DMO relationship Sales Order (Sold To Customer) → Individual added so Sales Order shows in Profile Engagements.
- 2026-10-23: Step 10: `measureCurrency` moved from Total Orders to Avg Cart Value tile.
- 2026-10-23: Step 10: unified contact point / party identification DMO labels renamed to Email, Phone, Address, Customer IDs (card titles).
- 2026-10-23: Step 10: SQL DMO `Westerly_Shopper_Name__dlm` + relationship to unified individual created for a name card; view invalid, not on the page.
- 2026-10-23: Step 10: SQL DMO and its relationship deleted. Replaced with a regular DMO `Westerly_Shopper_Name__dlm` filled by a daily batch transform (`Westerly_Shopper_Name_Transform` → `Westerly_Shopper_Name__dll` → mapping), plus the relationship to the unified individual; profile API verified. Card not yet on the page.
- 2026-10-23: Step 10: Shopper Name card (First/Last Name) added to the top of main through the metadata API (App Builder field picker was empty).
- 2026-10-23: dummy phone/address for CUST_001–005 (Snowflake CUSTOMER_CONTACTS table, stream, Phone and Address mappings, IR run submitted). Shopper Name DMO rebuilt as category Profile (card still errors).
- 2026-10-23: Step 12: Google agent folder `~/westerly-agent/` created with ADK agent scaffold and a placeholder `.env`.
- 2026-10-23: Step 12: no-code `Westerly Shopper` agent built in Agent Studio (Google Search recipes, catalog in instructions); Spoonacular deferred.
- 2026-10-23: Step 11: IR run finished; unified phone and address verified for CUST_001–005.
- 2026-10-23: Step 13: flow `Westerly_Get_Order_Status` (draft v1) rewritten through the Tooling API: Get Records store fields in plain variables (Flow can't reference Data 360 record variables), Not Found branch now ends instead of going to the email check. Backup in `setup/agentforce/26a-…`, saved definition in `26b-…`. Not yet debugged.
- 2026-10-23: Step 13: `Westerly_Get_Order_Status` debugged in Flow Builder: W-10482 + matching email → verified (Not yet picked, 14.48); W-10482 + wrong email → Not Verified message; unknown/empty order → Not Found message. Flow reads Data 360 DMOs fine. Not yet activated.
- 2026-10-23: Step 13: flow `Westerly_Get_Order_Items` created as draft v1 through the Tooling API (`setup/agentforce/27-flow-get-order-items.json`): same order + email check, then loops the order lines into `itemsSummary`. Not yet debugged.
- 2026-10-23: Step 13: `Westerly_Get_Order_Items` test 1 passed (2 lines, 5.49 + 8.99 = 14.48). Plain-text template trims the trailing newline, so each item is now wrapped in brackets (`[1 x SKU - $x.xx]`); draft updated in place.
- 2026-10-23: Step 13: `Westerly_Get_Order_Items` debugged in Flow Builder: verified case returns bracketed items, wrong email → Not Verified, unknown order → Not Found. Not yet activated.
- 2026-10-26: Step 13: Agent Spec written; `Westerly_Support` Agent Script bundle validated and deployed as a draft; Data Cloud PSL assigned to the agent user; simulated preview passed (5 turns). Not published or activated.
- 2026-10-26: Step 13: both flows Active. Live preview (W-10482): every flow call failed with `INVALID_TYPE` (unhandled fault), including the unknown-order case. Likely cause: the agent user has the Data Cloud license but no Data Cloud permission set / data space, so it can't read the DMOs.
- 2026-10-26: Step 13: Data Cloud User permission set (`GenieUserEnhancedSecurity`) assigned to the agent user. Live preview rerun passed: W-10482 verified (Not yet picked, $14.48, PN-RICE + MT-CHICKEN), wrong email → Not Verified, W-99999 → Not Found. Not published or activated.
- 2026-10-26: Step 13: `Westerly_Support` published and activated (version 1 Active). Channel (Messaging for In-App and Web) and Google agent handoff still to do.
- 2026-10-26: Step 10: profile page cleanup through the Tooling API: header = Shopper Name + 3 insight tiles; main = Email, Phone, Address, Customer IDs; Engagements sidebar = Sales Orders only (Product Browse removed). Before/after in `setup/data360/22a-…` and `22b-…`.
- 2026-10-26: Step 10: Shopper Name card experiment: transform switched to `ssot__Individual__dlm` and relationship swapped to the source Individual (`26a`–`26c`). Three runs failed (Error ID 2000-1bf63508, 0 rows); card untested. Next: revert or diagnose.
- 2026-10-26: Step 10: Shopper Name experiment reverted (SQL and relationship back to the unified individual). Run succeeded, 122 rows; the transform fails only when reading `ssot__Individual__dlm`. Card still shows the original error.
- 2026-10-26: Step 10: name via Party Identification. Transform from `Westerly_Customers__dll` failed (Error ID 2000-1bf63508); root cause: batch transforms can't read the zero-copy, non-accelerated Snowflake data. Snowflake view SQL written (`setup/snowflake/westerly_customer_names.sql`); stream, mapping and IR run to follow.
- 2026-10-26: Step 10: name via Party Identification done. `DATA360_READER` grant fixed on `CUSTOMER_NAMES_V`; stream `Westerly_Customer_Names_Sf` (5 rows) mapped to Party Identification; IR run → 5 unified `Full Name` rows. Page: Name card removed, Customer IDs card moved to top of main (`27e`/`27f`). Failed `Westerly_Customer_Name_Transform` deleted; its empty DLO remains.
- 2026-10-26: Step 10: empty DLO `Westerly_Customer_Names__dll` (left by the deleted transform) deleted.
- 2026-10-26: Step 10: Party Identification name card added at the top of the header (`27h`/`27i`); Customer IDs card stays in main.
- 2026-10-26: Step 10: Customer IDs card removed from main (duplicate of the header name card); page saved as `27j`.
- 2026-10-26: Step 10: header name card shows Identification Number only (Identification Name column removed); page saved as `27k`.
- 2026-10-26: Step 10: custom shopper card test. Apex + probe LWC deployed (`setup/salesforce/`); the profile page rejects custom components in every region (`CdpRecordPage` allows only built-in cards). Page unchanged.
- 2026-10-26: Step 10: probe deleted; `westerlyShopperCard` + `getProfile` deployed and checked. Record page for the unified individual rejected (FlexiPage not enabled on the DMO); card unplaced.
- 2026-10-26: Step 10: Westerly Shopper 360: `searchShoppers` + `westerlyShopper360` deployed and checked; app page and tab `Westerly_Shopper_360` deployed; tab still hidden.
- 2026-10-26: Step 10: permission set `Westerly_Shopper_360` (tab Visible + Apex access) created and assigned to the admin user; tab now visible.
- 2026-10-26: Step 11b: realistic customer names. Snowflake rename script written, seed INSERT and `script.js` demo name updated; Snowflake run and identity resolution re-run pending.
- 2026-10-26: Step 14: Agentforce Coworker licenses and permission sets assigned to the admin user; AISearchUser and AISearchAdmin user perms verified.
- 2026-10-26: Step 11b: Snowflake rename run, identity resolution re-run; unified profiles show the new names.
- 2026-10-26: Step 15 part 1: Westerly Market Shoppers account + 5 contacts, Case fields Westerly_Order_Id__c / Westerly_Customer_Id__c deployed, Contact_Home refresh started; identity resolution re-run pending.
- 2026-10-26: Step 15 part 1 done: identity resolution re-run; each of the 5 contacts is on its Westerly shopper's unified profile.
- 2026-10-26: Step 15 part 2: Westerly Support queue + open-cases list view, Case contact/orders Apex methods, westerlyCaseShopper LWC added to the Service - Console Case page.
- 2026-10-26: Step 15 part 2: sample Case 00001068 (garam masala, W-10482, CUST_001) created in the Westerly Support queue.
- 2026-10-26: Step 15 part 2: sample Case rerouted by demo-org automation (General queue, then the admin user; Starter Kit asset added); open question how to handle.
- 2026-10-26: Step 15 part 2: list view now shows all open cases with a Westerly Customer ID (any owner); Starter Kit asset on the sample case keeps coming back.
- 2026-10-26: Step 15 part 2: westerlyCaseShopper added at the top of the right sidebar on the default Case page (SDO_Service_Case_Default).
- 2026-10-27: Step 15 part 2: SDO_Service_Case_Default turned out to be unassigned; the demo uses the Service - Console app's Case page; org default unchanged.
- 2026-10-27: Step 15 part 2: Milestones component removed from the right panel of the Service - Console Case page.
- 2026-10-27: Step 15 part 2: View unified profile button added to westerlyCaseShopper and deployed.
- 2026-10-27: Step 15 part 2: View unified profile button removed from westerlyCaseShopper (reverted and redeployed).
- 2026-10-27: Step 14: read-only check; Coworker not yet turned on (no Access_Ai_Search group, no Coworker agent); next steps logged.
- 2026-10-27: Step 14: Coworker turned on by the admin; Access_Ai_Search group and SearchAgent (active) confirmed.
- 2026-10-27: Step 15 part 3: 7 Westerly help-center Knowledge articles created and published (internal app only).
- 2026-10-27: Step 15 part 4: Case field Westerly_Order_Status__c added (permission set updated); sample case 00001068 set to "Not yet picked".
- 2026-10-27: Step 15 part 2: console Case page edited in App Builder (left column is only the Westerly panel); noted the Service Console vs Service - Console app gotcha.
- 2026-10-27: Step 8: Data 360 events panel hidden on the website (events still sent). Checked locally; deployed to Heroku (build succeeded).
- 2026-10-27: Step 8: favicon.svg added to the website. Checked locally; deployed to Heroku.
- 2026-10-27: Step 12: phase 1 ADK agent app (`~/westerly-agent/`) and site chat widget plus /api/agent proxy built; checked locally with a fake model (Gemini key out of prepaid credits). Not yet deployed.
- 2026-10-27: Step 12: re-tested phase 1 locally with the real Gemini model after adding AI Studio credits; recipe, catalog prices and cart actions all work.
- 2026-10-27: Step 12: phase 1 deployed: agent on its own Heroku app from a private GitHub repo, site proxy connected; live `/api/agent` check returns 200.
- 2026-10-27: Step 8: order confirmation pop-up with a delivery window added to checkout. Checked locally; deployed to Heroku.
- 2026-10-27: Step 12: chat updates (new greeting, last order and usual items for the agent, New chat, chat ends at checkout). Checked locally; agent change committed, not yet pushed or deployed.
- 2026-10-27: Step 15 part 5: Contact field Westerly_Customer_Id__c deployed and filled on the 5 Westerly contacts; permission set Westerly_Google_Agent deployed on the wrong license (no object access); fixed version in the repo, org copy still to replace.
- 2026-10-27: Step 15 part 5: Westerly_Google_Agent replaced (wrong-license copy deleted, fixed version on the Salesforce API Integration license deployed); object and field access checked.
- 2026-10-27: Step 15 part 5: step 3 guide (integration user, External Client App with client credentials, agent config vars) added to item 3; admin steps not yet done.
- 2026-10-27: Step 15 part 5: integration user, External Client App and agent SF_ config vars done by the admin; local token check 200; user license and permission sets verified.
- 2026-10-27: Step 15 part 5: agent `create_support_case` tool, Salesforce client and site case note written; four Case field permissions added to Westerly_Google_Agent. Checked locally (test cases 00001069–00001071, rerouted to the General queue by org automation); not yet committed, pushed or deployed.
- 2026-10-27: Step 12 / Step 15 part 5: agent commits e893581 and ef82403 pushed to GitHub; Heroku agent deploy and site upload (index.html, styles.css, script.js) pending.
- 2026-10-27: Step 15 part 5: agent deployed to Heroku and site uploaded; live test opened case 00001072 (Website, CUST_001, W-10482, by the integration user). Fixed the agent's config var name (`SF_Domain` → `SF_DOMAIN`).
- 2026-10-27: Step 12 / Step 15 part 5: Gemini key and agent shared secret rotated; live retest opened case 00001073. Old Gemini key deleted.
- 2026-10-27: Step 15 part 5: routing fix. `SDO_Service_Case_Routing` v2 skips cases with a Westerly Customer ID (backups 38a/38b); agent sends `Sforce-Auto-Assign: FALSE`. Local test case 00001074 stayed in Westerly Support; agent change committed (1b3fa1b), not yet pushed or deployed.
- 2026-10-27: Step 15 part 5: routing fix deployed (agent 1b3fa1b on Heroku); live test case 00001076 stayed in Westerly Support.
- 2026-10-27: Step 15: earlier Westerly cases 00001068–00001073 moved to the Westerly Support queue; all 9 Westerly cases now in the queue.
- 2026-10-27: Step 15 done: rep-side check on case 00001076 (Westerly panel in Service - Console; Coworker order status and add-items policy). Starter Kit asset on new cases still open.
- 2026-10-27: Step 15 part 2: Westerly Website Activity card (`westerlyCaseWebActivity` + `getRecentWebEvents`) deployed and added under the Westerly panel on the Service - Console Case page (backups 39a/39b); 8 events on case 00001076.
- 2026-10-27: Test cleanup: deleted the 8 test cases 00001068–00001075 (Recycle Bin, restorable for 15 days); 00001076 kept as the demo case.
- 2026-10-27: Architecture slides: `docs/westerly-architecture.pptx` (current state, illustrative ERP and ELT; future state with Snowflake zero copy to Data 360, Service Cloud and the Google ADK agent), explanations in the speaker notes. Generator: `setup/slides/build-architecture.js` (pptxgenjs; run with `NODE_PATH` pointing at its node_modules).
- 2026-10-27: Architecture slides: future state redrawn for real time: ERP events on an event bus feed the site (live stock, order status) and Snowflake (Snowpipe Streaming); zero copy both ways between Snowflake and Data 360; the site and agent read the shopper profile from Data 360; stock and checkout stay on the ERP. Generator updated.
- 2026-10-27: Architecture slides restyled to the Salesforce reference look (navy titles, teal arrows, white boxes with gray borders, Salesforce blue for Service Cloud). The future slide now puts Data 360 at the center: data streams (Web SDK streaming, Snowflake zero copy), Customer 360 data model, identity resolution, unified profiles, calculated insights, Data Graph API and data shares; the sources sit below and Service Cloud and the website above. No Salesforce logo is embedded. Generator updated.
- 2026-10-28: Architecture slides simplified. Today: the Integration box is gone; "Integration layer" (iPaaS or custom APIs, e.g. MuleSoft, Boomi) is now written between the website and the ERP. Future: no event bus box (the ERP streams to Snowflake through CDC + Snowpipe Streaming); Data 360 keeps data streams, Customer 360 data model, unified profiles and calculated insights (identity resolution, Data Graph API and data shares boxes removed; the data shares arrow to Snowflake stays); the Salesforce org box has no inner tiles. Speaker notes updated. Generator updated.
- 2026-10-28: Future slide: agent handoff follows Option A. The agent opens the Case directly in Service Cloud (API), and sends the handoff context (reason, summary, SKUs) to Data 360 as an event. Added the missing Service Cloud → Data 360 flow: cases and contacts through the Salesforce CRM connector into data streams. Speaker notes updated. Generator updated.
- 2026-10-28: Architecture slides: removed the "Illustrative current state" subtitle from the Today slide; future slide retitled "Unified Customer View at the heart of D360"; the website → Data 360 arrow is labeled "Web SDK or Ingestion API" (data streams and speaker notes match). Generator updated.
- 2026-10-28: Today slide: diagram and legend moved up 0.45 in to close the gap left by the removed subtitle. Generator updated.
- 2026-10-28: Architecture deck: added slide 3, "How the unified customer view works": nine numbered points explaining the future state (ERP streaming to Snowflake, zero copy, Web SDK or Ingestion API, CRM connector, unified profiles, reps and agents, case handoff, data shares, checkout on the ERP). Generator updated.
- 2026-10-28: Architecture deck: added slide 4, "Shopper & Rep Experience | Web + Agent", the demo flow as a winding journey with 8 stops (Web SDK, Google ADK agent, unified profile, agent opens the Case, routing, Westerly panel, Coworker + knowledge, case closed) and a trail key (Google, Salesforce, Google + Salesforce). Stand-in persona names (Maya, Jordan); no photos or logos. Generator updated.
- 2026-10-28: Slide 4 restyled: the journey is a winding trail with uneven bends (not a sine wave), a soft glow under the path, and numbered stops 1–8 on white rings with a light shadow. Generator updated.
