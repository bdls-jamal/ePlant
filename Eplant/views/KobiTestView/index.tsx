// index.ts

import * as React from 'react';

import { View } from '@eplant/View';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';

import NavigatorView from './NavigatorView'; // Import the new NavigatorView component

const KobiTestView: View = {
  name: 'Navigator View',
  component: NavigatorView, // Use the NavigatorView as the component
  async getInitialData() {
    return null;
  },
  id: 'navigator-view',
  icon: () => <HomeOutlinedIcon />,
};

export default KobiTestView;
