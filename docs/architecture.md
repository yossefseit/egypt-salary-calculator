# Architecture and decisions

The Egypt Salary Calculator has two concerns: a browser application that performs salary calculations and an optional exchange-rate service that supplies a USD/EGP reference rate. The salary engine does not depend on that service, so a rate failure does not prevent an EGP calculation.

![Delivery and runtime architecture. GitHub main triggers independent quality and GitHub Pages deployment workflows. Pages serves the static React client at the repository path. The browser fetches Frankfurter reference rates directly; the dotnet Function is an optional separately hosted override.](assets/architecture.svg)

## Source map

| Concern | Implementation |
| --- | --- |
| Arabic RTL interface | [`src/App.tsx`](../src/App.tsx) and [`src/App.css`](../src/App.css) |
| Salary rules and gross-up | [`src/domain/salaryCalculator.ts`](../src/domain/salaryCalculator.ts) |
| Exchange-rate client | [`src/services/exchangeRate.ts`](../src/services/exchangeRate.ts) |
| Exchange-rate endpoint | [`.NET 10 isolated Function`](../api/GetUsdEgpRate.cs) and [`Program.cs`](../api/Program.cs) |
| Application CI | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| Static client delivery | [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) |

## Calculation path

The React client normalizes monthly and annual input before calling a pure TypeScript engine. The engine calculates employee insurance, annual taxable income, progressive income tax, the Martyrs Fund deduction and the resulting net salary. Net-to-gross uses a bounded binary search, then verifies that the resulting net is within EGP 0.01 of the requested value.

The current model records a rules effective date of 15 August 2026 and assumes 12 equal salary months. It does not model bonuses, allowances, special exemptions or employer-side costs. The result is an educational estimate; the source references are collected in the [main README](../README.md#calculation-references).

## Optional reference-rate path

By default, the browser sends a fixed public GET to `https://api.frankfurter.dev/v2/rate/USD/EGP`. [Frankfurter documents browser fetch with open CORS and no API key](https://frankfurter.dev/javascript/). The response is a flat `{date, base, quote, rate}` object. No salary value is included in the URL, headers or body, and the client omits cookies. It accepts only USD/EGP, a positive finite rate and a real ISO calendar date. The request times out after eight seconds and is cancelled on unmount. The interface displays the source/date and makes clear that the conversion is indicative, not a bank transaction quote; failure keeps EGP available and offers a retry.

An explicitly configured `VITE_API_BASE_URL` instead calls that origin’s `/api/GetUsdEgpRate` endpoint and preserves the Function’s `{baseCurrency, quoteCurrency, rate, date, source}` contract. The same browser validation and timeout apply. This adapter is optional and unhosted; it is not needed by the default Pages client.

The Function calls Frankfurter with a five-second timeout and accepts only a positive USD/EGP rate with the expected currency codes and a non-empty date. Successful responses receive a one-hour public cache header. Upstream HTTP errors and parsed-but-invalid responses become 502 responses; an upstream timeout becomes a 504 response. The client treats any failure as optional and keeps the EGP result visible.

OpenTelemetry export to Azure Monitor is enabled only when `APPLICATIONINSIGHTS_CONNECTION_STRING` is present. The source contains no salary-value telemetry.

## Delivery path

Two independent GitHub Actions workflows cover review and delivery:

- `CI` validates pull requests to `main`, pushes to `main`, and manual runs with a locked npm install, the JavaScript test suite, linter, and production build.
- `Deploy static calculator to GitHub Pages` runs on pushes to `main` or manual dispatch, repeats the locked install, tests, lint and build, then packages only `dist/`. Its deploy job accepts only the `main` ref and publishes through the repository's `github-pages` environment.

Vite's production base is `/egypt-salary-calculator/`, matching the project site at `https://yossefseit.github.io/egypt-salary-calculator/`. The workflow uses GitHub's Pages artifact and deployment actions with repository-scoped `pages: write` and `id-token: write` permissions. It does not need an Azure identity or cloud credential.

GitHub Pages cannot execute the .NET Function. The Pages workflow does not build or deploy `api/`, and no production `VITE_API_BASE_URL` is currently set. The static client therefore fetches its reference rate directly from Frankfurter, while keeping EGP calculations independent of the provider. See the [dated validation record](validation.md) and [operations guide](operations.md).

## Decisions and trade-offs

| Decision | Benefit | Boundary |
| --- | --- | --- |
| Calculate in the browser | Immediate feedback and no salary submission to a server | A published bundle exposes the rules and must be updated when regulations change |
| Keep exchange rates optional | Payroll estimates still work when the provider or Function is unavailable | USD output is a dated reference, not part of the payroll result |
| Use pure domain functions | Tax boundaries and gross-up behavior are straightforward to test | Accuracy still depends on the modeled assumptions and source interpretation |
| Publish `dist/` with GitHub Pages | Uses a repository-native static host with no application server or Azure credential | Pages cannot run the .NET Function or provide server-side routing |
| Build with the repository base path | Asset URLs resolve under `/egypt-salary-calculator/` | The same bundle is coupled to that public project path |
| Use public browser reference rates | USD display works on static Pages without a secret or a server | Depends on provider CORS and availability; the shown date can precede today |
| Retain the Function as an override | Existing adapter and caching behavior remain available | That alternative needs separate hosting, reviewed CORS and `VITE_API_BASE_URL` |

## What I learned

- Separating optional enrichment from the core calculation keeps the application useful during a dependency failure.
- Payroll boundary tests need to state the modeled effective date and assumptions; a green build does not certify statutory accuracy.
- Static hosting fits a calculation engine that already runs entirely in the browser, and a CORS-enabled reference provider can supply optional enrichment without an application server.
- Delivery evidence is strongest when workflow configuration, a completed workflow run and current availability are reported as different facts.

[Back to README](../README.md) · [Run and operate](operations.md) · [Validation evidence](validation.md)
