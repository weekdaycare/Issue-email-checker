# Issue Email Subscribe Checker

A GitHub Action to check if an issue contains an email address, add a "subscribe" label, and generate a `emails.json` file containing all email addresses from issues in the repository. The JSON file is pushed to the `output` branch.

## Usage

### Inputs

| Name           | Description                         | Required |
|----------------|-------------------------------------|----------|
| `issue_state`  | The issue state to check            | no       |

### Example Workflow

```yaml
name: Email Checker

on:
  issues:
    types: [opened, edited, closed, reopened, labeled, unlabeled]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: ./
        with:
          issue_state: open
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: prepare worktree
        run: |
          git fetch origin output
          git worktree add output branch

      - name: mv subscribe.json
        run: |
          mkdir -p branch/v2
          cp subscribe.json branch/v2/subscribe.json

      - name: push commit
        run: |
          cd branch
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add v2/subscribe.json
          git commit -m "Update subscribe.json [bot]" || echo "No changes to commit"
          git push origin HEAD:output
```