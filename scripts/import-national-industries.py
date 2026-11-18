"""Reproduce the final NIC 2025 reference from hash-verified official files.

Run with the existing bundled document Python runtime (openpyxl and pypdf).
No network requests or database writes. Production reads the committed JSON.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

import openpyxl
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
WORKBOOK_SHA256 = "ad3b8f24a40de5650c9fa8d06a36940c6e3c5d159d4f82d6c5cb3740d4e324c0"
PDF_SHA256 = "66bc2babc1e915b670b21a66d556c2933b97f72d9590a50cc535c5e9239fe709"
BASE_URL = "https://www.mospi.gov.in/uploads/publications_reports/"
WORKBOOK_URL = BASE_URL + "publications_reports1763618655097_29a4a622-fa4c-47e9-abba-b549e27a1bbb_NIC_2025.xlsx"
PDF_URL = BASE_URL + "publications_reports1763457214315_c3e5d4f3-8e25-4775-85e3-ad42d571652f_NIC_2025_Final.pdf"
COUNTS = {"section": 22, "division": 87, "group": 258, "class": 463, "subclass": 1887}
WORKBOOK_COUNTS = {**COUNTS, "division": 86, "group": 257}


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def verified_file(path: Path, expected: str) -> None:
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise ValueError(f"Unexpected source bytes: {path.name}; review a new source version before import.")


def pdf_parents(path: Path) -> dict[str, dict]:
    reader = PdfReader(path)
    if len(reader.pages) != 322:
        raise ValueError("Unexpected PDF page structure.")
    rows = []
    current = None
    section = None
    division = None
    for physical_page in range(35, 50):
        for raw in reader.pages[physical_page - 1].extract_text().splitlines():
            line = clean(raw)
            if not line or line.isdigit() or line in {"BROAD STRUCTURE", "(Sections, Divisions and Groups)"}:
                continue
            match = re.fullmatch(r"(Section|Division|Group)\s+([A-V]|\d{2,3})\s+(.+)", line)
            if match:
                level, code, title = match.groups()
                level = level.lower()
                if level == "section":
                    section, division = code, None
                elif level == "division":
                    division = code
                current = {
                    "code": code,
                    "title": title,
                    "level": level,
                    "sectionCode": section,
                    "divisionCode": division,
                    "printedPage": physical_page - 20,
                }
                rows.append(current)
            elif current:
                current["title"] += " " + line
    expected = {level: COUNTS[level] for level in ("section", "division", "group")}
    if dict(Counter(row["level"] for row in rows)) != expected:
        raise ValueError("PDF broad structure does not reconcile.")
    by_code = {row["code"]: row for row in rows}
    if len(by_code) != len(rows):
        raise ValueError("Duplicate PDF hierarchy code.")
    for row in rows:
        if row["level"] == "group" and row["code"][:2] != row["divisionCode"]:
            raise ValueError("PDF group is outside its parent division.")
    return by_code


def extract(workbook_path: Path, pdf_path: Path) -> dict:
    verified_file(workbook_path, WORKBOOK_SHA256)
    verified_file(pdf_path, PDF_SHA256)
    pdf = pdf_parents(pdf_path)
    workbook = openpyxl.load_workbook(workbook_path, read_only=True, data_only=False)
    if workbook.sheetnames != ["All"]:
        raise ValueError("Unexpected workbook sheets.")
    sheet = workbook["All"]
    if (sheet.max_row, sheet.max_column) != (3150, 5):
        raise ValueError("Unexpected workbook dimensions.")
    rows = []
    for number, cells in enumerate(sheet.iter_rows(values_only=True), 1):
        if number == 1:
            continue
        a, b, c, description, _unused = cells
        section = re.fullmatch(r"SECTION\s+([A-V])\s*:\s*(.+)", clean(a), re.I)
        division = re.fullmatch(r"DIVISION\s+(\d{2})\s*:\s*(.+)", clean(b), re.I)
        if section or division:
            match = section or division
            code, title = match.groups()
            level = "section" if section else "division"
        else:
            coded = [(level, clean(value)) for value, level, digits in
                     [(a, "group", 3), (b, "class", 4), (c, "subclass", 6)]
                     if re.fullmatch(r"\d{" + str(digits) + r"}", clean(value))]
            if not coded:
                continue
            if len(coded) != 1:
                raise ValueError(f"Ambiguous industry code at workbook row {number}.")
            level, code = coded[0]
            title = clean(description)
        if not title:
            raise ValueError(f"Empty industry title at workbook row {number}.")
        rows.append({"code": code, "title": title, "level": level,
                     "source": {"kind": "workbook", "sheet": "All", "row": number, "printedPage": None}})
    if dict(Counter(row["level"] for row in rows)) != WORKBOOK_COUNTS:
        raise ValueError("Workbook counts do not match the reviewed source.")
    by_code = {row["code"]: row for row in rows}
    if len(by_code) != len(rows):
        raise ValueError("Duplicate workbook activity code.")
    for code in ("38", "108"):
        if code in by_code:
            raise ValueError("Expected missing heading is already present; review this source.")
        parent = pdf[code]
        row = {"code": code, "title": parent["title"], "level": parent["level"],
               "source": {"kind": "pdf", "sheet": None, "row": None, "printedPage": parent["printedPage"]}}
        by_code[code] = row
        rows.append(row)
    heading_differences = []
    for row in rows:
        code, level = row["code"], row["level"]
        division_code = None if level == "section" else code[:2]
        section_code = code if level == "section" else pdf[division_code]["sectionCode"]
        group_code = code[:3] if level in {"group", "class", "subclass"} else None
        class_code = code[:4] if level in {"class", "subclass"} else None
        parent_code = {"section": None, "division": section_code, "group": division_code,
                       "class": group_code, "subclass": class_code}[level]
        row.update({"parentCode": parent_code, "sectionCode": section_code,
                    "divisionCode": division_code, "groupCode": group_code, "classCode": class_code})
        if parent_code and parent_code not in by_code:
            raise ValueError(f"Missing parent for activity {code}.")
        if level in {"section", "division", "group"}:
            if code not in pdf or pdf[code]["level"] != level:
                raise ValueError(f"Hierarchy heading {code} is not in the official PDF.")
            if row["title"] != pdf[code]["title"]:
                heading_differences.append({"code": code, "workbookTitle": row["title"],
                                            "pdfTitle": pdf[code]["title"],
                                            "printedPage": pdf[code]["printedPage"]})
    observed = dict(Counter(row["level"] for row in rows))
    if observed != COUNTS:
        raise ValueError("Reconciled hierarchy counts do not match the reviewed source.")
    level_rank = {level: index for index, level in enumerate(COUNTS)}
    rows.sort(key=lambda row: (level_rank[row["level"]], row["code"]))
    return {
        "version": "NIC-2025", "publishedOn": "2025-11-18", "retrievedOn": "2026-11-18",
        "sourceQuality": "official_reference", "sourceLanguage": "en",
        "publisher": "Ministry of Statistics and Programme Implementation, Government of India",
        "workbookUrl": WORKBOOK_URL, "workbookSha256": WORKBOOK_SHA256,
        "pdfUrl": PDF_URL, "pdfSha256": PDF_SHA256,
        "releaseUrl": "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2191142",
        "reportedCounts": {**COUNTS, "group": 257},
        "workbookCounts": WORKBOOK_COUNTS, "observedCounts": observed,
        "discrepancies": [
            {"id": "workbook-missing-division-38", "detail": "Division 38 heading is absent from the workbook. Imported from PDF broad structure, printed page 20 (physical page 40)."},
            {"id": "workbook-missing-group-108", "detail": "Group 108 heading is absent before class 1080 at workbook All row 434. Imported from PDF broad structure, printed page 16 (physical page 36)."},
            {"id": "release-group-count", "detail": "Official release reports 257 groups; the official PDF broad structure contains 258 distinct group headings. All verified groups are retained."},
        ],
        "headingDifferences": heading_differences,
        "normalization": "Whitespace only; workbook titles are retained where workbook and PDF wording differs. No code or industry description is inferred.",
        "reuse": {
            "policyUrl": "https://www.mospi.gov.in/CopyrightPolicy",
            "status": "attribution_required_no_separate_nic_licence_found",
            "note": "Retain MoSPI attribution and source links. The website policy describes accurate attributed reuse under GSDD 2026; no NIC-specific SPDX or separate licence is stated in these files. Do not describe this data as public domain.",
        },
        "rows": rows,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "convex/data/nationalIndustries2025.json")
    args = parser.parse_args()
    data = extract(args.workbook, args.pdf)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"version": data["version"], "counts": data["observedCounts"], "records": len(data["rows"])}))
