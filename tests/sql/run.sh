#!/usr/bin/env bash
# Builds a throwaway database, loads the real access rules, and runs the sharing checks.
# Uses the usual PGHOST, PGPORT, PGUSER and PGPASSWORD settings. Needs a Postgres you may create databases in.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=puddle_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
P="psql -q -v ON_ERROR_STOP=1 -d $DB"
$P -f tests/sql/00-supabase-stub.sql
$P -f supabase/schema.sql 2>&1 | grep -v NOTICE || true
$P -f supabase/migrations/20261117_reliable_map_limits.sql
$P -f supabase/migrations/20261124_share_maps.sql
$P -f supabase/migrations/20261125_team_roles.sql
$P -f supabase/migrations/20261126_edited_by.sql
for t in shared-maps team-roles edited-by; do
  $P -f tests/sql/$t.test.sql 2>&1 | sed 's/^psql:[^ ]* //' | grep -E 'PASS|FAIL|ALL SQL' || { echo "database checks failed in $t"; exit 1; }
done
