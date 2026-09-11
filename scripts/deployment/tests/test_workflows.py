#!/usr/bin/env python3
"""Deterministic structural checks for production workflows."""
from pathlib import Path
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[3]
DEPLOY = (ROOT / ".github/workflows/deploy-production.yml").read_text()
ROLLBACK = (ROOT / ".github/workflows/rollback-production.yml").read_text()
STAMP = (ROOT / ".github/workflows/stamp-production-db.yml").read_text()
CI = (ROOT / ".github/workflows/ci.yml").read_text()


def shell_sources(workflow_text: str) -> list[str]:
    """Return only Actions `run` values, excluding YAML env and comments."""
    document = yaml.safe_load(workflow_text)
    sources: list[str] = []

    def visit(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key == "run" and isinstance(child, str):
                    sources.append(child)
                else:
                    visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(document)
    return sources


def position(text: str, needle: str) -> int:
    value = text.find(needle)
    if value < 0:
        raise AssertionError(f"missing workflow control: {needle}")
    return value


class WorkflowSafetyTests(unittest.TestCase):
    def test_ci_never_deploys(self):
        self.assertRegex(CI, r"(?m)^\s+push:\s*$")
        self.assertRegex(CI, r"(?m)^\s+pull_request:\s*$")
        self.assertNotRegex(CI, r"(?m)^\s+deploy:\s*$")
        self.assertNotIn("environment: production", CI)

    def test_deploy_is_manual_exact_and_environment_bound(self):
        self.assertIn("workflow_dispatch:", DEPLOY)
        self.assertNotRegex(DEPLOY, r"(?m)^\s+(push|pull_request|schedule):")
        self.assertIn("ref:", DEPLOY)
        self.assertIn("confirm:", DEPLOY)
        self.assertIn("runs-on: [self-hosted, billing]", DEPLOY)
        self.assertIn("name: production", DEPLOY)
        self.assertGreaterEqual(DEPLOY.count("ref: ${{ needs.resolve.outputs.sha }}"), 2)

    def test_unmerged_commit_is_rejected_before_selected_code_runs(self):
        resolve = position(DEPLOY, 'sha="$(bash scripts/deployment/resolve_ref.sh')
        trusted = position(DEPLOY, 'bash scripts/deployment/assert_trusted_commit.sh "$sha"')
        selected_checkout = position(DEPLOY, "ref: ${{ needs.resolve.outputs.sha }}")
        self.assertLess(resolve, trusted)
        self.assertLess(trusted, selected_checkout)
        self.assertIn("merge-base --is-ancestor \"$resolved_sha\" origin/main", (ROOT / "scripts/deployment/assert_trusted_commit.sh").read_text())

        privileged = DEPLOY[position(DEPLOY, "runs-on: [self-hosted, billing]"):]
        privileged_trust = position(privileged, 'assert_trusted_commit.sh "$RESOLVED_SHA"')
        privileged_checkout = position(privileged, "ref: ${{ needs.resolve.outputs.sha }}")
        self.assertLess(privileged_trust, privileged_checkout)
        self.assertIn("Checkout trusted main for the privileged-runner gate", privileged)

    def test_post_activation_failures_have_guarded_recovery(self):
        self.assertIn("Restore previous release after failed activation", DEPLOY)
        self.assertIn("previous_revision", DEPLOY)
        self.assertIn("refusing automatic code rollback", DEPLOY)
        self.assertIn("Restore original release after failed rollback", ROLLBACK)
        self.assertIn("steps.activate.outcome == 'success'", ROLLBACK)

    def test_all_preflight_checks_precede_target_mutation(self):
        mutation = position(DEPLOY, "Sync resolved commit into its immutable release directory")
        for check in (
            "Validate host identity and prerequisites",
            "Validate all required deployment settings",
            "Validate deployment configuration is serializer-safe",
        ):
            self.assertLess(position(DEPLOY, check), mutation)

    def test_release_path_cannot_be_reused(self):
        self.assertIn('if [ -e "$release_dir" ]', DEPLOY)
        self.assertLess(position(DEPLOY, "Verify deployment proofs"), position(DEPLOY, "Mark verified release complete"))

    def test_backend_secrets_are_shared_outside_immutable_releases(self):
        self.assertIn('destination = shared / f".backend.env.', DEPLOY)
        self.assertIn('release_env.symlink_to("../../../shared/backend.env")', DEPLOY)
        self.assertIn('mv -T -- "$candidate" "$destination"', DEPLOY)
        self.assertIn("Activation failed; restored the pre-deployment backend configuration", DEPLOY)
        self.assertNotIn(' / "backend" / ".env"\n          destination.write_text', DEPLOY)
        self.assertLess(position(DEPLOY, "Run database migrations"), position(DEPLOY, 'mv -T -- "$candidate" "$destination"'))

    def test_proofs_are_run_specific_not_stale_tmp_files(self):
        self.assertIn("billing-deployment-${{ github.run_id }}.proofs", DEPLOY)
        self.assertIn("billing-rollback-${{ github.run_id }}.proofs", ROLLBACK)
        self.assertNotIn("/tmp/billing-deployment-proofs.txt", DEPLOY)
        self.assertNotIn("/tmp/billing-rollback-proofs.txt", ROLLBACK)

    def test_rollback_uses_trusted_tools_and_does_not_mutate_release(self):
        self.assertIn("ref: main", ROLLBACK)
        self.assertIn("assert_trusted_commit.sh \"$TARGET_SHA\"", ROLLBACK)
        self.assertNotIn("Checkout target commit", ROLLBACK)
        self.assertNotIn("Re-render backend env", ROLLBACK)
        self.assertNotIn("Re-render frontend env", ROLLBACK)
        self.assertIn(".deploy-complete", ROLLBACK)
        rollback_shell = "\n".join(shell_sources(ROLLBACK))
        self.assertNotRegex(
            rollback_shell,
            r"(?m)^[ \t]*(?:sudo[ \t]+)?(?:\./\.venv/bin/)?alembic[ \t]+(?:upgrade|downgrade)\b",
        )
        self.assertIn("Restore original release after failed rollback", ROLLBACK)

    def test_rollback_schema_mismatch_always_fails_closed(self):
        self.assertNotIn("acknowledge_schema_mismatch", ROLLBACK)
        self.assertNotIn("ACKNOWLEDGE_SCHEMA_MISMATCH", ROLLBACK)
        self.assertIn("does not exactly match this release's recorded revision", ROLLBACK)

    def test_privileged_jobs_require_non_root_service_identity(self):
        self.assertIn("EXPECTED_SERVICE_USER: billing", DEPLOY)
        self.assertIn("EXPECTED_SERVICE_USER: billing", ROLLBACK)
        service = (ROOT / "ops/billing-api.service").read_text()
        self.assertIn("User=billing", service)
        self.assertIn("ProtectSystem=strict", service)
        self.assertIn("ReadOnlyPaths=/opt/billing", service)

    def test_dispatch_inputs_are_not_injected_into_shell_source(self):
        for workflow in (DEPLOY, ROLLBACK, STAMP):
            for block in shell_sources(workflow):
                self.assertNotIn("${{ github.event.inputs.ref }}", block)
                self.assertNotIn("${{ github.event.inputs.confirm }}", block)
                self.assertNotIn("${{ github.event.inputs.target_sha }}", block)

    def test_stamp_is_manual_protected_backed_up_and_main_pinned(self):
        self.assertIn("workflow_dispatch:", STAMP)
        self.assertNotRegex(STAMP, r"(?m)^\s+(push|pull_request|schedule):")
        self.assertIn("environment: production", STAMP)
        self.assertIn("ref: main", STAMP)
        self.assertIn("persist-credentials: false", STAMP)
        backup = position(STAMP, "Create and validate pre-stamp PostgreSQL backup")
        stamp = position(STAMP, "Stamp the exact reviewed revision")
        self.assertLess(backup, stamp)
        self.assertIn('alembic stamp "$REVISION"', STAMP)


if __name__ == "__main__":
    unittest.main()
