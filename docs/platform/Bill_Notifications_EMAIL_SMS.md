# Cerillion Technologies — CWS  
## Cerillion Training Module  
### Bill Notifications

---

## Contents

- [Module Introduction](#module-introduction)
  - [Overview](#overview)
  - [Pre-requisites](#pre-requisites)
- [1. Bill Email Notification](#1-bill-email-notification)
- [2. SMS Notifications](#2-sms-notifications)
- [Module Summary](#module-summary)
- [Module Exercise](#module-exercise)

---

## Module Introduction

### Overview
This module introduces the key concepts of sending notifications to customers.

By the end of this module you will be able to:

- Send Notifications through Email.
- Send Notifications through SMS.

### Pre-requisites
It is assumed that you are familiar with CRM database tables, queries, and commands.

---

## 1. Bill Email Notification

1. Once Real cyclic bill completed, and PDFs are generated we need to start sending Email notifications.  
2. Email notification files are generated at path:

   ```
   /cer_cerprod/streams/streamcsv/20240901/
   ```

3. If we have generated PDFs multiple time then email notification file will contain duplicate entry for same account. Use latest notifications file.  
4. Combine all notification files which we want to process in 1 file:

   ```bash
   sort -u EMAIL_???_20241201*.csv > EMAIL_ALL_20241201.csv
   ```

5. Copy new notification file to path:

   ```
   /cer_cerprod/streams/streamcsv/invoiceEmail/
   ```

6. Then streamserve will start sending notifications.  
7. Once all notifications sent successfully then check streamserve logs to reconcile.  
8. Copy streamserve logs from streamserve machine:

   ```
   C:\ManagementGateway\16.6\root\applications\CWS_Invoice\Prod
   ```

   to Unix server temporary path.

9. If there are multiple log files then merge them in single file, remove old logs generated before we start email notifications.  
10. Run below command to check email sent successfully:

   ```bash
   grep -c "Mail was successfully sent" all_email.log
   ```

11. Run below command to check email notification failed:

   ```bash
   grep -c "Mail was not sent" all_email.log
   ```

12. To find out failed records run below command on final notification file.  
   This command will return all records where email address does not contain `@` symbol:

   ```bash
   cat Email_Final_5Sep.csv | awk -F";" '$4 !~ "@" {print $0}' | wc -l
   ```

---

## 2. SMS Notifications

1. Once Real cyclic bill is completed, and PDFs are generated we need to start sending SMS notifications.  
2. After getting confirmation from customer, we can start notification.  
   SMS notification files generated in path:

   ```
   /cer_cerprod/streams/streamcsv/20240901/
   ```

   *(We are not using this file because this file contain records for Business customers also)*

3. Create New SMS File.  
4. Use below query to check if there are any accounts for which multiple SMS entries got created.

```sql
select d.account_no,d.BILL_UID,count(*), max(doc_request_uid) from 
docum_request d, subscribers s
where s.account_no=d.account_no
and doc_media_cd='SMS'
and doc_profile_id='BILL_READY_SMS'
and doc_request_dt>='01-JAN-2025' --Change this to Bill Date
and sms_text is null
and ERROR_DESCRIPTION is null
and s.CREATION_SOURCE_CD!='BUS'
group by d.account_no,d.BILL_UID
having count(*) >1;
```

5. If we got any output with above query then mark `SMS_text = 'DO NOT SEND'` for 1 record and keep 1 record `SMS_text` as null.

```sql
update docum_request set sms_text='DO NOT SEND' where 
DOC_REQUEST_UID in (
select DOC_REQUEST_UID from docum_request where 
(account_no,bill_uid) in (select account_no,bill_uid from (
select d.account_no,d.BILL_UID,count(*), max(doc_request_uid) from 
docum_request d, subscribers s
where s.account_no=d.account_no
and doc_media_cd='SMS'
and doc_profile_id='BILL_READY_SMS'
and doc_request_dt>='01-JAN-2025' --Change this to Bill Date
and sms_text is null
and ERROR_DESCRIPTION is null
and s.CREATION_SOURCE_CD!='BUS'
group by d.account_no,d.BILL_UID
having count(*) >1))
and doc_request_uid not in (select doc_req_uid from (
select d.account_no,d.BILL_UID,count(*), max(doc_request_uid) doc_req_uid 
from docum_request d, subscribers s
where s.account_no=d.account_no
and doc_media_cd='SMS'
and doc_profile_id='BILL_READY_SMS'
and doc_request_dt>='01-JAN-2025' --Change this to Bill Date
and sms_text is null
and ERROR_DESCRIPTION is null
and s.CREATION_SOURCE_CD!='BUS'
group by d.account_no,d.BILL_UID
having count(*) >1))) ;
commit;
```

6. Create new SMS notification file.

```sql
select d.account_no||','||d.BILL_UID from docum_request d, subscribers s
where s.account_no=d.account_no
and doc_media_cd='SMS'
and doc_profile_id='BILL_READY_SMS'
and doc_request_dt>='01-JAN-2025' --Change this to Bill Date
and sms_text is null
and ERROR_DESCRIPTION is null
and s.CREATION_SOURCE_CD!='BUS';
```

7. Export the output of the above SQL into the text file.  
8. Connect to CRM Backend `10.6.12.52` and go to:

```
/cer_cerprod/Monitoring/krushna/SMS_Notifications
```

Remove old `.csv` files from this path.

9. Upload new file on backend server in path:

```
/cer_cerprod/Monitoring/krushna/SMS_Notifications
```

10. Split file into multiple files with **500 lines** in each file (change the date accordingly):

```bash
split -l 500 SMS_ALL_20250101.txt SMS_ALL_20250101_
```

11. Add `.csv` extension of new split files generated.

```bash
for file_nm in `ls -1 SMS_ALL_20250101_??`
do
mv ${file_nm} ${file_nm}.csv
done
```

12. Change filename in script `send_sms_notification.sh`  
13. Run script `send_sms_notification.sh`  
14. Check SMS sender logs.  
15. Once all files processed check successful & failed SMS count.

16. Successful SMS count

```sql
select d.* from docum_request d, subscribers s
where s.account_no=d.account_no
and doc_media_cd='SMS'
and doc_profile_id='BILL_READY_SMS'
and doc_request_dt>='01-JAN-2025' --Change this to Bill Date
and sms_text is not null
and ERROR_DESCRIPTION is null
and s.CREATION_SOURCE_CD!='BUS';
```

17. Failed SMS count

```sql
select d.* from docum_request d, subscribers s
where s.account_no=d.account_no
and doc_media_cd='SMS'
and doc_profile_id='BILL_READY_SMS'
and doc_request_dt>='01-JAN-2025' --Change this to Bill Date
and sms_text is not null
and ERROR_DESCRIPTION is not null
and s.CREATION_SOURCE_CD!='BUS';
```

---

## Module Summary

You should now:

- Be able to send notifications via Email.
- Be able to send notifications via SMS.

---

## Module Exercise

You should have access to CRM Database and Backend box.
