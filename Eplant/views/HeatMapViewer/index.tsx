import React from 'react';

import GeneticElement from '@eplant/GeneticElement';
import { View } from '@eplant/View';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';

import { createViewSwitchProvider } from '../ViewGeneSwitching';

import HeatMapViewObject from './Heatmap';
import HeatMapIcon from './icon';

/** Use the provider from helper function */
export const ViewSwitchProvider = createViewSwitchProvider();

export const HeatMapContext = React.createContext<{ geneName: string }>({
  geneName: 'AT3G24650', // Default gene name for now
});

/** Define heatmap view configuration */
const HeatMap: View = {
  name: 'HeatMap view',
  component: ({ geneticElement }) => {
    // Extract gene name from the selected genetic element
    const geneName = geneticElement?.id || ''; // Gene name or ID
    const species = geneticElement?.species?.name || ''; // Species name

    return (
      <HeatMapContext.Provider value={{ geneName }}>
        <HeatMapViewObject />
      </HeatMapContext.Provider>
    );
  },
  async getInitialData(gene: GeneticElement | null, loadEvent: (progress: number) => void) {
    loadEvent(1);
    return null;
  },
  async getInitialState() {
    return {
      transform: {
        dx: 0,
        dy: 0,
      },
    };
  },
  id: 'heatmap-view',
  icon: () => <HeatMapIcon />,
};

export default HeatMap;
