import { describe, expect, it } from "vitest";
import { clinicalResources } from "@/lib/clinical-resources";

describe("recursos clínicos externos", () => {
  it("mantiene recursos curados y no editables desde frontend", () => {
    expect(clinicalResources).toHaveLength(4);
    expect(clinicalResources.map((resource) => resource.id)).toEqual(["vera-health", "pubmed", "pubmed-central", "imss-gpc"]);
    expect(Object.isFrozen(clinicalResources)).toBe(true);
  });

  it("usa únicamente enlaces externos HTTPS", () => {
    for (const resource of clinicalResources) {
      const url = new URL(resource.url);

      expect(resource.external).toBe(true);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).not.toBe("localhost");
      expect(resource.url.startsWith("/")).toBe(false);
    }
  });
});
