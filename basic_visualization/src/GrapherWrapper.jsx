import React, { useEffect, useRef, useState } from "react";
import Graph from "graphology";
import Sigma from "sigma";

function GrapherWrapper({ nodes, edges, onNodeClick }) {
    const containerRef = useRef(null);
    const sigmaInstanceRef = useRef(null);
    const graphRef = useRef(null);
    const [zoomRatio, setZoomRatio] = useState(2); // initial zoom ratio
    const [hoveredNode, setHoveredNode] = useState(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Separate user nodes from product nodes
        const userNodes = nodes.filter((node) => node.type === "user");
        const productNodes = nodes.filter((node) => node.type === "product");

        // Create a new graph
        const graph = new Graph();
        graphRef.current = graph;

        // Calculate coordinates using horizontal tree layout
        const coords = {};

        // Map to track node levels (distance from user node)
        const nodeLevels = {};

        // First, create a map of parents to their child nodes
        const childrenByParent = {};
        const nodesWithParent = productNodes.filter((node) => node.parentId);
        const rootProductNodes = productNodes.filter((node) => !node.parentId);

        // Track parent-child relationships
        nodesWithParent.forEach((node) => {
            if (!childrenByParent[node.parentId]) {
                childrenByParent[node.parentId] = [];
            }
            childrenByParent[node.parentId].push(node);
        });

        // Place user node as root at left side
        userNodes.forEach((node) => {
            coords[node.id] = { x: 0, y: 0 };
            nodeLevels[node.id] = 0;
        });

        // Set levels for all nodes
        rootProductNodes.forEach((node) => {
            nodeLevels[node.id] = 1;
        });

        // Determine levels for nodes with parents
        nodesWithParent.forEach((node) => {
            const parentLevel = nodeLevels[node.parentId] || 1;
            nodeLevels[node.id] = parentLevel + 1;
        });

        // Position root product nodes (direct recommendations to user)
        const xSpacing = 350; // Horizontal spacing between levels
        const ySpacing = 120; // Vertical spacing between nodes at same level

        // Organize nodes by level
        const nodesByLevel = {};
        nodes.forEach((node) => {
            const level = nodeLevels[node.id] || 0;
            if (!nodesByLevel[level]) {
                nodesByLevel[level] = [];
            }
            nodesByLevel[level].push(node);
        });

        // Position all nodes by level
        Object.entries(nodesByLevel).forEach(([level, levelNodes]) => {
            level = parseInt(level);
            const levelNodeCount = levelNodes.length;

            levelNodes.forEach((node, index) => {
                // X position is determined by level
                const x = level * xSpacing;

                // Y position centers nodes vertically within their level
                // Stagger the nodes within the level
                let y;
                if (level === 0) {
                    // Center the user node
                    y = 0;
                } else {
                    const totalHeight = (levelNodeCount - 1) * ySpacing;
                    y = -totalHeight / 2 + index * ySpacing;
                }

                coords[node.id] = { x, y };
            });
        });

        // Create a Set to track added node IDs to prevent duplicates
        const addedNodeIds = new Set();

        // Store original colors for hover effect reset
        const originalNodeColors = {};
        const originalEdgeColors = {};

        // Add nodes to the graph
        nodes.forEach((node) => {
            // Skip if node already exists in the graph
            if (addedNodeIds.has(node.id)) {
                return;
            }

            const { x, y } = coords[node.id];

            // Truncate long labels to prevent overlap
            let displayLabel = node.label;
            if (displayLabel && displayLabel.length > 12) {
                displayLabel = displayLabel.substring(0, 12) + "...";
            }

            const nodeColor = node.type === "user" ? "#4285f4" : "#34a853";

            // Store original color
            originalNodeColors[node.id] = nodeColor;

            graph.addNode(node.id, {
                label: displayLabel,
                x,
                y,
                size: node.type === "user" ? 15 : 10, // Make user node bigger
                color: nodeColor, // Different colors for user vs products
                originalColor: nodeColor, // Store original color for reset
                // Store type as nodeType instead of type to avoid Sigma errors
                nodeType: node.type,
            });

            // Mark this node as added
            addedNodeIds.add(node.id);
        });

        // Create a Set to track added edge pairs to prevent duplicate edges
        const addedEdgePairs = new Set();

        // Add edges
        edges.forEach((edge, index) => {
            // Create a unique key for this edge pair
            const edgeKey = `${edge.source}-${edge.target}`;

            // Skip if edge already exists in the graph
            if (addedEdgePairs.has(edgeKey)) {
                return;
            }

            // Set different colors based on edge type
            let edgeColor = "#dadada"; // default

            if (edge.type) {
                if (edge.type === "complementary") {
                    edgeColor = "#4caf50"; // green for complementary
                } else if (edge.type === "substitute") {
                    edgeColor = "#2196f3"; // blue for substitute
                }
            }

            // Store original color
            originalEdgeColors[edgeKey] = edgeColor;

            // Only add edge if both source and target nodes exist
            if (
                addedNodeIds.has(edge.source) &&
                addedNodeIds.has(edge.target)
            ) {
                graph.addEdge(edge.source, edge.target, {
                    size: 2,
                    color: edgeColor,
                    originalColor: edgeColor, // Store original color for reset
                    // Don't set the type property for Sigma, as it causes errors
                    // Just store our custom type as a different property for reference
                    edgeType: edge.type || "default",
                });

                // Mark this edge pair as added
                addedEdgePairs.add(edgeKey);
            }
        });

        // Initialize Sigma with the precomputed layout
        const renderer = new Sigma(graph, containerRef.current, {
            labelRenderedSizeThreshold: 1, // Only render labels for nodes above this size
            minCameraRatio: 0.2,
            maxCameraRatio: 3,
            labelFont: "Roboto, sans-serif",
            labelSize: 14,
            labelWeight: "400",
            renderLabels: true,
            labelDensity: 0.7, // Lower value means less labels rendered when zoomed out
            labelGridCellSize: 150, // Larger value means less overlap
        });

        sigmaInstanceRef.current = renderer;

        // Adjust default zoom (a higher ratio means more zoomed out)
        const camera = renderer.getCamera();
        camera.setState({
            ratio: 1.8,
            angle: 0,
        });

        // Set initial zoom ratio in state
        setZoomRatio(camera.getState().ratio);

        // Update the zoom ratio whenever the camera state changes.
        // The "updated" event is fired when the camera is changed (e.g. via zoom/pan)
        const updateZoom = () => setZoomRatio(camera.getState().ratio);
        camera.on("updated", updateZoom);

        // Listen for node clicks
        renderer.on("clickNode", (e) => {
            if (onNodeClick) onNodeClick(e.node);
        });

        // Handle hover effects
        renderer.on("enterNode", (event) => {
            const nodeId = event.node;
            setHoveredNode(nodeId);

            // Collect connected nodes (incoming and outgoing)
            const incomingNodes = new Set();
            const outgoingNodes = new Set();

            // Check for incoming edges (where hovered node is the target)
            graph.inEdges(nodeId).forEach((edgeId) => {
                const edge = graph.getEdgeAttributes(edgeId);
                const sourceId = graph.source(edgeId);
                incomingNodes.add(sourceId);

                // Color incoming edges orange
                graph.setEdgeAttribute(edgeId, "color", "#FF9800"); // Orange
            });

            // Check for outgoing edges (where hovered node is the source)
            graph.outEdges(nodeId).forEach((edgeId) => {
                const edge = graph.getEdgeAttributes(edgeId);
                const targetId = graph.target(edgeId);
                outgoingNodes.add(targetId);

                // Color outgoing edges purple
                graph.setEdgeAttribute(edgeId, "color", "#9C27B0"); // Purple
            });

            // Color all nodes
            graph.forEachNode((node) => {
                if (node === nodeId) {
                    // Keep hovered node's original color
                    return;
                } else if (incomingNodes.has(node)) {
                    // Color incoming nodes orange
                    graph.setNodeAttribute(node, "color", "#FF9800"); // Orange
                } else if (outgoingNodes.has(node)) {
                    // Color outgoing nodes purple
                    graph.setNodeAttribute(node, "color", "#9C27B0"); // Purple
                } else {
                    // Color unconnected nodes gray
                    graph.setNodeAttribute(node, "color", "#CCCCCC"); // Gray
                }
            });

            // Color edges that are not connected to the hovered node
            graph.forEachEdge((edge) => {
                const source = graph.source(edge);
                const target = graph.target(edge);

                if (source !== nodeId && target !== nodeId) {
                    // Gray out unconnected edges
                    graph.setEdgeAttribute(edge, "color", "#CCCCCC"); // Gray
                }
            });
        });

        // Reset colors when mouse leaves a node
        renderer.on("leaveNode", () => {
            setHoveredNode(null);

            // Reset all node colors to original
            graph.forEachNode((nodeId) => {
                const nodeAttrs = graph.getNodeAttributes(nodeId);
                graph.setNodeAttribute(
                    nodeId,
                    "color",
                    nodeAttrs.originalColor
                );
            });

            // Reset all edge colors to original
            graph.forEachEdge((edgeId) => {
                const edgeAttrs = graph.getEdgeAttributes(edgeId);
                graph.setEdgeAttribute(
                    edgeId,
                    "color",
                    edgeAttrs.originalColor
                );
            });
        });

        // Cleanup on unmount or update
        return () => {
            camera.off("updated", updateZoom);
            renderer.kill();
            sigmaInstanceRef.current = null;
            graphRef.current = null;
        };
    }, [nodes, edges, onNodeClick]);

    return (
        <div
            style={{ display: "flex", flexDirection: "column", width: "100%" }}
        >
            <div className="graph-controls">
                <div>Zoom level: {Math.round((1 / zoomRatio) * 100)}%</div>

                <div className="legend-container">
                    <div className="graph-legend main-legend">
                        <div className="legend-item">
                            <span
                                className="legend-color"
                                style={{ backgroundColor: "#4285f4" }}
                            ></span>
                            <span>User</span>
                        </div>
                        <div className="legend-item">
                            <span
                                className="legend-color"
                                style={{ backgroundColor: "#34a853" }}
                            ></span>
                            <span>Product</span>
                        </div>
                        <div className="legend-item">
                            <span
                                className="legend-line"
                                style={{ backgroundColor: "#4caf50" }}
                            ></span>
                            <span>Complementary</span>
                        </div>
                        <div className="legend-item">
                            <span
                                className="legend-line"
                                style={{ backgroundColor: "#2196f3" }}
                            ></span>
                            <span>Substitute</span>
                        </div>
                    </div>

                    <div className="graph-legend hover-legend">
                        <div className="legend-subheading">On Hover:</div>
                        <div className="legend-item">
                            <span
                                className="legend-color"
                                style={{ backgroundColor: "#FF9800" }}
                            ></span>
                            <span>Incoming</span>
                        </div>
                        <div className="legend-item">
                            <span
                                className="legend-color"
                                style={{ backgroundColor: "#9C27B0" }}
                            ></span>
                            <span>Outgoing</span>
                        </div>
                        <div className="legend-item">
                            <span
                                className="legend-color"
                                style={{ backgroundColor: "#CCCCCC" }}
                            ></span>
                            <span>Unconnected</span>
                        </div>
                    </div>
                </div>
            </div>
            <div
                ref={containerRef}
                style={{
                    width: "100%",
                    height: "600px", // Increased from 500px
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                    marginTop: "1rem",
                    background: "#f8f9fa",
                }}
            />
        </div>
    );
}

export default GrapherWrapper;
