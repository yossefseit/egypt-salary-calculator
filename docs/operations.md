# Local use and operations

This guide separates local application work, static GitHub Pages delivery and the optional exchange-rate Function. No Azure account or application server is needed to calculate salaries locally or publish the React client.

## Prerequisites

| Task | Requirement |
| --- | --- |
| Run and validate the React application | Git, Node.js 22.x and npm |
| Run the optional API locally | .NET 10 SDK, Azure Functions Core Tools 4, and Azurite when using the sample local-storage setting |
| Publish the static client | Repository administration access for the one-time GitHub Pages source setting; workflow runs need no cloud credential |

## Run the calculator

```bash
git clone https://github.com/yossefseit/egypt-salary-calculator.git
cd egypt-salary-calculator
npm ci
npm run dev
```

Open the URL Vite prints, normally `http://localhost:5173/egypt-salary-calculator/`. The Vite server proxies `/api` to `http://localhost:7071`. If the Function is not running, the page reports that the exchange rate is unavailable and continues to calculate in EGP.

To inspect the production bundle locally:

```bash
npm run build
npm run preview
```

The built `dist/index.html` uses `/egypt-salary-calculator/` for its production assets, matching the GitHub Pages project URL. Vite's preview server serves that path locally.

## Run the optional Function

From another terminal, create an ignored `api/local.settings.json` for local Functions configuration:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated"
  }
}
```

Then start the Function host on the port expected by Vite:

```bash
# Start Azurite in another terminal if it is not already running.
azurite

cd api
dotnet restore
func start --port 7071
```

The endpoint is `http://localhost:7071/api/GetUsdEgpRate`. The Function needs outbound HTTPS access to `api.frankfurter.dev`. `APPLICATIONINSIGHTS_CONNECTION_STRING` is optional; omit it for a local session without Azure Monitor export.

## Validate a change

```bash
npm test
npm run lint
npm run build
dotnet build api/api.csproj
```

Both JavaScript workflows execute the first three checks. Neither workflow builds the Function, so keep the final command as a separate review gate when `api/` changes.

## GitHub Pages delivery

The workflow [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) runs on pushes to `main` or manual dispatch. Pull requests are covered by the separate CI workflow. The Pages workflow:

- checks out the exact repository revision;
- installs the locked npm dependency graph;
- requires all 57 tests, Oxlint and the production build to pass;
- uploads only `dist/` as the Pages artifact; and
- deploys through the `github-pages` environment only when the selected ref is `main`.

For a new repository, open **Settings → Pages** and select **GitHub Actions** as the source. This setting was confirmed for this repository on 9 September 2026. The live project URL is `https://yossefseit.github.io/egypt-salary-calculator/`; [Pages run 34370072295](https://github.com/yossefseit/egypt-salary-calculator/actions/runs/34370072295) published the production bundle on 9 September 2026 at 15:25 UTC. See the [dated deployment and browser evidence](validation.md). The deployment job has only the `pages: write` and `id-token: write` permissions required by GitHub Pages; the build job has read-only access to repository contents and Pages metadata.

The workflow intentionally leaves `VITE_API_BASE_URL` unset. GitHub Pages is a static host and cannot execute the .NET Function in `api/`. As a result, the published client keeps its local EGP calculation behavior and shows the existing unavailable message for USD conversion. If the Function is hosted separately later, configure its cross-origin policy for the Pages origin and review its availability before supplying that origin at build time.

## Smoke checks after an authorized deployment

1. Open the deployed page and confirm the Arabic RTL interface renders without console errors.
2. Enter EGP 10,000 as monthly gross with automatic insurance and confirm the reference net is EGP 8,302.50.
3. Switch monthly/yearly, calculation direction, insurance mode and theme; refresh once to confirm theme persistence.
4. Confirm the calculator shows its EGP result and the expected unavailable-rate message; a Pages deployment alone does not provide the Function.
5. Record the workflow URL, commit SHA, UTC time, destination and sanitized smoke-check results.

These checks do not replace payroll-domain review.

## Rollback and retired Azure delivery

For a client rollback, revert the problematic change on `main` and let the Pages workflow publish the reviewed state. Disabling Pages stops the project site; it does not change source history.

The former Azure App Service workflow and resource prerequisites are no longer part of current delivery. Its successful 15 August 2026 run remains linked in [validation](validation.md) as historical evidence. This repository never provisioned or tore down those Azure resources, and the current Pages workflow contains no Azure login or resource operation.

[Back to README](../README.md) · [Architecture](architecture.md) · [Validation evidence](validation.md)
