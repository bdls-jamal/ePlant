import { atom } from 'jotai';

import { GeneData } from '../HeatMapViewer/types';

type EFPViewType = 'plant' | 'experiment' | 'cell';

export type GlobalEFPData = {
  plant: Record<string, GeneData>;
  experiment: Record<string, GeneData>;
  cell: Record<string, GeneData>;
};

export const globalEFPDataAtom = atom<GlobalEFPData>({
  plant: {},
  experiment: {},
  cell: {},
});