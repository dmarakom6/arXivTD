"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

interface CitationGraphProps {
  data: {
    source: {
      id: string;
      title: string;
      year: number;
      citation_count: number;
    };
    nodes: Array<{
      id: string;
      title: string;
      year: number;
      citation_count: number;
      is_source: boolean;
      node_type?: string;
    }>;
    edges: Array<{
      source: string;
      target: string;
      type: string;
    }>;
  };
  primaryColor?: string;
  scannedPaperTitle?: string;
}

interface ExpandedNodeData {
  id: string;
  title: string;
  year: number | null;
  citation_count: number;
  node_type?: string;
}

export function CitationGraph({ data, primaryColor = "#8B1538", scannedPaperTitle }: CitationGraphProps) {
  const { nodes: graphNodes, edges: graphEdges, source } = data;
  const [expandedNodes, setExpandedNodes] = useState<Map<string, ExpandedNodeData[]>>(new Map());
  const [expandingNode, setExpandingNode] = useState<string | null>(null);
  const [allNodes, setAllNodes] = useState(graphNodes);
  const [allEdges, setAllEdges] = useState(graphEdges);

  useEffect(() => {
    setAllNodes(graphNodes);
    setAllEdges(graphEdges);
  }, [graphNodes, graphEdges]);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [allNodes, allEdges, expandedNodes]);

  const getNodePosition = useCallback((nodeId: string, isExpanded: boolean, expandedIndex: number = 0) => {
    const xSpacing = 280;
    const ySpacing = 80;
    
    if (nodeId === source.id) {
      return { x: xSpacing, y: 0 };
    }

    const isExpandedNode = expandedNodes.has(nodeId);
    if (isExpandedNode) {
      const expandedData = expandedNodes.get(nodeId) || [];
      const idx = expandedData.findIndex((_, i) => i === expandedIndex);
      return { x: xSpacing * 1.5, y: 300 + idx * ySpacing };
    }

    const isReference = allEdges.some(e => e.source === source.id && e.target === nodeId);
    const isCitation = allEdges.some(e => e.source === nodeId && e.target === source.id);
    const isRelated = allEdges.some(e => e.source === source.id && e.type === "related" && e.target === nodeId);
    
    const baseNodes = graphNodes.filter(n => n.id !== source.id);
    const refNodes = baseNodes.filter(n => allEdges.some(e => e.source === source.id && e.target === n.id && e.type === "reference"));
    const citNodes = baseNodes.filter(n => allEdges.some(e => e.target === source.id && e.source === n.id && e.type === "citation"));
    const relNodes = baseNodes.filter(n => allEdges.some(e => e.source === source.id && e.target === n.id && e.type === "related"));
    
    if (isReference) {
      const idx = refNodes.findIndex(n => n.id === nodeId);
      return { x: 0, y: 100 + idx * ySpacing };
    }
    
    if (isCitation) {
      const idx = citNodes.findIndex(n => n.id === nodeId);
      return { x: xSpacing * 2, y: 100 + idx * ySpacing };
    }
    
    if (isRelated) {
      const idx = relNodes.findIndex(n => n.id === nodeId);
      return { x: xSpacing, y: 100 + idx * ySpacing };
    }
    
    return { x: 0, y: 100 };
  }, [source.id, allEdges, graphNodes, expandedNodes]);

  const handleNodeClick = useCallback(async (event: React.MouseEvent, node: Node) => {
    console.log("Node clicked:", node.id, node.data?.label);
    
    if (node.id === source.id) return;
    if (expandedNodes.has(node.id)) {
      console.log("Node already expanded:", node.id);
      return;
    }
    if (expandingNode) {
      console.log("Already expanding another node");
      return;
    }

    setExpandingNode(node.id);

    try {
      const { fetchApi, keysApi } = await import("@/lib/api");
      
      const keys = await keysApi.list();
      if (keys.length === 0) {
        console.error("No API keys available");
        setExpandingNode(null);
        return;
      }
      
      const revealedKey = await keysApi.reveal(keys[0].id);
      if (!revealedKey.key) {
        console.error("Failed to reveal API key");
        setExpandingNode(null);
        return;
      }

      console.log("Fetching graph for node:", node.id);
      const response = await fetchApi<typeof data>(`/graph/id/${node.id}?max_nodes=10`, {
        method: "GET",
        headers: { "X-API-Key": revealedKey.key },
      });
      
      console.log("Graph response:", response);

      if (response.nodes && response.nodes.length > 1) {
        const newNodes = response.nodes.filter(n => n.id !== node.id).map(n => ({
          ...n,
          is_source: false,
        }));
        const newEdges = response.edges.map((e, i) => ({
          id: `e-${node.id}-${i}`,
          source: e.source,
          target: e.target,
          type: "smoothstep" as const,
        }));

        console.log("Adding", newNodes.length, "new nodes");

        setExpandedNodes(prev => {
          const updated = new Map(prev);
          updated.set(node.id, newNodes);
          return updated;
        });

        setAllNodes(prev => [...prev, ...newNodes]);
        setAllEdges(prev => [...prev, ...newEdges]);
      } else {
        console.log("No new nodes to add");
      }
    } catch (err) {
      console.error("Failed to expand node:", err);
    } finally {
      setExpandingNode(null);
    }
  }, [source.id, expandedNodes, expandingNode]);

  const initialNodes: Node[] = useMemo(() => {
    return allNodes.map((node) => {
      const expandedData = expandedNodes.get(node.id);
      const isExpanded = !!expandedData;
      const isExpandable = node.id !== source.id && !expandedNodes.has(node.id);
      const pos = getNodePosition(node.id, isExpanded, 0);

      return {
        id: node.id,
        position: pos,
        data: {
          label: (
            <div className="text-center p-2 max-w-[220px]">
              <div className="font-medium text-xs truncate" title={node.title}>{node.title}</div>
              <div className="text-[10px] text-gray-500 flex items-center justify-center gap-1">
                <span>{node.year || "N/A"}</span>
                <span>•</span>
                <span>{node.citation_count} citations</span>
                {isExpandable && <span className="text-[var(--primary)] ml-1">↦</span>}
                {isExpanded && <span className="text-green-600 ml-1">✓</span>}
              </div>
            </div>
          ),
        },
        style: {
          background: node.id === source.id ? primaryColor : "#fff",
          color: node.id === source.id ? "#fff" : "#000",
          border: node.id === source.id ? `2px solid ${primaryColor}` : "1px solid #ddd",
          borderRadius: "8px",
          padding: "8px",
          width: 200,
          cursor: isExpandable ? "pointer" : "default",
        },
      };
    });
  }, [allNodes, source.id, primaryColor, expandedNodes, getNodePosition]);

  const initialEdges: Edge[] = useMemo(() => {
    return allEdges.map((edge, i) => ({
      id: `e-${i}`,
      source: edge.source,
      target: edge.target,
      animated: edge.source === source.id,
      style: { stroke: primaryColor },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: primaryColor,
      },
    }));
  }, [allEdges, source.id, primaryColor]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const nodesWithCorrectSource = useMemo(() => {
    if (!scannedPaperTitle) return nodes;
    return nodes.map(node => {
      if (node.id === source.id) {
        return {
          ...node,
          data: {
            label: (
              <div className="text-center p-2 max-w-[220px]">
                <div className="font-medium text-xs truncate" title={scannedPaperTitle}>{scannedPaperTitle}</div>
                <div className="text-[10px] text-gray-200">
                  {source.year || "N/A"} • {source.citation_count > 0 ? `${source.citation_count} citations` : allEdges.length > 0 ? "linked papers" : "no citations"}
                </div>
              </div>
            ),
          },
        };
      }
      return node;
    });
  }, [nodes, source.id, scannedPaperTitle, source.year, source.citation_count]);

  return (
    <div className="w-full h-[500px] border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
      <ReactFlow
        nodes={nodesWithCorrectSource}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#ccc" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => node.id === source.id ? primaryColor : "#fff"}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}