import React from 'react';

import { View } from '@eplant/View';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';

import Dendrogram from './Dendrogram';

// Define the view
const TestClusterView: View = {
  name: 'Cluster View',
  component: (props) => {
    // Type cast props to include the necessary fields
    const { newick, eFPLinks, seq, scc, genomes } = props as unknown as {
      newick: string;
      eFPLinks: any;
      seq: any;
      scc: any;
      genomes: any;
    };

    // Pass props to the Dendrogram component
    return (
      <Dendrogram
        newick={newick}
        eFPLinks={eFPLinks}
        seq={seq}
        scc={scc}
        genomes={genomes}
      />
    );
  },
  async getInitialData() {
    const response = await fetch('//bar.utoronto.ca/webservices/eplant_navigator/cgi-bin/eplant_navigator_service.cgi?primaryGene=query&species=species&dataset=Developmental&checkedspecies=arabidopsis_poplar_medicago_soybean_rice_barley_maize_potato_tomato_grape');
    const data = await response.json();
    return {
      newick: data.tree,
      eFPLinks: data.efp_links,
      seq: data.sequence_similarity,
      scc: data.SCC_values,
      genomes: data.genomes
    };
  },
  id: 'cluster-view',
  icon: () => <HomeOutlinedIcon />,
};

export default TestClusterView;
