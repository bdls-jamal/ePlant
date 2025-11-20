import { ViewMetadata } from '@eplant/View'
import YoutubeSearchedForRoundedIcon from '@mui/icons-material/YoutubeSearchedForRounded'

import HeatMapIcon from './Heat_Icons'
import { HeatMapViewerData, HeatMapViewerState } from './types'

/** Define heatmap view configuration */
const HeatMap: ViewMetadata<HeatMapViewerData, HeatMapViewerState> = {
  name: 'HeatMap view',
  id: 'heatmap-view',

  icon: () => <HeatMapIcon />,
  description: 'HeatMap Viewer.',
  citation() {
    return <div></div>
  },
  actions: [
    {
      name: 'Reset Pan/Zoom',
      description: 'Reset the pan and zoom of the viewer',
      icon: <YoutubeSearchedForRoundedIcon />,
      mutation: (prevState) => ({
        ...prevState,
        transform: {
          offset: {
            x: 0,
            y: 0,
          },
          zoom: 1,
        },
      }),
    },
  ],
}

export default HeatMap
