import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAtom } from 'jotai';
import { createRoot } from 'react-dom/client';
import { useOutletContext } from 'react-router-dom';

import GeneticElement from '@eplant/GeneticElement';
import { useURLState } from '@eplant/state/URLStateProvider';
import { ViewContext } from '@eplant/UI/Layout/ViewContainer/types';
import { ViewDataError } from '@eplant/View';
import { ThemeProvider,useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';

import { cellEFPLoader } from '../CellEFP/CellEFP';
import CellEFPIcon from '../CellEFP/icon';
import { globalEFPDataAtom } from '../eFP/eFPAtoms';
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

export const HeatMapViewObject = () => {
    const { geneticElement, setIsLoading, setLoadAmount } = useOutletContext<ViewContext>();
    const { initializeState } = useURLState<HeatMapViewerState>();
    const theme = useTheme();
    const svgRef = useRef<SVGSVGElement | null>(null);

    const [globalEFPData, setGlobalEFPData] = useAtom(globalEFPDataAtom);

    const { data, isLoading } = useQuery<HeatMapViewerData>({
        queryKey: [`heatmap-view-${geneticElement?.id}`],
        queryFn: async () => await HeatMapViewerLoader(geneticElement, setLoadAmount),
        enabled: !!geneticElement,
        staleTime: Infinity,
    });

    useEffect(() => initializeState(HeatMapViewStateSchema), [initializeState]);
    useEffect(() => setIsLoading(isLoading), [isLoading, setIsLoading]);

    const loadedGenes = useMemo<GeneData[]>(() => {
        const ids = Array.from(new Set([
            ...Object.keys(globalEFPData.plant),
            ...Object.keys(globalEFPData.experiment),
            ...Object.keys(globalEFPData.cell),
        ]));

        // Combine per-id arrays across the three maps
        return ids
            .map(id => ({
            gene: id,
            data: {
                plant:      globalEFPData.plant[id]?.data.plant ?? [],
                experiment: globalEFPData.experiment[id]?.data.experiment ?? [],
                cell:       globalEFPData.cell[id]?.data.cell ?? [],
            },
            }))
            .filter(g =>
            g.data.plant.length || g.data.experiment.length || g.data.cell.length
            );
    }, [globalEFPData]);


    useEffect(() => {
        if (!geneticElement || !data?.geneData) return;
        const id = geneticElement.id;
        const incoming = data.geneData.data;

        // Merge new arrays with whatever is already cached for this gene
        setGlobalEFPData(prev => {
            const prevPlant = prev.plant[id]?.data.plant ?? [];
            const prevExp   = prev.experiment[id]?.data.experiment ?? [];
            const prevCell  = prev.cell[id]?.data.cell ?? [];

            const merged = {
            plant: incoming.plant?.length ? incoming.plant : prevPlant,
            experiment: incoming.experiment?.length ? incoming.experiment : prevExp,
            cell: incoming.cell?.length ? incoming.cell : prevCell,
            };

            const nextEntry = { gene: id, data: merged };

            return {
            plant:      { ...prev.plant,      [id]: nextEntry },
            experiment: { ...prev.experiment, [id]: nextEntry },
            cell:       { ...prev.cell,       [id]: nextEntry },
            };
        });
    }, [geneticElement, data, setGlobalEFPData]);

    const ICON_HEIGHT = 24;
    const ICON_SPACING = 20;
    const TOP_MARGIN = 80;
    const LEFT_MARGIN = 100;
    const ROW_SPACING = 10;
    const MIN_CELL_WIDTH = 1.3;
    const GROUP_GAP = 10;
    const ROW_HEIGHT = 25;
    const DATABASE_GAP = 3;
    
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

    /** Hard coded values for determining the max expected number of samples per database category per EFP type. Based on names in index files of each efp,
     * so this must change if there are any changes to those files.
     */
    const maxSamplesPerDBPlant: Record<string, number> = {
        'AtGenExpress eFP': 47,
        'Klepikova eFP (RNA-Seq data)': 69,
    };

    const maxSamplesPerDBCell: Record<string, number> = {
        'plant cell': 11,
    };

    const validGroups = ['plant', 'experiment', 'cell'] as const;
    type GroupKey = typeof validGroups[number];

    const groups: GroupKey[] = validGroups.filter(group =>
        loadedGenes.some(g => g.data[group].length > 0)
    );

    // Helper function to calculate actual rendered width including database gaps
    const calculateActualWidth = (group: GroupKey, cellWidth: number) => {
        const maxSamplesPerDBObj = group === 'plant'
            ? maxSamplesPerDBPlant
            : group === 'cell'
                ? maxSamplesPerDBCell
                : maxSamplesPerDBExperiment;

        const allDbs = Object.keys(maxSamplesPerDBObj);

        let totalWidth = 0;
        allDbs.forEach(db => {
            totalWidth += (maxSamplesPerDBObj[db] ?? 0) * cellWidth + DATABASE_GAP;
        });

        if (allDbs.length > 0) totalWidth -= DATABASE_GAP;

        return totalWidth;
    };

    const groupInfo = useMemo(() => {
        const cellWidth = MIN_CELL_WIDTH;
        
        // Calculate actual widths for each group across all genes
        const groupWidths = groups.map(group => {
            const maxWidth = calculateActualWidth(group, cellWidth);
            return { group, width: maxWidth };
            });

        // Calculate cumulative positions
        const groupPositions = groupWidths.map(({ group, width }, i) => {
            const position = i === 0
                ? 0
                : groupWidths.slice(0, i).reduce((sum, { width }) => sum + width + GROUP_GAP, 0);
            return { group, width, position };
        });

        return { cellWidth, groupPositions };
    }, [loadedGenes, groups]);

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

        return () => {
            tooltip.remove();
        };
    }, []);

    function interpolateColor(value: number, max: number, minColor: string, maxColor: string) {
        if (max === 0) return minColor; // avoid divide-by-zero
        const scale = d3.scaleLinear<string>()
            .domain([0, max])        // 0 → yellow, max → red
            .range([minColor, maxColor])
            .clamp(true);
        return scale(value);
    }


    useEffect(() => {
        if (!loadedGenes.length || !svgRef.current || !groupInfo) return;
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const mainGroup = svg.append('g').attr('transform', `translate(${LEFT_MARGIN}, ${TOP_MARGIN})`);

        // Render group icons and branch lines
        groupInfo.groupPositions.forEach(({ group, position, width }) => {
            const Icon = group === 'plant' ? PlantEFPIcon : group === 'experiment' ? ExperimentEFPIcon : CellEFPIcon;
            const iconCenterX = LEFT_MARGIN + position + width / 2;
            
            // Render icon (centered on the vertical line)
            const foreignObject = svg.append('foreignObject')
                .attr('x', iconCenterX - 15) // Adjust centering - icons might not be exactly 34px or centered within their container
                .attr('y', ICON_SPACING)
                .attr('width', 30)
                .attr('height', ICON_HEIGHT);
            const container = foreignObject.append('xhtml:div').node();
            if (container instanceof HTMLElement) {
                const iconDiv = document.createElement('div');
                container.appendChild(iconDiv);
                createRoot(iconDiv).render(<ThemeProvider theme={theme}><Icon /></ThemeProvider>);
            }

            // Only draw branch lines if this group has data
            const hasData = loadedGenes.some(geneData => geneData.data[group].length > 0);
            if (hasData && width > 0) {
                const iconBottomY = ICON_SPACING + ICON_HEIGHT;
                const branchStartY = iconBottomY + 5;
                const branchEndY = TOP_MARGIN - 5;
                const groupStartX = LEFT_MARGIN + position;
                const groupEndX = LEFT_MARGIN + position + width;

                // Left horizontal line from icon center to start of data
                svg.append('line')
                    .attr('x1', iconCenterX)
                    .attr('y1', branchStartY)
                    .attr('x2', groupStartX)
                    .attr('y2', branchStartY)
                    .attr('stroke', theme.palette.text.secondary)
                    .attr('stroke-width', 1);

                // Right horizontal line from icon center to end of data
                svg.append('line')
                    .attr('x1', iconCenterX)
                    .attr('y1', branchStartY)
                    .attr('x2', groupEndX)
                    .attr('y2', branchStartY)
                    .attr('stroke', theme.palette.text.secondary)
                    .attr('stroke-width', 1);

                // Left bracket line (start of group)
                svg.append('line')
                    .attr('x1', groupStartX)
                    .attr('y1', branchStartY)
                    .attr('x2', groupStartX)
                    .attr('y2', branchEndY)
                    .attr('stroke', theme.palette.text.secondary)
                    .attr('stroke-width', 1);

                // Right bracket line (end of group)
                svg.append('line')
                    .attr('x1', groupEndX)
                    .attr('y1', branchStartY)
                    .attr('x2', groupEndX)
                    .attr('y2', branchEndY)
                    .attr('stroke', theme.palette.text.secondary)
                    .attr('stroke-width', 1);
            }
        });

        // Render gene data
        loadedGenes.forEach((geneData, row) => {
            const yOffset = row * (ROW_HEIGHT + ROW_SPACING);
            const isPrimary = geneticElement?.id === geneData.gene;
            
            // Gene label
            mainGroup.append('text')
                .attr('x', -10)
                .attr('y', yOffset + ROW_HEIGHT / 2)
                .attr('text-anchor', 'end')
                .attr('dominant-baseline', 'middle')
                .text(geneData.gene)
                .style('font-size', '14px')
                .style('fill', theme.palette.text.primary)
                .style("font-weight", isPrimary ? "bold" : "normal")

            // Render cells for each group
            groupInfo.groupPositions.forEach(({ group, position }) => {
                // Collect databases across ALL genes
                const allDbs = group === 'plant'
                    ? Object.keys(maxSamplesPerDBPlant)
                    : group === 'cell'
                        ? Object.keys(maxSamplesPerDBCell)
                        : Object.keys(maxSamplesPerDBExperiment);

                let currentX = position;
                allDbs.forEach(db => {
                    const maxSamplesPerDBObj = group === 'plant' ? maxSamplesPerDBPlant
                        : group === 'cell' ? maxSamplesPerDBCell
                        : maxSamplesPerDBExperiment;
                    const dbMaxCount = maxSamplesPerDBObj[db] ?? 0;
                    const dbSamples = geneData.data[group].filter(p => p.database === db); // may be empty
                    const rectWidth = groupInfo.cellWidth;
                    const dbMaxValue = d3.max(dbSamples, p => p.value) ?? 0;

                    // render each "slot" for this database
                    for (let i = 0; i < dbMaxCount; i++) {
                        const point = dbSamples[i] ?? null;

                        mainGroup.append('rect')
                            .attr('x', currentX + i * rectWidth)
                            .attr('y', yOffset)
                            .attr('width', rectWidth)
                            .attr('height', ROW_HEIGHT)
                            .attr('fill', point
                                ? interpolateColor(point.value, dbMaxValue, "#ffff00", "#ff0000")
                                : "#ccc" // grey filler
                            )
                            .style('cursor', point ? 'pointer' : 'default')
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
                            .on('mousemove', (e) => {
                                if (!point) return;
                                d3.select('.heatmap-tooltip')
                                    .style('top', (e.pageY - 10) + 'px')
                                    .style('left', (e.pageX + 10) + 'px');
                            })
                            .on('mouseout', () =>
                                d3.select('.heatmap-tooltip').style('visibility', 'hidden')
                            );
                    }

                    currentX += dbMaxCount * rectWidth + DATABASE_GAP;
                });
            });
        });
    }, [loadedGenes, groupInfo, theme]);

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

export const HeatMapViewerLoader = async (
    geneticElement: GeneticElement | null,
    loadEvent: (loaded: number) => void
): Promise<HeatMapViewerData> => {
    if (!geneticElement) throw ViewDataError.UNSUPPORTED_GENE;

    const geneId = geneticElement.id;
    const [plant, experiment, cell] = await Promise.all([
        EFPViewerLoader(geneticElement, plantEFPs, plantEFPViews, () => {}),
        EFPViewerLoader(geneticElement, experimentEFPs, experimentEFPViews, () => {}),
        cellEFPLoader(geneticElement, () => {}),
    ]);

    loadEvent(100);

    return {
        geneData: {
            gene: geneId,
            data: {
                plant: plant?.viewData?.flatMap((sample, i) =>
                    sample.groups.flatMap((g: EFPGroup) =>
                        g.tissues.map((t: EFPTissue) => ({
                            value: t.mean,
                            sample: t.name,
                            database: plant.views?.[i]?.name ?? g.name
                        }))
                    )
                ) ?? [],
                experiment: experiment?.viewData?.flatMap((sample, i) =>
                    sample.groups.flatMap((g: EFPGroup) =>
                        g.tissues.map((t: EFPTissue) => ({
                            value: t.mean,
                            sample: t.name,
                            database: experiment.views?.[i]?.name ?? g.name 
                        }))
                    )
                ) ?? [],
                cell: cell?.viewData?.groups?.flatMap((g: EFPGroup) =>
                    g.tissues.map((t: EFPTissue) => ({
                        value: t.mean,
                        sample: t.name,
                        database: g.name
                    }))
                ) ?? [],
            },
        },
        viewMap: {
            plant: 'plant',
            experiment: 'tissue',
            cell: 'Cell eFP',
        },
    };
};