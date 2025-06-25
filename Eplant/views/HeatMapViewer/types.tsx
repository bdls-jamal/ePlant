import { z } from 'zod'

/** 
 * Mapping of view types to their corresponding display names.
 * Used for switching between different visualization modes.
 */
export type ViewMap = {
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
export type GeneData = {
  gene: string;
  data: {
    plant: DataPoint[];
    experiment: DataPoint[];
    cell: DataPoint[];
  };
};

/** Define the data structure returned by the loader */
export interface HeatMapViewerData {
  geneData: GeneData // The actual tree data fetched from API
  viewMap: ViewMap
}

/** Define the schema for URL state synchronization */
export const HeatMapViewStateSchema = z.object({
  transform: z.object({
    offset: z.object({
      x: z.number().default(0),
      y: z.number().default(0),
    }),
    zoom: z.number().default(1),
  }),
})

/** Infer TypeScript type from Zod schema */
export type HeatMapViewerState = z.infer<typeof HeatMapViewStateSchema>