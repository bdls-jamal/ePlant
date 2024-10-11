import React, { useEffect, useMemo, useState } from 'react';
import { parse } from "newick-js";
import Tree from 'react-d3-tree';

interface NodeData {
  name: string;
  attributes?: {
    length?: number;
    depth?: number;
  };
  children?: NodeData[];
}

interface CustomNodeProps {
  nodeDatum: NodeData;
  toggleNode: () => void;
}

const CustomNode: React.FC<CustomNodeProps> = ({ nodeDatum, toggleNode }) => {
  const isLeafNode = !nodeDatum.children || nodeDatum.children.length === 0;

  return (
    <g className="node-container">
      <circle
        r={10}
        fill={isLeafNode ? "#69b3a2" : "#4a5568"}
        onClick={toggleNode}
      />
      {nodeDatum.name && nodeDatum.name !== "Unnamed" && (
        <text
          dy=".31em"
          x={15}
          textAnchor="start"
          className="text-sm fill-current"
          style={{ fontFamily: 'Arial' }}
        >
          {nodeDatum.name}
        </text>
      )}
      {isLeafNode && (
        <foreignObject
          width={200}
          height={100}
          x={150}
          y={-10}
        >
          <div className="node-extension">
            <div className="bg-gray-100 p-2 rounded shadow-sm">
              Expression Data
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
};

const NavigatorView = () => {

  const [treeData, setTreeData] = useState<NodeData>();

  const drawStepPath = (linkData: any, orientation: any) => {
    const { source, target } = linkData;
    const deltaY = target.y - source.y;
    return orientation === 'horizontal'
      ? `M${source.y},${source.x} H${source.y + deltaY / 2} V${target.x} H${target.y}`
      : `M${source.x},${source.y} V${source.y + deltaY / 2} H${target.x} V${target.y}`;
  }; 

  const alignLeafNodes = (node: NodeData, depth: number, maxDepth: number) => {
    // If it's a leaf node, set its y position to max depth.
    if (!node.children || node.children.length === 0) {
      node.attributes = { ...node.attributes, depth: maxDepth };
    } else {
      // For non-leaf nodes, recurse for each child.
      node.children.forEach(child => alignLeafNodes(child, depth + 1, maxDepth));
    }
  };

  useEffect(() => {
    const newickData = "((AT3G24650:0.54188,((Potri.002G252000.1:0.43277,VIT_07s0005g05400:0.43277):0.07324,(Medtr7g059330.1:0.40126,(Glyma.08G357600:0.09194,Glyma.18G176100:0.09194):0.30932):0.10475):0.03587):0.03552,((PGSC0003DMP400034979:0.06033,Solyc06g083600:0.06033):0.24363,(PGSC0003DMP400034841:0.09346,Solyc06g083590:0.09346):0.21050):0.27344);";
   
    try {
      const parsedTree = parse(newickData);
      const vertices = Array.from(parsedTree.graph[0]);
      const rootVertex = vertices.find(vertex =>
        !Array.from(parsedTree.graph[1]).some(arc => arc[1] === vertex)
      );
  
      const formatTreeData = (vertex: any, depth = 0): NodeData => {
        const childArcs = Array.from(parsedTree.graph[1])
          .filter(arc => arc[0] === vertex);
        
        const node: NodeData = {
          name: vertex.label || vertex.name || "",
          attributes: {
            length: vertex.length || 1,
            depth,
          },
          children: [],
        };
  
        node.children = childArcs.map(arc => formatTreeData(arc[1], depth + 1));
        return node;
      };
  
      if (rootVertex) {
        const formattedData = formatTreeData(rootVertex);
        if (formattedData && formattedData.children) {
          const maxDepth = Math.max(...formattedData.children.map(child => child.attributes?.depth || 0));
          alignLeafNodes(formattedData, 0, maxDepth);
          setTreeData(formattedData);
        }
      }
    } catch (error) {
      console.error("Error parsing Newick data:", error);
    }
  }, []);

  const renderCustomNode = (props: CustomNodeProps) => <CustomNode {...props} />;

  return (
    <div className="w-full h-screen">
      <h2 className="text-xl font-bold mb-4">Phylogenetic Tree</h2>
      <div 
        className="w-full" 
        style={{ 
          height: 'calc(100vh - 4rem)',
          border: '1px solid #e5e7eb'
        }}
      >
        {treeData && (
          <Tree
            data={treeData}
            orientation="horizontal"
            pathFunc={drawStepPath}
            renderCustomNodeElement={renderCustomNode}
            separation={{ siblings: 2, nonSiblings: 2.5 }}
            nodeSize={{ x: 300, y: 80 }}
            translate={{ x: 150, y: 300 }}
            scaleExtent={{ min: 0.1, max: 2 }}
            enableLegacyTransitions={false}
            collapsible={true}
            zoomable={true}
            draggable={true}
          />
        )}
      </div>
    </div>
  );
};

export default NavigatorView;