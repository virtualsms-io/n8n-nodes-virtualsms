# n8n-nodes-virtualsms

Community n8n nodes for [VirtualSMS](https://virtualsms.io) — real-SIM SMS verification across 145+ countries and 2,500+ services. Buy disposable phone numbers, receive OTP codes via polling, manage orders.

[![npm](https://img.shields.io/npm/v/n8n-nodes-virtualsms.svg)](https://www.npmjs.com/package/n8n-nodes-virtualsms)

## Install

In **n8n desktop / cloud / self-hosted** → Settings → Community Nodes → Install:

```
n8n-nodes-virtualsms
```

## Credentials

Create a key at [virtualsms.io](https://virtualsms.io) → Settings → API Keys, then in n8n add a **VirtualSMS API** credential with that key.

## Nodes

### `VirtualSMS` (action)

| Resource | Operations |
|---|---|
| Order | Buy Number, Get Status, Cancel, List, Check Price |
| Service | List |
| Country | List |
| Account | Get Balance |

`Check Price` is unauthenticated and reports back `success`/`error` along with the current cost for a service/country combination — useful as a pre-flight before `Buy Number`.

### `VirtualSMS Trigger`

Three polling triggers:

- **Order Received SMS** — fires once per order that newly transitions to `received`
- **Order Expired** — fires once per order that newly transitions to `expired`
- **Low Balance** — fires once when balance crosses below configurable USD threshold (debounced)

> Triggers are polling-based because VirtualSMS does not currently expose a customer-facing outbound webhook subscription endpoint. The trigger node tracks seen-order IDs in workflow state to dedupe across poll intervals.

## Service codes

VirtualSMS services use **short codes**, not slugs. Examples:

| Service | Code |
|---|---|
| WhatsApp | `wa` |
| Telegram | `tg` |
| 7-Eleven | `aws` |
| Caffe Nero | `bqo` |

Use the `Service: List` operation to discover the full catalog.

## Example flow

`Schedule Trigger → VirtualSMS (Buy Number wa/GB) → Wait 30s → VirtualSMS Trigger (Order Received SMS) → ...`

Or `VirtualSMS Trigger (Order Received SMS) → IF sms_code present → Slack message`.

## Develop locally

```bash
git clone https://github.com/virtualsms-io/automation-integrations
cd automation-integrations
npm install
npm run build --workspace=n8n-nodes-virtualsms
```

Link into a local n8n instance per [n8n community node docs](https://docs.n8n.io/integrations/creating-nodes/test/run-node-locally/).

## License

MIT
