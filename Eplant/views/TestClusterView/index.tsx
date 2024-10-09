// index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';

import { View } from '@eplant/View';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';

import Dendrogram from './Dendrogram';

const TestClusterView: View = {
  name: 'Cluster View',
  component: Dendrogram,
  async getInitialData() {
    return null;
  },
  id: 'cluster-view',
  icon: () => <HomeOutlinedIcon />,
};

export default TestClusterView;
