import pandas as pd
import json
import numpy as np
import ast
import csv
from pathlib import Path
import os

def recursively_clean(obj):
    """
    Recursively traverse an object and replace non-breaking spaces (\xa0) with a normal space.
    """
    if isinstance(obj, str):
        return obj.replace('\xa0', ' ')
    elif isinstance(obj, list):
        return [recursively_clean(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: recursively_clean(value) for key, value in obj.items()}
    else:
        return obj

def clean_images_field(images_obj):
    """
    Convert the images field into a JSON-formatted string.
    If the field is a dict and contains NumPy arrays, convert those arrays into lists.
    Apply recursive cleaning to remove non-breaking spaces.
    """
    # Fixed handling of null values - avoid ambiguity with arrays
    if images_obj is None:
        return json.dumps({})
    
    # Use pandas.isna only if it's not an array or collection type
    if not isinstance(images_obj, (list, dict)) and not hasattr(images_obj, '__iter__'):
        if pd.isna(images_obj):
            return json.dumps({})
        
    if isinstance(images_obj, dict):
        cleaned = {}
        for key, val in images_obj.items():
            if isinstance(val, np.ndarray):
                cleaned[key] = val.tolist()
            else:
                cleaned[key] = val
        return json.dumps(recursively_clean(cleaned), ensure_ascii=False)
    
    try:
        # In case it's already a string representation of JSON
        if isinstance(images_obj, str):
            if images_obj.strip() == '':
                return json.dumps({})
            # Try to parse it as JSON first
            parsed = json.loads(images_obj)
            return json.dumps(recursively_clean(parsed), ensure_ascii=False)
    except (json.JSONDecodeError, ValueError):
        pass
        
    return json.dumps(recursively_clean(images_obj), ensure_ascii=False)

def clean_description(desc):
    """
    Clean the description field:
      - If it's a list or dict, recursively clean it and dump as JSON.
      - If it's a string, replace non-breaking spaces, trim whitespace,
        and try to interpret it as a Python literal.
      - If that evaluation yields a list or dict, recursively clean it and dump as JSON.
      - Otherwise, return the cleaned string.
    """
    # Fixed handling of null values - avoid ambiguity with arrays
    if desc is None:
        return json.dumps("")
    
    # Use pandas.isna only if it's not an array or collection type
    if not isinstance(desc, (list, dict)) and not hasattr(desc, '__iter__'):
        if pd.isna(desc):
            return json.dumps("")
            
    if isinstance(desc, (list, dict)):
        return json.dumps(recursively_clean(desc), ensure_ascii=False)
    
    if isinstance(desc, str):
        # Replace non-breaking spaces and trim whitespace.
        cleaned_desc = desc.replace('\xa0', ' ').strip()
        if not cleaned_desc:
            return json.dumps("")
            
        # Check if the string resembles a Python literal.
        if (cleaned_desc.startswith('[') and cleaned_desc.endswith(']')) or \
           (cleaned_desc.startswith('{') and cleaned_desc.endswith('}')):
            try:
                parsed = ast.literal_eval(cleaned_desc)
                if isinstance(parsed, (list, dict)):
                    return json.dumps(recursively_clean(parsed), ensure_ascii=False)
                else:
                    return json.dumps(cleaned_desc)
            except Exception:
                return json.dumps(cleaned_desc)
        else:
            return json.dumps(cleaned_desc)
    
    return json.dumps(str(desc))

def main():
    # Define paths with flexibility
    data_dir = Path("../data")
    file_path = data_dir / "sample_item_info.parquet"
    
    # Check if file exists and try alternatives if needed
    if not file_path.exists():
        print(f"File not found at {file_path}")
        alternative_paths = [
            Path("./sample_item_info.parquet"),
            Path("../../data/sample_item_info.parquet"),
            Path("./data/sample_item_info.parquet"),
            Path("data/sample_item_info.parquet")  # Added for the project root case
        ]
        
        for alt_path in alternative_paths:
            if alt_path.exists():
                print(f"Found file at alternative location: {alt_path}")
                file_path = alt_path
                break
        else:
            print("Could not find the parquet file. Please check the path.")
            return
    
    print(f"Loading data from {file_path}")
    try:
        df = pd.read_parquet(file_path)
    except Exception as e:
        print(f"Error reading parquet file: {e}")
        return
    
    # Add logs for debugging
    print(f"Loaded {len(df)} rows")
    print(f"Columns: {list(df.columns)}")
    
    # Clean the 'images' column by converting nested arrays/dicts to JSON strings
    # and ensuring non-breaking spaces are replaced.
    print("Cleaning images column...")
    df["images"] = df["images"].apply(clean_images_field)
    
    # Clean the 'description' column with our cleaning function.
    print("Cleaning description column...")
    df["description"] = df["description"].apply(clean_description)
    
    # Create output directory (use same directory as input file by default)
    output_dir = file_path.parent
    os.makedirs(output_dir, exist_ok=True)
    
    csv_path = output_dir / "sample_item_info.csv"
    print(f"Writing to CSV: {csv_path}")
    
    # Write the cleaned DataFrame to a CSV file with full quoting and explicit encoding.
    df.to_csv(csv_path, index=False, quoting=csv.QUOTE_ALL, encoding='utf-8')
    
    # Post-process the CSV file to remove any lingering \xa0 characters.
    print("Post-processing CSV file...")
    with open(csv_path, "r", encoding="utf-8") as f:
        content = f.read()
    content = content.replace("\xa0", " ")
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"CSV file created successfully at {csv_path}")
    
    # Sample validation
    sample_row = df.iloc[0] if len(df) > 0 else None
    if sample_row is not None:
        print("\nSample row preview:")
        for col in df.columns:
            preview = str(sample_row[col])
            if isinstance(preview, str) and len(preview) > 100:
                preview = preview[:100] + "..."
            print(f"{col}: {preview}")

if __name__ == "__main__":
    main() 