# Validation evidence

**Project status:** 57 tests passing; deployed to GitHub Pages.

The evidence below separates source validation, successful static delivery, historical Azure evidence and the optional unhosted API.

## Evidence ledger

| Evidence | Result | Limit |
| --- | --- | --- |
| JavaScript suite reviewed 8 September 2026 | 57 tests passed across two files: 48 domain tests and nine interface tests | Exercises the implemented rules and interface; it is not independent payroll certification |
| Local delivery review repeated 8 September 2026 | Tests, lint and production build passed; generated asset URLs begin with `/egypt-salary-calculator/`; the .NET Function built with zero warnings and zero errors | Validated the local checkout before publication; the later deployment is recorded below |
| Static production preview at 390 × 844 | Project-path page, JavaScript, CSS and favicon returned 200; EGP 10,000 produced EGP 8,302.50; no console errors, request failures or horizontal overflow | Browser evidence for the local bundle, not the first public Pages run |
| Final production-bundle review on 9 September 2026, at 1440 × 1000 and 390 × 844 | Reference result confirmed at both widths; zero Axe WCAG A/AA and WCAG 2.1 AA violations, horizontal overflow, browser errors, or failed requests | Local static preview before publication, with the optional API unconfigured |
| Pre-migration public availability check on 9 September 2026 | Pages API confirms `build_type: workflow`; the project URL returned HTTP 200, but Chromium rendered an empty application because `/src/main.tsx` returned 404 | Existing [Pages run 34335934625](https://github.com/yossefseit/egypt-salary-calculator/actions/runs/34335934625) deployed the older commit `1241689611f72dd55f3f575cb41ccbac43200041`; it did not publish this production bundle |
| [Production Pages run 34370072295](https://github.com/yossefseit/egypt-salary-calculator/actions/runs/34370072295), 9 September 2026 at 15:25:20 UTC | Build and deploy succeeded for commit `1f710b2b5dea7c86df15199ea9dd1f2e7f6e0090`; production `dist/` published at the project URL | Static React client only; the optional .NET Function remains unhosted |
| Live browser review on 9 September 2026, at 1440 × 1000 and 390 × 844 | HTTP 200 and built asset paths; EGP 10,000 gross → EGP 8,302.50 net; period conversion, manual insurance, reverse calculation and persisted theme verified; zero Axe A/AA violations, overflow, browser errors or failed requests | Dated application smoke check with USD reference rate unavailable; not ongoing uptime or independent payroll certification |
| [Historical GitHub Actions run 31909528455](https://github.com/yossefseit/egypt-salary-calculator/actions/runs/31909528455) | Former Azure build and deployment jobs completed successfully on 15 August 2026 (UTC), commit `1241689611f72dd55f3f575cb41ccbac43200041` | Dated evidence for the retired Azure delivery path; it does not establish current hosting |
| Local application screenshot | Captured from the production bundle in dark mode with the optional API unavailable | Visual evidence of the static client, not a public endpoint or API deployment |

Live evidence: [sanitized browser report](evidence/pages-live-2026-09-09.json) · [Desktop capture](assets/live-application-desktop.png) · [Mobile capture](assets/live-application-mobile.png).

## Reproduce the local checks

Use Node.js 22.x and npm from the repository root:

```bash
npm ci
npm test
npm run lint
npm run build
dotnet build api/api.csproj
```

The expected JavaScript test split is:

- `src/domain/salaryCalculator.test.ts`: 48 tests covering insurance limits, tax boundaries, annual rounding, gross-to-net, net-to-gross and invalid inputs.
- `src/App.test.tsx`: nine tests covering the reference result, USD display, formatted input, period conversion, reverse calculation, theme persistence, validation and the empty state.

Review the [desktop](assets/pages-application-desktop.png) and [mobile](assets/pages-application-mobile.png) production previews from 9 September.

The reference interface scenario enters EGP 10,000 monthly gross with automatic insurance and expects:

| Item | Monthly result |
| --- | ---: |
| Gross | EGP 10,000.00 |
| Employee insurance | EGP 1,100.00 |
| Income tax | EGP 592.50 |
| Martyrs Fund deduction | EGP 5.00 |
| Net | EGP 8,302.50 |

## What the workflows establish

[`ci.yml`](../.github/workflows/ci.yml) runs a locked install, the JavaScript tests, Oxlint and the production build. Its badge in the README follows the current public branch.

[`deploy-pages.yml`](../.github/workflows/deploy-pages.yml) has separate build and deployment jobs. On pushes to `main` or manual runs, the build repeats tests, lint and the production build before uploading only `dist/`. The deployment job accepts only the `main` ref and targets GitHub's `github-pages` environment with repository-scoped Pages and identity-token permissions. Pull requests remain covered by `ci.yml`. Its first successful production deployment is [run 34370072295](https://github.com/yossefseit/egypt-salary-calculator/actions/runs/34370072295), completed on 9 September 2026 at 15:25:20 UTC from commit `1f710b2b5dea7c86df15199ea9dd1f2e7f6e0090`.

The Pages workflow does not build or deploy the Function. The linked historical run documents successful checkout, Node setup, application build/tests, artifact upload, Azure OIDC login and App Service deployment on its exact 2026 commit; that retired workflow is no longer current automation.

## Availability language

The live client URL is `https://yossefseit.github.io/egypt-salary-calculator/`. The repository owner selected **GitHub Actions** as the Pages source, verified through the Pages API on 9 September 2026. The successful production deployment above replaced the older unbuilt source page. Live browser checks at desktop and mobile widths confirmed that production JavaScript and CSS load under `/egypt-salary-calculator/assets/` and the calculator renders and calculates in EGP.

GitHub Pages cannot host the optional .NET Function. Without a separately hosted and configured API, the public client shows the reference-rate unavailable state while continuing to calculate salaries in EGP. The linked case study is maintained in the separate [portfolio repository](https://github.com/yossefseit/yossefseit.github.io).

[Back to README](../README.md) · [Architecture](architecture.md) · [Operations](operations.md)
