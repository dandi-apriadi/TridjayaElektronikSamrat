import pandas as pd
import json
import os

files = [
    r'c:\Users\acer\Desktop\Project\RUST\Tridjaya Samrat\docs\kredit\PRICELIST KONS NEW 2025.xlsx',
    r'c:\Users\acer\Desktop\Project\RUST\Tridjaya Samrat\docs\kredit\PRICELIST KONS RO 2025-1.xlsx'
]

results = {}

for file in files:
    filename = os.path.basename(file)
    print(f"--- Analyzing {filename} ---")
    xl = pd.ExcelFile(file)
    results[filename] = {"sheets": xl.sheet_names, "data": {}}
    
    for sheet in xl.sheet_names:
        df = pd.read_excel(file, sheet_name=sheet)
        print(f"\nSheet {sheet} columns: {df.columns.tolist()}")
        print(f"Sample data from {sheet} (first 5 rows):")
        print(df.head(5).to_string())
        results[filename]["data"][sheet] = df.head(30).to_dict(orient='records')

with open('excel_analysis.json', 'w') as f:
    json.dump(results, f, indent=2, default=str)
