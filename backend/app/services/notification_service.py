def build_notification_command(billing_cycle_id: str) -> str:
    return f"python -m app.jobs.send_notifications --billing-cycle-id {billing_cycle_id}"
