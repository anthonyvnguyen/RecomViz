from flask import Flask, request, jsonify

import pandas as pd
import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer
from flask_cors import CORS


app = Flask(__name__)
CORS(app) 
tokenizer = AutoTokenizer.from_pretrained("hyp1231/blair-roberta-large")
model = AutoModel.from_pretrained("hyp1231/blair-roberta-large")
product_descriptions_df = pd.read_parquet("./data/updated_sample_item_info.parquet")
item_sim_df = pd.read_parquet("./data/sample_item_sim.parquet", engine = "fastparquet")
print("finished loading resources")
def get_children_nodes(parent_id, complementary = True):
    def get_similar_products(product_id, k=10):
        """Returns top-k similar products based on item similarity."""
        if product_id not in item_sim_df:
            return []
        return item_sim_df[product_id].nlargest(k + 1)[1:].index.tolist()  # Skip itself
    similar_products = get_similar_products(parent_id, k=10)
    def get_product_description(product_id):
        product = product_descriptions_df[product_descriptions_df['product_id'] == product_id]
        if not product.empty:
            description = product.iloc[0]['description']
            if description is None or len(description) == 0:
                description = [""]
            return product.iloc[0]['title'] + ". " + description[0]
        return None
    def get_complementary_products_blair(input_product, similar_products, complementary, k=3):
        """Use BLAIR to find the most complementary products among similar ones."""
        input_desc = get_product_description(input_product)
        similar_descs = [get_product_description(pid) for pid in similar_products]

        if not input_desc or all(not desc for desc in similar_descs):
            return similar_products[:k]  # Default to first k if descriptions are missing

        # **New: Complementary instruction**
        if complementary:
            context_prompt = ("I am looking for products that complement the following product, meaning they should be bought together.")
        else:
            context_prompt = ("I am looking for products similar to the following product.")

        # Create input texts for BLAIR
        texts = [context_prompt + " " + input_desc] + similar_descs
        inputs = tokenizer(texts, padding=True, truncation=True, max_length=512, return_tensors="pt")
        with torch.no_grad():
            embeddings = model(**inputs, return_dict=True).last_hidden_state[:, 0]
            embeddings = embeddings / embeddings.norm(dim=1, keepdim=True)  # Normalize embeddings
        input_embedding = embeddings[0]
        similarity_scores = (input_embedding @ embeddings[1:].T).cpu().numpy()  # Cosine similarity
        ranked_indices = np.argsort(similarity_scores)[::-1][:k]
        return [similar_products[i] for i in ranked_indices] 
    recs = get_complementary_products_blair(parent_id, similar_products, complementary, 3)
    return recs


@app.route("/get_children", methods=["POST"])
def get_children():
    data = request.get_json()
    print('recieved')
    if not data or "parentId" not in data:
        return jsonify({"error": "Missing parentId in request"}), 400

    parent_id = data["parentId"]
    complementary = bool(data.get("complementary",False))
    # Call your Python function to get children nodes.
    children_nodes = get_children_nodes(parent_id, complementary)
    # Return the result as JSON.
    return jsonify(children_nodes)

if __name__ == "__main__":
    app.run(debug=False, use_reloader=False, port = 5001)
