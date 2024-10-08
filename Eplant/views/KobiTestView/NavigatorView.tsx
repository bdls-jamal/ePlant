import React, { useEffect, useState } from 'react';
import { parse } from "newick-js";
import Tree from 'react-d3-tree';

interface NodeData {
  name: string;
  attributes?: {
    length?: number;
  };
  children?: NodeData[];
}

interface CustomNodeProps {
  nodeDatum: NodeData;
  toggleNode: () => void;
}

const CustomNode: React.FC<CustomNodeProps> = ({ nodeDatum, toggleNode }) => {
  // Determine if this is a leaf node
  const isLeafNode = !nodeDatum.children || nodeDatum.children.length === 0;

  return (
    <g className="node-container">
      <circle
        r={10}
        fill="#69b3a2"
        onClick={toggleNode}
      />
     
      {/* Only render text if there's a valid gene name */}
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
     
      {/* Show "Expression Data" only for leaf nodes */}
      {isLeafNode && (
        <foreignObject
          width={200}
          height={100}
          x={150}  /* Move the foreignObject to the right of the node */
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
  const [treeData, setTreeData] = useState<NodeData | null>(null);
  
  const containerStyles: React.CSSProperties = {
    width: '100%',
    height: '500px',
  };

  useEffect(() => {
    const newickData = "((AT3G24650:0.54188,((Potri.002G252000.1:0.43277,VIT_07s0005g05400:0.43277):0.07324,(Medtr7g059330.1:0.40126,(Glyma.08G357600:0.09194,Glyma.18G176100:0.09194):0.30932):0.10475):0.03587):0.03552,((PGSC0003DMP400034979:0.06033,Solyc06g083600:0.06033):0.24363,(PGSC0003DMP400034841:0.09346,Solyc06g083590:0.09346):0.21050):0.27344);";
   
    try {
      const parsedTree = parse(newickData);
      const vertices = Array.from(parsedTree.graph[0]);
      const rootVertex = vertices.find(vertex =>
        !Array.from(parsedTree.graph[1]).some(arc => arc[1] === vertex)
      );

      const formatTreeData = (vertex: any): NodeData => {
        const node: NodeData = {
          name: vertex.label || vertex.name || "",  // Changed to empty string instead of "Unnamed"
          attributes: {
            length: vertex.length || 0,
          },
          children: [],
        };
       
        const childArcs = Array.from(parsedTree.graph[1])
          .filter(arc => arc[0] === vertex);
       
        if (childArcs.length === 0) {
          // For leaf nodes, extend the branch length to ensure alignment
          node.attributes!.length = Math.max(node.attributes?.length || 0, 0.6);
        }
       
        childArcs.forEach(arc => {
          const childVertex = arc[1];
          const childNode = formatTreeData(childVertex);
          node.children?.push(childNode);
        });
       
        return node;
      };

      if (rootVertex) {
        const formattedData = formatTreeData(rootVertex);
        setTreeData(formattedData);
      }
    } catch (error) {
      console.error("Error parsing Newick data:", error);
      setTreeData(null);
    }
  }, []);

  const renderCustomNode = (props: CustomNodeProps) => <CustomNode {...props} />;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Phylogenetic Tree</h2>
      {treeData ? (
        <div style={containerStyles}>
          <Tree
            data={treeData}
            orientation="horizontal"
            pathFunc="step"
            renderCustomNodeElement={renderCustomNode}
            separation={{ siblings: 2, nonSiblings: 2 }}
            nodeSize={{ x: 200, y: 60 }}  // Increased nodeSize x for better spacing
            translate={{ x: 100, y: 200 }}
            enableLegacyTransitions={false}
          />
        </div>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

export default NavigatorView;
