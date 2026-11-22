import scryerProxyHandler from "./proxy";

// Scryer exposes GraphQL only, so there is no REST `api` template: the custom
// proxy handler POSTs one batched query and returns the already-mapped payload.
const widget = {
  api: "{url}/graphql",
  proxyHandler: scryerProxyHandler,

  mappings: {
    overview: {
      endpoint: "overview",
    },
  },
};

export default widget;
