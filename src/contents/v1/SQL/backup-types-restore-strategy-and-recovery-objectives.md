---
id: backup-types-restore-strategy-and-recovery-objectives
topic: Backup, recovery, HA/DR, security, and temporal data
subtopic: Backup types, restore strategy, and recovery objectives
category: SQL
---

## Overview

Backup types, restore strategy, and recovery objectives define how a database can survive failure, human error, corruption, deployment mistakes, ransomware, hardware loss, and regional outages. A backup is only useful if it can be restored to a known good point that meets the business need.

This topic matters because database durability is not the same as recoverability. SQL Server can make committed transactions durable on disk, but that does not protect against a user dropping a table, a storage failure, a bad release, or a site outage. A real recovery strategy defines what backups are taken, how often they are taken, where they are stored, how they are secured, how they are tested, and how long a restore is expected to take.

For interviews, this topic tests whether you think operationally. Strong candidates can explain full, differential, log, copy-only, file, and tail-log backups; recovery models; restore chains; point-in-time recovery; RPO; RTO; restore testing; backup encryption; and why "we take backups" is not enough.

## Core Concepts

### Backup, Restore, And Recovery

A backup is a copy of database data or log records that can be used after failure. Restore is the process of copying backup data back into a database. Recovery is the phase that brings the restored database to a transactionally consistent state.

Those words matter because a restore can involve several steps:

- Restore a full backup.
- Restore the latest differential backup.
- Restore transaction log backups in order.
- Recover the database so it becomes usable.

If the database is recovered too early, additional log backups cannot be applied.

### Recovery Objectives

Recovery objectives translate business risk into technical targets.

| Objective | Meaning |
| --- | --- |
| RPO | Recovery Point Objective: how much data loss is acceptable |
| RTO | Recovery Time Objective: how long the system can be unavailable |

Example:

- RPO of 15 minutes means the business accepts losing at most about 15 minutes of committed work.
- RTO of 1 hour means the restore process must bring service back within about an hour.

Backup frequency affects RPO. Restore complexity, database size, storage speed, automation, and practice affect RTO.

### Recovery Models

SQL Server recovery models control transaction log behavior and restore options.

| Recovery Model | Typical Use | Restore Implication |
| --- | --- | --- |
| Simple | Lower recovery requirements, dev/test, easily regenerated data | No transaction log backup chain for point-in-time recovery |
| Full | Production systems needing point-in-time recovery | Requires log backups to control log growth and meet RPO |
| Bulk-logged | Bulk operations with reduced log usage in some cases | Can affect point-in-time recovery during bulk operations |

The full recovery model alone does not protect data. You must also take transaction log backups.

### Full Backups

A full database backup contains the whole database at the time the backup completes, plus enough log to recover that backup to a consistent state.

```sql
BACKUP DATABASE SalesDb
TO DISK = 'D:\Backups\SalesDb_full.bak'
WITH COMPRESSION, CHECKSUM;
```

Full backups are the base for differential backups and log restore chains. They are usually scheduled during lower-traffic windows when possible, but SQL Server backups can run while the database is online.

### Differential Backups

A differential backup contains data changed since the most recent full backup that serves as the differential base.

```sql
BACKUP DATABASE SalesDb
TO DISK = 'D:\Backups\SalesDb_diff.bak'
WITH DIFFERENTIAL, COMPRESSION, CHECKSUM;
```

Differential backups can reduce restore time because you restore one full backup, the latest useful differential backup, and then the needed log backups after that.

### Transaction Log Backups

A transaction log backup captures log records not already backed up in the previous log backup. Log backups are available in full and bulk-logged recovery models.

```sql
BACKUP LOG SalesDb
TO DISK = 'D:\Backups\SalesDb_log.trn'
WITH COMPRESSION, CHECKSUM;
```

Log backups support point-in-time recovery and limit data loss. They also allow SQL Server to truncate inactive portions of the log so the log file does not grow indefinitely under full recovery.

### Copy-Only Backups

A copy-only backup is an independent backup that does not disrupt the normal backup sequence.

```sql
BACKUP DATABASE SalesDb
TO DISK = 'D:\Backups\SalesDb_copyonly.bak'
WITH COPY_ONLY, COMPRESSION, CHECKSUM;
```

Use copy-only backups for ad hoc copies, testing, refreshes, or one-off operations where you do not want to affect the differential base or normal backup plan.

### Tail-Log Backups

A tail-log backup captures log records that have not yet been backed up after a failure or before a restore operation. It is used to minimize data loss when the database and log are still accessible.

```sql
BACKUP LOG SalesDb
TO DISK = 'D:\Backups\SalesDb_tail.trn'
WITH NORECOVERY, CHECKSUM;
```

Tail-log backup is often part of a restore process after accidental damage, before restoring over the existing database.

### File And Filegroup Backups

Large databases can use file and filegroup backups to back up and restore parts of a database. This is useful when a database is too large for convenient full backups or when different filegroups have different change rates.

For most interview scenarios, know that file/filegroup strategies add complexity and should be justified by size, restore objectives, and operational maturity.

### Restore Chains

A restore chain is the ordered set of backups needed to reach a target recovery point.

Common sequence:

```sql
RESTORE DATABASE SalesDb
FROM DISK = 'D:\Backups\SalesDb_full.bak'
WITH NORECOVERY;

RESTORE DATABASE SalesDb
FROM DISK = 'D:\Backups\SalesDb_diff.bak'
WITH NORECOVERY;

RESTORE LOG SalesDb
FROM DISK = 'D:\Backups\SalesDb_log_001.trn'
WITH NORECOVERY;

RESTORE LOG SalesDb
FROM DISK = 'D:\Backups\SalesDb_log_002.trn'
WITH RECOVERY;
```

`NORECOVERY` keeps the database ready for more restore steps. `RECOVERY` brings it online.

### Point-In-Time Restore

Point-in-time restore uses transaction log backups to restore to a specific moment before a failure or mistake.

```sql
RESTORE LOG SalesDb
FROM DISK = 'D:\Backups\SalesDb_log_002.trn'
WITH STOPAT = '2026-06-20T10:14:00', RECOVERY;
```

This is useful after accidental data changes, such as a bad update or dropped table. You need a valid restore chain that spans the target time.

### Testing Restores

A backup strategy is not proven until restore is tested. Restore testing should verify:

- Backup files are readable.
- The restore order works.
- RPO and RTO are realistic.
- DBCC checks pass on restored data.
- Application connectivity works.
- Security and permissions are correct.
- Runbooks are accurate.

`RESTORE VERIFYONLY` and backup checksums are useful, but they are not substitutes for real restore tests.

### Backup Security

Backups contain sensitive data. They need security controls similar to production databases.

Important controls include:

- Store backups separately from database files.
- Keep off-site or cross-region copies.
- Encrypt backups where appropriate.
- Restrict backup and restore permissions.
- Protect backup storage accounts or file shares.
- Monitor backup job failures.
- Avoid restoring untrusted backup files.
- Define retention and secure deletion policy.

Backups can become a data exfiltration path if they are easier to access than the live database.

### Strategy Examples

An OLTP production system with 15-minute RPO might use:

- Weekly full backups.
- Frequent differential backups.
- Transaction log backups every 5 to 15 minutes.
- Encrypted off-server storage.
- Automated restore tests.
- Documented incident runbook.

A small dev database might use:

- Simple recovery model.
- Nightly full backup.
- No point-in-time recovery.
- Short retention.

The correct plan follows the business need.

### Common Mistakes

Common mistakes include:

- Taking backups but never testing restores.
- Using full recovery without log backups.
- Storing backups on the same disk as database files.
- Not encrypting backups that contain sensitive data.
- Assuming a high-availability replica replaces backups.
- Losing the restore chain by missing log backups.
- Not documenting restore steps.
- Letting backup jobs fail silently.
- Setting RPO and RTO without testing whether they are achievable.

### Best Practices

Best practices include:

- Define RPO and RTO for each database.
- Choose recovery model based on business requirements.
- Use full, differential, and log backups intentionally.
- Store backups separately from database files.
- Encrypt and restrict backup access.
- Monitor backup job success and restore test success.
- Document restore runbooks.
- Test point-in-time restore.
- Keep retention aligned with legal, business, and storage requirements.
- Remember that backups and HA/DR solve different problems.

## Common Interview Questions

<!-- interview-questions:start -->

### Beginner
<!-- question-group:start:beginner -->

#### What is the difference between backup, restore, and recovery?

<!-- question:start:backup-types-restore-strategy-and-recovery-objectives-beginner-q01 -->
<!-- question-id:backup-types-restore-strategy-and-recovery-objectives-beginner-q01 -->
<!-- question-level:beginner -->
##### Expected Answer

A backup is a copy of database data or transaction log records that can be used after failure. Restore is the process of copying backup contents back into a database. Recovery is the process that brings the restored database into a transactionally consistent and usable state.

In SQL Server, a restore sequence can apply a full backup, a differential backup, and multiple log backups before finally recovering the database.

##### Key Points to Mention

- Backup is the saved copy.
- Restore applies backup data.
- Recovery makes the database consistent and usable.
- `NORECOVERY` allows more restore steps.
- `RECOVERY` brings the database online.

<!-- question:end:backup-types-restore-strategy-and-recovery-objectives-beginner-q01 -->

#### What is the difference between a full backup and a differential backup?

<!-- question:start:backup-types-restore-strategy-and-recovery-objectives-beginner-q02 -->
<!-- question-id:backup-types-restore-strategy-and-recovery-objectives-beginner-q02 -->
<!-- question-level:beginner -->
##### Expected Answer

A full backup captures the whole database at the time the backup completes. A differential backup captures changes made since the most recent full backup that acts as the differential base.

During restore, you usually restore the full backup first, then the latest useful differential backup, then any transaction log backups needed to reach the target time.

##### Key Points to Mention

- Full backup is the base.
- Differential contains changes since the full backup.
- Differential backups can reduce restore time.
- Restore full before differential.
- A new full backup resets the differential base.

<!-- question:end:backup-types-restore-strategy-and-recovery-objectives-beginner-q02 -->

#### What is a transaction log backup?

<!-- question:start:backup-types-restore-strategy-and-recovery-objectives-beginner-q03 -->
<!-- question-id:backup-types-restore-strategy-and-recovery-objectives-beginner-q03 -->
<!-- question-level:beginner -->
##### Expected Answer

A transaction log backup captures transaction log records that have not yet been backed up. It is used in full or bulk-logged recovery models. Log backups allow point-in-time restore and reduce data loss by letting you restore changes after the last full or differential backup.

Log backups also help control transaction log growth by allowing inactive log portions to be reused after backup.

##### Key Points to Mention

- Available in full and bulk-logged recovery models.
- Supports point-in-time recovery.
- Captures log records since the previous log backup.
- Helps meet low RPO.
- Must be restored in order.

<!-- question:end:backup-types-restore-strategy-and-recovery-objectives-beginner-q03 -->

#### What are RPO and RTO?

<!-- question:start:backup-types-restore-strategy-and-recovery-objectives-beginner-q04 -->
<!-- question-id:backup-types-restore-strategy-and-recovery-objectives-beginner-q04 -->
<!-- question-level:beginner -->
##### Expected Answer

RPO, or Recovery Point Objective, is the maximum acceptable amount of data loss measured in time. RTO, or Recovery Time Objective, is the maximum acceptable time to restore service after a failure.

For example, a 15-minute RPO means backups and logs must allow recovery with no more than about 15 minutes of data loss. A 1-hour RTO means the restore process must be practiced and fast enough to bring service back within about an hour.

##### Key Points to Mention

- RPO measures acceptable data loss.
- RTO measures acceptable downtime.
- Backup frequency influences RPO.
- Restore speed and automation influence RTO.
- Objectives must be tested, not guessed.

<!-- question:end:backup-types-restore-strategy-and-recovery-objectives-beginner-q04 -->

<!-- question-group:end:beginner -->

### Intermediate
<!-- question-group:start:intermediate -->

#### How do recovery models affect backup strategy?

<!-- question:start:backup-types-restore-strategy-and-recovery-objectives-intermediate-q01 -->
<!-- question-id:backup-types-restore-strategy-and-recovery-objectives-intermediate-q01 -->
<!-- question-level:intermediate -->
##### Expected Answer

The recovery model controls transaction log maintenance and restore options. In simple recovery, SQL Server does not maintain a log backup chain for point-in-time recovery, so the system generally restores only to full or differential backup points. In full recovery, transaction log backups are required to preserve the log chain, support point-in-time restore, and prevent the log from growing indefinitely.

Bulk-logged recovery can reduce logging for some bulk operations, but it has restore trade-offs. The choice should be based on business RPO, workload, and operational capability.

##### Key Points to Mention

- Simple recovery does not support log backup point-in-time restore.
- Full recovery requires log backups.
- Full recovery supports lower data-loss objectives.
- Bulk-logged has special trade-offs during bulk operations.
- Recovery model must match business requirements.

<!-- question:end:backup-types-restore-strategy-and-recovery-objectives-intermediate-q01 -->

#### What is a restore chain?

<!-- question:start:backup-types-restore-strategy-and-recovery-objectives-intermediate-q02 -->
<!-- question-id:backup-types-restore-strategy-and-recovery-objectives-intermediate-q02 -->
<!-- question-level:intermediate -->
##### Expected Answer

A restore chain is the ordered set of backups needed to restore a database to a desired point. It commonly starts with a full backup, then the latest appropriate differential backup, then transaction log backups in sequence until the target time.

The log backups must be continuous. If a required log backup is missing or damaged, recovery beyond that point may not be possible.

##### Key Points to Mention

- Ordered set of backups.
- Usually full, differential, then logs.
- Log backups must be continuous.
- Use `NORECOVERY` until final restore step.
- Missing backups can break recoverability.

<!-- question:end:backup-types-restore-strategy-and-recovery-objectives-intermediate-q02 -->

#### Why is restore testing more important than backup job success?

<!-- question:start:backup-types-restore-strategy-and-recovery-objectives-intermediate-q03 -->
<!-- question-id:backup-types-restore-strategy-and-recovery-objectives-intermediate-q03 -->
<!-- question-level:intermediate -->
##### Expected Answer

Backup job success only means a backup command completed. It does not prove the team can restore the right files, in the right order, within the required time, with usable data and permissions. Restore testing proves the recovery process works and reveals gaps in storage, documentation, permissions, file naming, backup corruption, and RTO assumptions.

A mature team regularly restores backups to a test environment and validates the restored database.

##### Key Points to Mention

- Backup success does not prove recoverability.
- Restore testing validates the full process.
- Tests RTO and runbooks.
- Can include DBCC consistency checks.
- Finds permission and storage problems early.

<!-- question:end:backup-types-restore-strategy-and-recovery-objectives-intermediate-q03 -->

#### When would you use a copy-only backup?

<!-- question:start:backup-types-restore-strategy-and-recovery-objectives-intermediate-q04 -->
<!-- question-id:backup-types-restore-strategy-and-recovery-objectives-intermediate-q04 -->
<!-- question-level:intermediate -->
##### Expected Answer

Use a copy-only backup for an ad hoc backup that should not affect the normal backup sequence. For example, before a risky deployment, for a one-off database refresh, or for troubleshooting. A copy-only full backup does not reset the differential base, so normal differential backups remain based on the scheduled full backup.

It is useful when you need a backup without changing operational assumptions.

##### Key Points to Mention

- Ad hoc independent backup.
- Does not disrupt normal backup sequence.
- Useful before risky operations.
- Useful for refreshes or troubleshooting.
- Still needs secure storage and retention decisions.

<!-- question:end:backup-types-restore-strategy-and-recovery-objectives-intermediate-q04 -->

<!-- question-group:end:intermediate -->

### Advanced
<!-- question-group:start:advanced -->

#### How would you design a backup strategy for a production OLTP database with a 15-minute RPO?

<!-- question:start:backup-types-restore-strategy-and-recovery-objectives-advanced-q01 -->
<!-- question-id:backup-types-restore-strategy-and-recovery-objectives-advanced-q01 -->
<!-- question-level:advanced -->
##### Expected Answer

I would likely use the full recovery model with scheduled full backups, differential backups to reduce restore time, and transaction log backups more frequent than the 15-minute RPO, such as every 5 minutes. Backups should be written to separate storage, copied off-server or off-site, encrypted, monitored, and retained according to business and compliance needs.

I would also test restore sequences regularly, including point-in-time recovery, and measure whether RTO is achievable. The backup strategy should include runbooks, ownership, alerts, and periodic recovery drills.

##### Key Points to Mention

- Full recovery model.
- Frequent log backups below the RPO threshold.
- Full and differential backups for restore efficiency.
- Separate secure backup storage.
- Regular restore testing and measured RTO.

<!-- question:end:backup-types-restore-strategy-and-recovery-objectives-advanced-q01 -->

#### How would you recover from an accidental data modification?

<!-- question:start:backup-types-restore-strategy-and-recovery-objectives-advanced-q02 -->
<!-- question-id:backup-types-restore-strategy-and-recovery-objectives-advanced-q02 -->
<!-- question-level:advanced -->
##### Expected Answer

First, identify the time of the bad change and stop further damage if needed. If using full recovery and the log is available, take a tail-log backup before restore. Then restore a copy of the database to a point just before the mistake using full, differential, and log backups with `STOPAT`.

Depending on the incident, you may either replace the production database, extract the correct rows from the restored copy and apply a repair, or use another recovery method. The safest response depends on business impact, scope, downtime tolerance, and whether new valid writes happened after the mistake.

##### Key Points to Mention

- Identify the failure time.
- Protect the tail of the log if possible.
- Use point-in-time restore.
- Restore to a separate environment when appropriate.
- Decide between full restore and targeted repair.

<!-- question:end:backup-types-restore-strategy-and-recovery-objectives-advanced-q02 -->

#### Why does high availability not replace backups?

<!-- question:start:backup-types-restore-strategy-and-recovery-objectives-advanced-q03 -->
<!-- question-id:backup-types-restore-strategy-and-recovery-objectives-advanced-q03 -->
<!-- question-level:advanced -->
##### Expected Answer

High availability keeps service running when a node or replica fails, but it usually replicates logical mistakes too. If a user deletes important rows or an application corrupts data, that bad change can replicate to secondary replicas. Backups provide historical recovery points that can survive user error, corruption scenarios, ransomware, and retention requirements.

HA helps availability. Backups help recoverability. Production systems usually need both.

##### Key Points to Mention

- HA protects against infrastructure failure.
- Bad data changes can replicate.
- Backups provide historical recovery points.
- Backups support point-in-time restore.
- HA and backups solve different problems.

<!-- question:end:backup-types-restore-strategy-and-recovery-objectives-advanced-q03 -->

#### What should be included in a restore runbook?

<!-- question:start:backup-types-restore-strategy-and-recovery-objectives-advanced-q04 -->
<!-- question-id:backup-types-restore-strategy-and-recovery-objectives-advanced-q04 -->
<!-- question-level:advanced -->
##### Expected Answer

A restore runbook should include database owners, escalation contacts, backup locations, required permissions, restore order, sample commands, RPO and RTO targets, validation steps, application connection changes, security steps, communication plan, and rollback or roll-forward decision points.

It should be tested periodically. A runbook that has not been exercised may contain wrong paths, missing permissions, outdated server names, or unrealistic timing.

##### Key Points to Mention

- Contacts and ownership.
- Backup locations and restore order.
- Commands and permissions.
- Validation and consistency checks.
- RPO/RTO and communication plan.

<!-- question:end:backup-types-restore-strategy-and-recovery-objectives-advanced-q04 -->

<!-- question-group:end:advanced -->

<!-- interview-questions:end -->
