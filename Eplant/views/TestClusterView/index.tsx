// index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import Dendrogram from './Dendrogram';
import { data } from "./data";

import { View } from '@eplant/View';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';


// const App = () => (
//   <div>
//     <h1>Horizontal Dendrogram</h1>
//     <Dendrogram data={data} width={600} height={400}/>
// </div>
// );

// const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
// root.render(<App />);

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
