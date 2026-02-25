---
description: Version numbering rules for StudyStation
---

# Versioning Rules

The app version is stored in `src/version.ts` as `APP_VERSION`.

## Rules

1. **Feature / UI update** → increase by **0.1** (e.g. 1.0 → 1.1 → 1.2)
2. **Bug fix** → increase by **0.01** (e.g. 1.1 → 1.11 → 1.12)

## How to update

// turbo
1. Open `src/version.ts`
2. Change the `APP_VERSION` string according to the rules above
3. The version is displayed in the FloatingHub's Theme/Settings tab (ThemeTab component in `src/components/FloatingHub.tsx`)

## Examples

| Change type | Before | After |
|---|---|---|
| New feature added | 1.0 | 1.1 |
| Bug fix after 1.1 | 1.1 | 1.11 |
| Another bug fix | 1.11 | 1.12 |
| Another feature | 1.12 | 1.2 |
| Bug fix after 1.2 | 1.2 | 1.21 |
