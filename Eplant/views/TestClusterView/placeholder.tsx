import { useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import * as d3 from "d3";

const MARGIN = { top: 50, right: 400, bottom: 50, left: 50 };
const MIN_NODE_SPACING = 30;
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 600;

// Constants for visualization
const BAR_WIDTH = 100;
const BAR_HEIGHT = 12;
const BAR_SPACING = 2;
const LABEL_OFFSET = 10;
const NODE_RADIUS = 4;

const DEFAULT_API_URL = 'https://bar.utoronto.ca/webservices/eplant_navigator/cgi-bin/eplant_navigator_service.cgi?primaryGene=AT3G24650&species=Arabidopsis&dataset=Developmental&checkedspecies=arabidopsis_poplar_medicago_soybean_rice_barley_maize_potato_tomato_grape';

function extractPrimaryGene(url: string): string {
  const match = url.match(/primaryGene=([^&]+)/);
  return match ? match[1] : "";
}

interface TreeData {
  tree: string;
  efp_links: Record<string, string>;
  genomes: Record<string, string>;
  SCC_values: Record<string, number>;
  sequence_similarity: Record<string, number>;
  maximum_values: Record<string, number>;
}

interface D3Node {
  name: string;
  value?: number;
  children?: D3Node[];
  metadata?: {
    genome?: string;
    scc_value?: number;
    sequence_similarity?: number;
    efp_link?: string;
  };
}

// Convert newick format data into D3 applicable data
function newickToD3(newickString: string, metadata: TreeData): D3Node {
  const cleaned = newickString.trim().replace(/;$/, "");
  
  function parseNode(str: string): D3Node {
    if (!str.includes("(")) {
      const [name, lengthStr] = str.split(":");
      const cleanName = name.trim();
      const upperName = cleanName.toUpperCase();
      
      return {
        name: cleanName,
        value: lengthStr ? parseFloat(lengthStr) : undefined,
        metadata: {
          genome: metadata.genomes[upperName],
          scc_value: metadata.SCC_values[upperName],
          sequence_similarity: metadata.sequence_similarity[upperName],
          efp_link: metadata.efp_links[upperName]
        }
      };
    }

    const matches = str.match(/\((.*)\)(.*)/);
    if (!matches) throw new Error("Invalid Newick format");
    
    const [_, childrenStr, remainingStr] = matches;
    const children: D3Node[] = [];
    let buffer = "";
    let parenthesesCount = 0;

    for (const char of childrenStr) {
      if (char === "(") parenthesesCount++;
      if (char === ")") parenthesesCount--;
      if (char === "," && parenthesesCount === 0) {
        children.push(parseNode(buffer.trim()));
        buffer = "";
      } else {
        buffer += char;
      }
    }
    if (buffer.trim()) children.push(parseNode(buffer.trim()));

    const [name, lengthStr] = remainingStr.split(":");
    
    return {
      name: name || "internal",
      value: lengthStr ? parseFloat(lengthStr) : undefined,
      children
    };
  }

  return parseNode(cleaned);
}

const MetadataVisualizations = ({ 
  x, 
  y, 
  metadata,
  isPrimaryGene
}: { 
  x: number; 
  y: number; 
  metadata: D3Node['metadata'];
  isPrimaryGene: boolean;
}) => {
  if (!metadata) return null;

  const sequenceSimilarity = Math.min(isPrimaryGene ? 1 : (metadata.sequence_similarity || 0), 1);
  const expressionLevel = Math.min(isPrimaryGene ? 1 : (metadata.scc_value || 0), 1);

  return (
    <g transform={`translate(${x + LABEL_OFFSET + 100}, ${y - BAR_HEIGHT - BAR_SPACING})`}>
      <g transform={`translate(0, ${BAR_HEIGHT + BAR_SPACING})`}>
        <rect
          x={0}
          y={0}
          width={BAR_WIDTH}
          height={BAR_HEIGHT}
          fill="#e0e0e0"
          stroke="#999"
          strokeWidth={0.5}
        />
        <rect
          x={BAR_WIDTH / 2}
          y={0}
          width={(BAR_WIDTH / 2) * expressionLevel}
          height={BAR_HEIGHT}
          fill="#000000"
        />
        <line
          x1={BAR_WIDTH / 2}
          y1={-1}
          x2={BAR_WIDTH / 2}
          y2={BAR_HEIGHT + 1}
          stroke="red"
          strokeWidth={1}
        />
      </g>
    </g>
  );
};

export const Dendrogram = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string>(DEFAULT_API_URL);
  const [primaryGene, setPrimaryGene] = useState<string>(extractPrimaryGene(DEFAULT_API_URL));
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  const [dimensions, setDimensions] = useState({ 
    width: DEFAULT_WIDTH, 
    height: DEFAULT_HEIGHT,
    boundsWidth: DEFAULT_WIDTH - MARGIN.left - MARGIN.right,
    boundsHeight: DEFAULT_HEIGHT - MARGIN.top - MARGIN.bottom
  });

  useEffect(() => {
    setPrimaryGene(extractPrimaryGene(apiUrl));
  }, [apiUrl]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        if (data.status === "success") {
          setTreeData(data);
          setError(null);
        } else {
          setError("Failed to load tree data");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      }
    };
    fetchData();
  }, [apiUrl]);

  const hierarchy = useMemo(() => {
    if (!treeData) return null;
    try {
      const d3Data = newickToD3(treeData.tree, treeData);
      return d3.hierarchy(d3Data);
    } catch (error) {
      console.error("Error parsing Newick string:", error);
      return null;
    }
  }, [treeData]);

  const dendrogram = useMemo(() => {
    if (!dimensions.boundsHeight || !dimensions.boundsWidth || !hierarchy) return null;

    const dendrogramGenerator = d3
      .cluster<D3Node>()
      .size([dimensions.boundsHeight * 0.8, dimensions.boundsWidth * 0.4]);

    return dendrogramGenerator(hierarchy);
  }, [hierarchy, dimensions.boundsWidth, dimensions.boundsHeight]);

  const rightAngledLinkGenerator = (source: any, target: any) => {
    const sourceX = source.x;
    const sourceY = source.y;
    const targetX = target.x;
    const targetY = target.y;
    
    const midY = (sourceY + targetY) / 2;
    return `M${sourceY},${sourceX}
            L${midY},${sourceX}
            L${midY},${targetX}
            L${targetY},${targetX}`;
  };

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  if (!treeData || !hierarchy || !dimensions.width || !dendrogram) {
    return (
      <div ref={containerRef} style={{ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }}>
        Loading...
      </div>
    );
  }

  const allNodes = dendrogram.descendants().map((node) => {
    const isPrimaryGene = node.data.name === primaryGene;
    return (
      <g key={node.data.name} className="node">
        <circle
          cx={node.y}
          cy={node.x}
          r={NODE_RADIUS}
          fill={isPrimaryGene ? "#000000" : "#69b3a2"}
          stroke="none"
        />
        {!node.children && (
          <>
            <text
              x={node.y + LABEL_OFFSET}
              y={node.x}
              fontSize={12}
              textAnchor="start"
              dominantBaseline="middle"
              fontWeight={isPrimaryGene ? "bold" : "normal"}
            >
              {`${node.data.name}${node.data.metadata?.genome ? ` (${node.data.metadata.genome})` : ''}`}
            </text>
            <MetadataVisualizations
              x={node.y + LABEL_OFFSET * 20}
              y={node.x - 10}
              metadata={node.data.metadata}
              isPrimaryGene={isPrimaryGene}
            />
          </>
        )}
      </g>
    );
  });

  const allEdges = dendrogram.links().map((link) => (
    <path
      key={`${link.source.data.name}-${link.target.data.name}`}
      fill="none"
      stroke="#999"
      strokeWidth={1}
      d={rightAngledLinkGenerator(link.source, link.target)}
    />
  ));

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        overflow: 'hidden'
      }}
    >
      <svg 
        ref={svgRef}
        width={dimensions.width} 
        height={dimensions.height}
        style={{ cursor: "grab", backgroundColor: '#ffffff' }}
      >
        <g 
          ref={gRef}
          transform={`translate(${MARGIN.left}, ${MARGIN.top}) scale(${transform.k}) translate(${transform.x}, ${transform.y})`}
        >
          {allEdges}
          {allNodes}
        </g>
      </svg>
    </div>
  );
};

export default Dendrogram;