import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

import { useTheme } from '@mui/material/styles';

import { HeatMapContext } from './index'; // Import HeatMapContext to access the gene name

/**
 * Main component for rendering the heatmap view
 * Handles data fetching, layout, and visualization
 * 
 * @returns JSX element containing the heatmap visualization
 */
export const HeatMapViewObject = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const theme = useTheme();

  // Access geneName from HeatMapContext
  const { geneName } = useContext(HeatMapContext);

  /** Generate random gene expression data for 3 categories */
  const generateRandomData = (geneName: string) => {
    const plantData = Array.from({ length: 100 }, () => Math.floor(Math.random() * 100) + 1); // Plant data
    const experimentData = Array.from({ length: 100 }, () => Math.floor(Math.random() * 100) + 1); // Experiment data
    const cellData = Array.from({ length: 100 }, () => Math.floor(Math.random() * 100) + 1); // Cell eFP data
    return { gene: geneName, plant: plantData, experiment: experimentData, cell: cellData };
  };

  /** Initialize fake data with random values for 3 categories */
  const fakeData = [generateRandomData(geneName)];

  /** State for managing data and visualization */
  const [data, setData] = useState<any[]>(fakeData); // Using fakeData as initial data
  const [dimensions, setDimensions] = useState({ width: 1200, height: 25 }); // Adjust width for spacing between categories

  /** Compute color scale based on data */
  const colorScale = useMemo(() => {
    // Get the minimum and maximum values from the data
    const values = data.flatMap(d => [...d.plant, ...d.experiment, ...d.cell]);
    const extent = d3.extent(values);

    // Reverse the domain so that higher values are closer to red (start from the highest)
    return d3.scaleSequential(d3.interpolateYlOrRd).domain(extent.reverse());
  }, [data]);

  /** Render heatmap using D3 */
  useEffect(() => {
    if (!data.length || !svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    const rowHeight = dimensions.height;  // Single row for one gene (height is fixed)
    const cellWidth = (dimensions.width - 300) / 300;  // Cell width for 3 sections (100 bars per section)

    const g = svg.append('g').attr('transform', 'translate(100, 0)'); // Shift the heatmap right

    // Render gene name on the left of the heatmap
    svg.append('text')
      .attr('x', 50) // Positioned on the left side of the heatmap
      .attr('y', 40) // Vertical positioning below the header
      .attr('text-anchor', 'middle')
      .text(geneName)
      .style('font-size', '16px')
      .style('fill', theme.palette.text.primary);

    // Static titles for each section (only displayed once above the heatmap)
    const sectionTitles = ['Plant', 'Experiment', 'Cell'];

    // Render the static titles above the heatmap
    sectionTitles.forEach((title, index) => {
      svg.append('text')
        .attr('x', 250 + 300 * (index)) // Center each title above its respective section
        .attr('y', 10) // Position the titles above the heatmap, with a bit of space above
        .attr('text-anchor', 'middle')
        .text(title)
        .style('font-size', '14px')
        .style('fill', theme.palette.text.primary);
    });

    // Loop through each section (Plant, Experiment, Cell) and render the heatmap
    const sections = ['plant', 'experiment', 'cell'];

    let sectionStartX = 0;  // Start of each section for rendering
    const sectionGap = 10;  // Fixed gap between sections (in pixels)

    sections.forEach((section, sectionIndex) => {
      // Render heatmap bars for this section
      data.forEach((row, rowIndex) => {
        row[section].forEach((value: d3.NumberValue, colIndex: number) => {
          g.append('rect')
            .attr('x', sectionStartX + colIndex * cellWidth)
            .attr('y', 20 + rowIndex * rowHeight)
            .attr('width', cellWidth)
            .attr('height', rowHeight)
            .attr('fill', colorScale(value));
        });
      });

      // Update the start of the next section (with gap)
      sectionStartX += 100 * cellWidth + sectionGap;  // Add the width of 100 bars plus the gap
    });
  }, [data, dimensions, colorScale, theme, geneName]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <h2>{geneName} HeatMap</h2> {/* Display the gene name as the title */}
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height + 60}></svg> {/* Adjust the SVG height to fit titles and shift everything down */}
    </div>
  );
};

export default HeatMapViewObject;
