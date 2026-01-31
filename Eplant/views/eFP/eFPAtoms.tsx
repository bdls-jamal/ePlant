import { atom } from 'jotai';

import { GeneData } from '../HeatMapViewer/types';

type EFPViewType = 'plant' | 'experiment' | 'cell';

export type GlobalEFPData = {
  plant: Record<string, GeneData | undefined>;
  experiment: Record<string, GeneData | undefined>;
  cell: Record<string, GeneData | undefined>;
};

export const globalEFPDataAtom = atom<GlobalEFPData>({
  plant: {},
  experiment: {},
  cell: {},
});