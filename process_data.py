import json
import re

def process_toh(input_path, output_path):
    with open(input_path, 'r') as f:
        data = json.load(f)
    
    columns = data['columns']
    brand_idx = columns.index('brand')
    model_idx = columns.index('model')
    version_idx = columns.index('version')
    device_type_idx = columns.index('devicetype')

    supported = {}

    for entry in data['entries']:
        dtype = entry[device_type_idx]
        if dtype and 'Router' not in dtype and 'Access Point' not in dtype and 'SBC' not in dtype:
            continue
            
        brand = entry[brand_idx]
        model = entry[model_idx]
        
        if not brand or not model:
            continue
            
        brand = brand.strip().upper()
        
        # Normalize models
        raw_models = []
        if isinstance(model, list):
            raw_models = [m.strip().upper() for m in model]
        else:
            raw_models = [model.strip().upper()]

        # Handle Keenetic/Zyxel overlap
        target_brands = [brand]
        if brand == 'ZYXEL' and any('KEENETIC' in m for m in raw_models):
            target_brands.append('KEENETIC')
        if brand == 'KEENETIC':
            # Ensure Zyxel Keenetic also matches
            target_brands.append('ZYXEL')

        for b in target_brands:
            if b not in supported:
                supported[b] = set()
            for m in raw_models:
                # Extract clean model name (e.g. "ARCHER C80" from "ARCHER C80 V1")
                # But also keep the full one
                supported[b].add(m)
                
                # Try to extract model code like "KN-1011"
                match = re.search(r'([A-Z0-9]{2,}-\d{4,})', m)
                if match:
                    supported[b].add(match.group(1))
                
                # Also common patterns in parenthesis
                match_paren = re.search(r'\(([^)]+)\)', m)
                if match_paren:
                    supported[b].add(match_paren.group(1).strip().upper())

    # Add some manual hype devices for ImmortalWrt
    hype_devices = {
        "XIAOMI": ["AX3000T", "AX6000", "AX3600", "AX9000", "AX6S", "BE3600"],
        "REDMI": ["AX6000", "AX5400", "AX5", "AX6"],
        "MERCUSYS": ["MR70X", "MR80X", "MR90X"]
    }
    
    for b, ms in hype_devices.items():
        if b not in supported:
            supported[b] = set()
        for m in ms:
            supported[b].add(m)

    # Convert sets to sorted lists for JSON
    final_data = {k: sorted(list(v)) for k, v in supported.items()}
    
    with open(output_path, 'w') as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    process_toh('toh.json', 'supported_devices.json')
