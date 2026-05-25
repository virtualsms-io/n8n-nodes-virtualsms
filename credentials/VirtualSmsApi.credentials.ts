import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class VirtualSmsApi implements ICredentialType {
  name = "virtualSmsApi";
  displayName = "VirtualSMS API";
  documentationUrl = "https://api.virtualsms.io";

  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description:
        "Your VirtualSMS API key. Find it at https://virtualsms.io → Settings → API Keys.",
    },
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "https://virtualsms.io",
      description: "Override only for self-hosted/staging deployments.",
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: {
        "X-API-Key": "={{$credentials.apiKey}}",
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.baseUrl}}",
      url: "/api/v1/balance",
      method: "GET",
    },
  };
}
