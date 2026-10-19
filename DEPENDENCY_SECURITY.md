# Dependency security

Verified on 2026-10-19 with clean `npm ci` installs.

- Application production dependencies: no npm audit findings.
- Landing dependencies: no npm audit findings after upgrading Astro to 7.4.
- Application development dependencies: seven package findings trace to one
  unpatched `braces` advisory, GHSA-vfj7-8cjw-p6xm, through the `@vercel/node`
  build tooling (`ts-morph` → `@ts-morph/common` → `fast-glob` → `micromatch`).
  The registry's latest `braces` release, 3.0.3, is affected. No suppression or
  forced downgrade is applied. Recheck when upstream publishes a fix.

The root package overrides select patched gRPC, Undici, path-to-regexp and Ajv
versions where upstream packages still pin vulnerable releases. The application
uses `@vercel/node` for TypeScript request/response types; its build tooling is
not imported into application runtime code.

CI audits application production dependencies and the complete landing
dependency tree, failing on high or critical findings. To review all application
tooling as well, run `npm audit` from the repository root.

The landing requires Node.js 22.22.0 or newer as supported by Astro 7. Existing
CI uses the latest Node.js 22 release.
