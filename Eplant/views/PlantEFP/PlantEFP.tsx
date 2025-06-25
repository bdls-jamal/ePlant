import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { useOutletContext } from 'react-router-dom'

import { validateType } from '@eplant/state/stateUtils'
import { useURLState } from '@eplant/state/URLStateProvider'
import { ViewContext } from '@eplant/UI/Layout/ViewContainer/types'
import { useQuery } from '@tanstack/react-query'

import { globalEFPDataAtom } from '../eFP/eFPAtoms'
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
  const setGlobalEFPData = useSetAtom(globalEFPDataAtom);
  const { data, isLoading, isError, error } = useQuery<EFPViewerData>({
    queryKey: [`plant-efp-${geneticElement?.id}`],
      queryFn: async () => {
        const result = await EFPViewerLoader(geneticElement, plantEFPs, plantEFPViews, setLoadAmount);
        console.log(result)
        if (geneticElement?.id && result?.viewData) {
          setGlobalEFPData(prev => ({
            ...prev,
            plant: {
              ...prev.plant,
              [geneticElement.id]: {
                gene: geneticElement.id,
                data: {
                  plant: result.viewData.flatMap((sample) =>
                    sample.groups.flatMap((group) =>
                      group.tissues.map((tissue) => ({
                        value: tissue.mean,
                        sample: tissue.name,
                        database: group.name
                      }))
                    )
                  ),
                  experiment: [],
                  cell: []
                }
              }
            }
          }));
        }
        return result;
      },
    enabled: !!geneticElement,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    // On mount, set the active actions and initialize the state
    initializeState(EFPViewerStateSchema)
  }, [])

  useEffect(() => {
    setIsLoading(isLoading)
  }, [isLoading, setIsLoading])

  if (isLoading || isError || !data || !state) return <></>

  return (
    <EFPViewer
      data={data}
      state={state}
      geneticElement={geneticElement}
      efps={plantEFPs}
      setViewState={setState}
    ></EFPViewer>
  )
}
