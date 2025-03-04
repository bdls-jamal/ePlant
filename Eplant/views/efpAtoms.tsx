import { atom } from 'jotai'

import { EFPData } from './eFP/types'

export const globalEFPDataAtom = atom<EFPData | null>(null)
