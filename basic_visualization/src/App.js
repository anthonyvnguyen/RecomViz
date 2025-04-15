import React, { useState, useEffect, useCallback } from "react";
import Papa from "papaparse";
import GrapherWrapper from "./GrapherWrapper";
import "./App.css";

function App() {
    const [userId, setUserId] = useState("");
    const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
    const [recommendations, setRecommendations] = useState([]);
    const [items, setItems] = useState(new Map());
    const [selectedNode, setSelectedNode] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showComplementary, setShowComplementary] = useState(true);
    // Track which nodes have already been expanded
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    // New state for tracking recommendation generation status
    const [recGenerationStatus, setRecGenerationStatus] = useState({
        status: "none", // "none", "generating", "complete"
        nodeId: null,
    });
    // New state for user ratings
    const [userRatings, setUserRatings] = useState([]);
    // New state for selected product from dropdown
    const [selectedRatedProduct, setSelectedRatedProduct] = useState(null);

    useEffect(() => {
        // Load recommendations data
        Papa.parse("/top10_recommendations_all_users_sample.csv", {
            download: true,
            header: true,
            dynamicTyping: false, // Keep everything as strings initially
            complete: (results) => {
                console.log(
                    "Loaded recommendations:",
                    results.data.slice(0, 5)
                );
                setRecommendations(results.data);

                // Load product info data
                Papa.parse("/sample_item_info.csv", {
                    download: true,
                    header: true,
                    dynamicTyping: false, // Keep everything as strings to ensure consistent key type
                    complete: (itemResults) => {
                        console.log(
                            "Loaded item info data sample:",
                            itemResults.data.slice(0, 5)
                        );

                        // Create a Map with product_id as string keys
                        const itemsMap = new Map();

                        itemResults.data.forEach((item) => {
                            if (item && item.product_id) {
                                // Use clean string as key
                                const productId = item.product_id.trim();
                                itemsMap.set(productId, item);
                            }
                        });

                        console.log(
                            "Items map created with",
                            itemsMap.size,
                            "items"
                        );

                        // Test lookup with a few sample product IDs from recommendations
                        if (results.data.length > 0) {
                            const sampleRecId = results.data[0].product_id;
                            console.log(
                                `Test lookup for product ${sampleRecId}:`,
                                itemsMap.get(sampleRecId)
                            );
                        }

                        setItems(itemsMap);

                        // Load user ratings data
                        Papa.parse("/sample_user_ratings.csv", {
                            download: true,
                            header: true,
                            dynamicTyping: false,
                            complete: (ratingsResults) => {
                                console.log(
                                    "Loaded user ratings sample:",
                                    ratingsResults.data.slice(0, 5)
                                );
                                setUserRatings(ratingsResults.data);
                                setIsLoading(false);
                            },
                            error: (err) => {
                                console.error(
                                    "Error loading user ratings:",
                                    err
                                );
                                setIsLoading(false);
                            },
                        });
                    },
                    error: (err) => {
                        console.error("Error loading items:", err);
                        setIsLoading(false);
                    },
                });
            },
            error: (err) => {
                console.error("Error loading recommendations:", err);
                setIsLoading(false);
            },
        });
    }, []);

    const fetchChildrenNodes = async (productId, complementary = true) => {
        try {
            const response = await fetch("http://localhost:5001/get_children", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    parentId: productId,
                    complementary: complementary,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("Fetched children nodes:", data);
            return data; // array of recommended product_ids
        } catch (error) {
            console.error("Error fetching recommendations:", error);
            return [];
        }
    };

    // New function to handle recommendation generation button click
    const handleGenerateRecommendations = async () => {
        if (!selectedNode || selectedNode.type !== "product") return;

        // Check if this node has already been expanded with the current recommendation type
        const nodeKey = `${selectedNode.id}-${
            showComplementary ? "comp" : "subst"
        }`;

        // Skip fetching if we've already expanded this node with this recommendation type
        if (expandedNodes.has(nodeKey)) {
            console.log(
                `Node ${selectedNode.id} already expanded for ${
                    showComplementary ? "complementary" : "substitute"
                } recommendations`
            );
            return;
        }

        // Set status to generating
        setRecGenerationStatus({
            status: "generating",
            nodeId: selectedNode.id,
        });

        const recProductIds = await fetchChildrenNodes(
            selectedNode.id,
            showComplementary
        );

        if (!recProductIds || recProductIds.length === 0) {
            // Set status to complete even if no recommendations
            setRecGenerationStatus({
                status: "complete",
                nodeId: selectedNode.id,
            });

            // Reset status after 3 seconds
            setTimeout(() => {
                setRecGenerationStatus({
                    status: "none",
                    nodeId: null,
                });
            }, 3000);

            return;
        }

        console.log(
            `${
                showComplementary ? "Complementary" : "Substitute"
            } recommendations for`,
            selectedNode.id,
            recProductIds
        );

        // Create a map of existing nodes to quickly check for duplicates
        const existingNodeMap = new Map();
        graphData.nodes.forEach((node) => {
            existingNodeMap.set(node.id, node);
        });

        // Create a map of existing edges to quickly check for duplicates
        const existingEdgeMap = new Set();
        graphData.edges.forEach((edge) => {
            existingEdgeMap.add(`${edge.source}-${edge.target}`);
        });

        // Filter out IDs that are already in the graph
        const newRecommendations = recProductIds.filter(
            (id) => !existingNodeMap.has(id)
        );

        // Get item details for new recommendations
        const recommendedItems = newRecommendations
            .map((id) => items.get(id))
            .filter(Boolean);

        // Create new nodes for the recommendations
        const newNodes = recommendedItems.map((item) => {
            const cleanId = item.product_id.trim();
            return {
                id: cleanId,
                label: item.title || `Product ${cleanId}`,
                type: "product",
                parentId: selectedNode.id,
                data: {
                    title: item.title,
                    description: item.description,
                    images: item.images,
                },
            };
        });

        // Create new edges for all recommendations (including those already in the graph)
        // This ensures connections are made to existing nodes too
        const newEdges = [];

        recProductIds.forEach((id) => {
            // Create a clean ID to match with our node IDs
            const cleanId = id.trim();

            // Skip duplicate edges
            const edgeKey = `${selectedNode.id}-${cleanId}`;
            if (!existingEdgeMap.has(edgeKey)) {
                newEdges.push({
                    source: selectedNode.id,
                    target: cleanId,
                    type: showComplementary ? "complementary" : "substitute",
                });
            }
        });

        // Only update the graph if we have new nodes or edges to add
        if (newNodes.length > 0 || newEdges.length > 0) {
            setGraphData((prevGraphData) => ({
                nodes: [...prevGraphData.nodes, ...newNodes],
                edges: [...prevGraphData.edges, ...newEdges],
            }));
        }

        // Mark this node as expanded with this recommendation type
        setExpandedNodes((prev) => {
            const newSet = new Set(prev);
            newSet.add(nodeKey);
            return newSet;
        });

        // Update the displayed recommendations in the panel
        // Show all recommendations for this node, including ones that were already in the graph
        const allRecommendedItems = recProductIds
            .map((id) => items.get(id.trim()))
            .filter(Boolean);

        setRecommendations(allRecommendedItems);

        // Set status to complete
        setRecGenerationStatus({
            status: "complete",
            nodeId: selectedNode.id,
        });

        // Reset status after 3 seconds
        setTimeout(() => {
            setRecGenerationStatus({
                status: "none",
                nodeId: null,
            });
        }, 3000);
    };

    // Function to handle selection of a product from the dropdown
    const handleRatedProductSelect = (event) => {
        const productId = event.target.value;
        if (!productId) {
            setSelectedRatedProduct(null);
            return;
        }

        const productInfo = items.get(productId);
        if (productInfo) {
            // Set the selected product with all available details
            setSelectedRatedProduct({
                id: productId,
                type: "product",
                data: {
                    title: productInfo.title,
                    description: productInfo.description,
                    images: productInfo.images,
                    // Add rating info
                    rating:
                        userRatings.find(
                            (rating) =>
                                rating.product_id === productId &&
                                rating.user_id ===
                                    selectedNode.id.replace("user-", "")
                        )?.rating || "N/A",
                },
            });
        } else {
            console.log(`No product info found for ${productId}`);
            setSelectedRatedProduct({
                id: productId,
                type: "product",
                data: {
                    title: `Product ${productId}`,
                    rating:
                        userRatings.find(
                            (rating) =>
                                rating.product_id === productId &&
                                rating.user_id ===
                                    selectedNode.id.replace("user-", "")
                        )?.rating || "N/A",
                },
            });
        }
    };

    const processDescription = (description) => {
        if (!description) return "no description provided";

        try {
            // Fix malformed array: add missing commas between quoted strings
            let fixed = description.replace(/'/g, '"').replace(/"\s*"/g, '","');

            // Try parsing as JSON
            let parsed = JSON.parse(fixed);

            const cleaned = parsed
                .filter((item) => typeof item === "string")
                .map((item) => item.trim())
                .join(" ");

            // Decode HTML entities (e.g., unicode)
            const textarea = document.createElement("textarea");
            textarea.innerHTML = cleaned;
            const decoded = textarea.value.trim();

            return decoded || "no description provided";
        } catch (e) {
            console.log("Error processing description:", e);
            // Fallback cleanup
            const cleaned = description
                .replace(/[\[\]']+/g, "")
                .replace(/\\n/g, " ")
                .replace(/\\u[\dA-F]{4}/gi, (match) =>
                    String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16))
                )
                .trim();

            return cleaned || "no description provided";
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!userId) return;

        // Clear existing graph data first to handle switching between users
        setGraphData({ nodes: [], edges: [] });

        // Reset expanded nodes when starting a new graph
        setExpandedNodes(new Set());

        // Reset selected node
        setSelectedNode(null);

        // Reset selected rated product
        setSelectedRatedProduct(null);

        // Reset recommendation status
        setRecGenerationStatus({
            status: "none",
            nodeId: null,
        });

        const userRecs = recommendations
            .filter((r) => r.user_id === userId)
            .sort(
                (a, b) =>
                    parseFloat(b.predicted_rating) -
                    parseFloat(a.predicted_rating)
            )
            .slice(0, 10);

        console.log("User recommendations found:", userRecs.length);

        // Create user node (root of the tree)
        const nodes = [
            {
                id: `user-${userId}`,
                label: `User ${userId}`,
                type: "user",
            },
        ];

        const edges = [];

        // Add first level of product recommendations
        userRecs.forEach((rec) => {
            // Ensure product_id is a clean string
            const productId = rec.product_id.trim();
            const itemInfo = items.get(productId);

            console.log(
                `Product ${productId} lookup:`,
                itemInfo
                    ? `Found: ${itemInfo.title.substring(0, 20)}...`
                    : "Not found"
            );

            nodes.push({
                id: productId,
                label: itemInfo ? itemInfo.title : `Product ${productId}`,
                type: "product",
                parentId: `user-${userId}`, // Track parent for tree layout
                data: {
                    predictedRating: parseFloat(rec.predicted_rating),
                    title: itemInfo ? itemInfo.title : null,
                    description: itemInfo ? itemInfo.description : null,
                    images: itemInfo ? itemInfo.images : null,
                },
            });

            edges.push({
                source: `user-${userId}`,
                target: productId,
            });
        });

        setGraphData({ nodes, edges });

        // Automatically select the user node to display recommendation count
        const userNodeId = `user-${userId}`;
        setSelectedNode({
            id: userNodeId,
            type: "user",
            data: {
                recommendationCount: userRecs.length,
            },
        });
    };

    const handleNodeClick = useCallback(
        (nodeId) => {
            console.log("Node clicked:", nodeId);
            const node = graphData.nodes.find((n) => n.id === nodeId);
            if (!node) {
                console.log("No node found with id:", nodeId);
                return;
            }

            console.log("Found node:", node);

            // Reset selected rated product when a new node is clicked
            setSelectedRatedProduct(null);

            // For product nodes, get info from node data rather than trying to look up again
            if (node.type === "product") {
                setSelectedNode({
                    id: nodeId,
                    type: node.type,
                    data: node.data || {},
                });
                return;
            }

            // For other node types
            setSelectedNode({
                id: nodeId,
                type: node.type,
                data: {},
            });
        },
        [graphData.nodes]
    );

    // Fix the reset button by properly creating a new Event and clearing the user ID
    const resetGraph = () => {
        // Clear the graph data
        setGraphData({ nodes: [], edges: [] });

        // Clear the user ID input
        setUserId("");

        // Reset selected node
        setSelectedNode(null);

        // Reset selected rated product
        setSelectedRatedProduct(null);

        // Reset expanded nodes
        setExpandedNodes(new Set());

        // Reset recommendation status
        setRecGenerationStatus({
            status: "none",
            nodeId: null,
        });

        // Reset recommendations to the original loaded data
        // This is critical - if recommendations array is empty, new user lookups won't work
        Papa.parse("/top10_recommendations_all_users_sample.csv", {
            download: true,
            header: true,
            dynamicTyping: false,
            complete: (results) => {
                console.log("Reloaded recommendations after reset");
                setRecommendations(results.data);
            },
            error: (err) => {
                console.error("Error reloading recommendations:", err);
            },
        });
    };

    // Get user's rated products from userRatings data
    const getUserRatedProducts = (userId) => {
        if (!userId) return [];

        const userIdWithoutPrefix = userId.replace("user-", "");
        const ratedProducts = userRatings.filter(
            (rating) => rating.user_id === userIdWithoutPrefix
        );

        console.log(
            `Found ${ratedProducts.length} rated products for user ${userIdWithoutPrefix}`
        );
        return ratedProducts;
    };

    // Render the product details panel - used for both clicked nodes and dropdown-selected products
    const renderProductDetails = (product) => {
        return (
            <div className="product-details">
                <div className="detail-header">
                    <h4>{product.data.title || "Unknown Product"}</h4>
                    {(product.data.predictedRating || product.data.rating) && (
                        <div className="rating-badge">
                            {product.data.predictedRating
                                ? product.data.predictedRating.toFixed(2)
                                : product.data.rating}
                            <span className="rating-star">★</span>
                        </div>
                    )}
                </div>

                {product.data.images && (
                    <div className="product-image">
                        <img
                            src={product.data.images}
                            alt={product.data.title}
                        />
                    </div>
                )}

                <div className="product-id">ID: {product.id}</div>

                {product.data.description && (
                    <div className="product-description">
                        <h5>Description</h5>
                        <p>{processDescription(product.data.description)}</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <h1>Recommendation Explorer</h1>
                {!isLoading && (
                    <form onSubmit={handleSubmit} className="control-panel">
                        <input
                            type="text"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="Enter User ID"
                            required
                            className="user-id-input"
                        />
                        <button type="submit" className="submit-button">
                            Show Recommendations
                        </button>
                        {graphData.nodes.length > 0 && (
                            <button
                                type="button"
                                className="reset-button"
                                onClick={resetGraph}
                            >
                                Reset Graph
                            </button>
                        )}
                    </form>
                )}
            </header>

            {isLoading ? (
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <div>Loading data...</div>
                </div>
            ) : (
                <div className="main-content">
                    {/* Notification area for recommendation generation status */}
                    {recGenerationStatus.status !== "none" && (
                        <div
                            className={`recommendation-notification ${
                                recGenerationStatus.status === "complete"
                                    ? "complete"
                                    : ""
                            }`}
                        >
                            {recGenerationStatus.status === "generating"
                                ? `Generating recommendations for ${recGenerationStatus.nodeId}...`
                                : `Recommendations complete for ${recGenerationStatus.nodeId}`}
                        </div>
                    )}

                    <div className="visualization-container">
                        <div className="recommendation-type-toggle">
                            <div className="toggle-label">Substitute</div>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={showComplementary}
                                    onChange={() =>
                                        setShowComplementary(!showComplementary)
                                    }
                                />
                                <span className="slider round"></span>
                            </label>
                            <div className="toggle-label">Complementary</div>
                        </div>
                        <GrapherWrapper
                            nodes={graphData.nodes}
                            edges={graphData.edges}
                            onNodeClick={handleNodeClick}
                        />
                    </div>

                    {selectedNode && (
                        <div className="node-details-panel">
                            <div className="node-details-header">
                                <h3>
                                    {selectedNode.type === "user"
                                        ? "User Details"
                                        : "Product Details"}
                                </h3>

                                {/* Add recommendation button for product nodes */}
                                {selectedNode.type === "product" && (
                                    <button
                                        className="generate-recs-button"
                                        onClick={handleGenerateRecommendations}
                                        disabled={expandedNodes.has(
                                            `${selectedNode.id}-${
                                                showComplementary
                                                    ? "comp"
                                                    : "subst"
                                            }`
                                        )}
                                    >
                                        {expandedNodes.has(
                                            `${selectedNode.id}-${
                                                showComplementary
                                                    ? "comp"
                                                    : "subst"
                                            }`
                                        )
                                            ? "Recommendations Loaded"
                                            : `Get ${
                                                  showComplementary
                                                      ? "Complementary"
                                                      : "Substitute"
                                              } Recommendations`}
                                    </button>
                                )}
                            </div>

                            {selectedNode.type === "product" ? (
                                renderProductDetails(selectedNode)
                            ) : (
                                <div className="user-details">
                                    <div className="user-icon">👤</div>
                                    <div className="user-id">
                                        User ID:{" "}
                                        {selectedNode.id.replace("user-", "")}
                                    </div>
                                    <div className="recommendation-count">
                                        {
                                            graphData.edges.filter(
                                                (edge) =>
                                                    edge.source ===
                                                    selectedNode.id
                                            ).length
                                        }{" "}
                                        recommendations
                                    </div>

                                    {/* Add dropdown for user's rated products */}
                                    <div className="user-rated-products">
                                        <h5>Rated Products</h5>
                                        <select
                                            className="rated-products-dropdown"
                                            onChange={handleRatedProductSelect}
                                            value={
                                                selectedRatedProduct
                                                    ? selectedRatedProduct.id
                                                    : ""
                                            }
                                        >
                                            <option value="">
                                                Select a product
                                            </option>
                                            {getUserRatedProducts(
                                                selectedNode.id
                                            ).map((rating) => {
                                                const productInfo = items.get(
                                                    rating.product_id
                                                );
                                                const displayName = productInfo
                                                    ? `${productInfo.title.substring(
                                                          0,
                                                          30
                                                      )}${
                                                          productInfo.title
                                                              .length > 30
                                                              ? "..."
                                                              : ""
                                                      } (${rating.rating}★)`
                                                    : `Product ${rating.product_id} (${rating.rating}★)`;

                                                return (
                                                    <option
                                                        key={rating.product_id}
                                                        value={
                                                            rating.product_id
                                                        }
                                                    >
                                                        {displayName}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>

                                    {/* Show selected product details if any */}
                                    {selectedRatedProduct && (
                                        <div className="rated-product-details">
                                            <h4>Rated Product Details</h4>
                                            {renderProductDetails(
                                                selectedRatedProduct
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <footer className="app-footer">
                <div>Recommendation Visualization Tool</div>
            </footer>
        </div>
    );
}

export default App;
