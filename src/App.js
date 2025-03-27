import React, { useState } from "react";
import GrapherWrapper from "./GrapherWrapper";
import "./App.css";

function App() {
  const [userId, setUserId] = useState("");
  const [levels, setLevels] = useState(1);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);

  // --- Generate mock data for demonstration ---
  function generateMockRecommendations(userId, levels) {
    // Simple data structure:
    // user node -> recommended items (level 1)
    // recommended items -> similar items (level 2)
    // If levels > 2, you could keep expanding similarly.
    const nodes = [];
    const edges = [];
  
    // Level 0: User node
    // Add user node
    const userNodeId = `user-${userId}`;
    nodes.push({ id: userNodeId, label: `User ${userId}`, level: 0 });
  
    // Level 1: Recommended products
    // Mock recommended products for the user
    const recommendedProducts = ["ProdA", "ProdB", "ProdC"];
    recommendedProducts.forEach((prod) => {
      nodes.push({ id: prod, label: `${prod} (Recommended)`, level: 1 });
      edges.push({ source: userNodeId, target: prod });
  
      // Level 2: Similar items for each recommended product
      // If user wants more levels, show "similar" expansions
      if (levels > 1) {
        // For each recommended product, add 2 "similar" items
        const simItems = [`${prod}-Sim1`, `${prod}-Sim2`];
        simItems.forEach((sim) => {
          nodes.push({ id: sim, label: sim, level: 2 });
          edges.push({ source: prod, target: sim });
        });

        // If levels > 2, you could continue similarly
        // e.g. recommended complements, or further expansions
        // in a real scenario, you would fetch from your rec system
      }
    });
  
    return { nodes, edges };
  }
  

  // --- Form submit handler ---
  function handleSubmit(e) {
    e.preventDefault();
    if (!userId) return;

    // In real code, you'd call your backend or rec logic here:
    const data = generateMockRecommendations(userId, levels);
    setGraphData(data);
    setSelectedNode(null);
  }

  // --- Called when user clicks a node in GrapherWrapper ---
  const handleNodeClick = React.useCallback((nodeId) => {
    setSelectedNode(nodeId);
  }, []);
  

  return (
    <div className="app-container">
      <h1>Interactive Recommendation Graph</h1>

      <form onSubmit={handleSubmit}>
        <label htmlFor="userId">User ID: </label>
        <input
          id="userId"
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        />

        <label htmlFor="levels"> # of levels: </label>
        <input
          id="levels"
          type="number"
          min="1"
          value={levels}
          onChange={(e) => setLevels(Number(e.target.value))}
        />

        <button type="submit">Generate Graph</button>
      </form>

      {/* Graph display */}
      <div className="graph-section">
        <GrapherWrapper
          nodes={graphData.nodes}
          edges={graphData.edges}
          onNodeClick={handleNodeClick}
        />
      </div>

      {/* Node detail display */}
      {selectedNode && (
        <div className="detail-section">
          <h2>Node Details</h2>
          <p>You clicked on: <strong>{selectedNode}</strong></p>
        </div>
      )}
    </div>
  );
}

export default App;
