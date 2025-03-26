#!/bin/bash

echo "Downloading datasets from Google Cloud Storage..."

gsutil -m cp -r gs://recomviz_home_and_kitchen/datasets/converted_item_metadata .
gsutil -m cp -r gs://recomviz_home_and_kitchen/datasets/converted_user_ratings .

echo "✅ Download complete!"
