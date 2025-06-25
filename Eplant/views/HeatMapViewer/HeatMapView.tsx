import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAtomValue } from 'jotai';
import { createRoot } from 'react-dom/client';
import { useOutletContext } from 'react-router-dom';

import GeneticElement from '@eplant/GeneticElement';
import {
    useActiveGeneId,
} from '@eplant/state';
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

    const [loadedGenes, setLoadedGenes] = useState<GeneData[]>([]);

    const { data, isLoading } = useQuery<HeatMapViewerData>({
        queryKey: [`heatmap-view-${geneticElement?.id}`],
        queryFn: async () => await HeatMapViewerLoader(geneticElement, setLoadAmount),
        enabled: !!geneticElement,
        staleTime: Infinity,
    });

    useEffect(() => initializeState(HeatMapViewStateSchema), [initializeState]);
    useEffect(() => setIsLoading(isLoading), [isLoading, setIsLoading]);

    useEffect(() => {
        if (!geneticElement || !data?.geneData) return;
        const id = geneticElement.id;

        const newGene: GeneData = {
            gene: id,
            data: data.geneData.data
        };

        if (
            newGene.data.plant.length === 0 &&
            newGene.data.experiment.length === 0 &&
            newGene.data.cell.length === 0
        ) return;

        setLoadedGenes(prev => prev.find(g => g.gene === id) ? prev : [...prev, newGene]);
    }, [geneticElement, data]);

    const ICON_HEIGHT = 24;
    const ICON_SPACING = 20;
    const TOP_MARGIN = 80;
    const LEFT_MARGIN = 100;
    const ROW_SPACING = 10;
    const MIN_CELL_WIDTH = 1.3;
    const GROUP_GAP = 20;
    const ROW_HEIGHT = 25;
    const DATABASE_GAP = 2;

    const validGroups = ['plant', 'experiment', 'cell'] as const;
    type GroupKey = typeof validGroups[number]; // 'plant' | 'experiment' | 'cell'

    const groups: GroupKey[] = validGroups.filter(group =>
    loadedGenes.some(g => g.data[group].length > 0)
    );

    const groupInfo = useMemo(() => {
        const cellWidth = MIN_CELL_WIDTH;
        const sizes = groups.map(group => {
            const maxSize = Math.max(0, ...loadedGenes.map(d => d.data[group].length));
            return { group, size: maxSize };
        });
        const groupPositions = sizes.map(({ group, size }, i) => {
            const position = i === 0
                ? 0
                : sizes.slice(0, i).reduce((sum, { size }) => sum + size * cellWidth + GROUP_GAP, 0);
            return { group, width: size * cellWidth, position };
        });


        return { sizes, cellWidth, groupPositions };
    }, [loadedGenes, groups]);

    const totalWidth = useMemo(() => {
        return LEFT_MARGIN + groupInfo.groupPositions.reduce((sum, g) => sum + g.width + GROUP_GAP, 0);
    }, [groupInfo]);

    const colorScale = useMemo(() => {
        if (!loadedGenes.length) return () => '#ccc';
        const allValues = loadedGenes.flatMap(gd =>
            Object.values(gd.data).flatMap(group => group.map(p => p.value))
        );
        const extent = d3.extent(allValues) as [number, number];
        return d3.scaleSequential(d3.interpolateYlOrRd).domain(extent); // ← no reverse()
    }, [loadedGenes]);

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

    
    useEffect(() => {
        if (!loadedGenes.length || !svgRef.current || !groupInfo) return;
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const mainGroup = svg.append('g').attr('transform', `translate(${LEFT_MARGIN}, ${TOP_MARGIN})`);

        groupInfo.groupPositions.forEach(({ group, position, width }) => {
            const Icon = group === 'plant' ? PlantEFPIcon : group === 'experiment' ? ExperimentEFPIcon : CellEFPIcon;
            const foreignObject = svg.append('foreignObject')
                .attr('x', LEFT_MARGIN + position + (width - 34) / 2)
                .attr('y', ICON_SPACING)
                .attr('width', 34)
                .attr('height', ICON_HEIGHT);
            const container = foreignObject.append('xhtml:div').node();
            if (container instanceof HTMLElement) {
                const iconDiv = document.createElement('div');
                container.appendChild(iconDiv);
                createRoot(iconDiv).render(<ThemeProvider theme={theme}><Icon /></ThemeProvider>);
            }
        });
        console.log(loadedGenes)

        loadedGenes.forEach((geneData, row) => {
            const yOffset = row * (ROW_HEIGHT + ROW_SPACING);
            mainGroup.append('text')
                .attr('x', -10)
                .attr('y', yOffset + ROW_HEIGHT / 2)
                .attr('text-anchor', 'end')
                .attr('dominant-baseline', 'middle')
                .text(geneData.gene)
                .style('font-size', '14px')
                .style('fill', theme.palette.text.primary);

            groupInfo.groupPositions.forEach(({ group, position }) => {
                const sorted = [...geneData.data[group]].sort((a, b) =>
                    (a.database || '').localeCompare(b.database || '')
                );

                let currentX = position;
                let previousDb: string | null = null;

                sorted.forEach((point, i) => {
                    if (previousDb !== null && point.database !== previousDb) {
                    currentX += DATABASE_GAP; // insert gap between databases
                    }

                    mainGroup.append('rect')
                    .attr('x', currentX)
                    .attr('y', yOffset)
                    .attr('width', groupInfo.cellWidth)
                    .attr('height', ROW_HEIGHT)
                    .attr('fill', colorScale(point.value))
                    .style('cursor', 'pointer')
                    .on('mouseover', (e) => {
                        d3.select('.heatmap-tooltip')
                        .style('visibility', 'visible')
                        .html(`<strong>Gene:</strong> ${geneData.gene}<br/><strong>Sample:</strong> ${point.sample}<br/><strong>Value:</strong> ${point.value.toFixed(2)}<br/><strong>Database:</strong> ${point.database}`);
                    })
                    .on('mousemove', (e) => {
                        d3.select('.heatmap-tooltip')
                        .style('top', (e.pageY - 10) + 'px')
                        .style('left', (e.pageX + 10) + 'px');
                    })
                    .on('mouseout', () => d3.select('.heatmap-tooltip').style('visibility', 'hidden'));

                    currentX += groupInfo.cellWidth;
                    previousDb = point.database;
                });
            });
        });
    }, [loadedGenes, groupInfo, theme]);

    return (
        <div style={{ width: '100%', height: '100%', overflowX: 'auto' }}>
            <h2 style={{ marginBottom: '30px' }}>HeatMap View</h2>
            <svg
                ref={svgRef}
                width={totalWidth}
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
                plant: plant?.viewData?.flatMap(sample =>
                    sample.groups.flatMap((g: EFPGroup) =>
                        g.tissues.map((t: EFPTissue) => ({
                            value: t.mean,
                            sample: t.name,
                            database: g.name
                        }))
                    )
                ) ?? [],
                experiment: experiment?.viewData?.flatMap(sample =>
                    sample.groups.flatMap((g: EFPGroup) =>
                        g.tissues.map((t: EFPTissue) => ({
                            value: t.mean,
                            sample: t.name,
                            database: g.name
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
