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

        // Calculate coordinates using a circular layout
        const coords = {};

        // Place user node at center
        userNodes.forEach((node) => {
            coords[node.id] = { x: 0, y: 0 };
        });

        // Place product nodes in a circle around the user
        const radius = 600; // Increased radius for better spacing
        const angleStep = (2 * Math.PI) / productNodes.length;

        productNodes.forEach((node, index) => {
            const angle = index * angleStep;
            coords[node.id] = {
                x: radius * Math.cos(angle),
                y: radius * Math.sin(angle),
            };
        });

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
            graph.addEdge(edge.source, edge.target, {
                size: 2,
                color: "#dadada",
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
