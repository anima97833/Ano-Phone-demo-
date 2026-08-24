---
name: lobehub-mcp-market
description: >-
  Search, inspect, install, rate, and comment on MCP plugins from the LobeHub MCP Plugins Marketplace
  using @lobehub/market-cli.
---

# LobeHub MCP Plugins Marketplace

Manage and explore MCP plugins from the LobeHub MCP Marketplace.

## 1. Search Plugins

```bash
npx -y @lobehub/market-cli mcp search --q "<keyword>"
```

Options:
- `--category <category>`: Filter by category (e.g. `development`, `productivity`)
- `--sort <field>`: Sort by `installCount`, `ratingAverage`, `createdAt`, `updatedAt`
- `--order <asc|desc>`: Sort direction
- `--output json`: Return full JSON payload

## 2. View Plugin Details

```bash
npx -y @lobehub/market-cli mcp view <identifier> --comments
```

Examples:
```bash
npx -y @lobehub/market-cli mcp view duhanjun-ima-mcp --output json
```

## 3. Rate & Feedback

```bash
# Rate (1-5)
npx -y @lobehub/market-cli mcp rate <identifier> --score 5

# Comment with rating
npx -y @lobehub/market-cli mcp comment <identifier> -c "Feedback message" --rating 5
```
