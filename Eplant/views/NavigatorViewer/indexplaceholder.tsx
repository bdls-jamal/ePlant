// index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';

import GeneticElement from '@eplant/GeneticElement';
import { View } from '@eplant/View';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';

import Dendrogram from './NavigatorView';

interface ClusterViewData {
  apiUrl: string;
}


const TestClusterView: View = {
  name: 'Cluster View',
  component: ({ activeData, geneticElement }) => {
    // Construct API URL using genetic element data
    const baseUrl = 'https://bar.utoronto.ca/webservices/eplant_navigator/cgi-bin/eplant_navigator_service.cgi';
    const gene = geneticElement?.id || 'AT3G24650';
    // Extract species name properly - assuming it's a string property
    const species = geneticElement?.species?.name || 'Arabidopsis';
    
    // Create the complete URL with all parameters, ensuring species is properly formatted
    const apiUrl = `${baseUrl}?primaryGene=${encodeURIComponent(gene)}&species=${encodeURIComponent(species)}&dataset=Developmental&checkedspecies=arabidopsis_poplar_medicago_soybean_rice_barley_maize_potato_tomato_grape`;
    
    return (
      <DendrogramContext.Provider value={{ apiUrl }}>
        <Dendrogram />
      </DendrogramContext.Provider>
    );
  },
  
  async getInitialData(gene: GeneticElement | null) {
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
  
  id: 'cluster-view',
  icon: () => <HomeOutlinedIcon />,
};

// Create a context with a properly formatted default URL
export const DendrogramContext = React.createContext<{ apiUrl: string }>({
  apiUrl: 'https://bar.utoronto.ca/webservices/eplant_navigator/cgi-bin/eplant_navigator_service.cgi?primaryGene=AT3G24650&species=Arabidopsis&dataset=Developmental&checkedspecies=arabidopsis_poplar_medicago_soybean_rice_barley_maize_potato_tomato_grape'
});

export default TestClusterView;