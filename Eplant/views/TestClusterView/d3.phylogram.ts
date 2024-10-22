import * as d3 from 'd3';
import { max } from 'd3-array';
import { cluster, ClusterLayout, hierarchy, HierarchyNode } from 'd3-hierarchy';
import { ScaleLinear } from 'd3-scale';
import { scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';

// Define interfaces for TypeScript
interface Node {
  x: number;
  y: number;
  name?: string;
  children?: Node[];
  branchset?: Node[];
  length?: number;
  parent?: Node;
  rootDist?: number;
  depth?: number;
}

interface DiagonalPath {
  source: Node;
  target: Node;
}

interface PhylogramOptions {
  width?: number;
  height?: number;
  vis?: any;
  tree?: d3.ClusterLayout<Node>;
  children?: (node: Node) => Node[];
  diagonal?: any;
  skipBranchLengthScaling?: boolean;
  skipLabels?: boolean;
  skipTicks?: boolean;
}

interface Diagonal {
  (diagonalPath: DiagonalPath): string;
  projection: (x: (d: Node) => [number, number]) => Diagonal;
  path: (x: (pathData: [number, number][]) => string) => Diagonal;
}

const phylogram = {
  rightAngleDiagonal(): Diagonal {
    let projection = function(d: Node): [number, number] {
      return [d.y, d.x];
    };
    
    let path = function(pathData: [number, number][]): string {
      return `M${pathData[0]} ${pathData[1]} ${pathData[2]}`;
    };

    function diagonal(diagonalPath: DiagonalPath): string {
      const source = diagonalPath.source;
      const target = diagonalPath.target;
      const pathData = [
        source,
        {x: target.x, y: source.y},
        target
      ].map(projection);
      return path(pathData);
    }

    (diagonal as Diagonal).projection = function(x: typeof projection): Diagonal {
      if (!arguments.length) return diagonal as Diagonal;
      projection = x;
      return diagonal as Diagonal;
    };

    (diagonal as Diagonal).path = function(x: typeof path): Diagonal {
      if (!arguments.length) return diagonal as Diagonal;
      path = x;
      return diagonal as Diagonal;
    };

    return diagonal as Diagonal;
  },

  coordinateToAngle(coord: [number, number], radius: number): number {
    return 0; // replace with actual implementation
  },

  styleTreeNodes(vis: any): void {
    // ... existing styleTreeNodes function ...
  },

  build(
    selector: string | HTMLElement,
    nodes: Node,
    query: string,
    eFPLinks: any,
    gens: any,
    scc: any,
    seq: any,
    options: PhylogramOptions = {}
  ): { tree: any; vis: any } {
    const w = options.width || select(selector as string).style('width') || select(selector as string).attr('width') || '0';
    const h = options.height || select(selector as string).style('height') || select(selector as string).attr('height') || '0';
   
    const width = parseInt(w.toString());
    const height = parseInt(h.toString());

    // Create cluster layout using d3.cluster()
    const hierarchyData = d3.hierarchy(nodes, options.children || ((node: Node) => node.branchset));
    const treeLayout = d3.cluster<Node>()
      .size([height, width]);


    // Custom sort function
    const sortedTree = (data: Node) => {
      const root = d3.hierarchy(data);
      const sortedRoot = root.sort((a, b) => 
        (b.children?.length || 0) - (a.children?.length || 0)
      );
      return treeLayout(sortedRoot);
    };

    const tree = options.tree || sortedTree;
    const diagonal = options.diagonal || phylogram.rightAngleDiagonal();
    const vis = options.vis || select(selector as string).append("svg:svg")
      .attr("width", width + 1000)
      .attr("height", height + 50)
      .append("svg:g")
      .attr("transform", "translate(20, 20)");

    const processedNodes = tree(hierarchyData);

    const genomes = gens;
    const sccValues = scc;
    const seqValues = seq;

    // Hide until active
    select(selector as string).style("visibility", "hidden");

    // Initialize yscale with a default value
    let yscale: ScaleLinear<number, number> = scaleLinear()
      .domain([0, width])
      .range([0, width]);

    if (!options.skipBranchLengthScaling) {
      yscale = scaleLinear()
        .domain([0, width])
        .range([0, width]);
    }

    return { tree, vis };
  }
};

export default phylogram;