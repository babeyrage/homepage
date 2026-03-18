import genericProxyHandler from "utils/proxy/handlers/generic";
import { asJson } from "utils/proxy/api-helpers";

const widget = {
  api: "https://www.cisa.gov/sites/default/files/feeds/{endpoint}",
  proxyHandler: genericProxyHandler,

  mappings: {
    kev: {
      endpoint: "known_exploited_vulnerabilities.json",
      validate: ["vulnerabilities"],
      map: (data) => {
        const json = asJson(data);
        return {
          count: json.count,
          catalogVersion: json.catalogVersion,
          vulnerabilities: (json.vulnerabilities ?? [])
            .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
            .map((v) => ({
              id: v.cveID,
              dateAdded: v.dateAdded,
              dueDate: v.dueDate,
              vendor: v.vendorProject,
              product: v.product,
              name: v.vulnerabilityName,
              description: v.shortDescription,
              ransomware: v.knownRansomwareCampaignUse === "Known",
              requiredAction: v.requiredAction,
            })),
        };
      },
    },
  },
};

export default widget;
