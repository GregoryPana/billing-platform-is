def build_notification_command(billing_cycle_id: str, notification_date: str) -> str:
    return "\n".join(
        [
            f"# Billing cycle: {billing_cycle_id}",
            f"# Notification date: {notification_date}",
            "# Email notifications",
            "/cer_cerprod/Dominique/EMAIL_NOTIFICATION_FOR_REAL_BILL_FINAL.sh",
            "",
            "# SMS notifications",
            "/cer_cerprod/Dominique/SMS_NOTIFICATION_FOR_REAL_BILL.sh",
        ]
    )
