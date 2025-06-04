# Issue Email Subscribe Checker

A GitHub Action to check if an issue contains an email address, add a "subscribe" label, and generate a `emails.json` file containing all email addresses from issues in the repository. The JSON file is pushed to the `output` branch.

## Usage

### Inputs

| Name           | Description                         | Required |
|----------------|-------------------------------------|----------|
| `issue_state`  | The issue state to check            | no       |

### Example Workflow

```yaml
name: Email Subscribe Check

on:
  issues:
    types: [opened, edited]

jobs:
  check-email:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run email subscribe checker
        uses: weekdaycare/issue-email-checker@main
        with:
          issue_state: 'open' # open, closed, all
```