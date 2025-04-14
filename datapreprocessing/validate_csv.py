import pandas as pd
import json
import csv

EXPECTED_COLUMNS = ["title", "product_id", "description", "images"]
IMAGE_KEYS = {"hi_res", "large", "thumb", "variant"}

def validate_row(row_num, row):
    errors = []

    # Check for valid description JSON
    try:
        desc = json.loads(row["description"])
        if not isinstance(desc, (list, str)):
            errors.append("Description is not a list or string")
    except json.JSONDecodeError:
        errors.append("Invalid JSON in description")

    # Check for valid images JSON
    try:
        images = json.loads(row["images"])
        if not isinstance(images, dict):
            errors.append("Images is not a JSON object")
        else:
            missing_keys = IMAGE_KEYS - set(images.keys())
            if missing_keys:
                errors.append(f"Images field missing keys: {missing_keys}")
    except json.JSONDecodeError:
        errors.append("Invalid JSON in images")

    return errors

def main():
    try:
        df = pd.read_csv("../data/updated_sample_item_info.csv", quoting=csv.QUOTE_ALL)
    except Exception as e:
        print(f"❌ Failed to read CSV: {e}")
        return

    if sorted(list(df.columns)) != sorted(EXPECTED_COLUMNS):
        print("❌ Column mismatch!")
        print(f"Expected: {EXPECTED_COLUMNS}")
        print(f"Found:    {list(df.columns)}")
        return

    print(f"✅ Loaded {len(df)} rows. Starting validation...\n")
    total_errors = 0
    error_samples = {}  # Store sample errors for display

    for i, row in df.iterrows():
        row_errors = validate_row(i, row)
        if row_errors:
            total_errors += len(row_errors)
            # Only store a few samples to avoid verbose output
            if len(error_samples) < 5:
                error_samples[i] = {
                    "product_id": row['product_id'],
                    "errors": row_errors
                }

    # Display sample errors
    for idx, error_info in error_samples.items():
        print(f"⚠️ Row {idx + 1} (product_id={error_info['product_id']}):")
        for err in error_info['errors']:
            print(f"  - {err}")

    # Summary output
    if total_errors == 0:
        print("\n✅ All rows passed validation!")
    else:
        print(f"\n❌ Found {total_errors} issues in {len(df)} rows.")
        
    # Try to find the most common error patterns
    if total_errors > 0:
        error_patterns = {}
        for i, row in df.iterrows():
            row_errors = validate_row(i, row) 
            for err in row_errors:
                if err not in error_patterns:
                    error_patterns[err] = 0
                error_patterns[err] += 1
                
        print("\nMost common error patterns:")
        for err, count in sorted(error_patterns.items(), key=lambda x: x[1], reverse=True):
            print(f"- {err}: {count} occurrences")

if __name__ == "__main__":
    main() 