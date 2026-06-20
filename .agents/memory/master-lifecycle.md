---
name: Master account lifecycle enforcement
description: Strict 8-stage status pipeline for master accounts, audit trail table, poller architecture, and binding guard.
---

## Status pipeline
PENDING_APPROVAL → APPROVED → DEPLOYING → DEPLOYED → STRATEGY_CREATED → ACTIVE ↔ SUSPENDED

## Where each transition is written
| Transition | Location |
|---|---|
| submitted → pending_approval | masterAccounts.ts POST |
| pending_approval → approved | admin.ts approve route |
| approved → deploying | admin.ts approve route (deployMasterToMetaApi) |
| deploying/connecting/synchronizing → deployed | accountPoller.ts (30s tick) |
| deployed → strategy_created | strategies.ts POST (first strategy created for this master) |
| strategy_created → active | accountPoller.ts (30s tick, when CONNECTED) |
| active → suspended | accountPoller.ts (5-min monitor, connection lost) |
| suspended → active | accountPoller.ts (5-min monitor, connection restored) |
| any → rejected | admin.ts reject route |

## Poller architecture (accountPoller.ts)
- **30-second tick** (`ADVANCING_STATUSES`): deploying, connecting, synchronizing, deployed, strategy_created
- **5-minute monitor** (`MONITOR_STATUSES`): active, suspended
- `writeAuditLog` exported from accountPoller.ts — imported by admin.ts, strategies.ts, masterAccounts.ts

## Binding guard (bindings.ts POST)
All 4 conditions required:
1. master.status === 'active'
2. master.connectionStatus === 'CONNECTED'
3. master.deploymentStatus === 'DEPLOYED'
4. strategy.status === 'active'
Error message: "This strategy is not yet active and cannot accept subscribers."

## Refresh-status route rule
masterAccounts.ts refresh-status must NEVER regress lifecycle-managed statuses (deployed, strategy_created, active, suspended). Use smart logic for those; mapMetaApiState only for non-managed statuses.

## Audit table
lib/db/src/schema/masterAccountAuditLogs.ts → master_account_audit_logs
Fields: id, masterAccountId, userId, adminId, event, fromStatus, toStatus, reason, createdAt

## UI badge colors (spec)
PENDING_APPROVAL=gray, APPROVED=blue, DEPLOYING/CONNECTING/SYNCHRONIZING=yellow, DEPLOYED=cyan, STRATEGY_CREATED=purple, ACTIVE=green, REJECTED=red, SUSPENDED=orange

## Frontend binding protection
bindings.tsx: only `activeStrategies` (master.status === 'active') shown in dropdown. Master accounts hook fetched to cross-reference.
