// index.ts

import * as React from 'react';

import { View } from '@eplant/View';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';

import NavigatorView from './react-d3-tree-view'; // Import the new NavigatorView component

const KobiTestView: View = {
  name: 'ReactD3Tree View',
  component: NavigatorView, // Use the NavigatorView as the component
  async getInitialData() {
    return null;
  },
  id: 'reactd3tree-view',
  icon: () => <HomeOutlinedIcon />,
};

export default KobiTestView;
