import React, { useEffect, useRef, useState } from "react";
import Graph from "graphology";
import Sigma from "sigma";

function GrapherWrapper({ nodes, edges, onNodeClick }) {
  const containerRef = useRef(null);
  const sigmaInstanceRef = useRef(null);
  const [zoomRatio, setZoomRatio] = useState(2); // initial zoom ratio

  useEffect(() => {
    if (!containerRef.current) return;

    // Group nodes by level
    const nodesByLevel = {};
    nodes.forEach((node) => {
      const lvl = node.level || 0;
      if (!nodesByLevel[lvl]) nodesByLevel[lvl] = [];
      nodesByLevel[lvl].push(node);
    });

    // Sort levels (0, 1, 2, …)
    const levelKeys = Object.keys(nodesByLevel).sort((a, b) => a - b);

    // Define default spacings. Adjust these values as needed.
    const defaultHorizontalSpacing = 100;
    const spacingByLevel = {
      0: 0,    // User node (centered)
      1: 300,  // Recommended products
      2: 200,  // Similar items
    };

    const verticalSpacing = 100; // Define vertical spacing

    // Calculate coordinates for each node based on its level
    const coords = {};
    levelKeys.forEach((lvlStr) => {
      const lvl = parseInt(lvlStr, 10);
      const levelNodes = nodesByLevel[lvl];
      const count = levelNodes.length;
      const spacing = spacingByLevel[lvl] || defaultHorizontalSpacing;
      // Center nodes for this level: starting x position
      const startX = -((count - 1) / 2) * spacing;
      levelNodes.forEach((node, index) => {
        coords[node.id] = {
          x: startX + index * spacing,
          y: -lvl * verticalSpacing, // Level 0: y=0; level 1: y=-verticalSpacing; etc.
        };
      });
    });

    // Create a new graph
    const graph = new Graph();
    nodes.forEach((node) => {
      const { x, y } = coords[node.id];
      graph.addNode(node.id, {
        label: node.label,
        x,
        y,
        size: 8,
      });
    });

    // Add edges
    edges.forEach((edge, index) => {
      graph.addEdge(edge.source, edge.target, {
        label: `Edge ${index}`,
      });
    });

    // Initialize Sigma with the precomputed layout
    const renderer = new Sigma(graph, containerRef.current);
    sigmaInstanceRef.current = renderer;

    // Adjust default zoom (a higher ratio means more zoomed out)
    const camera = renderer.getCamera();
    camera.setState({
      ratio: 1.6,
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
    <div style={{ display: "flex" }}>
      <div
        ref={containerRef}
        style={{
          width: "100vw", // adjust width as needed
          height: "500px",
          border: "1px solid #ccc",
          marginTop: "1rem",
        }}
      />
    </div>
  );
}

export default GrapherWrapper;
