import pandas as pd
import json
import os
from datetime import datetime

excel_file = "Work Tracker.xlsx"
output_file = "data.json"

def clean_value(val):
    if pd.isna(val) or val == "":
        return None
    return val

def parse_excel():
    if not os.path.exists(excel_file):
        raise FileNotFoundError(f"Spreadsheet not found at {excel_file}")
        
    df = pd.read_excel(excel_file, sheet_name="Papers in Progress", engine="openpyxl")
    cols = df.columns
    papers_data = []

    # Columns are in groups of 4: [Paper Name, Date Last Reviewed, Days Since Last Review, Notes]
    for i in range(0, len(cols), 4):
        if i + 3 >= len(cols):
            break
            
        group_cols = cols[i:i+4]
        paper_name = group_cols[0]
        
        # Skip if the column name is empty or starts with unnamed
        if pd.isna(paper_name) or str(paper_name).startswith("Unnamed"):
            continue
            
        sections = []
        deadline_date = None
        deadline_notes = None
        # Extract rows for this paper group
        paper_df = df[group_cols]
        
        for _, row in paper_df.iterrows():
            section_name = row[group_cols[0]]
            # If section name is empty, skip this row
            if pd.isna(section_name) or str(section_name).strip() == "":
                continue
                
            section_name_str = str(section_name).strip()
            
            raw_date = row[group_cols[1]]
            date_str = None
            if pd.notna(raw_date):
                if isinstance(raw_date, datetime):
                    date_str = raw_date.strftime("%Y-%m-%d")
                else:
                    try:
                        # Try parsing string if not datetime object
                        parsed_dt = pd.to_datetime(raw_date)
                        if pd.notna(parsed_dt):
                            date_str = parsed_dt.strftime("%Y-%m-%d")
                    except Exception:
                        pass
            
            raw_days = row[group_cols[2]]
            days = None
            if pd.notna(raw_days) and date_str is not None:
                try:
                    # If Excel computed a weird value like 46215 due to empty dates, we ignore it
                    val = float(raw_days)
                    if val < 40000: # normal range of days
                        days = int(val)
                except ValueError:
                    pass

            notes = clean_value(row[group_cols[3]])
            
            if section_name_str.lower() == 'deadline':
                deadline_date = date_str
                deadline_notes = notes
                continue
            
            sections.append({
                "name": section_name_str,
                "date_last_reviewed": date_str,
                "days_since_last_review": days,
                "notes": notes
            })
            
        if sections or deadline_date:
            papers_data.append({
                "name": str(paper_name).strip(),
                "deadline_date": deadline_date,
                "deadline_notes": deadline_notes,
                "sections": sections
            })

    output_data = {
        "last_updated": datetime.now().isoformat(),
        "papers": papers_data
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, default=str)
        
    print(f"Successfully processed {len(papers_data)} papers and saved to {output_file}")

if __name__ == "__main__":
    parse_excel()
