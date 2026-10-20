"""Validate a successful Dependency-Check scan before publishing its reports."""

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from datetime import datetime, timezone


def validate_report(report):
    if not isinstance(report, dict) or report.get("reportSchema") != "1.1":
        raise ValueError("Unsupported Dependency-Check report schema")
    info = report.get("scanInfo")
    if not isinstance(info, dict) or info.get("engineVersion") != "13.0.0":
        raise ValueError("Missing or unexpected Dependency-Check engine version")
    if "analysisExceptions" in info and info["analysisExceptions"] != []:
        raise ValueError("Dependency-Check reported analysis exceptions")
    sources = info.get("dataSource")
    if not isinstance(sources, list) or not sources:
        raise ValueError("Missing vulnerability data source metadata")
    for source in sources:
        if not isinstance(source, dict) or not all(
            isinstance(source.get(key), str) and source[key].strip()
            for key in ("name", "timestamp")
        ):
            raise ValueError("Invalid vulnerability data source metadata")
    names = {source["name"] for source in sources}
    if not {"NVD Cache Last Checked", "NVD Cache Last Modified"} <= names:
        raise ValueError("Missing NVD datafeed update metadata")
    dependencies = report.get("dependencies")
    if not isinstance(dependencies, list) or not dependencies:
        raise ValueError("No dependencies were scanned")
    all_dependencies = []
    pending = list(dependencies)
    while pending:
        dependency = pending.pop()
        if not isinstance(dependency, dict) or not isinstance(dependency.get("fileName"), str):
            raise ValueError("Invalid dependency entry")
        if "analysisExceptions" in dependency and dependency["analysisExceptions"] != []:
            raise ValueError("A dependency reported analysis exceptions")
        if "vulnerabilities" in dependency and not isinstance(dependency["vulnerabilities"], list):
            raise ValueError("Invalid vulnerability list")
        related = dependency.get("relatedDependencies", [])
        if not isinstance(related, list):
            raise ValueError("Invalid related dependencies")
        all_dependencies.append(dependency)
        pending.extend(related)
    files = [dependency["fileName"] for dependency in all_dependencies]
    if not any(name.startswith("junit-jupiter-api-") for name in files):
        raise ValueError("Expected test dependency is missing from the report")
    if not any(name.startswith("postgresql-") for name in files):
        raise ValueError("Expected runtime dependency is missing from the report")
    findings = {}
    vulnerable_dependencies = 0
    for dependency in all_dependencies:
        vulnerabilities = dependency.get("vulnerabilities", [])
        vulnerable_dependencies += bool(vulnerabilities)
        for vulnerability in vulnerabilities:
            if not isinstance(vulnerability, dict) or not isinstance(vulnerability.get("name"), str):
                raise ValueError("Invalid vulnerability entry")
            severity = vulnerability.get("severity", "UNKNOWN")
            if not isinstance(severity, str):
                raise ValueError("Invalid vulnerability severity")
            key = vulnerability.get("source", "UNKNOWN"), vulnerability["name"]
            if not isinstance(key[0], str):
                raise ValueError("Invalid vulnerability source")
            findings.setdefault(key, severity.upper())
    counts = {}
    for severity in findings.values():
        counts[severity] = counts.get(severity, 0) + 1
    return {
        "engineVersion": info["engineVersion"],
        "dataSources": sources,
        "dependencyCount": len(dependencies),
        "relatedDependencyCount": len(all_dependencies) - len(dependencies),
        "vulnerableDependencyCount": vulnerable_dependencies,
        "uniqueAdvisoryCount": len(findings),
        "advisoriesBySeverity": counts,
    }


def command(*args):
    return subprocess.check_output(args, text=True).strip()


def main():
    backend = Path(__file__).resolve().parents[1]
    output = backend / "target/dependency-audit"
    for name in ("dependency-check-report.json", "dependency-check-report.html", "update-started-at.txt", "update-completed-at.txt"):
        if not (output / name).is_file() or not (output / name).stat().st_size:
            raise ValueError(f"Missing or empty audit report: {name}")
    report = json.loads((output / "dependency-check-report.json").read_text())
    result = validate_report(report)
    started = datetime.fromisoformat((output / "update-started-at.txt").read_text().strip().replace("Z", "+00:00"))
    completed = datetime.fromisoformat((output / "update-completed-at.txt").read_text().strip().replace("Z", "+00:00"))
    verified = datetime.now(timezone.utc)
    if started.tzinfo is None or completed.tzinfo is None or not started <= completed <= verified:
        raise ValueError("Invalid successful cold-update timestamps")
    timestamps = {source["name"]: datetime.fromisoformat(source["timestamp"].replace("Z", "+00:00")) for source in result["dataSources"]}
    checked = timestamps["NVD Cache Last Checked"]
    modified = timestamps["NVD Cache Last Modified"]
    if checked.tzinfo is None or modified.tzinfo is None or not modified <= checked or not started <= checked <= verified:
        raise ValueError("NVD update metadata is stale or invalid for this run")
    checked_out = command("git", "-C", str(backend), "rev-parse", "HEAD")
    head = os.environ.get("PR_HEAD_SHA", checked_out)
    if not re.fullmatch(r"[0-9a-f]{40}", head):
        raise ValueError("Invalid PR head commit")
    result.update({
        "status": "completed_with_findings" if result["uniqueAdvisoryCount"] else "completed_no_findings",
        "verifiedAt": verified.isoformat(),
        "coldUpdateStartedAt": started.isoformat(),
        "coldUpdateCompletedAt": completed.isoformat(),
        "checkedOutCommit": checked_out,
        "prHeadCommit": head,
        "mavenVersion": command("mvn", "--version").splitlines()[0],
        "pomSha256": hashlib.sha256((backend / "pom.xml").read_bytes()).hexdigest(),
        "scope": "Maven application and test direct/transitive dependencies; excludes build plugins",
        "severityGate": None,
        "database": "Pipeline verifies absent job-local database before update; update-only and check must both succeed before this validator runs",
        "sources": {
            "NVD": "https://nvd.nist.gov/feeds/json/cve/2.0/nvdcve-2.0-{0}.json.gz",
            "CISA_KEV": "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
            "OSS_Index": "Disabled for this baseline; no authentication configured",
            "hostedSuppressions": "Upstream default false-positive rules; no project suppressions",
        },
    })
    (output / "scan-metadata.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    if not (output / "scan-metadata.json").stat().st_size:
        raise ValueError("Empty scan metadata")
    summary = (
        "### Backend dependency audit\n\n"
        f"Status: **{result['status']}**; dependencies: {result['dependencyCount']}; "
        f"unique advisories: **{result['uniqueAdvisoryCount']}**; "
        f"affected dependencies: {result['vulnerableDependencyCount']}.\n\n"
        f"Severity counts: `{json.dumps(result['advisoriesBySeverity'], sort_keys=True)}`.\n\n"
        f"PR head: `{head}`; checked-out commit: `{checked_out}`.\n\n"
        "All severities are reported without a severity gate. Tool/source failures fail the job. "
        "This is dependency analysis, excluding build plugins, source-code and Secrets analysis.\n"
    )
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as destination:
            destination.write(summary)
    print(summary)


if __name__ == "__main__":
    main()
