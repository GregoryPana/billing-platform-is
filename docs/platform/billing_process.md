# Cleaned Documentation (Markdown Version)

Below is the fully cleaned and formatting-enhanced **Markdown** version of the Billing Process documentation. **No content has been removed or changed**, only formatted for clarity and consistency.

---

# Cerillion Operations Training
## Module 12 – Billing Processes

## Proprietary and Confidential Notice
Information contained within this document is proprietary and confidential to Cerillion Technologies Limited (“Cerillion”). Its use, reproduction, transmission and distribution is controlled by the terms of the contract between Cerillion and the client for which this document is generated. All other rights are reserved. Unless otherwise indicated, the companies, names, and data used in examples herein are fictitious.

© Copyright 2023 Cerillion Technologies Limited.

Cerillion Technologies Limited is a limited liability company registered in England No. 3849601 with Registered Office at 1 Princeton Mews, 167-169 London Road, Kingston upon Thames, Surrey, KT2 6PT. VAT registration No. 743 8054 29.

---

# Contents
1. Module Introduction  
2. Pre-requisites  
3. Pre-Billing Checks for Real Billing  
4. CRM Billing Process  
5. Backend Billing Process  
6. Module Exercise

---

# Module Introduction
## Overview
This module introduces key concepts on the Billing Processes and the Bill Cycle Maintenance aspects of the Cerillion CRM. The purpose of this document is to provide an overview of the related processes in Cerillion.

By the end of this module, you should:
- Understand the steps required to run Billing.
- Understand Bill Generation, Bill Printing, and Bill Formatting.

## Pre-requisites
It is assumed that you are familiar with:
- Account, Service, Equipment and Work Order concepts in Cerillion.
- Rentals, Usage, and other adhoc charges and their respective transaction codes.
- Basic summarization process in Cerillion.

---

# 1. Pre-Billing Checks for Real Billing

### Change Due Date Parameter
Update the **DUEDY** parameter depending on when real billing starts.

Example:
- Billing starts: **1st March**, Due Date: **30th March** → set `RES=29, BUS=29`.
- Billing starts: **5th March**, Due Date: **30th March** → set `RES=25, BUS=25`.

To update the value:
```
CRM → My Company → System Parameters
Search for DUEDY and update the value.
```

### Move Third Party Payer Accounts to A1A or A1U
Run the following query to identify payer accounts not on A1A or A1U:
```sql
select s.bill_cycle_code, s.account_no, s.creation_source_cd,
sp.account_no payer_account_no, sp.account_name1 payer_account_name,
s.creation_source_cd payer_account_type, sp.bill_cycle_code payer_bill_cycle_code, tpp.*
from subscribers s, subscribers sp, third_party_payments tpp, equipment_charging ec
where sp.account_no = tpp.third_account_no
and tpp.prime_uid = ec.third_payment_uid
and ec.account_no = s.account_no
and ( tpp.end_dt is null or tpp.end_dt >= '01-May-2024')
and sp.bill_cycle_code not in ('A1A','A1U');
```
Update payer account bill cycles:
- **A1A** → Seychelles currency
- **A1U** → USD

### Validate Bill Cycle Parameters
The following cycles must have `expected next_bill_date` set and `last_st = 0`:
```
M1U, M1V, M1C, M1G, M1F, M1B, M1A, M1R, A1A, A1U
```

### Billing Execution Sequence
1. Pre bill-run checks
2. Start Test/Real billing from Backend or CRM (except A1A & A1U)
3. Validate bill-run logs
4. Once all cycles succeed, run A1A & A1U
5. Validate logs
6. Start bill print for completed cycles
7. Check for failed accounts
8. Verify PDF generation
9. Verify post-bill PDF completion

---

# 2. CRM Billing Process
Billing may be started from the **CRM screen** or from the **backend**.

## 2.1 Run Billing from Screen
Access the Billing Control screen from:
```
Bills → Run Bills
```
This screen displays billing cycles, run dates, statuses, and other key information.

## 2.2 New Bill Run – Bill Generation Process
Steps:
1. Open Thick Client Administrator
2. Select a Bill Cycle in the grid
3. Click **New Bill Run** and configure:
   - **Bill Run Type**: Test or Production
   - **Collection Plan Start Date**
   - **Payment Due Date**
   - **Grace Period**
4. Click **Start Bill Run**

Bill run logs can be found on the backend:
```
cd /cer_<ENV>/log
```
File naming convention:
```
bil0101b_MMDDHHMMSS00_xxxxx.log
```

## 2.3 Billing Reports
Generated reports:
```
BIL0105R_xxxxx.REP → Items Not Billed Report
BIL0103R_xxxxx.REP → Billing Transactions Report
BIL0102R_xxxxx.REP → Bill Summary Report
```
Paths:
- Test billing: `/cer_<ENV>/work/bil/test`
- Real billing: `/cer_<ENV>/work/bil`

## 2.4 Bill Printing Process
After successful bill run, click **Print Bills**.

Output paths:
```
Production: /cer_<ENV>/work/bil/
Testing:    /cer_<ENV>/work/bil/test/
```
Print file format:
```
[BillCycleCode]_[YYYYDD]_nnnnn.DAT
```

## 2.5 Bill XMLs
DAT files are transferred by:
```
DAT_filetransfer.sh
```
Then Streamserve generates PDFs.

Example input folder:
```
/cer_cerprod/streams/billxml_in
```

## 2.6 PDF Visibility in CRM
Run:
```
./docum_attachment_workaround.sh <bill_date>
```
Date format example:
```
01-MAR-2025
```

## 2.7 Test Billing
Test mode behaves like Production but does **not** write to super schema.
Production can run only once per period.

---

# 3. Backend Billing Process
## 3.1 Bill Generation
Backend bill run:
```bash
P1='M1A' P2='T' P3='2025_03_01 00:00:00' P4='28' P5='2' P6='' P7='' P8='' \
/cer_cerprod/exe/pspbil0101b.sh
```
Parameter definitions included exactly as in the source.

## 3.2 Bill Printing
```bash
P1='S' P2='PBCC=M1A|PITM=Y|PTEST=Y' P3='2025_03_01 00:00:00' \
P4='2025_03_01 00:00:00' P5='N' P6='2002' P7='0' P8='99999999' \
/cer_cerprod/exe/bil0705s.sh
```

## 3.3 Logs
Bill run log prefix:
```
bil0101b
```
Bill print log prefix:
```
bil0705s
```

## 3.4 Verification Queries
Check fatal errors:
```bash
grep -i fatal bil0101b_070619203800_2104402.log
```

Check completion:
```bash
grep "Billing finished" bil0101b_070619203800_2104402.log
```

Check bill cycle status:
```sql
select * from BILL_CYCLE_PARAMETERS where bill_cycle_code='M1C';
```

Check billed accounts:
```sql
select * from billing_runs where bill_cycle_code='M1C';
```

Check latest bill:
```sql
select * from bill_history where billing_run_uid=2002;
```

---

# 4. Module Exercise
Your instructor will provide login credentials.

Exercise:
- Create a new bill cycle
- Assign accounts
- Run billing and bill printing
- Run test billing and generate PDFs
