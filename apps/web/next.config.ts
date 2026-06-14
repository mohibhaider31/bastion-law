import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: "bastion-law",
  project: "bastion-web",
  silent: true,
  disableLogger: true,
});
