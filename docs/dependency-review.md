# Dependency review

The npm production-dependency audit on 4 November 2026 identified a high-severity constrained-collection memory-exhaustion advisory in Zod 3. The shared contracts and API were upgraded to the patched Zod 4.6.7 line and must pass the contract and end-to-end tests after installation. API bodies are also limited to 8 KiB and text to 240 characters. [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

The final audit reports zero high or critical entries, 23 moderate entries and three low entries, including parent-package propagation. The remaining advisory families are inherited through React Native build tooling and AWS CDK. The current code does not expose their glob, XML-builder or configuration-merge operations to viewer input. Their presence still needs review when maintaining or distributing the toolchain. Avoid forcing major transitive dependency overrides across incompatible APIs merely to suppress audit output.

| Dependency family | Advisory                                    | Current use                                                |
| ----------------- | ------------------------------------------- | ---------------------------------------------------------- |
| minimatch         | Glob-pattern memory amplification           | React Native tooling and bundled CDK build/deployment code |
| fast-xml-parser   | XML comment / CDATA injection in XMLBuilder | React Native CLI Android configuration tooling             |
| deepmerge         | Prototype poisoning of merged configuration | React Native CLI configuration merging                     |

Re-run `npm audit --omit=dev` before release, review upstream patched versions, and validate Android builds and CDK synthesis after updating. These packages are not used by the TypeScript Lambda request/observation domain or loaded into the web UI. React Native’s npm production tree includes build tooling that is not Android application JavaScript.

The Lambda bundle, web bundle and container need their own release artifact inventory. The Python engine is pinned and voice artifacts have SHA-256 verification. The Linux container build and its dependency inventory are outstanding because Docker is unavailable locally.
