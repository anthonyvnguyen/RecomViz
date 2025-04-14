import React, { useEffect, useRef, useState } from "react";
import Graph from "graphology";
import Sigma from "sigma";

function GrapherWrapper({ nodes, edges, onNodeClick }) {
    const containerRef = useRef(null);
    const sigmaInstanceRef = useRef(null);
    const [zoomRatio, setZoomRatio] = useState(2); // initial zoom ratio

    useEffect(() => {
        if (!containerRef.current) return;

        // Separate user nodes from product nodes
        const userNodes = nodes.filter((node) => node.type === "user");
        const productNodes = nodes.filter((node) => node.type === "product");

        // Create a new graph
        const graph = new Graph();

        // Calculate coordinates using a more intelligent layout that reduces crossings
        const coords = {};

        // Place user node at center
        userNodes.forEach((node) => {
            coords[node.id] = { x: 0, y: 0 };
        });

        // First, create a map of parents to their child nodes
        const childrenByParent = {};
        const nodesWithParent = productNodes.filter((node) => node.parentId);
        const rootProductNodes = productNodes.filter((node) => !node.parentId);

        // Create a map to track node levels (distance from user node)
        const nodeLevels = {};
        rootProductNodes.forEach((node) => (nodeLevels[node.id] = 1));

        // Identify parent-child relationships and determine true node levels
        nodesWithParent.forEach((node) => {
            if (!childrenByParent[node.parentId]) {
                childrenByParent[node.parentId] = [];
            }
            childrenByParent[node.parentId].push(node);

            // Calculate level based on parent's level
            const parentLevel = nodeLevels[node.parentId] || 1;
            nodeLevels[node.id] = parentLevel + 1;
        });

        // Position the first level of product nodes in a circle
        const baseRadius = 350;
        let angleStep =
            rootProductNodes.length > 0
                ? (2 * Math.PI) / rootProductNodes.length
                : 0;

        rootProductNodes.forEach((node, index) => {
            const angle = index * angleStep;
            coords[node.id] = {
                x: baseRadius * Math.cos(angle),
                y: baseRadius * Math.sin(angle),
            };
        });

        // Process children level by level to ensure proper spacing
        const maxLevel = Math.max(...Object.values(nodeLevels), 1);
        for (let level = 2; level <= maxLevel; level++) {
            // Get all nodes at this level
            const nodesAtLevel = Object.entries(nodeLevels)
                .filter(([id, nodeLevel]) => nodeLevel === level)
                .map(([id]) => id);

            // Position each node based on its parent
            nodesAtLevel.forEach((nodeId) => {
                const node = nodesWithParent.find((n) => n.id === nodeId);
                if (!node || !coords[node.parentId]) return;

                const parentX = coords[node.parentId].x;
                const parentY = coords[node.parentId].y;

                // Get distance from parent to center
                const parentDistFromCenter = Math.sqrt(
                    parentX * parentX + parentY * parentY
                );

                // Calculate the angle from parent to center
                const parentAngle = Math.atan2(parentY, parentX);

                // Get siblings (nodes with same parent)
                const siblings = childrenByParent[node.parentId] || [];
                const siblingIndex = siblings.findIndex((s) => s.id === nodeId);

                // Make the fan angle narrower as we move outward (prevents overlaps)
                // Scale down by level to make outer levels have a smaller angular spread
                const fanAngleScale = Math.max(0.3, 1 - (level - 1) * 0.15);
                const fanAngleRange = ((Math.PI * 2) / 3) * fanAngleScale;

                // Scale radius up by level to space out levels
                const radiusScale = 1 + (level - 1) * 0.4; // Each level increases spacing by 40%
                const childRadius = 250 * radiusScale;

                // Position the child
                let childAngle;
                if (siblings.length === 1) {
                    childAngle = parentAngle; // directly on line from center through parent
                } else {
                    const childAngleStep =
                        siblings.length > 1
                            ? fanAngleRange / (siblings.length - 1)
                            : 0;
                    childAngle =
                        parentAngle -
                        fanAngleRange / 2 +
                        siblingIndex * childAngleStep;
                }

                // Calculate position to ensure we're moving outward from center
                coords[nodeId] = {
                    x: parentX + childRadius * Math.cos(childAngle),
                    y: parentY + childRadius * Math.sin(childAngle),
                };
            });
        }

        // Add nodes to the graph
        nodes.forEach((node) => {
            const { x, y } = coords[node.id];

            // Truncate long labels to prevent overlap
            let displayLabel = node.label;
            if (displayLabel && displayLabel.length > 12) {
                displayLabel = displayLabel.substring(0, 12) + "...";
            }

            graph.addNode(node.id, {
                label: displayLabel,
                x,
                y,
                size: node.type === "user" ? 15 : 10, // Make user node bigger
                color: node.type === "user" ? "#4285f4" : "#34a853", // Different colors for user vs products
                // Store type as nodeType instead of type to avoid Sigma errors
                nodeType: node.type,
            });
        });

        // Add edges
        edges.forEach((edge, index) => {
            // Set different colors based on edge type
            let edgeColor = "#dadada"; // default

            if (edge.type) {
                if (edge.type === "complementary") {
                    edgeColor = "#4caf50"; // green for complementary
                } else if (edge.type === "substitute") {
                    edgeColor = "#2196f3"; // blue for substitute
                }
            }

            graph.addEdge(edge.source, edge.target, {
                size: 2,
                color: edgeColor,
                // Don't set the type property for Sigma, as it causes errors
                // Just store our custom type as a different property for reference
                edgeType: edge.type || "default",
            });
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

        // Cleanup on unmount or update
        return () => {
            camera.off("updated", updateZoom);
            renderer.kill();
            sigmaInstanceRef.current = null;
        };
    }, [nodes, edges, onNodeClick]);

    return (
        <div
            style={{ display: "flex", flexDirection: "column", width: "100%" }}
        >
            <div className="graph-controls">
                <div>Zoom level: {Math.round((1 / zoomRatio) * 100)}%</div>

                <div className="graph-legend">
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
