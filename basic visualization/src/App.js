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

  useEffect(() => {
    // Load recommendations data
    Papa.parse("/user_recommendations.csv", {
      download: true,
      header: true,
      dynamicTyping: true,
      complete: (results) => {
        setRecommendations(results.data);
        
        // Load product info data
        Papa.parse("/sample_item_info.csv", {
          download: true,
          header: true,
          dynamicTyping: true,
          complete: (itemResults) => {
            console.log(itemResults.data);
            const itemsMap = new Map(
              itemResults.data.map(item => [item.product_id, item])
            );
            console.log(itemsMap);
            setItems(itemsMap);
            setIsLoading(false);
          },
          error: (err) => {
            console.error("Error loading items:", err);
            setIsLoading(false);
          }
        });
      },
      error: (err) => {
        console.error("Error loading recommendations:", err);
        setIsLoading(false);
      }
    });
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userId) return;

    const userRecs = recommendations
      .filter(r => r.user_id === userId)
      .sort((a, b) => b.predicted_rating - a.predicted_rating)
      .slice(0, 10);

    const nodes = [
      { 
        id: `user-${userId}`, 
        label: `User ${userId}`, 
        level: 0,
        type: 'user'
      }
    ];
    
    const edges = [];
    
    userRecs.forEach(rec => {
      nodes.push({
        id: rec.product_id,
        label: `${rec.product_id}`,
        level: 1,
        type: 'product',
        data: {
          predictedRating: rec.predicted_rating
        }
      });
      edges.push({
        source: `user-${userId}`,
        target: rec.product_id
      });
    });

    setGraphData({ nodes, edges });
    setSelectedNode(null);
  };

  const handleNodeClick = useCallback((nodeId) => {
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const itemKey = String(nodeId);
    const itemData = items.get(itemKey);

    console.log('Selected product data for', itemKey, ':', itemData);

    if (node.type === 'product') {
      console.log(node.id);
      console.log(items.get("B093TH4WM6"));
      // const itemData = items.get(node.id);
      console.log('Selected product data:', itemData);
      console.log('All items map:', items);
    }
    
    setSelectedNode({
      id: nodeId,
      type: node.type,
      data: {
        ...(itemData || {}),
        ...(node.data || {})
      }
    });
  }, [graphData.nodes, items]);

  return (
    <div className="app-container">
      <h1>Recommendation Explorer</h1>
      
      {isLoading ? (
        <div className="loading">Loading data...</div>
      ) : (
        <form onSubmit={handleSubmit} className="control-panel">
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter User ID"
            required
          />
          <button type="submit">Show Recommendations</button>
        </form>
      )}

      <div className="visualization-section">
        <GrapherWrapper
          nodes={graphData.nodes}
          edges={graphData.edges}
          onNodeClick={handleNodeClick}
        />
        
        {selectedNode && (
          <div className="node-details">
            <h3>Node Details</h3>
            <p><strong>ID:</strong> {selectedNode.id}</p>
            
            {selectedNode.type === 'product' && (
              <>
                <p><strong>Title:</strong> {
                  items.get(selectedNode.id)?.title || 'Title not available'
                }</p>
                <p><strong>Predicted Rating:</strong> {
                  selectedNode.data.predictedRating?.toFixed(2) || 'N/A'
                }</p>
              </>
            )}
            
            {selectedNode.type === 'user' && (
              <p><strong>Type:</strong> User</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;