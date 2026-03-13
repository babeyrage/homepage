import genericProxyHandler from "utils/proxy/handlers/generic";
import { asJson } from "utils/proxy/api-helpers";

const widget = {
  api: "https://services.nvd.nist.gov/rest/json/{endpoint}",
  proxyHandler: genericProxyHandler,

  mappings: {
    total: {
      // Fetch 1 result with no filters to get the global CVE count from totalResults
      endpoint: "cves/2.0",
      params: ["resultsPerPage"],
      validate: ["totalResults"],
      map: (data) => {
        const json = asJson(data);
        return { totalResults: json.totalResults };
      },
    },
    cves: {
      // https://nvd.nist.gov/developers/vulnerabilities
      endpoint: "cves/2.0",
      optionalParams: ["resultsPerPage", "pubStartDate", "pubEndDate", "apiKey"],
      validate: ["vulnerabilities"],
      map: (data) => {
        const json = asJson(data);
        return {
          totalResults: json.totalResults,
          vulnerabilities: (json.vulnerabilities ?? [])
            .sort((a, b) => new Date(b.cve.published) - new Date(a.cve.published))
            .map((v) => {
              const cve = v.cve;
              const metrics = cve.metrics ?? {};
              // CVSSv3.x stores baseSeverity inside cvssData; CVSSv2 stores it on the metric root
              const v31 = metrics.cvssMetricV31?.[0];
              const v30 = metrics.cvssMetricV30?.[0];
              const v2 = metrics.cvssMetricV2?.[0];
              const severity =
                v31?.cvssData?.baseSeverity ??
                v30?.cvssData?.baseSeverity ??
                v2?.baseSeverity ??
                "UNKNOWN";
              const score =
                v31?.cvssData?.baseScore ??
                v30?.cvssData?.baseScore ??
                v2?.cvssData?.baseScore ??
                null;
              const description = cve.descriptions?.find((d) => d.lang === "en")?.value ?? "";
              return {
                id: cve.id,
                published: cve.published,
                severity,
                score,
                description,
              };
            }),
        };
      },
    },
  },
};

export default widget;
