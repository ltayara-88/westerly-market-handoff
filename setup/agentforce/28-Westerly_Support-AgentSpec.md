# Agent Spec: Westerly_Support

## Purpose & Scope

Westerly Support is a customer-facing service agent for Westerly Market. It answers
order questions (status, date, total and the items on an order) from Data 360 order
data, after the shopper proves the order is theirs. Recipes and shopping stay with
the Google agent, which hands order questions over to this one.

## Behavioral Intent

- Before any lookup the agent needs two things from the shopper: the order number and
  the email on the order.
- Both actions are autolaunched Flows that read Data 360 DMOs
  (`ssot__SalesOrder__dlm`, `ssot__ContactPointEmail__dlm`, `ssot__SalesOrderProduct__dlm`).
- Verification happens inside each flow (order number + email must match). The agent
  never shares order details unless the flow returns `isVerified = true`. A failed
  check gets the flow's `message`; no hints about which part was wrong.
- No other customer data (phone, address, other orders) is ever shared.
- Off-topic questions (recipes, products, prices): say politely that this agent handles
  order questions only.
- The shopper can ask for a person at any time; the agent escalates.
- Order number and email stay in conversation history; no variables are needed.

## Subagent Posture

| Subagent | Posture | Why this posture? | Deterministic controls |
|----------|---------|-------------------|------------------------|
| order_support (start_agent) | agentic | one objective (order questions), two lookups the LLM picks by intent | none: verification is enforced in the flows |

## Subagent Map

```mermaid
%%{init: {'theme':'neutral'}}%%
graph TD
    A[start_agent<br/>order_support] --> B[get_order_status<br/>flow://Westerly_Get_Order_Status]
    A --> C[get_order_items<br/>flow://Westerly_Get_Order_Items]
    A --> D[escalate<br/>@utils.escalate]
```

## Variables

Only the standard Messaging Session linked variables (EndUserId, RoutableId, ContactId),
which a service agent on Messaging for In-App and Web needs. No mutable variables.

## Actions

### get_order_status (order_support)

- **Target:** `flow://Westerly_Get_Order_Status`
- **Status:** EXISTS (Active)

#### Inputs

| Name | Type | Required | Source |
|------|------|----------|--------|
| orderNumber | string | Yes | Shopper |
| customerEmail | string | Yes | Shopper |

#### Outputs

| Name | Type | Visible to User? | Notes |
|------|------|------------------|-------|
| isVerified | boolean | No | Gate: share details only when true |
| message | string | Yes | Result message (found / not verified / not found) |
| orderStatus | string | Yes | |
| orderDate | datetime | Yes | Flow DateTime |
| orderTotal | number | Yes | Flow Number, 2 decimals |

### get_order_items (order_support)

- **Target:** `flow://Westerly_Get_Order_Items`
- **Status:** EXISTS (must be Active before publish)

#### Inputs

| Name | Type | Required | Source |
|------|------|----------|--------|
| orderNumber | string | Yes | Shopper |
| customerEmail | string | Yes | Shopper |

#### Outputs

| Name | Type | Visible to User? | Notes |
|------|------|------------------|-------|
| isVerified | boolean | No | Gate |
| message | string | Yes | |
| itemsSummary | string | Yes | `[qty x SKU - $amount]` per line; SKUs only, no product names |

## Action Invocation Strategy

| Action | Invocation Mode | Why |
|--------|-----------------|-----|
| get_order_status | planner slot-fill | shopper asks where/when/how much |
| get_order_items | planner slot-fill | shopper asks what was in the order |
| escalate | planner (`@utils.escalate`) | shopper asks for a person |

## Deterministic Controls

None. The flows enforce verification; adding agent-side gates would duplicate it.

## Architecture Pattern

Single `start_agent order_support:` block, zero subagents, no router.

## Agent Configuration

- **developer_name:** `Westerly_Support`
- **agent_label:** `Westerly Support`
- **agent_type:** `AgentforceServiceAgent` (customer-facing web chat)
- **access.default_agent_user:** `<SERVICE_AGENT_USERNAME>` (the org's existing
  ServiceAgent Agentforce user, which has the Einstein Agent license and the
  AgentforceServiceAgentUser permission set). It also needs Data Cloud access to read
  the DMOs: permission set license `GenieDataPlatformStarterPsl`, plus the default
  data space.
