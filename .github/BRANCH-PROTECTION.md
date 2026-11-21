# Branch protection for `main`

Configure these in GitHub → Settings → Branches (the agent must not change repo settings):

- Require a pull request before merging.
- Require at least **1 approval**, dismiss stale approvals, and require review from Code Owners.
- Require status checks to pass before merging:
  - `Types, lint, unit and integration`
  - `End-to-end and accessibility`
  - `Lighthouse (installable, performance, accessibility)`
  - `Production security invariants`
  - `Production dependency audit`
  - `Performance budgets`
  - `UI-only presentation guard`
  - `Test floor and skipped-test guard`
  - `Secret scan`
- Require branches to be up to date before merging.
- Block force pushes and deletions on `main`.
- Do not require linear history; normal merge commits are the project convention.
- Restrict who can push to `main` to the owner.
