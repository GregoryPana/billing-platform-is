from datetime import datetime


def _format_compact_date(value: str) -> str:
    parsed = datetime.strptime(value, "%Y-%m-%d")
    return parsed.strftime("%Y%m%d")


def _format_sql_date(value: str) -> str:
    parsed = datetime.strptime(value, "%Y-%m-%d")
    return parsed.strftime("%d-%b-%Y").upper()


def build_notification_command(billing_cycle_id: str, notification_date: str) -> str:
    compact_date = _format_compact_date(notification_date)
    sql_date = _format_sql_date(notification_date)
    return "\n".join(
        [
            f"# Billing cycle: {billing_cycle_id}",
            f"# Notification date: {notification_date}",
            "# Email notifications",
            f"sort -u EMAIL_???_{compact_date}*.csv > EMAIL_ALL_{compact_date}.csv",
            f"cp EMAIL_ALL_{compact_date}.csv /cer_cerprod/streams/streamcsv/invoiceEmail/",
            "grep -c \"Mail was successfully sent\" all_email.log",
            "grep -c \"Mail was not sent\" all_email.log",
            f"cat Email_Final_{compact_date}.csv | awk -F\";\" '$4 !~ \"@\" {{print $0}}' | wc -l",
            "",
            "# SMS notifications",
            "select d.account_no,d.BILL_UID,count(*), max(doc_request_uid)",
            "from docum_request d, subscribers s",
            "where s.account_no=d.account_no",
            "and doc_media_cd='SMS'",
            "and doc_profile_id='BILL_READY_SMS'",
            f"and doc_request_dt>='{sql_date}'",
            "and sms_text is null",
            "and ERROR_DESCRIPTION is null",
            "and s.CREATION_SOURCE_CD!='BUS'",
            "group by d.account_no,d.BILL_UID",
            "having count(*) >1;",
            "",
            "select d.account_no||','||d.BILL_UID",
            "from docum_request d, subscribers s",
            "where s.account_no=d.account_no",
            "and doc_media_cd='SMS'",
            "and doc_profile_id='BILL_READY_SMS'",
            f"and doc_request_dt>='{sql_date}'",
            "and sms_text is null",
            "and ERROR_DESCRIPTION is null",
            "and s.CREATION_SOURCE_CD!='BUS';",
            "",
            f"split -l 500 SMS_ALL_{compact_date}.txt SMS_ALL_{compact_date}_",
            "for file_nm in \\",
            f"ls -1 SMS_ALL_{compact_date}_??",
            "do",
            "mv $file_nm $file_nm.csv",
            "done",
        ]
    )
