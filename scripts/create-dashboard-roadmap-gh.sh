#!/usr/bin/env bash

set -euo pipefail

REPO="${REPO:-WFord26/FuelRipple}"
OWNER="${OWNER:-WFord26}"
PROJECT_TITLE="${PROJECT_TITLE:-FuelRipple Dashboard Roadmap}"
CREATE_PROJECT="${CREATE_PROJECT:-1}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ISSUE_DIR="$ROOT_DIR/docs/github/dashboard-roadmap/issues"

require_gh_auth() {
  if ! gh auth status >/dev/null 2>&1; then
    cat <<'EOF'
GitHub CLI is not authenticated.

Run:
  gh auth login -h github.com
  gh auth refresh -s project

Then re-run this script.
EOF
    exit 1
  fi
}

create_label() {
  local name="$1"
  local color="$2"
  local description="$3"
  gh label create "$name" \
    --repo "$REPO" \
    --color "$color" \
    --description "$description" \
    --force >/dev/null
}

create_labels() {
  echo "Creating or updating labels..."
  create_label "dashboard" "0E8A16" "Dashboard roadmap and user-facing analytics work"
  create_label "phase:1" "1D76DB" "Phase 1 dashboard roadmap work"
  create_label "phase:2" "5319E7" "Phase 2 dashboard roadmap work"
  create_label "phase:3" "FBCA04" "Phase 3 dashboard roadmap work"
  create_label "frontend" "C2E0C6" "Primarily frontend work"
  create_label "api" "BFDADC" "Primarily API or service contract work"
  create_label "observability" "D4C5F9" "Telemetry, metrics, and ops visibility work"
  create_label "testing" "F9D0C4" "Automated coverage and quality infrastructure work"
}

create_project() {
  if [ "$CREATE_PROJECT" != "1" ]; then
    echo "Skipping project creation because CREATE_PROJECT=$CREATE_PROJECT"
    return
  fi

  echo "Creating GitHub project: $PROJECT_TITLE"
  gh project create --owner "$OWNER" --title "$PROJECT_TITLE" >/dev/null
}

create_issue() {
  local key="$1"
  local title="$2"
  local body_file="$3"
  shift 3

  local cmd=(gh issue create --repo "$REPO" --title "$title" --body-file "$body_file" --project "$PROJECT_TITLE")
  for label in "$@"; do
    cmd+=(--label "$label")
  done

  local url
  url="$("${cmd[@]}")"
  eval "ISSUE_URL_${key}=\"\$url\""
  echo "Created issue: $title"
  echo "  $url"
}

create_implementation_issues() {
  echo "Creating implementation issues..."

  create_issue \
    foundations \
    "Dashboard foundations: URL state and overview aggregation endpoint" \
    "$ISSUE_DIR/01-foundations-overview-endpoint.md" \
    enhancement needs-triage dashboard phase:1 frontend api

  create_issue \
    visualization \
    "Dashboard visualization system consolidation" \
    "$ISSUE_DIR/02-visualization-system.md" \
    enhancement needs-triage dashboard phase:1 frontend

  create_issue \
    stories \
    "Story cards and event-aware annotations across dashboard surfaces" \
    "$ISSUE_DIR/03-story-cards-and-annotations.md" \
    enhancement needs-triage dashboard phase:1 frontend api

  create_issue \
    analytics \
    "Dashboard analytics and interaction telemetry" \
    "$ISSUE_DIR/04-analytics-and-telemetry.md" \
    enhancement needs-triage dashboard phase:1 observability frontend

  create_issue \
    quality \
    "Dashboard quality foundations: chart/map coverage and API bootstrap hardening" \
    "$ISSUE_DIR/05-quality-foundations.md" \
    enhancement needs-triage dashboard phase:1 testing api frontend

  create_issue \
    overview_workspace \
    "Public market overview workspace" \
    "$ISSUE_DIR/06-public-market-overview-workspace.md" \
    enhancement needs-triage dashboard phase:2 frontend api

  create_issue \
    state_workspace \
    "State intelligence workspace" \
    "$ISSUE_DIR/07-state-intelligence-workspace.md" \
    enhancement needs-triage dashboard phase:2 frontend api

  create_issue \
    compare_map \
    "Compare mode and time-aware map drilldowns" \
    "$ISSUE_DIR/08-compare-mode-and-map-drilldowns.md" \
    enhancement needs-triage dashboard phase:2 frontend api

  create_issue \
    planner_briefs \
    "Scenario planner and shareable state briefs" \
    "$ISSUE_DIR/09-scenario-planner-and-state-briefs.md" \
    enhancement needs-triage dashboard phase:2 frontend api

  create_issue \
    ops_center \
    "Internal data operations command center" \
    "$ISSUE_DIR/10-ops-command-center.md" \
    enhancement needs-triage dashboard phase:2 observability api

  create_issue \
    phase3 \
    "Phase 3 dashboard extensions: watchlists, partner packages, and forecast workspace" \
    "$ISSUE_DIR/11-phase-3-extensions.md" \
    enhancement needs-triage dashboard phase:3 frontend api observability
}

create_roadmap_issue() {
  echo "Creating umbrella roadmap issue..."

  local tmp_body
  tmp_body="$(mktemp)"

  cat >"$tmp_body" <<EOF
## Summary

This issue tracks the GitHub execution plan derived from \`docs/DASHBOARD_REVIEW_AND_IDEAS.md\`.

The roadmap is organized around three outcomes:

- turn FuelRipple from a collection of route-level pages into a coordinated public dashboard workspace
- consolidate chart, map, and storytelling primitives so the product feels consistent
- build a separate internal observability layer for freshness, ingestion, cache, queue, and route health

## Phase 1

- [ ] Dashboard foundations: URL state and overview aggregation endpoint (${ISSUE_URL_foundations})
- [ ] Dashboard visualization system consolidation (${ISSUE_URL_visualization})
- [ ] Story cards and event-aware annotations across dashboard surfaces (${ISSUE_URL_stories})
- [ ] Dashboard analytics and interaction telemetry (${ISSUE_URL_analytics})
- [ ] Dashboard quality foundations: chart/map coverage and API bootstrap hardening (${ISSUE_URL_quality})

## Phase 2

- [ ] Public market overview workspace (${ISSUE_URL_overview_workspace})
- [ ] State intelligence workspace (${ISSUE_URL_state_workspace})
- [ ] Compare mode and time-aware map drilldowns (${ISSUE_URL_compare_map})
- [ ] Scenario planner and shareable state briefs (${ISSUE_URL_planner_briefs})
- [ ] Internal data operations command center (${ISSUE_URL_ops_center})

## Phase 3

- [ ] Phase 3 dashboard extensions: watchlists, partner packages, and forecast workspace (${ISSUE_URL_phase3})

## Success criteria

- users can move from national to state views without losing context
- users can compare fuels, regions, and time ranges without bouncing between separate routes
- charts support annotations, normalized compare mode, and clear movement context
- mobile users still get a usable dashboard workflow
- operators can monitor data freshness, ingestion jobs, cache health, and route latency in an ops dashboard
- major roadmap work is covered by component tests, API contract tests, visual regression targets, and telemetry

## Source document

- [docs/DASHBOARD_REVIEW_AND_IDEAS.md](https://github.com/$REPO/blob/main/docs/DASHBOARD_REVIEW_AND_IDEAS.md)
EOF

  local roadmap_url
  roadmap_url="$(gh issue create \
    --repo "$REPO" \
    --title "Dashboard roadmap: public workspace, charting system, and ops observability" \
    --body-file "$tmp_body" \
    --project "$PROJECT_TITLE" \
    --label enhancement \
    --label needs-triage \
    --label dashboard)"

  rm -f "$tmp_body"

  echo "Created roadmap issue:"
  echo "  $roadmap_url"
}

main() {
  require_gh_auth
  create_labels
  create_project
  create_implementation_issues
  create_roadmap_issue

  echo
  echo "Dashboard roadmap project and issues created successfully."
  echo "Project title: $PROJECT_TITLE"
}

main "$@"
