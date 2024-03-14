import { useState } from 'react'
import { useContext } from 'react'
import { useAtom } from 'jotai';

import { collapseContext } from '@eplant/Eplant'
import { changeCollapse,isCollapse as isCollapseState } from '@eplant/Eplant';
import ArrowCircleLeftIcon from '@mui/icons-material/ArrowCircleLeft';
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight';
import { Container } from '@mui/material'
import { Box } from '@mui/material'

import SerializedGeneticElement from '../GeneticElement'
import { useActiveId, usePanes } from '../state'

import { LeftNav } from './LeftNav'
import ResponsiveDrawer from './ResponsiveDrawer'


// This sidebar width is hard coded --> not responsive to screen size
export const sidebarWidth = 300


export default function Sidebar() {
  const [panes, panesDispatch] = usePanes()
  const [activeId] = useActiveId()

  //Grabbing collapse state from useContext hook
  const context = useContext(collapseContext)
  const collapse = context.collapse

  // trying out jotai
  const [isCollapse] = useAtom(isCollapseState)
  return (
    <div>

      <ResponsiveDrawer
        variant='persistent'
        open={true}
        PaperProps={{
          sx: {
            border: 'none',
            backgroundColor: 'transparent',
          },
        }}
      >

        <Container
          disableGutters
          sx={{
            height: '100%',
            padding: '20px',
            width: `${isCollapse ? 100 : sidebarWidth}px`,
            boxSizing: 'border-box',
            transition: 'all 1s ease-out'
          }}
        >
          <LeftNav
            onSelectGene={(gene: SerializedGeneticElement) =>
              panesDispatch({
                type: 'set-active-gene',
                id: activeId,
                activeGene: gene.id,
              })
            }
            selectedGene={panes[activeId ?? '']?.activeGene ?? undefined}
          />
        </Container>

      </ResponsiveDrawer>
    </div>
  )
}
