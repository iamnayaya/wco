/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Admin is behind SSO + IP allowlist at the edge (see infra/kubernetes);
  // no telemetry leaves the build machine either.
  poweredByHeader: false,
};
