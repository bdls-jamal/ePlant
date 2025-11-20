import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { createRoot } from 'react-dom/client';
import { useOutletContext } from 'react-router-dom';

import GeneticElement from '@eplant/GeneticElement';
import { useURLState } from '@eplant/state/URLStateProvider';
import { ViewContext } from '@eplant/UI/Layout/ViewContainer/types';
import { ViewDataError } from '@eplant/View';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import { useQueries, useQuery } from '@tanstack/react-query';

import { cellEFPLoader } from '../CellEFP/CellEFP';
import CellEFPIcon from '../CellEFP/icon';
import { EFPGroup, EFPTissue } from '../eFP/types';
import { EFPViewerLoader } from '../eFP/Viewer/EFPViewer';
import { experimentEFPs, experimentEFPViews } from '../ExperimentEFP/efps';
import ExperimentEFPIcon from '../ExperimentEFP/icon';
import { plantEFPs, plantEFPViews } from '../PlantEFP/efps';
import PlantEFPIcon from '../PlantEFP/icon';

import {
    GeneData,
    HeatMapViewerData,
    HeatMapViewerState,
    HeatMapViewStateSchema,
} from './types';

/**
 * Main React component that renders a heatmap visualization of gene expression data.
 * This component displays gene expression data across three different categories:
 * - Plant tissues
 * - Experimental conditions
 * - Cell types
 * 
 * The heatmap shows expression values as colored cells, with yellow representing
 * low expression and red representing high expression levels.
 */
export const HeatMapViewObject = () => {
    /** Extract context data from the parent component including the current gene and loading functions */
    const { geneticElement, setIsLoading, setLoadAmount } = useOutletContext<ViewContext>();
    
    /** Initialize URL state management for maintaining view state */
    const { initializeState } = useURLState<HeatMapViewerState>();
    
    /** Access Material-UI theme for consistent styling (dark/light mode support) */
    const theme = useTheme();
    
    /** Reference to the SVG element where the D3.js visualization will be rendered */
    const svgRef = useRef<SVGSVGElement | null>(null);

    /**
     * React Query hook to fetch heatmap data for the current genetic element.
     * Only runs when a genetic element is selected and caches the result indefinitely.
     */
    const { data, isLoading } = useQuery<HeatMapViewerData>({
        queryKey: [`heatmap-view-${geneticElement?.id}`],
        queryFn: async () => await HeatMapViewerLoader(geneticElement, setLoadAmount),
        enabled: !!geneticElement,
        staleTime: Infinity,
    });

    /**
     * Fetch data from all three sources (plant, experiment, cell) for the current gene.
     * React Query will automatically use cached data if it's already been loaded by other views.
     */
    const queries = useQueries({
        queries: [
            {
                queryKey: [`plant-efp-${geneticElement?.id}`],
                queryFn: async () => await EFPViewerLoader(geneticElement, plantEFPs, plantEFPViews, () => {}),
                enabled: !!geneticElement,
                staleTime: Infinity,
            },
            {
                queryKey: [`experiment-efp-${geneticElement?.id}`],
                queryFn: async () => await EFPViewerLoader(geneticElement, experimentEFPs, experimentEFPViews, () => {}),
                enabled: !!geneticElement,
                staleTime: Infinity,
            },
            {
                queryKey: [`cell-efp-${geneticElement?.id}`],
                queryFn: async () => await cellEFPLoader(geneticElement, () => {}),
                enabled: !!geneticElement,
                staleTime: Infinity,
            },
        ],
    });

    const [plantQuery, experimentQuery, cellQuery] = queries;

    /** Initialize the URL state schema when component mounts */
    useEffect(() => initializeState(HeatMapViewStateSchema), [initializeState]);
    
    /** Update parent component's loading state when any query is loading */
    useEffect(() => {
        const anyLoading = queries.some(q => q.isLoading);
        setIsLoading(anyLoading);
    }, [queries, setIsLoading]);

    /**
     * Processes the cached query data to create a unified list of genes with their data.
     * Combines data from plant, experiment, and cell categories for the current gene.
     */
    const loadedGenes = useMemo<GeneData[]>(() => {
        if (!geneticElement) return [];

        const geneId = geneticElement.id;

        /** Transform the current gene's data into structured format */
        const plantData = plantQuery.data?.viewData?.flatMap((sample, i) =>
            sample.groups.flatMap((g: EFPGroup) =>
                g.tissues.map((t: EFPTissue) => ({
                    value: t.mean,
                    sample: t.name,
                    database: plantQuery.data.views?.[i]?.name ?? g.name
                }))
            )
        ) ?? [];

        const experimentData = experimentQuery.data?.viewData?.flatMap((sample, i) =>
            sample.groups.flatMap((g: EFPGroup) =>
                g.tissues.map((t: EFPTissue) => ({
                    value: t.mean,
                    sample: t.name,
                    database: experimentQuery.data.views?.[i]?.name ?? g.name
                }))
            )
        ) ?? [];

        const cellData = cellQuery.data?.viewData?.groups?.flatMap((g: EFPGroup) =>
            g.tissues.map((t: EFPTissue) => ({
                value: t.mean,
                sample: t.name,
                database: g.name
            }))
        ) ?? [];

        /** Return the gene data if at least one category has data */
        if (plantData.length || experimentData.length || cellData.length) {
            return [{
                gene: geneId,
                data: {
                    plant: plantData,
                    experiment: experimentData,
                    cell: cellData,
                },
            }];
        }

        return [];
    }, [geneticElement, plantQuery.data, experimentQuery.data, cellQuery.data]);

    /** Visual layout constants that define the heatmap's appearance */
    const ICON_HEIGHT = 24;          /** Height of category icons in pixels */
    const ICON_SPACING = 20;         /** Space above icons from top of SVG */
    const TOP_MARGIN = 80;           /** Space above the data rows */
    const LEFT_MARGIN = 100;         /** Space to the left for gene labels */
    const ROW_SPACING = 10;          /** Vertical space between gene rows */
    const MIN_CELL_WIDTH = 1.3;      /** Minimum width of each expression data cell */
    const GROUP_GAP = 10;            /** Horizontal space between data categories */
    const ROW_HEIGHT = 25;           /** Height of each gene row */
    const DATABASE_GAP = 3;          /** Space between different databases within a category */

    /**
     * Defines the maximum number of samples expected for each experimental database.
     * These values are used to ensure consistent spacing even when some genes
     * don't have data for all samples in a database.
     */
    const maxSamplesPerDBExperiment: Record<string, number> = {
        'Abiotic Stress II eFP': 16,
        'Abiotic Stress eFP': 154,
        'Biotic Stress Botrytis cinerea eFP': 4,
        'Biotic Stress Elicitors eFP': 14,
        'Biotic Stress Erysiphe orontii eFP': 16,
        'Biotic Stress Golovinomyces orontii eFP': 6,
        'Biotic Stress Hyaloperonospora arabidopsidis eFP': 10,
        'Biotic Stress Myzus persicaere eFP': 2,
        'Biotic Stress Phytophthora infestans eFP': 6,
        'Biotic Stress Pseudomonas syringae eFP': 30,
        'Chemical eFP': 25,
        'DNA Damage eFP (RNA-Seq data)': 24,
        'Germination eFP (RNA-Seq data)': 12,
        'Guard Cell Drought eFP': 14,
        'Guard Cell Meristemoids eFP': 4,
        'Guard Cell Mutant And Wild Type Guard Cell ABA Response eFP': 16,
        'Guard Cell Suspension Cell ABA Response With ROS Scavenger eFP': 4,
        'Heterodera schachtii eFP (RNA-Seq data)': 10,
        'Root Immunity Elicitation eFP (RNA-Seq data)': 9,
        'Shoot Apex eFP (RNA-Seq data)': 8,
        'Single Cell eFP (RNA-Seq data)': 36,
        'Tissue Specific Embryo Development eFP': 9,
        'Tissue Specific Guard And Mesophyll Cells eFP': 12,
        'Tissue Specific Microgametogenesis eFP': 4,
        'Tissue Specific Pollen Germination eFP': 4,
        'Tissue Specific Root eFP': 217,
        'Tissue Specific Shoot Apical Meristem eFP': 3,
        'Tissue Specific Stem Epidermis eFP': 4,
        'Tissue Specific Stigma And Ovaries eFP': 2,
        'Tissue Specific Trichomes eFP': 5,
        'Tissue Specific Xylem And Cork eFP': 12,
    };

    /**
     * Maximum number of samples for plant tissue databases.
     */
    const maxSamplesPerDBPlant: Record<string, number> = {
        'AtGenExpress eFP': 47,
        'Klepikova eFP (RNA-Seq data)': 69,
    };

    /**
     * Maximum number of samples for cell-type specific databases.
     */
    const maxSamplesPerDBCell: Record<string, number> = {
        'plant cell': 11,
    };

    /** Definition of the three main data categories */
    const validGroups = ['plant', 'experiment', 'cell'] as const;
    type GroupKey = typeof validGroups[number];

    /**
     * Filter to only include groups that have data for at least one loaded gene.
     * This prevents empty categories from being displayed.
     */
    const groups: GroupKey[] = validGroups.filter(group =>
        loadedGenes.some(g => g.data[group].length > 0)
    );

    /**
     * Calculates the actual rendered width for a data group, including gaps between databases.
     * This ensures consistent spacing across all genes even when some have missing data.
     */
    const calculateActualWidth = (group: GroupKey, cellWidth: number) => {
        /** Select the appropriate database configuration based on group type */
        const maxSamplesPerDBObj = group === 'plant'
            ? maxSamplesPerDBPlant
            : group === 'cell'
                ? maxSamplesPerDBCell
                : maxSamplesPerDBExperiment;

        const allDbs = Object.keys(maxSamplesPerDBObj);

        /** Calculate total width: (samples × cell_width + gap) for each database */
        let totalWidth = 0;
        allDbs.forEach(db => {
            totalWidth += (maxSamplesPerDBObj[db] ?? 0) * cellWidth + DATABASE_GAP;
        });

        /** Remove the trailing gap after the last database */
        if (allDbs.length > 0) totalWidth -= DATABASE_GAP;

        return totalWidth;
    };

    /**
     * Calculates layout information for all data groups including their widths and positions.
     * This information is used to properly space and align the heatmap columns.
     */
    const groupInfo = useMemo(() => {
        const cellWidth = MIN_CELL_WIDTH;

        /** Calculate the rendered width for each group */
        const groupWidths = groups.map(group => {
            const maxWidth = calculateActualWidth(group, cellWidth);
            return { group, width: maxWidth };
        });

        /** Calculate cumulative horizontal positions for each group */
        const groupPositions = groupWidths.map(({ group, width }, i) => {
            const position = i === 0
                ? 0
                : groupWidths.slice(0, i).reduce((sum, { width }) => sum + width + GROUP_GAP, 0);
            return { group, width, position };
        });

        return { cellWidth, groupPositions };
    }, [loadedGenes, groups]);

    /**
     * Creates a tooltip element that will display detailed information when hovering over cells.
     * The tooltip is added to the document body and initially hidden.
     */
    useEffect(() => {
        const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'heatmap-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('border', '1px solid #ddd')
            .style('padding', '10px')
            .style('border-radius', '4px')
            .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)');

        /** Cleanup function to remove tooltip when component unmounts */
        return () => {
            tooltip.remove();
        };
    }, []);

    /**
     * Creates a color interpolation between yellow (low expression) and red (high expression).
     * Uses D3's linear scale to map expression values to colors within the specified range.
     */
    function interpolateColor(value: number, max: number, minColor: string, maxColor: string) {
        /** Handle edge case where maximum value is zero to avoid division by zero */
        if (max === 0) return minColor;
        
        const scale = d3.scaleLinear<string>()
            .domain([0, max])        /** Map from 0 to maximum value in dataset */
            .range([minColor, maxColor])  /** Yellow to red color gradient */
            .clamp(true);           /** Ensure values outside domain are clamped to range */
        return scale(value);
    }

    /**
     * Main rendering effect that creates the D3.js heatmap visualization.
     * This runs whenever the gene data, layout information, or theme changes.
     */
    useEffect(() => {
        if (!loadedGenes.length || !svgRef.current || !groupInfo) return;
        
        /** Select the SVG element and clear any existing content */
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        /** Create a main group element with appropriate margins for the data area */
        const mainGroup = svg.append('g').attr('transform', `translate(${LEFT_MARGIN}, ${TOP_MARGIN})`);

        /** 
         * Render category icons and connecting branch lines for each data group.
         * This creates the visual hierarchy showing how data categories relate to the columns below.
         */
        groupInfo.groupPositions.forEach(({ group, position, width }) => {
            /** Select the appropriate icon component based on data category */
            const Icon = group === 'plant' ? PlantEFPIcon : group === 'experiment' ? ExperimentEFPIcon : CellEFPIcon;
            const iconCenterX = LEFT_MARGIN + position + width / 2;

            /** 
             * Render the category icon using React components within SVG foreignObject.
             * This allows us to use React components inside the D3 visualization.
             */
            const foreignObject = svg.append('foreignObject')
                .attr('x', iconCenterX - 15) /** Center the icon horizontally */
                .attr('y', ICON_SPACING)
                .attr('width', 30)
                .attr('height', ICON_HEIGHT);
            
            const container = foreignObject.append('xhtml:div').node();
            if (container instanceof HTMLElement) {
                const iconDiv = document.createElement('div');
                container.appendChild(iconDiv);
                /** Render the React icon component with theme provider for consistent styling */
                createRoot(iconDiv).render(<ThemeProvider theme={theme}><Icon /></ThemeProvider>);
            }

            /** Only draw connecting lines if this group actually has data to display */
            const hasData = loadedGenes.some(geneData => geneData.data[group].length > 0);
            if (hasData && width > 0) {
                /** Calculate vertical positions for the connecting lines */
                const iconBottomY = ICON_SPACING + ICON_HEIGHT;
                const branchStartY = iconBottomY + 5;
                const branchEndY = TOP_MARGIN - 5;
                const groupStartX = LEFT_MARGIN + position;
                const groupEndX = LEFT_MARGIN + position + width;

                /** Draw horizontal line from icon center to start of data columns */
                svg.append('line')
                    .attr('x1', iconCenterX)
                    .attr('y1', branchStartY)
                    .attr('x2', groupStartX)
                    .attr('y2', branchStartY)
                    .attr('stroke', theme.palette.text.secondary)
                    .attr('stroke-width', 1);

                /** Draw horizontal line from icon center to end of data columns */
                svg.append('line')
                    .attr('x1', iconCenterX)
                    .attr('y1', branchStartY)
                    .attr('x2', groupEndX)
                    .attr('y2', branchStartY)
                    .attr('stroke', theme.palette.text.secondary)
                    .attr('stroke-width', 1);

                /** Draw left vertical bracket line marking start of group */
                svg.append('line')
                    .attr('x1', groupStartX)
                    .attr('y1', branchStartY)
                    .attr('x2', groupStartX)
                    .attr('y2', branchEndY)
                    .attr('stroke', theme.palette.text.secondary)
                    .attr('stroke-width', 1);

                /** Draw right vertical bracket line marking end of group */
                svg.append('line')
                    .attr('x1', groupEndX)
                    .attr('y1', branchStartY)
                    .attr('x2', groupEndX)
                    .attr('y2', branchEndY)
                    .attr('stroke', theme.palette.text.secondary)
                    .attr('stroke-width', 1);
            }
        });

        /**
         * Render the actual heatmap data for each gene.
         * Each gene gets its own row with expression data displayed as colored rectangles.
         */
        loadedGenes.forEach((geneData, row) => {
            /** Calculate vertical position for this gene's row */
            const yOffset = row * (ROW_HEIGHT + ROW_SPACING);
            /** Highlight the primary gene (currently selected) with bold text */
            const isPrimary = geneticElement?.id === geneData.gene;

            /** Render the gene label on the left side of the row */
            mainGroup.append('text')
                .attr('x', -10)
                .attr('y', yOffset + ROW_HEIGHT / 2)
                .attr('text-anchor', 'end')
                .attr('dominant-baseline', 'middle')
                .text(geneData.gene)
                .style('font-size', '14px')
                .style('fill', theme.palette.text.primary)
                .style("font-weight", isPrimary ? "bold" : "normal");

            /**
             * Render expression data cells for each group (plant, experiment, cell).
             * Each group can contain multiple databases, and each database can have multiple samples.
             */
            groupInfo.groupPositions.forEach(({ group, position }) => {
                /** Get all possible databases for this group type */
                const allDbs = group === 'plant'
                    ? Object.keys(maxSamplesPerDBPlant)
                    : group === 'cell'
                        ? Object.keys(maxSamplesPerDBCell)
                        : Object.keys(maxSamplesPerDBExperiment);

                /** Track horizontal position as we render each database */
                let currentX = position;
                
                /** Render cells for each database in this group */
                allDbs.forEach(db => {
                    /** Get configuration for this specific database */
                    const maxSamplesPerDBObj = group === 'plant' ? maxSamplesPerDBPlant
                        : group === 'cell' ? maxSamplesPerDBCell
                        : maxSamplesPerDBExperiment;
                    
                    const dbMaxCount = maxSamplesPerDBObj[db] ?? 0;
                    /** Filter this gene's data to only include samples from current database */
                    const dbSamples = geneData.data[group].filter(p => p.database === db);
                    const rectWidth = groupInfo.cellWidth;
                    /** Find the maximum expression value for this database to normalize colors */
                    const dbMaxValue = d3.max(dbSamples, p => p.value) ?? 0;

                    /**
                     * Render a cell for each possible sample slot in this database.
                     * If a gene doesn't have data for a sample, render a grey placeholder.
                     */
                    for (let i = 0; i < dbMaxCount; i++) {
                        const point = dbSamples[i] ?? null;

                        /** Create a rectangle for each data point or placeholder */
                        mainGroup.append('rect')
                            .attr('x', currentX + i * rectWidth)
                            .attr('y', yOffset)
                            .attr('width', rectWidth)
                            .attr('height', ROW_HEIGHT)
                            .attr('fill', point
                                ? interpolateColor(point.value, dbMaxValue, "#ffff00", "#ff0000")
                                : "#ccc" /** Grey placeholder for missing data */
                            )
                            .style('cursor', point ? 'pointer' : 'default')
                            /** Show detailed information on hover for data points */
                            .on('mouseover', (e) => {
                                if (!point) return;
                                d3.select('.heatmap-tooltip')
                                    .style('visibility', 'visible')
                                    .style('background-color', theme.palette.mode === 'dark' ? '#333' : '#fff')
                                    .html(
                                        `<strong>Gene:</strong> ${geneData.gene}<br/>
                                        <strong>Sample:</strong> ${point.sample}<br/>
                                        <strong>Value:</strong> ${point.value.toFixed(2)}<br/>
                                        <strong>Database:</strong> ${point.database}`
                                    );
                            })
                            /** Update tooltip position as mouse moves */
                            .on('mousemove', (e) => {
                                if (!point) return;
                                d3.select('.heatmap-tooltip')
                                    .style('top', (e.pageY - 10) + 'px')
                                    .style('left', (e.pageX + 10) + 'px');
                            })
                            /** Hide tooltip when mouse leaves */
                            .on('mouseout', () =>
                                d3.select('.heatmap-tooltip').style('visibility', 'hidden')
                            );
                    }

                    /** Move to the next database position */
                    currentX += dbMaxCount * rectWidth + DATABASE_GAP;
                });
            });
        });
    }, [loadedGenes, groupInfo, theme]);

    /** 
     * Render the main component container with title and SVG.
     * The SVG size is calculated based on the number of genes and layout constants.
     */
    return (
        <div style={{ width: '100%', height: '100%', overflowX: 'auto' }}>
            <h2 style={{ marginBottom: '30px' }}>HeatMap View</h2>
            <svg
                ref={svgRef}
                width={'100%'}
                height={ROW_HEIGHT * loadedGenes.length + TOP_MARGIN + ICON_SPACING + ROW_SPACING * loadedGenes.length}
            ></svg>
        </div>
    );
};

/**
 * Data loader function that fetches expression data for a specific genetic element.
 * This function runs asynchronously and combines data from three different sources:
 * plant tissues, experimental conditions, and cell types.
 * 
 * @param geneticElement - The gene for which to load expression data
 * @param loadEvent - Callback function to report loading progress
 * @returns Promise containing the formatted heatmap data
 */
export const HeatMapViewerLoader = async (
    geneticElement: GeneticElement | null,
    loadEvent: (loaded: number) => void
): Promise<HeatMapViewerData> => {
    /** Validate that a genetic element was provided */
    if (!geneticElement) throw ViewDataError.UNSUPPORTED_GENE;

    const geneId = geneticElement.id;
    
    /**
     * Load expression data from all three sources in parallel for better performance.
     * Each loader function fetches data from different expression databases.
     * React Query will cache these results automatically based on their query keys.
     */
    const [plant, experiment, cell] = await Promise.all([
        EFPViewerLoader(geneticElement, plantEFPs, plantEFPViews, () => {}),
        EFPViewerLoader(geneticElement, experimentEFPs, experimentEFPViews, () => {}),
        cellEFPLoader(geneticElement, () => {}),
    ]);

    /** Report 100% loading completion */
    loadEvent(100);

    /**
     * Transform the loaded data into the format expected by the heatmap component.
     * Each data source has a different structure, so we normalize them here.
     */
    return {
        geneData: {
            gene: geneId,
            data: {
                /** 
                 * Plant data: Expression across different anatomical tissues.
                 * Flattens nested group/tissue structure into individual data points.
                 */
                plant: plant?.viewData?.flatMap((sample, i) =>
                    sample.groups.flatMap((g: EFPGroup) =>
                        g.tissues.map((t: EFPTissue) => ({
                            value: t.mean,
                            sample: t.name,
                            database: plant.views?.[i]?.name ?? g.name
                        }))
                    )
                ) ?? [],
                
                /** 
                 * Experiment data: Expression under different experimental conditions.
                 * Similar flattening process for consistency.
                 */
                experiment: experiment?.viewData?.flatMap((sample, i) =>
                    sample.groups.flatMap((g: EFPGroup) =>
                        g.tissues.map((t: EFPTissue) => ({
                            value: t.mean,
                            sample: t.name,
                            database: experiment.views?.[i]?.name ?? g.name
                        }))
                    )
                ) ?? [],
                
                /** 
                 * Cell data: Expression in specific cell types.
                 */
                cell: cell?.viewData?.groups?.flatMap((g: EFPGroup) =>
                    g.tissues.map((t: EFPTissue) => ({
                        value: t.mean,
                        sample: t.name,
                        database: g.name
                    }))
                ) ?? [],
            },
        },
        /** 
         * View mapping configuration for different data types.
         * This helps other components understand what type of data they're working with.
         */
        viewMap: {
            plant: 'plant',
            experiment: 'tissue',
            cell: 'Cell eFP',
        },
    };
};