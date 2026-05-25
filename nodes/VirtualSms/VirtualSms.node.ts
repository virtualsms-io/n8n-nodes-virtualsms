import {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestMethods,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from "n8n-workflow";

// n8n-workflow exports NodeConnectionType as type-only across many versions;
// the runtime value n8n actually expects is the string literal "main".
const MAIN = "main" as never;

async function vsmsRequest(
  ctx: IExecuteFunctions,
  method: IHttpRequestMethods,
  path: string,
  body?: object,
  qs?: Record<string, string | number | boolean | undefined>,
) {
  const credentials = await ctx.getCredentials("virtualSmsApi");
  const baseUrl =
    (credentials.baseUrl as string)?.replace(/\/+$/, "") ||
    "https://virtualsms.io";

  return ctx.helpers.httpRequestWithAuthentication.call(ctx, "virtualSmsApi", {
    method,
    url: `${baseUrl}${path}`,
    json: true,
    body,
    qs: qs
      ? Object.fromEntries(
          Object.entries(qs).filter(
            ([, v]) => v !== undefined && v !== null && v !== "",
          ),
        )
      : undefined,
    headers: { Accept: "application/json" },
  });
}

type Resource = "order" | "service" | "country" | "account";

export class VirtualSms implements INodeType {
  description: INodeTypeDescription = {
    displayName: "VirtualSMS",
    name: "virtualSms",
    icon: "file:virtualsms.svg",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description:
      "Buy real-SIM phone numbers for SMS verification (2,500+ services, 145+ countries), check status, cancel orders.",
    defaults: { name: "VirtualSMS" },
    inputs: [MAIN],
    outputs: [MAIN],
    credentials: [
      {
        name: "virtualSmsApi",
        required: true,
      },
    ],
    requestDefaults: {
      baseURL: "https://virtualsms.io",
    },
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        options: [
          { name: "Order", value: "order" },
          { name: "Service", value: "service" },
          { name: "Country", value: "country" },
          { name: "Account", value: "account" },
        ],
        default: "order",
      },

      // ── Order operations ──
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["order"] } },
        options: [
          {
            name: "Buy Number",
            value: "buyNumber",
            action: "Buy a phone number",
            description:
              "Purchase a phone number for a given service code and ISO country code",
          },
          {
            name: "Get Status",
            value: "getStatus",
            action: "Get order status",
            description:
              "Read the current status and any received SMS code for an order UUID",
          },
          {
            name: "Cancel",
            value: "cancel",
            action: "Cancel an order",
            description:
              "Cancel an order and trigger refund. Returns HTTP 425 inside the 120-second cooldown.",
          },
          {
            name: "List",
            value: "list",
            action: "List recent orders",
          },
          {
            name: "Check Price",
            value: "checkPrice",
            action: "Look up price for a service/country combo",
            description: "No auth required. Returns 'estimated' price + 'success' flag.",
          },
        ],
        default: "buyNumber",
      },

      // Buy Number inputs
      {
        displayName: "Service Code",
        name: "service",
        type: "string",
        required: true,
        default: "",
        placeholder: "wa",
        description:
          "Short service code (e.g. 'wa' for WhatsApp, 'tg' for Telegram, 'aws' for 7-Eleven). Use 'Service: List' to discover codes — they are NOT slugs.",
        displayOptions: {
          show: { resource: ["order"], operation: ["buyNumber", "checkPrice"] },
        },
      },
      {
        displayName: "Country",
        name: "country",
        type: "string",
        required: true,
        default: "",
        placeholder: "US",
        description: "ISO 2-letter country code (e.g. US, GB, DE, AR).",
        displayOptions: {
          show: { resource: ["order"], operation: ["buyNumber", "checkPrice"] },
        },
      },

      // Status / Cancel inputs
      {
        displayName: "Order ID",
        name: "orderId",
        type: "string",
        required: true,
        default: "",
        placeholder: "7e44ebb5-9a55-4bd8-a4e9-7f226f9d5ebd",
        description: "Order UUID returned by 'Buy Number'",
        displayOptions: {
          show: {
            resource: ["order"],
            operation: ["getStatus", "cancel"],
          },
        },
      },

      // List inputs
      {
        displayName: "Limit",
        name: "limit",
        type: "number",
        typeOptions: { minValue: 1, maxValue: 500 },
        default: 50,
        displayOptions: {
          show: { resource: ["order"], operation: ["list"] },
        },
      },

      // ── Service operations ──
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["service"] } },
        options: [
          {
            name: "List",
            value: "list",
            action: "List available services",
          },
        ],
        default: "list",
      },

      // ── Country operations ──
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["country"] } },
        options: [
          {
            name: "List",
            value: "list",
            action: "List available countries",
          },
        ],
        default: "list",
      },

      // ── Account operations ──
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["account"] } },
        options: [
          {
            name: "Get Balance",
            value: "getBalance",
            action: "Get account balance",
          },
        ],
        default: "getBalance",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const out: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter("resource", i) as Resource;
      const operation = this.getNodeParameter("operation", i) as string;

      try {
        let result: unknown;

        if (resource === "order") {
          if (operation === "buyNumber") {
            const service = this.getNodeParameter("service", i) as string;
            const country = this.getNodeParameter("country", i) as string;
            result = await vsmsRequest(
              this,
              "POST",
              "/api/v1/customer/purchase",
              { service, country },
            );
          } else if (operation === "getStatus") {
            const orderId = this.getNodeParameter("orderId", i) as string;
            result = await vsmsRequest(
              this,
              "GET",
              `/api/v1/customer/order/${encodeURIComponent(orderId)}`,
            );
          } else if (operation === "cancel") {
            const orderId = this.getNodeParameter("orderId", i) as string;
            result = await vsmsRequest(
              this,
              "POST",
              `/api/v1/customer/cancel/${encodeURIComponent(orderId)}`,
            );
          } else if (operation === "list") {
            const limit = this.getNodeParameter("limit", i) as number;
            result = await vsmsRequest(
              this,
              "GET",
              "/api/v1/customer/orders",
              undefined,
              { limit },
            );
          } else if (operation === "checkPrice") {
            const service = this.getNodeParameter("service", i) as string;
            const country = this.getNodeParameter("country", i) as string;
            result = await vsmsRequest(
              this,
              "GET",
              "/api/v1/price",
              undefined,
              { service, country },
            );
          } else {
            throw new NodeOperationError(
              this.getNode(),
              `Unknown order operation: ${operation}`,
            );
          }
        } else if (resource === "service" && operation === "list") {
          result = await vsmsRequest(
            this,
            "GET",
            "/api/v1/customer/services",
          );
        } else if (resource === "country" && operation === "list") {
          result = await vsmsRequest(
            this,
            "GET",
            "/api/v1/customer/countries",
          );
        } else if (resource === "account" && operation === "getBalance") {
          result = await vsmsRequest(this, "GET", "/api/v1/customer/balance");
        } else {
          throw new NodeOperationError(
            this.getNode(),
            `Unsupported ${resource}/${operation}`,
          );
        }

        if (Array.isArray(result)) {
          for (const row of result) out.push({ json: row as IDataObject });
        } else {
          out.push({ json: result as IDataObject });
        }
      } catch (err) {
        if (this.continueOnFail()) {
          out.push({ json: { error: (err as Error).message }, pairedItem: i });
          continue;
        }
        throw err;
      }
    }

    return [out];
  }
}
