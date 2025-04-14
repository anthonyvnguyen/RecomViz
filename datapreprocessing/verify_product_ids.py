import pandas as pd

def main():
    # Read the CSV files, ensuring that product_id columns are read as strings
    ratings = pd.read_csv("../data/sample_user_ratings.csv", dtype=str)
    items = pd.read_csv("../data/sample_item_info.csv", dtype=str)
    
    # Clean product_id by stripping whitespace
    ratings_ids = set(ratings["product_id"].dropna().str.strip())
    item_ids = set(items["product_id"].dropna().str.strip())
    
    # Compute missing product_ids (present in ratings but missing in items)
    missing_ids = ratings_ids - item_ids
    
    if missing_ids:
        print("The following product_ids from sample_user_ratings.csv are not in sample_item_info.csv:")
        for pid in missing_ids:
            print(pid)
    else:
        print("All product_ids in sample_user_ratings.csv are present in sample_item_info.csv.")

if __name__ == "__main__":
    main()