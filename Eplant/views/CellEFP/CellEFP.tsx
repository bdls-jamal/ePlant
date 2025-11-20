import { useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'

import GeneticElement from '@eplant/GeneticElement'
import { useURLState } from '@eplant/state/URLStateProvider'
import { ViewContext } from '@eplant/UI/Layout/ViewContainer/types'
import PanZoom from '@eplant/util/PanZoom'
import { ViewDataError } from '@eplant/View'
import { Box, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'

import Legend from '../eFP/Viewer/legend'

import { CellEFPDataObject } from './CellEFPDataObject'
import {
  CellEFPStateSchema,
  CellEFPViewerData,
  CellEFPViewerState,
} from './types'

/**
 * CellEFPView component displays gene expression data across different cell types.
 * It fetches data using React Query, which automatically caches the results
 * based on the gene ID. This cached data can be reused by other components
 * like the HeatMap view without refetching.
 */
export const CellEFPView = () => {
  const { geneticElement, setIsLoading, setLoadAmount } =
    useOutletContext<ViewContext>()
  const { state, setState, initializeState } = useURLState<CellEFPViewerState>()

  /**
   * Fetch cell expression data for the current genetic element.
   * React Query automatically caches this data with the key `cell-efp-${geneId}`.
   * Other components can access this cached data by using the same query key.
   */
  const { data, isLoading, isError, error } = useQuery<CellEFPViewerData>({
    queryKey: [`cell-efp-${geneticElement?.id}`],
    queryFn: async () => {
      console.log(`[CellEFP] 🔄 Fetching data for gene: ${geneticElement?.id}`)
      const result = await cellEFPLoader(geneticElement, setLoadAmount)
      console.log(
        `[CellEFP] ✅ Data fetched for gene: ${geneticElement?.id}`,
        result
      )
      return result
    },
    enabled: !!geneticElement,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  /** Initialize the URL state schema when component mounts */
  useEffect(() => {
    initializeState(CellEFPStateSchema)
  }, [initializeState])

  /** Update parent component's loading state when our loading state changes */
  useEffect(() => {
    setIsLoading(isLoading)
  }, [isLoading, setIsLoading])

  /** Memoize the EFP component to avoid unnecessary re-renders */
  const efp = useMemo(() => {
    const Component = CellEFPDataObject.component
    if (data) {
      return <Component data={data} geneticElement={geneticElement} />
    } else {
      return <div>TODO</div>
    }
  }, [geneticElement?.id, data])

  /** Don't render the viewer until data is loaded and state is initialized */
  if (isLoading || isError || !data || !state) return <></>

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <Typography variant='h6'>
          {'Cell EFP'}
          {': '}
          {geneticElement?.id}
        </Typography>
      </Box>
      <Box
        sx={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          justifyContent: 'stretch',
          overflow: 'hidden',
        }}
      >
        {/* main canvas area */}
        <Box
          sx={(theme) => ({
            flexGrow: 1,
            position: 'relative',
          })}
        >
          <>
            <Legend
              sx={(theme) => ({
                position: 'absolute',
                left: theme.spacing(2),
                bottom: theme.spacing(2),
                zIndex: 10,
              })}
              data={{
                ...data.viewData,
              }}
              colorMode={'absolute'}
            />
            <PanZoom
              sx={(theme) => ({
                position: 'absolute',
                top: theme.spacing(0),
                left: theme.spacing(0),
                width: '100%',
                height: '100%',
                zIndex: 0,
              })}
              transform={state.transform}
              onTransformChange={(transform) => {
                setState({ ...state, transform: transform })
              }}
            >
              {efp}
            </PanZoom>
          </>
        </Box>
      </Box>
    </Box>
  )
}

/**
 * Loader function that fetches cell expression data for a specific genetic element.
 * This function is called by React Query and its results are automatically cached.
 *
 * @param geneticElement - The gene for which to load expression data
 * @param loadEvent - Callback function to report loading progress
 * @returns Promise containing the formatted cell EFP data
 */
export const cellEFPLoader = async (
  geneticElement: GeneticElement | null,
  loadEvent: (loaded: number) => void
) => {
  if (!geneticElement) throw ViewDataError.UNSUPPORTED_GENE

  let totalLoaded = 0
  const viewData = await CellEFPDataObject.getInitialData(
    geneticElement,
    (progress) => {
      totalLoaded += progress
      loadEvent(totalLoaded)
    }
  )

  return {
    viewData: viewData,
  }
}
