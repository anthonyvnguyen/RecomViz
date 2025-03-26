# 📂 Dataset Access Instructions

This project uses two large datasets stored in **Google Cloud Storage (GCS)**:

- `converted_item_metadata`: Product titles, descriptions, and image URLs
- `converted_user_ratings`: User-to-product rating mappings

These datasets are **too large to store on GitHub**, but you can download them locally using a provided script.

---

## 📦 Sample Datasets for Quick Testing

To help you get started without downloading the full dataset, we’ve included two sample `.parquet` files in the `data/` folder:

| File                                          | Rows     | Description                                |
|-----------------------------------------------|----------|--------------------------------------------|
| `data/large_sample_user_ratings.parquet`      | 100,000  | Sampled user-to-product rating records     |
| `data/large_sample_item_info.parquet`         | 20,000   | Sampled item metadata (title, description) |

These files are great for:
- Local testing and development
- Debugging your pipeline
- Understanding the schema and format

### ▶️ Load a Sample in Python

\`\`\`python
import pandas as pd

ratings_df = pd.read_parquet(\"data/large_sample_user_ratings.parquet\")
items_df = pd.read_parquet(\"data/large_sample_item_info.parquet\")

print(ratings_df.head())
print(items_df.head())
\`\`\`

---

## 📥 How to Download the Full Datasets

### 🔧 Step 1: Install Google Cloud SDK

If you haven’t already, install the SDK:  
📎 https://cloud.google.com/sdk/docs/install

### 🔐 Step 2: Authenticate with Google

\`\`\`bash
gcloud auth login
\`\`\`

### 📝 Step 3: Run the Download Script

In your terminal (from the project directory), run:

\`\`\`bash
chmod +x download_data.sh
./download_data.sh
\`\`\`

This script will:

- Use \`gsutil\` to recursively download:
  - \`converted_item_metadata/\` (Parquet files of product metadata)
  - \`converted_user_ratings/\` (Parquet files of user-product ratings)
- Place both folders in your local directory

---

## 🛠️ Troubleshooting

- Make sure you're authenticated using \`gcloud auth login\`
- Ensure \`gsutil\` is in your system PATH
- If you get permission errors, confirm that your Google account has access to the GCS bucket:  
  \`gs://recomviz_home_and_kitchen/\`

---

## 🤝 Contributions

Feel free to submit a PR to improve the download script, sample datasets, or add support for other cloud providers.