import { useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import * as d3 from "d3";

const MARGIN = { top: 60, right: 60, bottom: 60, left: 60 };
const MIN_NODE_SPACING = 100; // Minimum pixels between nodes vertically
const NEWICK_STRING = "((AT3G24650:0.54188,((Potri.002G252000.1:0.43277,VIT_07s0005g05400:0.43277):0.07324,(Medtr7g059330.1:0.40126,(Glyma.08G357600:0.09194,Glyma.18G176100:0.09194):0.30932):0.10475):0.03587):0.03552,((PGSC0003DMP400034979:0.06033,Solyc06g083600:0.06033):0.24363,(PGSC0003DMP400034841:0.09346,Solyc06g083590:0.09346):0.21050):0.27344);"; // Default Newick string
const DEFAULT_WIDTH = undefined; // Set to number for fixed width, undefined for responsive
const DEFAULT_HEIGHT = undefined; // Set to number for fixed height, undefined for responsive

interface D3Node {
  name: string;
  value?: number;
  children?: D3Node[];
}

function newickToD3(newickString: string): D3Node {
  const cleaned = newickString.trim().replace(/;$/, "");
  
  function parseNode(str: string): D3Node {
    if (!str.includes("(")) {
      const [name, lengthStr] = str.split(":");
      return {
        name: name,
        value: lengthStr ? parseFloat(lengthStr) : undefined
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

export const Dendrogram = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);

  const [dimensions, setDimensions] = useState({ 
    width: DEFAULT_WIDTH || 0, 
    height: DEFAULT_HEIGHT || 0,
    boundsWidth: 0,
    boundsHeight: 0
  });

  // Create hierarchy once
  const hierarchy = useMemo(() => {
    try {
      const d3Data = newickToD3(NEWICK_STRING);
      return d3.hierarchy(d3Data);
    } catch (error) {
      console.error("Error parsing Newick string:", error);
      return null;
    }
  }, []);

  // Calculate leaf count once
  const leafCount = useMemo(() => {
    return hierarchy?.leaves().length || 0;
  }, [hierarchy]);

  // Update dimensions when window resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;

      const containerWidth = DEFAULT_WIDTH || containerRef.current.getBoundingClientRect().width;
      const baseHeight = DEFAULT_HEIGHT || Math.max(400, containerWidth * 0.6);
      const minHeight = Math.max(
        baseHeight,
        leafCount * MIN_NODE_SPACING + MARGIN.top + MARGIN.bottom
      );

      setDimensions({
        width: containerWidth,
        height: minHeight,
        boundsWidth: containerWidth - MARGIN.right - MARGIN.left,
        boundsHeight: minHeight - MARGIN.top - MARGIN.bottom
      });
    };

    updateDimensions();
    if (!DEFAULT_WIDTH || !DEFAULT_HEIGHT) {
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [leafCount]);

  // Create the dendrogram layout
  const dendrogram = useMemo(() => {
    if (!dimensions.boundsHeight || !dimensions.boundsWidth || !hierarchy) return null;

    const dendrogramGenerator = d3
      .cluster<D3Node>()
      .size([dimensions.boundsHeight, dimensions.boundsWidth]);

    const root = dendrogramGenerator(hierarchy);
    return root;
  }, [hierarchy, dimensions.boundsWidth, dimensions.boundsHeight]);

  // Setup zoom behavior
  useEffect(() => {
    if (!svgRef.current || !gRef.current || !dimensions.width) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const setZoomBounds = (transform: d3.ZoomTransform) => {
      const padding = 100;
      const xMin = -(dimensions.width * transform.k - padding);
      const xMax = padding;
      const yMin = -(dimensions.height * transform.k - padding);
      const yMax = padding;

      return transform.translate(
        Math.min(xMax, Math.max(xMin, transform.x)),
        Math.min(yMax, Math.max(yMin, transform.y))
      );
    };

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on("zoom", (event) => {
        const constrainedTransform = setZoomBounds(event.transform);
        g.attr("transform", constrainedTransform.toString());
      });

    svg.call(zoom);

    svg.on("dblclick.zoom", () => {
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(MARGIN.left, MARGIN.top));
    });

    svg.call(zoom.transform, d3.zoomIdentity.translate(MARGIN.left, MARGIN.top));

    return () => {
      svg.on(".zoom", null);
    };
  }, [dimensions]);

  const rightAngledLinkGenerator = (source: any, target: any) => {
    const sourceX = source.x;
    const sourceY = source.y;
    const targetX = target.x;
    const targetY = target.y;
    
    const offset = Math.abs(targetY - sourceY) * 0.5;
    return `M${sourceY},${sourceX}
            L${sourceY + offset},${sourceX}
            L${sourceY + offset},${targetX}
            L${targetY},${targetX}`;
  };

  // Error handling for invalid Newick string
  if (!hierarchy) {
    return (
      <div className="error-message">
        Invalid Newick format. Please check the input string.
      </div>
    );
  }

  // Loading state
  if (!dimensions.width || !dendrogram) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    );
  }

  const allNodes = dendrogram.descendants().map((node) => (
    <g key={node.data.name} className="node">
      <circle
        cx={node.y}
        cy={node.x}
        r={5}
        stroke="transparent"
        fill="#69b3a2"
      />
      {!node.children && (
        <text
          x={node.y + 15}
          y={node.x}
          fontSize={12}
          textAnchor="start"
          dominantBaseline="middle"
        >
          {node.data.name}
        </text>
      )}
    </g>
  ));

  const allEdges = dendrogram.links().map((link) => (
    <path
      key={`${link.source.data.name}-${link.target.data.name}`}
      fill="none"
      stroke="grey"
      d={rightAngledLinkGenerator(link.source, link.target)}
    />
  ));

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: DEFAULT_WIDTH || '100%', 
        height: DEFAULT_HEIGHT || '100%',
        border: "1px solid #ccc", 
        borderRadius: "8px",
        overflow: 'hidden'
      }}
    >
      <svg 
        ref={svgRef}
        width={dimensions.width} 
        height={dimensions.height}
        style={{ cursor: "grab" }}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g ref={gRef}>
          {allEdges}
          {allNodes}
        </g>
      </svg>
    </div>
  );
};

export default Dendrogram;