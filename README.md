Egypt Salary Calculator




An Arabic-first, privacy-focused calculator for estimating Egyptian gross and net salaries.

Open the live application

Features

Gross-to-net and net-to-gross calculations

Monthly and annual salary modes

Automatic or manually entered social insurance

Income tax, employee insurance, and Martyrs Fund breakdown

Monthly and annual summaries

Responsive Arabic RTL interface

Persistent light and dark themes

Accessible validation and keyboard navigation

Browser-local calculations with no salary data transmitted or stored

Technology

React 19

TypeScript

Vite

Vitest and Testing Library

Oxlint

Azure App Service for Linux

Node.js 22

GitHub Actions CI/CD

GitHub OIDC with an Azure managed identity

Application Insights and Log Analytics

Deployment architecture

GitHub main
├── CI: tests → lint → production build
└── CD: build → GitHub OIDC → Azure App Service
                                    ├── Application Insights
                                    └── Log Analytics

Authentication between GitHub and Azure uses workload identity federation. No Azure client secret is stored in the repository.

The Vite production output is served by App Service using:

pm2 serve /home/site/wwwroot/dist --no-daemon --spa

Calculation approach

The calculation engine currently implements:

Progressive Egyptian employment-income tax brackets

High-income bracket exclusions

EGP 20,000 annual personal exemption

11% employee social-insurance contribution

2026 monthly insurable-wage limits

Martyrs Fund deduction

Net-to-gross calculation using binary search

The automated test suite currently contains 55 calculation and interface tests.

Run locally

git clone https://github.com/yossefseit/egypt-salary-calculator.git
cd egypt-salary-calculator
npm ci
npm run dev

Quality checks

npm test
npm run lint
npm run build

Reference sources

Egyptian Income Tax Law No. 7 of 2024

Egyptian Tax Authority payroll forms

NOSI 2026 insurable-wage limits

Disclaimer

This application provides educational estimates and is not a substitute for professional payroll, tax, or legal advice. Actual payroll may differ because of allowances, bonuses, exemptions, or regulatory changes.

Project status

The MVP is live on Azure. Infrastructure was initially configured through Azure Portal and Azure CLI. Reproducible Bicep infrastructure is planned as the next cloud-engineering phase.