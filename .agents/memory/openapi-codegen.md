---
name: OpenAPI codegen compatibility
description: Small compatibility constraints discovered when generating the shared API client and Zod validators.
---

OpenAPI email `format` constraints currently generate `zod.email()` calls, which are incompatible with the workspace's installed Zod API. Prefer a plain string schema until the generator/runtime versions are aligned.

**Why:** The codegen step can succeed while the chained library typecheck fails, so generated-validator compatibility must be checked before wiring hooks into a frontend.

**How to apply:** When adding an email field to a contract, use a string constraint supported by the generated Zod version and rerun codegen plus `pnpm run typecheck:libs`.