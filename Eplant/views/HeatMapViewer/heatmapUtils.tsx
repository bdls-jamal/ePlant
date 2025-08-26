import { GlobalEFPData } from '../eFP/eFPAtoms';

export function removeGeneFromEFPData(prev: GlobalEFPData, geneId: string): GlobalEFPData {
  return {
    plant: Object.fromEntries(Object.entries(prev.plant).filter(([id]) => id !== geneId)),
    experiment: Object.fromEntries(Object.entries(prev.experiment).filter(([id]) => id !== geneId)),
    cell: Object.fromEntries(Object.entries(prev.cell).filter(([id]) => id !== geneId)),
  };
}