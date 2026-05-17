import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const allowIndexing = process.env.BETA_ALLOW_INDEXING === "true";

  if (!allowIndexing) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/"
      }
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/api/"]
    },
    sitemap: `${process.env.APP_URL ?? "http://localhost:3000"}/sitemap.xml`
  };
}
