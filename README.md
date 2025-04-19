# Welcome to RecomViz! 
RecomViz is a tool that adds interactivity to Amazon product recommendations. We use matrix factorization techinques for user-item recommendations along with support for SlopeOne enhancement. We provide item-item recommendations as well using cosine-similarity to prefilter products and BLaIR, a transformer model used to create rich embeddings of product descriptions. \

The structure of this code repo is as follows: \
**Recommendation_Models**: ipynb notebooks exploring some of the algorihtms we use for recommendations \
**backend**: the python backend (Flask server) used to generate our recommendations at runtime \
**basic_visualization**: the interactive frontend used to generate recommendations \
**data**: sampeled data files used for the demo, the whole datasets are too large to include \
**datapreprocessing**: the notebooks and scripts we used to preprocess the user reviews and product metadata



# Installing RecomViz 
- Step 1: [Clone this repo locally](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)
- Step 2: Install backend dependencies 
  ``` pip install flask pandas numpy torch transformers flask-cors ```
- Step 3:  Setup Node.js, use the following [guide](https://nodejs.org/en/download) if not already installed

# Executing RecomViz with sample dataset
### Step 1: Start the Flask Backend 
- In your terminal, navigate to the backend folder
- Launch the backend by running ```python app.py```
- The backend might take a few second to finish setting up, a message will be printed to your terminal when it is ready
- If you are still missing any of the python libraries required to run the backend, [pip install](https://packaging.python.org/en/latest/tutorials/installing-packages/) them as required 

### Step 2: Launch the Frontend 
- Navigate to basic_visualization folder
- Install required dependencies with ```npm install```
- Launch the web server with ```npm start```


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
