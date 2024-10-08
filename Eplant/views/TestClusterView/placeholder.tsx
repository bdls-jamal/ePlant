import { useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import * as d3 from "d3";

import { data } from "./data";
import { Tree } from "./data";

const MARGIN = { top: 60, right: 60, bottom: 60, left: 60 };
const MIN_NODE_SPACING = 100; // Minimum pixels between nodes vertically

export const Dendrogram = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);

  const [dimensions, setDimensions] = useState({ 
    width: 0, 
    height: 0,
    boundsWidth: 0,
    boundsHeight: 0
  });

  // Create hierarchy once
  const hierarchy = useMemo(() => {
    return d3.hierarchy(data);
  }, []);

  // Calculate leaf count once
  const leafCount = useMemo(() => {
    return hierarchy.leaves().length;
  }, [hierarchy]);

  // Update dimensions when window resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;

      const { width } = containerRef.current.getBoundingClientRect();
      // Base height calculation
      const baseHeight = Math.max(400, width * 0.6);
      // Minimum height needed for the tree
      const minHeight = Math.max(
        baseHeight,
        leafCount * MIN_NODE_SPACING + MARGIN.top + MARGIN.bottom
      );

      setDimensions({
        width,
        height: minHeight,
        boundsWidth: width - MARGIN.right - MARGIN.left,
        boundsHeight: minHeight - MARGIN.top - MARGIN.bottom
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [leafCount]);

  // Create the dendrogram layout
  const dendrogram = useMemo(() => {
    if (!dimensions.boundsHeight || !dimensions.boundsWidth) return null;

    const dendrogramGenerator = d3
      .cluster<Tree>()
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
    const offset = 100;
    return `M${source.y},${source.x}
            L${source.y + offset},${source.x}
            L${source.y + offset},${target.x}
            L${target.y},${target.x}`;
  };

  // Only render if we have dimensions and dendrogram data
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
        width: '100%', 
        height: '100%',
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