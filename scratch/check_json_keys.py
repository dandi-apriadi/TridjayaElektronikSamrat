import json

with open('frontend/public/data/credit_calculations.json', 'r') as f:
    data = json.load(f)

for client_type in ['NEW', 'RO']:
    print(f"--- {client_type} ---")
    for category in ['electronics', 'furniture', 'gadget']:
        keys = list(data[client_type][category].keys())
        if keys:
            # Convert keys to numbers to sort correctly
            num_keys = sorted([int(k) for k in keys if k.isdigit()])
            if num_keys:
                print(f"Category: {category}")
                print(f"  Range: {num_keys[0]} - {num_keys[-1]}")
                print(f"  Total Keys: {len(num_keys)}")
