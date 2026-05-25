import {
  IDataObject,
  IPollFunctions,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";

const MAIN = "main" as never;

async function callApi(
  ctx: IPollFunctions,
  method: "GET" | "POST",
  path: string,
  qs?: IDataObject,
) {
  const credentials = await ctx.getCredentials("virtualSmsApi");
  const baseUrl =
    (credentials.baseUrl as string)?.replace(/\/+$/, "") ||
    "https://virtualsms.io";
  return ctx.helpers.httpRequestWithAuthentication.call(ctx, "virtualSmsApi", {
    method,
    url: `${baseUrl}${path}`,
    qs,
    json: true,
    headers: { Accept: "application/json" },
  });
}

interface OrderRow {
  id: string;
  status: string;
  phone_number?: string;
  service_id?: string;
  country_id?: string;
  price_charged?: number;
  created_at?: string;
  expires_at?: string;
}

export class VirtualSmsTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "VirtualSMS Trigger",
    name: "virtualSmsTrigger",
    icon: "file:virtualsms.svg",
    group: ["trigger"],
    version: 1,
    subtitle: '={{$parameter["event"]}}',
    description:
      "Polling triggers for VirtualSMS: new SMS received, rental expired, low balance.",
    defaults: { name: "VirtualSMS Trigger" },
    inputs: [],
    outputs: [MAIN],
    credentials: [
      {
        name: "virtualSmsApi",
        required: true,
      },
    ],
    polling: true,
    properties: [
      {
        displayName: "Event",
        name: "event",
        type: "options",
        noDataExpression: true,
        options: [
          {
            name: "Order Received SMS",
            value: "smsReceived",
            description:
              "Fires once per order that newly transitions to status='completed' (the SMS-received terminal state on VirtualSMS)",
          },
          {
            name: "Order Expired",
            value: "orderExpired",
            description:
              "Fires once per order that newly transitions to status='expired'",
          },
          {
            name: "Low Balance",
            value: "lowBalance",
            description:
              "Fires once when account balance crosses below threshold (debounced)",
          },
        ],
        default: "smsReceived",
      },
      {
        displayName: "List Page Size",
        name: "limit",
        type: "number",
        typeOptions: { minValue: 10, maxValue: 500 },
        default: 100,
        description:
          "How many recent orders to scan on each poll. Default 100 covers most use cases.",
        displayOptions: { show: { event: ["smsReceived", "orderExpired"] } },
      },
      {
        displayName: "Balance Threshold (USD)",
        name: "balanceThreshold",
        type: "number",
        typeOptions: { numberPrecision: 2 },
        default: 5,
        description: "Trigger fires when balance drops below this value.",
        displayOptions: { show: { event: ["lowBalance"] } },
      },
    ],
  };

  async poll(this: IPollFunctions) {
    const event = this.getNodeParameter("event") as string;
    const data = this.getWorkflowStaticData("node");

    if (event === "smsReceived" || event === "orderExpired") {
      // VirtualSMS uses "completed" as the terminal state when SMS arrives —
      // there is no "received" status in the production API. Verified live
      // 2026-05-24 via /api/v1/customer/orders inspection.
      const wantStatus = event === "smsReceived" ? "completed" : "expired";
      const limit = this.getNodeParameter("limit") as number;
      const seenKey = `${event}Seen`;
      const seen = (data[seenKey] as string[]) || [];
      const seenSet = new Set(seen);

      const resp = (await callApi(
        this,
        "GET",
        "/api/v1/customer/orders",
        { limit },
      )) as { orders?: OrderRow[] };

      const fresh = (resp.orders || []).filter(
        (o) => o.status === wantStatus && !seenSet.has(o.id),
      );

      data[seenKey] = [...seen, ...fresh.map((o) => o.id)].slice(-1000);

      return fresh.length
        ? [fresh.map((o) => ({ json: o as unknown as IDataObject }))]
        : null;
    }

    if (event === "lowBalance") {
      const threshold = this.getNodeParameter("balanceThreshold") as number;
      const resp = (await callApi(this, "GET", "/api/v1/customer/balance")) as {
        balance: number;
      };
      const balance = Number(resp.balance);
      const wasBelow = Boolean(data.lowBalanceFired);
      if (balance < threshold && !wasBelow) {
        data.lowBalanceFired = true;
        return [
          [
            {
              json: {
                balance,
                threshold,
                currency: "USD",
                crossed_at: new Date().toISOString(),
              },
            },
          ],
        ];
      }
      if (balance >= threshold && wasBelow) {
        data.lowBalanceFired = false;
      }
      return null;
    }

    return null;
  }
}
