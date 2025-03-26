# Dataset Access Instructions

This project uses two datasets stored in Google Cloud Storage:

- `converted_item_metadata`
- `converted_user_ratings`

These are too large for GitHub but can be downloaded using `gsutil` or `gcsfs`.

## 📦 Download the Datasets

To download them locally:

### 1. Make sure you have the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed

```bash
gcloud auth login
