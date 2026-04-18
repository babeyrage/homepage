import credentialedProxyHandler from "utils/proxy/handlers/credentialed";

const widget = {
  api: "{url}/api/v1/api/{endpoint}",
  proxyHandler: credentialedProxyHandler,

  mappings: {
    hosts: {
      endpoint: "hosts",
      params: ["include"],
    },
  },
};

export default widget;
