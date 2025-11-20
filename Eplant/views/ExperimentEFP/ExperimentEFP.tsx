import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'

import { useURLState } from '@eplant/state/URLStateProvider'
import { ViewContext } from '@eplant/UI/Layout/ViewContainer/types'
import { useQuery } from '@tanstack/react-query'

import { EFPViewer, EFPViewerLoader } from '../eFP/Viewer/EFPViewer'
import {
  EFPViewerData,
  EFPViewerState,
  EFPViewerStateSchema,
} from '../eFP/Viewer/types'

import { experimentEFPs, experimentEFPViews } from './efps'

/**
 * ExperimentEFP component displays gene expression data across different experimental conditions.
 * It fetches data using React Query, which automatically caches the results
 * based on the gene ID. This cached data can be reused by other components
 * like the HeatMap view without refetching.
 */
export const ExperimentEFP = () => {
  const { geneticElement, setIsLoading, setLoadAmount } =
    useOutletContext<ViewContext>()
  const { state, setState, initializeState } = useURLState<EFPViewerState>()

  /**
   * Fetch experiment expression data for the current genetic element.
   * React Query automatically caches this data with the key `experiment-efp-${geneId}`.
   * Other components can access this cached data by using the same query key.
   */
  const { data, isLoading, isError, error } = useQuery<EFPViewerData>({
    queryKey: [`experiment-efp-${geneticElement?.id}`],
    queryFn: async () => {
      console.log(`[ExperimentEFP] 🔄 Fetching data for gene: ${geneticElement?.id}`);
      const result = await EFPViewerLoader(
        geneticElement,
        experimentEFPs,
        experimentEFPViews,
        setLoadAmount
      );
      console.log(`[ExperimentEFP] ✅ Data fetched for gene: ${geneticElement?.id}`, result);
      return result;
    },
    enabled: !!geneticElement,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  /** Initialize the URL state schema when component mounts */
  useEffect(() => {
    initializeState(EFPViewerStateSchema)
  }, [initializeState])

  /** Update parent component's loading state when our loading state changes */
  useEffect(() => {
    setIsLoading(isLoading)
  }, [isLoading, setIsLoading])

  /** Don't render the viewer until data is loaded and state is initialized */
  if (isLoading || isError || !data || !state) return <></>

  /** Render the EFP viewer with the fetched data */
  return (
    <EFPViewer
      data={data}
      state={state}
      geneticElement={geneticElement}
      efps={experimentEFPs}
      setViewState={setState}
    />
  )
}