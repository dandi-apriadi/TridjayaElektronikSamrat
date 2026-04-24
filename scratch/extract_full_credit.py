import pandas as pd
import json
import os

files_map = {
    "NEW": r'c:\Users\acer\Desktop\Project\RUST\Tridjaya Samrat\docs\kredit\PRICELIST KONS NEW 2025.xlsx',
    "RO": r'c:\Users\acer\Desktop\Project\RUST\Tridjaya Samrat\docs\kredit\PRICELIST KONS RO 2025-1.xlsx'
}

final_data = {
    "NEW": {},
    "RO": {}
}

sheet_mapping = {
    "furniture": "ELEK FUR ARREAR",
    "electronics": "ELEK FUR ADV",
    "gadget": "GADGET OTH ADV"  # Defaulting gadget to ADV as requested for electronics
}

def clean_val(x):
    try:
        return int(float(str(x).replace(',', '').strip()))
    except:
        return 0

for cust_type, filepath in files_map.items():
    print(f"Processing {cust_type}...")
    xl = pd.ExcelFile(filepath)
    
    for category, sheet_name in sheet_mapping.items():
        if sheet_name in xl.sheet_names:
            df = pd.read_excel(filepath, sheet_name=sheet_name, skiprows=2)
            # Find the actual columns
            # Column 0: Price, 1: 6x, 2: 9x, 3: 12x, 4: 15x (if exists)
            
            records = {}
            for _, row in df.iterrows():
                try:
                    price = clean_val(list(row)[0])
                    if price == 0: continue
                    
                    installments = {
                        "6x": clean_val(list(row)[1]),
                        "9x": clean_val(list(row)[2]),
                        "12x": clean_val(list(row)[3])
                    }
                    if len(list(row)) > 4:
                        installments["15x"] = clean_val(list(row)[4])
                    
                    records[str(price)] = installments
                except:
                    continue
            
            final_data[cust_type][category] = records

# Write the JSON
with open('c:/Users/acer/Desktop/Project/RUST/Tridjaya Samrat/docs/kredit/credit_calculations.json', 'w') as f:
    json.dump(final_data, f, indent=2)

print("Done. JSON generated at docs/kredit/credit_calculations.json")
