import { useEffect, useMemo } from 'react'
import { useSetAtom } from 'jotai'
import { useOutletContext } from 'react-router-dom'

import GeneticElement from '@eplant/GeneticElement'
import { useURLState } from '@eplant/state/URLStateProvider'
import { ViewContext } from '@eplant/UI/Layout/ViewContainer/types'
import PanZoom from '@eplant/util/PanZoom'
import { ViewDataError } from '@eplant/View'
import { Box, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'

import { globalEFPDataAtom } from '../eFP/eFPAtoms'
import { EFPData } from '../eFP/types'
import Legend from '../eFP/Viewer/legend'

import { CellEFPDataObject } from './CellEFPDataObject'
import {
  CellEFPStateSchema,
  CellEFPViewerData,
  CellEFPViewerState,
} from './types'

export const CellEFPView = () => {
  const { geneticElement, setIsLoading, setLoadAmount } =
    useOutletContext<ViewContext>()
  const { state, setState, initializeState } = useURLState<CellEFPViewerState>()
  const setGlobalEFPData = useSetAtom(globalEFPDataAtom)
  const { data, isLoading, isError, error } = useQuery<CellEFPViewerData>({
    queryKey: [`cell-efp-${geneticElement?.id}`],
    queryFn: async () => {
      const result = await cellEFPLoader(geneticElement, setLoadAmount)
      if (geneticElement?.id && result?.viewData) {
        setGlobalEFPData(prev => ({
          ...prev,
          cell: {
            ...prev.cell,
            [geneticElement.id]: {
              gene: geneticElement.id,
              data: {
                plant: [],
                experiment: [],
                cell: result.viewData.groups.flatMap(group =>
                  group.tissues.map(tissue => ({
                    value: tissue.mean,
                    sample: tissue.name,
                    database: group.name
                  }))
                )
              }
            }
          }
        }));
      }
      return result
    },
    enabled: !!geneticElement,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
    
  useEffect(() => {
    // On mount, initialize state
    initializeState(CellEFPStateSchema)
  }, [])

  useEffect(() => {
    setIsLoading(isLoading)
  }, [isLoading])

  const efp = useMemo(() => {
    const Component = CellEFPDataObject.component
    if (data) {
      return <Component data={data} geneticElement={geneticElement} />
    } else {
      return <div>TODO</div>
    }
  }, [geneticElement?.id, data])

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
