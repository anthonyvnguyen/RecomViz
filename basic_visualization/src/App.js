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

    useEffect(() => {
        // Load recommendations data
        Papa.parse("/user_recommendations.csv", {
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
                        setIsLoading(false);
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

    useEffect(() => {
        if (selectedNode && selectedNode.type === "product") {
            fetchChildrenNodes(selectedNode.id, showComplementary).then(
                (recProductIds) => {
                    if (!recProductIds || recProductIds.length === 0) return;

                    console.log(
                        `${
                            showComplementary ? "Complementary" : "Substitute"
                        } recommendations for`,
                        selectedNode.id,
                        recProductIds
                    );

                    // Filter out IDs that are already in the graph
                    const existingNodeIds = new Set(
                        graphData.nodes.map((node) => node.id)
                    );
                    const newRecommendations = recProductIds.filter(
                        (id) => !existingNodeIds.has(id)
                    );

                    if (newRecommendations.length === 0) return;

                    // Get item details for new recommendations
                    const recommendedItems = newRecommendations
                        .map((id) => items.get(id))
                        .filter(Boolean);

                    if (recommendedItems.length === 0) return;

                    // Create new nodes for the recommendations
                    const newNodes = recommendedItems.map((item) => ({
                        id: item.product_id
                            ? item.product_id.trim()
                            : item.product_id,
                        label: item.title || `Product ${item.product_id}`,
                        level: 2, // These are one level deeper than the parent
                        type: "product",
                        parentId: selectedNode.id, // Track parent for better positioning
                        data: {
                            title: item.title,
                            description: item.description,
                            images: item.images,
                        },
                    }));

                    // Create new edges from the selected node to each recommendation
                    const newEdges = recommendedItems.map((item) => ({
                        source: selectedNode.id,
                        target: item.product_id,
                        type: showComplementary
                            ? "complementary"
                            : "substitute",
                    }));

                    // Update the graph data with new nodes and edges
                    setGraphData((prevGraphData) => ({
                        nodes: [...prevGraphData.nodes, ...newNodes],
                        edges: [...prevGraphData.edges, ...newEdges],
                    }));

                    // Also update recommendations for display in the panel
                    setRecommendations(recommendedItems);
                }
            );
        }
    }, [selectedNode, graphData.nodes, items, showComplementary]);

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

        const userRecs = recommendations
            .filter((r) => r.user_id === userId)
            .sort(
                (a, b) =>
                    parseFloat(b.predicted_rating) -
                    parseFloat(a.predicted_rating)
            )
            .slice(0, 10);

        console.log("User recommendations found:", userRecs.length);

        const nodes = [
            {
                id: `user-${userId}`,
                label: `User ${userId}`,
                level: 0,
                type: "user",
            },
        ];

        const edges = [];

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
                level: 1,
                type: "product",
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

        // Reset recommendations to the original loaded data
        // This is critical - if recommendations array is empty, new user lookups won't work
        Papa.parse("/user_recommendations.csv", {
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
                            <h3>
                                {selectedNode.type === "user"
                                    ? "User Details"
                                    : "Product Details"}
                            </h3>

                            {selectedNode.type === "product" ? (
                                <div className="product-details">
                                    <div className="detail-header">
                                        <h4>
                                            {selectedNode.data.title ||
                                                "Unknown Product"}
                                        </h4>
                                        {selectedNode.data.predictedRating && (
                                            <div className="rating-badge">
                                                {selectedNode.data.predictedRating.toFixed(
                                                    2
                                                )}
                                                <span className="rating-star">
                                                    ★
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {selectedNode.data.images && (
                                        <div className="product-image">
                                            <img
                                                src={selectedNode.data.images}
                                                alt={selectedNode.data.title}
                                            />
                                        </div>
                                    )}

                                    <div className="product-id">
                                        ID: {selectedNode.id}
                                    </div>

                                    {selectedNode.data.description && (
                                        <div className="product-description">
                                            <h5>Description</h5>
                                            <p>
                                                {processDescription(
                                                    selectedNode.data
                                                        .description
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </div>
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
