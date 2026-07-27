import calendar
from datetime import date

from fastapi import HTTPException, status

from app.utils.datetime_utils import next_month_str, utc_plus_4_now


CYCLES = [
    "I1A",
    "M1B",
    "M1C",
    "M1F",
    "M1G",
    "M1R",
    "M1U",
    "M1V",
    "M1A",
    "A1A",
    "A1U",
]


def _default_preparation_params(environment: str, cycle: str, usage_month: str) -> dict[str, str]:
    next_month_year, next_month_number = (int(part) for part in next_month_str(usage_month).split("-"))
    first_of_next_month = date(next_month_year, next_month_number, 1)
    return {
        "p1": cycle,
        "p2": "T" if environment == "test" else "N",
        "p3": first_of_next_month.strftime("%Y_%m_%d 00:00:00"),
        "p4": "28",
        "p5": "2",
        "p6": "",
        "p7": "",
        "p8": "",
    }


def _default_printing_params(environment: str, cycle: str, usage_month: str) -> dict[str, str]:
    usage_year, usage_month_number = (int(part) for part in usage_month.split("-"))
    first_day = date(usage_year, usage_month_number, 1)
    last_day_value = calendar.monthrange(usage_year, usage_month_number)[1]
    last_day = date(usage_year, usage_month_number, last_day_value)
    return {
        "p1": "S",
        "p2": f"PBCC={cycle}|PITM=Y|PTEST={'Y' if environment == 'test' else 'N'}",
        "p3": first_day.strftime("%Y_%m_%d 00:00:00"),
        "p4": last_day.strftime("%Y_%m_%d 00:00:00"),
        "p5": "N",
        "p6": "",
        "p7": "0",
        "p8": "99999999",
    }


def generate_parameters(
    script_type: str,
    environment: str,
    log_type: str,
    usage_month: str,
    overrides: dict[str, str] | None,
) -> dict[str, str]:
    environment_value = environment.lower()
    script_type_value = script_type.lower()

    if log_type not in CYCLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported cycle")

    if script_type_value == "preparation":
        params = _default_preparation_params(environment_value, log_type, usage_month)
    elif script_type_value == "printing":
        params = _default_printing_params(environment_value, log_type, usage_month)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid script type")

    if overrides:
        params.update(overrides)

    if script_type_value == "printing" and not params.get("p6"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Printing scripts require p6 billing run uid.",
        )

    if script_type_value == "preparation" and params.get("p4") == "":
        params["p4"] = "28"

    return params


def format_command(script_type: str, environment: str, log_type: str, parameters: dict[str, str]) -> str:
    script_key = "Prep" if script_type.lower() == "preparation" else "Print"
    now_stamp = utc_plus_4_now().strftime("%d%m%Y")
    param_string = ",".join([parameters.get(f"p{index}", "") for index in range(1, 9)])
    executable = "/cer_cerprod/exe/pspbil0101b.sh" if script_type.lower() == "preparation" else "/cer_cerprod/exe/bil0705s.sh"
    log_suffix = f"test_bill_{script_key}_{now_stamp}_{log_type}.log"
    if script_type.lower() == "preparation":
        log_suffix = f"test_bill_{now_stamp}_{log_type}.log"
    log_path = f"/cer_cerprod/log/{log_suffix}"
    return f"P1='{parameters['p1']}' P2='{parameters['p2']}' P3='{parameters['p3']}' P4='{parameters['p4']}' P5='{parameters['p5']}' P6='{parameters['p6']}' P7='{parameters['p7']}' P8='{parameters['p8']}' {executable} | tee {log_path}"
