import credentialedProxyHandler from "utils/proxy/handlers/credentialed";

const widget = {
  api: "{url}/{endpoint}",
  proxyHandler: credentialedProxyHandler,

  mappings: {
    datastores: {
      endpoint: "monitoring/v1/datastores",
    },
  },
};

export default widget;
