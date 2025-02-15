import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { createRoot } from 'react-dom/client';

import { useTheme } from '@mui/material/styles';

import CellEFPIcon from '../CellEFP/icon';
import ExperimentEFPIcon from '../ExperimentEFP/icon';
import PlantEFPIcon from '../PlantEFP/icon';
import { useViewSwitch } from '../ViewGeneSwitching';

import { HeatMapContext, ViewSwitchProvider } from './index';

/** 
 * Mapping of view types to their corresponding display names.
 * Used for switching between different visualization modes.
 */
type ViewMap = {
  plant: 'plant';
  experiment: 'tissue';
  cell: 'Cell eFP';
};

/**
 * Represents a single data point in the heatmap.
 * Contains information about the value, sample type, and source database.
 */
type DataPoint = {
  value: number;
  sample: string;
  database: string;
};

/**
 * Structure representing gene expression data across different view types.
 * Contains data points for plant, experiment, and cell views.
 */
type GeneData = {
  gene: string;
  data: {
    plant: DataPoint[];
    experiment: DataPoint[];
    cell: DataPoint[];
  };
};

/**
 * Main component for rendering a heatmap visualization of gene expression data.
 * Displays data across different view types (plant, experiment, cell) with interactive
 * features like tooltips and click handling.
 */
export const HeatMapViewObject = () => {
  /** Reference to the container div element */
  const containerRef = useRef<HTMLDivElement | null>(null);
  /** Reference to the SVG element where the heatmap is rendered */
  const svgRef = useRef<SVGSVGElement | null>(null);
  /** Material-UI theme for consistent styling */
  const theme = useTheme();
  /** Current gene name from context */
  const { geneName } = useContext(HeatMapContext);
  /** Function to switch between different view types */
  const { switchViewAndGene } = useViewSwitch();

  /** Layout constants for positioning and sizing elements */
  const ICON_HEIGHT = 24;
  const ICON_SPACING = 20;
  const TOP_MARGIN = 80;
  const LEFT_MARGIN = 100;
  const ROW_SPACING = 10;
  const MIN_CELL_WIDTH = 2;
  const GROUP_GAP = 20;

  /**
   * Generates sample data for the current gene.
   * Creates random values for demonstration purposes.
   * @returns Array of GeneData with random values
   */
  const generateSampleData = (): GeneData[] => {
    return [{
      gene: geneName,
      data: {
        plant: Array(100).fill(null).map(() => ({
          value: Math.random() * 100,
          sample: 'plant',
          database: 'atgenexp_plus'
        })),
        experiment: Array(100).fill(null).map(() => ({
          value: Math.random() * 100,
          sample: 'experiment',
          database: 'root'
        })),
        cell: Array(100).fill(null).map(() => ({
          value: Math.random() * 100,
          sample: 'cell',
          database: 'gene_express_plus'
        }))
      }
    }];
  };

  /** State for storing gene expression data */
  const [data, setData] = useState<GeneData[]>(generateSampleData());
  /** State for storing component dimensions */
  const [dimensions, setDimensions] = useState({ width: 1200, height: 25 });

  /** Effect to update data when gene changes */
  useEffect(() => {
    setData(generateSampleData());
  }, [geneName]);

  /**
   * Calculates positions and dimensions for each group in the heatmap.
   * Handles layout calculations for proper spacing and sizing of elements.
   */
  const groupInfo = useMemo(() => {
    const groups = ['plant', 'experiment', 'cell'] as const;
    const sizes = groups.map(group => ({
      group,
      size: Math.max(...data.map(d => d.data[group].length))
    }));
    
    const totalDataPoints = sizes.reduce((sum, { size }) => sum + size, 0);
    const availableWidth = dimensions.width - LEFT_MARGIN - (groups.length - 1) * GROUP_GAP;
    const cellWidth = Math.max(MIN_CELL_WIDTH, availableWidth / totalDataPoints);

    let currentX = 0;
    const groupPositions = sizes.map(({ group, size }) => {
      const width = size * cellWidth;
      const position = currentX;
      currentX += width + GROUP_GAP;
      return { group, width, position };
    });

    return { sizes, cellWidth, groupPositions };
  }, [data, dimensions.width]);

  /**
   * Creates a color scale for the heatmap based on data values.
   * Uses d3's sequential color scale with YlOrRd (Yellow-Orange-Red) color scheme.
   */
  const colorScale = useMemo(() => {
    const allValues = data.flatMap(d => 
      Object.values(d.data).flatMap(group => 
        group.map(point => point.value)
      )
    );
    const extent = d3.extent(allValues) as [number, number];
    return d3.scaleSequential(d3.interpolateYlOrRd).domain(extent.reverse());
  }, [data]);

  /** Effect to create and cleanup tooltip */
  useEffect(() => {
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'heatmap-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'white')
      .style('border', '1px solid #ddd')
      .style('padding', '10px')
      .style('border-radius', '4px')
      .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)');

    return () => {
      tooltip.remove();
    };
  }, []);

  /**
   * Renders an icon for a specific view type.
   * @param iconType - Type of icon to render (plant, experiment, or cell)
   * @param position - X position for the icon
   * @param width - Width of the icon's container
   */
  const renderIcon = (iconType: 'plant' | 'experiment' | 'cell', position: number, width: number) => {
    if (!svgRef.current) return;

    const IconComponent = iconType === 'plant' ? PlantEFPIcon :
                         iconType === 'experiment' ? ExperimentEFPIcon :
                         CellEFPIcon;

    const foreignObject = d3.select(svgRef.current)
      .append('foreignObject')
      .attr('x', LEFT_MARGIN + position + (width - 34) / 2)
      .attr('y', ICON_SPACING)
      .attr('width', 34)
      .attr('height', ICON_HEIGHT);

    const div = foreignObject.append('xhtml:div');
    const container = div.node();
    
    if (container instanceof HTMLElement) {
      const iconElement = document.createElement('div');
      container.appendChild(iconElement);
      const root = createRoot(iconElement);
      root.render(<IconComponent />);
    }
  };

  /** Effect to render the heatmap */
  useEffect(() => {
    if (!data.length || !svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const rowHeight = dimensions.height;

    const mainGroup = svg.append('g')
      .attr('transform', `translate(${LEFT_MARGIN}, ${TOP_MARGIN})`);

    /** Render icons for each view type */
    groupInfo.groupPositions.forEach(({ group, position, width }) => {
      renderIcon(group as 'plant' | 'experiment' | 'cell', position, width);
    });

    /** Add gene label */
    mainGroup.append('text')
      .attr('x', -10)
      .attr('y', rowHeight / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .text(geneName)
      .style('font-size', '14px')
      .style('fill', theme.palette.text.primary);

    const viewMap: ViewMap = {
      plant: 'plant',
      experiment: 'tissue',
      cell: 'Cell eFP'
    };

    /** Render heatmap cells with interactivity */
    groupInfo.groupPositions.forEach(({ group, position }) => {
      data.forEach((geneData) => {
        const sortedData = [...geneData.data[group as keyof typeof geneData.data]]
          .sort((a, b) => (a.database || '').localeCompare(b.database || ''));

        sortedData.forEach((point, colIndex) => {
          const rect = mainGroup.append('rect')
            .attr('x', position + colIndex * groupInfo.cellWidth)
            .attr('y', 0)
            .attr('width', groupInfo.cellWidth)
            .attr('height', rowHeight)
            .attr('fill', colorScale(point.value))
            .style('cursor', 'pointer');

          rect
            .on('mouseover', (event) => {
              const tooltip = d3.select('.heatmap-tooltip');
              tooltip
                .style('visibility', 'visible')
                .html(`
                  <strong>Gene:</strong> ${geneName}<br/>
                  <strong>Sample:</strong> ${point.sample}<br/>
                  <strong>Value:</strong> ${point.value.toFixed(2)}<br/>
                  <strong>Database:</strong> ${point.database}
                `);
            })
            .on('mousemove', (event) => {
              const tooltip = d3.select('.heatmap-tooltip');
              tooltip
                .style('top', (event.pageY - 10) + 'px')
                .style('left', (event.pageX + 10) + 'px');
            })
            .on('mouseout', () => {
              d3.select('.heatmap-tooltip').style('visibility', 'hidden');
            })
            .on('click', () => {
              switchViewAndGene(viewMap[point.sample as keyof ViewMap], geneName);
            });
        });
      });
    });

  }, [data, dimensions, colorScale, theme, geneName, groupInfo, switchViewAndGene]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <h2 style={{ marginBottom: '30px' }}>{geneName} HeatMap</h2>
      <svg 
        ref={svgRef} 
        width={dimensions.width} 
        height={dimensions.height + TOP_MARGIN + ICON_SPACING}
      ></svg>
    </div>
  );
};

/**
 * Wrapper component that provides the ViewSwitch context to the HeatMapViewObject.
 * Ensures that view switching functionality is available to the heatmap.
 */
const WrappedHeatMapViewObject = () => {
  return (
    <ViewSwitchProvider>
      <HeatMapViewObject />
    </ViewSwitchProvider>
  );
};

export default WrappedHeatMapViewObject;