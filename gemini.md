# Project Map: Billing Platform (React + FastAPI)

## Status
- Phase: Blueprint
- Current step: Backend and frontend scaffolding completed with README draft

## Project Summary
- Goal: Updated version of the telco billing automation system with React frontend, FastAPI backend, and local Postgres
- Primary users: Billing team, Finance team, Admin

## Discovery Answers (Pending)
- North Star: Create billing command scripts and track runs with finance approvals
- Integrations: n8n if needed; otherwise email SMTP
- Source of Truth: Postgres
- Delivery Payload: UI screens, file exports, notifications
- Behavioral Rules: UTC+4 timezone handling; naming conventions lowercase with underscores; strict approval gates; validate data at every step; keep audit records for all actions

## Data Schema (Draft)
### Conventions
- All timestamps stored and returned in UTC+4 (ISO 8601)
- All identifiers are UUIDv4 strings unless noted

### Core Entities
```json
{
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "role": "admin|billing|finance|viewer",
    "is_active": "boolean",
    "created_at": "datetime",
    "updated_at": "datetime"
  },
  "billing_cycle": {
    "id": "uuid",
    "usage_month": "yyyy-mm",
    "billing_month": "yyyy-mm",
    "status": "draft|test_in_progress|test_approved|live_in_progress|live_approved|post_live_approved|closed",
    "notes": "string",
    "created_by": "uuid",
    "created_at": "datetime",
    "updated_at": "datetime"
  },
  "script_definition": {
    "id": "uuid",
    "billing_cycle_id": "uuid",
    "environment": "test|live",
    "script_type": "preparation|printing",
    "log_type": "string",
    "parameters": {
      "p1": "string",
      "p2": "string",
      "p3": "string",
      "p4": "string",
      "p5": "string",
      "p6": "string",
      "p7": "string",
      "p8": "string"
    },
    "command_text": "string",
    "created_by": "uuid",
    "created_at": "datetime"
  },
  "script_run": {
    "id": "uuid",
    "script_definition_id": "uuid",
    "status": "planned|executed|cancelled",
    "run_timestamp": "datetime",
    "run_by": "uuid",
    "notes": "string",
    "created_at": "datetime"
  },
  "approval": {
    "id": "uuid",
    "billing_cycle_id": "uuid",
    "stage": "test|live|post_live",
    "status": "pending|approved|rejected",
    "approved_by": "uuid",
    "approved_at": "datetime",
    "comments": "string",
    "created_at": "datetime",
    "updated_at": "datetime"
  },
  "generated_file": {
    "id": "uuid",
    "billing_cycle_id": "uuid",
    "environment": "test|live",
    "script_type": "preparation|printing",
    "file_name": "string",
    "file_path": "string",
    "generated_by": "uuid",
    "generated_at": "datetime"
  },
  "notification": {
    "id": "uuid",
    "billing_cycle_id": "uuid",
    "channel": "smtp|n8n",
    "recipient": "string",
    "subject": "string",
    "status": "queued|sent|failed",
    "sent_at": "datetime",
    "created_at": "datetime"
  },
  "audit_log": {
    "id": "uuid",
    "actor_id": "uuid",
    "actor_type": "user|system",
    "action": "string",
    "entity_type": "string",
    "entity_id": "uuid",
    "metadata": "object",
    "created_at": "datetime"
  }
}
```

### API Payload Shapes
```json
{
  "create_billing_cycle_request": {
    "usage_month": "yyyy-mm",
    "billing_month": "yyyy-mm",
    "notes": "string"
  },
  "generate_scripts_request": {
    "billing_cycle_id": "uuid",
    "environment": "test|live",
    "script_type": "preparation|printing",
    "log_types": ["string"],
    "overrides": {
      "p3": "string",
      "p4": "string",
      "p6": "string",
      "p7": "string",
      "p8": "string"
    }
  },
  "run_update_request": {
    "script_run_id": "uuid",
    "status": "planned|executed|cancelled",
    "notes": "string"
  },
  "approval_request": {
    "billing_cycle_id": "uuid",
    "stage": "test|live|post_live",
    "status": "approved|rejected",
    "comments": "string"
  },
  "notification_request": {
    "billing_cycle_id": "uuid",
    "channel": "smtp|n8n",
    "recipient": "string",
    "subject": "string",
    "message": "string"
  }
}
```

## Context Handoff
- Added GitHub Actions CI/CD workflow with deployment metadata artifact; updated README CI/CD section.
