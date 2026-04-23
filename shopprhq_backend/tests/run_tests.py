#!/usr/bin/env python3
"""
Ordaa Test Suite — Runner & Status Tracker
==========================================
Run this script to execute the full test suite and get a 
clear pass/fail report organized by bug and flow.

Usage:
    python tests/run_tests.py              # Run everything
    python tests/run_tests.py --bug 1      # Run only Bug 1 tests
    python tests/run_tests.py --group 04   # Run only group 04
    python tests/run_tests.py --quick      # Run regression tests only (fastest)
"""

import subprocess
import sys
import os

# ─── Test groups with descriptions ────────────────────────────────────────────

GROUPS = {
    "01": {
        "file": "test_01_webhook_dedup.py",
        "name": "Webhook Ingestion & WAMID Dedup",
        "covers": "WAMID dedup, user lock, tenant resolution",
        "status": "SHOULD PASS — these are the stable parts",
    },
    "02": {
        "file": "test_02_conversation_routing.py",
        "name": "Conversation Routing & Intent",
        "covers": "Mode-first routing, all intents, mode transitions",
        "status": "SHOULD PASS — routing logic is clean",
    },
    "03": {
        "file": "test_03_cart_service.py",
        "name": "Cart Service",
        "covers": "Create, add, remove, clear, summary, tenant isolation",
        "status": "SHOULD PASS — cart logic is solid",
    },
    "04": {
        "file": "test_04_checkout_payment.py",
        "name": "Checkout & Payment Service",
        "covers": "Validation, cart closure, payment records, Flutterwave",
        "status": "SOME FAIL — Bug 1 (cash confirm) and Bug 4 (cart closure)",
    },
    "05": {
        "file": "test_05_flutterwave_webhook.py",
        "name": "Flutterwave Webhook Endpoint",
        "covers": "Signature, idempotency, router mounting, cart closure",
        "status": "WILL FAIL — Bug 3 (router not mounted)",
    },
    "06": {
        "file": "test_06_bug_regressions.py",
        "name": "Bug Regression Suite",
        "covers": "All 5 critical bugs with fix-verification assertions",
        "status": "WILL FAIL until bugs are fixed — that's the point",
    },
    "07": {
        "file": "test_07_e2e_flows.py",
        "name": "End-to-End Flow Tests",
        "covers": "Complete WhatsApp commerce flows",
        "status": "SHOULD MOSTLY PASS — flows use mocks",
    },
}

BUG_TESTS = {
    "1": "TestBug1CashConfirmationSignature",
    "2": "TestBug2NestedTransactions",
    "3": "TestBug3FlutterwaveRouterMounting",
    "4": "TestBug4CardCartClosure",
    "5": "TestBug5InventoryReservations",
}


def run_group(group_id: str) -> int:
    info = GROUPS.get(group_id)
    if not info:
        print(f"Unknown group: {group_id}")
        return 1

    print(f"\n{'='*60}")
    print(f"GROUP {group_id} — {info['name']}")
    print(f"Covers: {info['covers']}")
    print(f"Expected: {info['status']}")
    print(f"{'='*60}\n")

    test_path = os.path.join(os.path.dirname(__file__), info["file"])
    result = subprocess.run(
        [sys.executable, "-m", "pytest", test_path, "-v", "--tb=short"],
        cwd=os.path.join(os.path.dirname(__file__), ".."),
    )
    return result.returncode


def run_bug(bug_id: str) -> int:
    class_name = BUG_TESTS.get(bug_id)
    if not class_name:
        print(f"Unknown bug: {bug_id}")
        return 1

    print(f"\n{'='*60}")
    print(f"BUG {bug_id} — Running regression tests")
    print(f"{'='*60}\n")

    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-v", "--tb=short", "-k", class_name],
        cwd=os.path.join(os.path.dirname(__file__), ".."),
    )
    return result.returncode


def run_quick() -> int:
    """Run only the regression suite — fastest way to check bug status."""
    print("\n" + "="*60)
    print("QUICK RUN — Regression tests only")
    print("="*60 + "\n")

    test_path = os.path.join(os.path.dirname(__file__), "test_06_bug_regressions.py")
    result = subprocess.run(
        [sys.executable, "-m", "pytest", test_path, "-v", "--tb=short"],
        cwd=os.path.join(os.path.dirname(__file__), ".."),
    )
    return result.returncode


def run_all() -> int:
    print("\n" + "="*60)
    print("ORDAA TEST SUITE — Full Run")
    print("="*60)

    for gid, info in GROUPS.items():
        print(f"  Group {gid}: {info['name']}")
        print(f"           {info['status']}")

    print("\nRunning...\n")

    test_dir = os.path.dirname(__file__)
    result = subprocess.run(
        [sys.executable, "-m", "pytest", test_dir, "-v", "--tb=short",
         "--tb=short", "-p", "no:warnings"],
        cwd=os.path.join(test_dir, ".."),
    )
    return result.returncode


if __name__ == "__main__":
    args = sys.argv[1:]

    if "--bug" in args:
        idx = args.index("--bug")
        bug_id = args[idx + 1] if idx + 1 < len(args) else None
        sys.exit(run_bug(bug_id))

    elif "--group" in args:
        idx = args.index("--group")
        group_id = args[idx + 1] if idx + 1 < len(args) else None
        sys.exit(run_group(group_id))

    elif "--quick" in args:
        sys.exit(run_quick())

    else:
        sys.exit(run_all())
