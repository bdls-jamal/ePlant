import React, { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import { useAtom } from 'jotai'
import { useOutletContext } from 'react-router-dom'

import GeneticElement from '@eplant/GeneticElement'
import { useURLState } from '@eplant/state/URLStateProvider'
import { ViewContext } from '@eplant/UI/Layout/ViewContainer/types'
import { ViewDataError } from '@eplant/View'
import { Box, CircularProgress, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'

import { cellEFPLoader } from '../CellEFP/CellEFP'
import CellEFPIcon from '../CellEFP/icon'
import { globalEFPDataAtom } from '../eFP/eFPAtoms'
import { getColor } from '../eFP/svg'
import { EFPGroup, EFPTissue } from '../eFP/types'
import { EFPViewerLoader } from '../eFP/Viewer/EFPViewer'
import { experimentEFPs, experimentEFPViews } from '../ExperimentEFP/efps'
import ExperimentEFPIcon from '../ExperimentEFP/icon'
import { plantEFPs, plantEFPViews } from '../PlantEFP/efps'
import PlantEFPIcon from '../PlantEFP/icon'

import {
  GeneData,
  HeatMapViewerData,
  HeatMapViewerState,
  HeatMapViewStateSchema,
} from './types'

// ---------------------------------------------------------------------------
// Layout constants — defined at module level so they are stable references
// and never recreated on each render.
// ---------------------------------------------------------------------------
const ICON_HEIGHT = 24   /** Height of category icons in pixels */
const ICON_SPACING = 20  /** Space above icons from top of SVG */
const TOP_MARGIN = 80    /** Space above the data rows */
const LEFT_MARGIN = 100  /** Space to the left for gene labels */
const ROW_SPACING = 10   /** Vertical space between gene rows */
const MIN_CELL_WIDTH = 1.3 /** Minimum width of each expression data cell */
const GROUP_GAP = 10     /** Horizontal space between data categories */
const ROW_HEIGHT = 25    /** Height of each gene row */
const DATABASE_GAP = 3   /** Space between different databases within a category */

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
}

/**
 * Maximum number of samples for plant tissue databases.
 */
const maxSamplesPerDBPlant: Record<string, number> = {
  'AtGenExpress eFP': 47,
  'Klepikova eFP (RNA-Seq data)': 69,
}

/**
 * Maximum number of samples for cell-type specific databases.
 */
const maxSamplesPerDBCell: Record<string, number> = {
  'plant cell': 11,
}

/** Definition of the three main data categories */
const validGroups = ['plant', 'experiment', 'cell'] as const
type GroupKey = (typeof validGroups)[number]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculates the actual rendered width for a data group, including gaps between databases.
 * This ensures consistent spacing across all genes even when some have missing data.
 *
 * @param group - The data category (plant, experiment, or cell)
 * @param cellWidth - The width of each individual expression data cell
 */
function calculateActualWidth(group: GroupKey, cellWidth: number): number {
  /** Select the appropriate database configuration based on group type */
  const maxSamplesPerDBObj =
    group === 'plant'
      ? maxSamplesPerDBPlant
      : group === 'cell'
        ? maxSamplesPerDBCell
        : maxSamplesPerDBExperiment

  const allDbs = Object.keys(maxSamplesPerDBObj)

  /** Calculate total width: (samples × cell_width + gap) for each database */
  let totalWidth = 0
  allDbs.forEach((db) => {
    totalWidth += (maxSamplesPerDBObj[db] ?? 0) * cellWidth + DATABASE_GAP
  })

  /** Remove the trailing gap after the last database */
  if (allDbs.length > 0) totalWidth -= DATABASE_GAP
  return totalWidth
}

// ---------------------------------------------------------------------------
// Icon overlay component — rendered in JSX and positioned over the SVG via
// CSS. This completely avoids the createRoot-inside-D3-effect anti-pattern.
// ---------------------------------------------------------------------------
interface IconOverlayProps {
  groupPositions: { group: GroupKey; width: number; position: number }[]
}

/**
 * Renders category icons (Plant, Experiment, Cell) as a JSX overlay
 * positioned above the corresponding data columns in the heatmap SVG.
 * Using JSX here instead of D3 foreignObject avoids creating new React
 * roots on every redraw.
 */
const IconOverlay: React.FC<IconOverlayProps> = ({ groupPositions }) => (
  <>
    {groupPositions.map(({ group, position, width }) => {
      /** Select the appropriate icon component based on data category */
      const Icon =
        group === 'plant'
          ? PlantEFPIcon
          : group === 'experiment'
            ? ExperimentEFPIcon
            : CellEFPIcon

      const centerX = LEFT_MARGIN + position + width / 2

      return (
        <div
          key={group}
          style={{
            position: 'absolute',
            left: centerX - 15,
            top: ICON_SPACING,
            width: 30,
            height: ICON_HEIGHT,
            pointerEvents: 'none',
          }}
        >
          <Icon />
        </div>
      )
    })}
  </>
)

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Main React component that renders a heatmap visualization of gene expression data.
 * This component displays gene expression data across three different categories:
 * - Plant tissues
 * - Experimental conditions
 * - Cell types
 *
 * The heatmap shows expression values as colored cells, with yellow representing
 * low expression and red representing high expression levels.
 *
 * Data sharing strategy: HeatMapViewerLoader uses queryClient.fetchQuery with
 * the same query keys as the individual EFP views (plant-efp-*, experiment-efp-*,
 * cell-efp-*). This means React Query will serve cached data when those views
 * have already loaded it, and only fetch from the network when necessary.
 */
export const HeatMapViewObject = () => {
  /** Extract context data from the parent component including the current gene and loading functions */
  const { geneticElement, setIsLoading, setLoadAmount } =
    useOutletContext<ViewContext>()

  /** Initialize URL state management for maintaining view state */
  const { initializeState } = useURLState<HeatMapViewerState>()

  /** Access Material-UI theme for consistent styling (dark/light mode support) */
  const theme = useTheme()

  /** Reference to the SVG element where the D3.js visualization will be rendered */
  const svgRef = useRef<SVGSVGElement | null>(null)

  const [globalEFPData, setGlobalEFPData] = useAtom(globalEFPDataAtom)

  /**
   * Access the shared React Query client so HeatMapViewerLoader can call
   * fetchQuery using the same keys as PlantEFP, ExperimentEFP, and CellEFP.
   * This is the key to avoiding redundant network requests — if those views
   * already populated the cache, the loader will reuse their data instantly.
   */
  const queryClient = useQueryClient()

  /**
   * Fetch heatmap data for the current genetic element.
   * The loader internally uses queryClient.fetchQuery with the same keys as the
   * individual EFP views, so cached data is reused rather than re-fetched.
   */
  const { data, isLoading } = useQuery<HeatMapViewerData>({
    queryKey: [`heatmap-view-${geneticElement?.id}`],
    queryFn: async () =>
      await HeatMapViewerLoader(geneticElement, setLoadAmount, queryClient),
    enabled: !!geneticElement,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  /** Initialize the URL state schema when component mounts */
  useEffect(() => initializeState(HeatMapViewStateSchema), [initializeState])

  /** Update parent component's loading state when our loading state changes */
  useEffect(() => setIsLoading(isLoading), [isLoading, setIsLoading])

  /**
   * Sync freshly loaded heatmap data into the shared atom so other views
   * can read it without triggering additional network requests.
   */
  useEffect(() => {
    if (!geneticElement || !data?.geneData) return
    const id = geneticElement.id
    const incoming = data.geneData.data

    setGlobalEFPData((prev) => {
      const prevPlant = prev.plant[id]?.data.plant ?? []
      const prevExp = prev.experiment[id]?.data.experiment ?? []
      const prevCell = prev.cell[id]?.data.cell ?? []

      /** Preserve existing data for any category not present in the new fetch */
      const merged = {
        plant: incoming.plant?.length ? incoming.plant : prevPlant,
        experiment: incoming.experiment?.length ? incoming.experiment : prevExp,
        cell: incoming.cell?.length ? incoming.cell : prevCell,
      }

      const nextEntry = { gene: id, data: merged }

      return {
        plant: { ...prev.plant, [id]: nextEntry },
        experiment: { ...prev.experiment, [id]: nextEntry },
        cell: { ...prev.cell, [id]: nextEntry },
      }
    })
  }, [geneticElement, data, setGlobalEFPData])

  /**
   * Processes the cached atom data to create a unified list of genes with their data.
   * Combines data from plant, experiment, and cell categories for all loaded genes.
   */
  const loadedGenes = useMemo<GeneData[]>(() => {
    const ids = Array.from(
      new Set([
        ...Object.keys(globalEFPData.plant),
        ...Object.keys(globalEFPData.experiment),
        ...Object.keys(globalEFPData.cell),
      ])
    )

    return ids
      .map((id) => ({
        gene: id,
        data: {
          plant: globalEFPData.plant[id]?.data.plant ?? [],
          experiment: globalEFPData.experiment[id]?.data.experiment ?? [],
          cell: globalEFPData.cell[id]?.data.cell ?? [],
        },
      }))
      .filter(
        (g) =>
          g.data.plant.length || g.data.experiment.length || g.data.cell.length
      )
  }, [globalEFPData])

  /**
   * Calculates layout information for all data groups including their widths and positions.
   * This information is used to properly space and align the heatmap columns.
   */
  const groupInfo = useMemo(() => {
    const cellWidth = MIN_CELL_WIDTH

    /** Filter to only include groups that have data for at least one loaded gene */
    const activeGroups: GroupKey[] = validGroups.filter((group) =>
      loadedGenes.some((g) => g.data[group].length > 0)
    )

    /** Calculate cumulative horizontal positions for each group */
    const groupPositions = activeGroups.map((group, i) => {
      const width = calculateActualWidth(group, cellWidth)
      const position =
        i === 0
          ? 0
          : activeGroups.slice(0, i).reduce((sum, g) => {
              return sum + calculateActualWidth(g, cellWidth) + GROUP_GAP
            }, 0)
      return { group, width, position }
    })

    return { cellWidth, groupPositions, activeGroups }
  }, [loadedGenes])

  /**
   * Creates a tooltip element that will display detailed information when hovering over cells.
   * The tooltip is added to the document body and initially hidden.
   */
  useEffect(() => {
    const tooltip = d3
      .select('body')
      .append('div')
      .attr('class', 'heatmap-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('border', '1px solid #ddd')
      .style('padding', '10px')
      .style('border-radius', '4px')
      .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')

    /** Cleanup function to remove tooltip when component unmounts */
    return () => {
      tooltip.remove()
    }
  }, []) /** Empty deps — tooltip is created once and cleaned up on unmount */

  /**
   * Main rendering effect that creates the D3.js heatmap visualization.
   * This runs whenever the gene data, layout information, or theme changes.
   */
  useEffect(() => {
    if (!loadedGenes.length || !svgRef.current || !groupInfo) return

    /** Select the SVG element and clear any existing content */
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    /** Create a main group element with appropriate margins for the data area */
    const mainGroup = svg
      .append('g')
      .attr('transform', `translate(${LEFT_MARGIN}, ${TOP_MARGIN})`)

    /**
     * Render connecting bracket lines for each data group.
     * Icons themselves are rendered in JSX via IconOverlay above the SVG.
     */
    groupInfo.groupPositions.forEach(({ group, position, width }) => {
      /** Only draw connecting lines if this group actually has data to display */
      const hasData = loadedGenes.some((gd) => gd.data[group].length > 0)
      if (!hasData || width <= 0) return

      /** Calculate vertical and horizontal positions for the connecting lines */
      const iconCenterX = LEFT_MARGIN + position + width / 2
      const iconBottomY = ICON_SPACING + ICON_HEIGHT
      const branchStartY = iconBottomY + 5
      const branchEndY = TOP_MARGIN - 5
      const groupStartX = LEFT_MARGIN + position
      const groupEndX = LEFT_MARGIN + position + width

      /** Draw the four bracket lines connecting the icon to the data columns */
      ;[
        [iconCenterX, branchStartY, groupStartX, branchStartY], /** Horizontal line to left edge */
        [iconCenterX, branchStartY, groupEndX, branchStartY],   /** Horizontal line to right edge */
        [groupStartX, branchStartY, groupStartX, branchEndY],   /** Left vertical bracket */
        [groupEndX, branchStartY, groupEndX, branchEndY],       /** Right vertical bracket */
      ].forEach(([x1, y1, x2, y2]) => {
        svg
          .append('line')
          .attr('x1', x1).attr('y1', y1)
          .attr('x2', x2).attr('y2', y2)
          .attr('stroke', theme.palette.text.secondary)
          .attr('stroke-width', 1)
      })
    })

    /**
     * Render the actual heatmap data for each gene.
     * Each gene gets its own row with expression data displayed as colored rectangles.
     */
    loadedGenes.forEach((geneData, row) => {
      /** Calculate vertical position for this gene's row */
      const yOffset = row * (ROW_HEIGHT + ROW_SPACING)

      /** Highlight the primary gene (currently selected) with bold text */
      const isPrimary = geneticElement?.id === geneData.gene

      /** Render the gene label on the left side of the row */
      mainGroup
        .append('text')
        .attr('x', -10)
        .attr('y', yOffset + ROW_HEIGHT / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .text(geneData.gene)
        .style('font-size', '14px')
        .style('fill', theme.palette.text.primary)
        .style('font-weight', isPrimary ? 'bold' : 'normal')

      /**
       * Render expression data cells for each group (plant, experiment, cell).
       * Each group can contain multiple databases, and each database can have multiple samples.
       */
      groupInfo.groupPositions.forEach(({ group, position }) => {
        /** Get all possible databases for this group type */
        const maxSamplesPerDBObj =
          group === 'plant'
            ? maxSamplesPerDBPlant
            : group === 'cell'
              ? maxSamplesPerDBCell
              : maxSamplesPerDBExperiment

        const allDbs = Object.keys(maxSamplesPerDBObj)

        /** Track horizontal position as we render each database */
        let currentX = position

        /** Render cells for each database in this group */
        allDbs.forEach((db) => {
          const dbMaxCount = maxSamplesPerDBObj[db] ?? 0

          /** Filter this gene's data to only include samples from current database */
          const dbSamples = geneData.data[group].filter(
            (p) => p.database === db
          )
          const rectWidth = groupInfo.cellWidth

          /** Find the maximum expression value for this database to normalize colors */
          const dbMaxValue = d3.max(dbSamples, (p) => p.value) ?? 0

          /**
           * Render a cell for each possible sample slot in this database.
           * If a gene doesn't have data for a sample, render a grey placeholder.
           */
          for (let i = 0; i < dbMaxCount; i++) {
            const point = dbSamples[i] ?? null

            /** Create a rectangle for each data point or placeholder */
            mainGroup
              .append('rect')
              .attr('x', currentX + i * rectWidth)
              .attr('y', yOffset)
              .attr('width', rectWidth)
              .attr('height', ROW_HEIGHT)
              .attr(
                'fill',
                point
                  ? getColor(point.value, point.group, point.control, theme, 'absolute')
                  : '#ccc'
              )
              .style('cursor', point ? 'pointer' : 'default')
              /** Show detailed information on hover for data points */
              .on('mouseover', (e) => {
                if (!point) return
                d3.select('.heatmap-tooltip')
                  .style('visibility', 'visible')
                  .style(
                    'background-color',
                    theme.palette.mode === 'dark' ? '#333' : '#fff'
                  )
                  .html(
                    `<strong>Gene:</strong> ${geneData.gene}<br/>
                     <strong>Sample:</strong> ${point.sample}<br/>
                     <strong>Value:</strong> ${point.value.toFixed(2)}<br/>
                     <strong>Database:</strong> ${point.database}`
                  )
              })
              /** Update tooltip position as mouse moves */
              .on('mousemove', (e) => {
                if (!point) return
                d3.select('.heatmap-tooltip')
                  .style('top', e.pageY - 10 + 'px')
                  .style('left', e.pageX + 10 + 'px')
              })
              /** Hide tooltip when mouse leaves */
              .on('mouseout', () =>
                d3.select('.heatmap-tooltip').style('visibility', 'hidden')
              )
          }

          /** Move to the next database position */
          currentX += dbMaxCount * rectWidth + DATABASE_GAP
        })
      })
    })
  }, [loadedGenes, groupInfo, theme])

  /**
   * Render the main component container with title, icon overlay, and SVG.
   * The SVG size is calculated based on the number of genes and layout constants.
   * The wrapper div uses position:relative so IconOverlay can be positioned
   * absolutely over the SVG without being inside the D3-managed SVG element.
   */
  const svgHeight =
    ROW_HEIGHT * loadedGenes.length +
    TOP_MARGIN +
    ICON_SPACING +
    ROW_SPACING * loadedGenes.length

  return (
    <div style={{ width: '100%', height: '100%', overflowX: 'auto', position: 'relative' }}>
      <h2 style={{ marginBottom: '30px' }}>HeatMap View</h2>

      {/* Loading overlay — sits on top without hiding existing content */}
      {isLoading && (
        <Box sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          zIndex: 10,
          backgroundColor: 'background.paper',
          borderRadius: 1,
          px: 1.5,
          py: 0.75,
          boxShadow: 1,
        }}>
          <CircularProgress size={16} />
          <Typography variant='body2' color='text.secondary'>
            Loading {geneticElement?.id}...
          </Typography>
        </Box>
      )}

      <div style={{ position: 'relative', display: 'inline-block', minWidth: '100%' }}>
        <IconOverlay groupPositions={groupInfo.groupPositions} />
        <svg ref={svgRef} width='100%' height={svgHeight} />
      </div>
    </div>
  )

}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Data loader function that fetches expression data for a specific genetic element.
 * Uses queryClient.fetchQuery with the same keys as PlantEFP, ExperimentEFP,
 * and CellEFP views so that React Query serves from cache when those views have
 * already loaded the data. Falls back to a real network fetch only when needed.
 *
 * @param geneticElement - The gene for which to load expression data
 * @param loadEvent - Callback function to report loading progress
 * @param queryClient - The shared React Query client used to read/write the cache
 * @returns Promise containing the formatted heatmap data
 */
export const HeatMapViewerLoader = async (
  geneticElement: GeneticElement | null,
  loadEvent: (loaded: number) => void,
  queryClient: QueryClient
): Promise<HeatMapViewerData> => {
  /** Validate that a genetic element was provided */
  if (!geneticElement) throw ViewDataError.UNSUPPORTED_GENE

  const geneId = geneticElement.id

  /**
   * Fetch all three data sources in parallel using the same query keys as the
   * individual EFP views. React Query will return cached data immediately if
   * PlantEFP, ExperimentEFP, or CellEFP have already fetched for this gene,
   * avoiding redundant network requests entirely.
   */
  const [plant, experiment, cell] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: [`plant-efp-${geneId}`],
      queryFn: () => EFPViewerLoader(geneticElement, plantEFPs, plantEFPViews, () => {}),
      staleTime: Infinity,
    }),
    queryClient.fetchQuery({
      queryKey: [`experiment-efp-${geneId}`],
      queryFn: () => EFPViewerLoader(geneticElement, experimentEFPs, experimentEFPViews, () => {}),
      staleTime: Infinity,
    }),
    queryClient.fetchQuery({
      queryKey: [`cell-efp-${geneId}`],
      queryFn: () => cellEFPLoader(geneticElement, () => {}),
      staleTime: Infinity,
    }),
  ])

  /** Report 100% loading completion */
  loadEvent(100)

  
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
        plant:
          plant?.viewData?.flatMap((sample: any, i: number) =>
            sample.groups.flatMap((g: EFPGroup) =>
              g.tissues.map((t: EFPTissue) => ({
                value: t.mean,
                sample: t.name,
                database: plant.views?.[i]?.name ?? g.name,
                group: g,
                control: sample.control ?? 1,
              }))
            )
          ) ?? [],

        /**
         * Experiment data: Expression under different experimental conditions.
         * Similar flattening process for consistency.
         */
        experiment:
          experiment?.viewData?.flatMap((sample: any, i: number) =>
            sample.groups.flatMap((g: EFPGroup) =>
              g.tissues.map((t: EFPTissue) => ({
                value: t.mean,
                sample: t.name,
                database: experiment.views?.[i]?.name ?? g.name,
                group: g,
                control: sample.control ?? 1,
              }))
            )
          ) ?? [],

        /**
         * Cell data: Expression in specific cell types.
         */
        cell:
          cell?.viewData?.groups?.flatMap((g: EFPGroup) =>
          g.tissues.map((t: EFPTissue) => ({
            value: t.mean,
            sample: t.name,
            database: g.name,
            group: g,
            control: cell?.viewData?.control ?? 1,
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
  }
}