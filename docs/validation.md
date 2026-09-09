# Validation evidence

**Project status:** 57 tests passing; GitHub Pages deployment configured.

This wording deliberately separates source validation, configured delivery, historical Azure evidence and current public availability.

## Evidence ledger

| Evidence | Result | Limit |
| --- | --- | --- |
| JavaScript suite reviewed 8 September 2026 | 57 tests passed across two files: 48 domain tests and nine interface tests | Exercises the implemented rules and interface; it is not independent payroll certification |
| Local delivery review repeated 8 September 2026 | Tests, lint and production build passed; generated asset URLs begin with `/egypt-salary-calculator/`; the .NET Function built with zero warnings and zero errors | Validates the local checkout and unpublished Pages configuration, not a completed public deployment |
| Static production preview at 390 × 844 | Project-path page, JavaScript, CSS and favicon returned 200; EGP 10,000 produced EGP 8,302.50; no console errors, request failures or horizontal overflow | Browser evidence for the local bundle, not the first public Pages run |
| Final production-bundle review on 9 September 2026, at 1440 × 1000 and 390 × 844 | Reference result confirmed at both widths; zero Axe WCAG A/AA and WCAG 2.1 AA violations, horizontal overflow, browser errors, or failed requests | Local static preview with the optional API unconfigured; public deployment remains pending |
| Public availability check on 9 September 2026 | Pages API confirms `build_type: workflow`; the project URL returns HTTP 200, but Chromium renders an empty application because `/src/main.tsx` returns 404 | Existing [Pages run 34335934625](https://github.com/yossefseit/egypt-salary-calculator/actions/runs/34335934625) deployed the older commit `1241689611f72dd55f3f575cb41ccbac43200041`; it did not publish this production bundle |
| [Historical GitHub Actions run 31909528455](https://github.com/yossefseit/egypt-salary-calculator/actions/runs/31909528455) | Former Azure build and deployment jobs completed successfully on 15 August 2026 (UTC), commit `1241689611f72dd55f3f575cb41ccbac43200041` | Dated evidence for the retired Azure delivery path; it does not establish current hosting |
| Local application screenshot | Captured from the production bundle in dark mode with the optional API unavailable | Visual evidence of the static client, not a public endpoint or API deployment |

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

[`deploy-pages.yml`](../.github/workflows/deploy-pages.yml) has separate build and deployment jobs. On pushes to `main` or manual runs, the build repeats tests, lint and the production build before uploading only `dist/`. The deployment job accepts only the `main` ref and targets GitHub's `github-pages` environment with repository-scoped Pages and identity-token permissions. Pull requests remain covered by `ci.yml`. This Pages workflow is configured locally but has no completed run yet.

The Pages workflow does not build or deploy the Function. The linked historical run documents successful checkout, Node setup, application build/tests, artifact upload, Azure OIDC login and App Service deployment on its exact 2026 commit; that retired workflow is no longer current automation.

## Availability language

The intended client URL is `https://yossefseit.github.io/egypt-salary-calculator/`. The repository owner selected **GitHub Actions** as the Pages source, verified through the Pages API on 9 September 2026. The remaining requirements are publication of this configuration through `main` and a successful run of `deploy-pages.yml`. The existing public page serves an unbuilt source entry point and does not render the calculator; HTTP 200 and the older Pages run alone do not establish a working application. This project therefore describes the reviewed deployment as configured rather than live.

GitHub Pages cannot host the optional .NET Function. Without a separately hosted and configured API, the public client will show the reference-rate unavailable state while continuing to calculate salaries in EGP. The linked case-study route also depends on the separately reviewed portfolio publication at `https://yossefseit.github.io/`.

[Back to README](../README.md) · [Architecture](architecture.md) · [Operations](operations.md)
