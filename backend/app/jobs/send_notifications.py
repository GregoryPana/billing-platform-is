import argparse


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Send billing notifications")
    parser.add_argument("--billing-cycle-id", required=True, help="Billing cycle UUID")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the actions without sending notifications",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.dry_run:
        print(f"Dry run: would send notifications for {args.billing_cycle_id}")
        return

    print(f"Sending notifications for {args.billing_cycle_id}")
    print("Notification delivery is handled by the backend runbook.")


if __name__ == "__main__":
    main()
