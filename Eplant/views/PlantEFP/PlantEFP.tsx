import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'

import { useURLState } from '@eplant/state/URLStateProvider'
import { ViewContext } from '@eplant/UI/Layout/ViewContainer/types'
import { useQuery } from '@tanstack/react-query'

import { useEFPData } from '../eFP/eFPLoading'
import { EFPViewer, EFPViewerLoader } from '../eFP/Viewer/EFPViewer'
import {
  EFPViewerData,
  EFPViewerState,
  EFPViewerStateSchema,
} from '../eFP/Viewer/types'

import { plantEFPs, plantEFPViews } from './efps'

export const PlantEFP = () => {
  const { geneticElement, setIsLoading, setLoadAmount } =
    useOutletContext<ViewContext>()
  const { state, setState, initializeState } = useURLState<EFPViewerState>()
  
  // Use the new caching hook
  const { cachedData, loadData, hasCache } = useEFPData(geneticElement, 'plant')

  // Query with integrated cache checking
  const { data, isLoading, isError } = useQuery<EFPViewerData>({
    queryKey: [`plant-efp-${geneticElement?.id}`],
    queryFn: async () => {
      console.log('🌱 PlantEFP query executing for:', geneticElement?.id);
      
      // Use the loadData function which checks cache first
      return await loadData(async () => {
        console.log('📡 PlantEFP: Making API call');
        const result = await EFPViewerLoader(
          geneticElement, 
          plantEFPs, 
          plantEFPViews, 
          setLoadAmount
        );
        
        // Return the full result - it already has the right structure
        return result;
      });
    },
    enabled: !!geneticElement,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    // On mount, set the active actions and initialize the state
    initializeState(EFPViewerStateSchema)
  }, [initializeState])

  useEffect(() => {
    setIsLoading(isLoading)
  }, [isLoading, setIsLoading])

  // Use cached data immediately if available, otherwise wait for query
  const displayData = (data || cachedData) as EFPViewerData | undefined;

  if (isLoading || isError || !displayData || !state) return <></>

  return (
      <EFPViewer
        data={displayData}
        state={state}
        geneticElement={geneticElement}
        efps={plantEFPs}
        setViewState={setState}
      />
  )
}