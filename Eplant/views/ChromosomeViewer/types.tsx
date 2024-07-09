
// Centromere
export interface CentromereItem {
	id: string,
	start: number,
	end: number,
}
export interface CentromereList extends Array<CentromereItem> { }
// Chromosome
export interface ChromosomeItem {
	id: string,
	name: string,
	size: number,
	centromeres: CentromereList | []
}
export interface ChromosomeList extends Array<ChromosomeItem> { }
export interface ChromosomesResponseObj {
	"species": string,
	"chromosomes": ChromosomeList
}
// Simplified Gene Item contains only neccary information for drawing the gene indicator
export interface SimplifiedGeneItem {
	id: string,
	chromosome: string,
	location: number, // y coordinate of gene
	strand: string // influences if gene is left or right of chromosome
}

// Genes
export interface GeneItem {
	id: string,
	chromosome?: string,
	start: number,
	end: number,
	strand: string,
	aliases: [],
	annotation: string
}
export interface GeneArray extends Array<GeneItem> { }

// Component Props
export type Transform = {
	scale: number,
	translation: {
		x: number,
		y: number
	}
}
export type ChromosomeViewerData = ChromosomeList
export type ChromosomeViewerState = {
	value: Transform
}
export type ChromosomeViewerAction =
	| { type: 'reset-transform' }
	| { type: 'set-transform'; value: Transform }



