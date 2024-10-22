import React, { useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';

import { ViewProps } from '@eplant/View';

import phylogram from './d3.phylogram';

// Define the interface for your component's props
interface DendrogramProps {
  newick: string;
  eFPLinks: any;
  seq: any;
  scc: any;
  genomes: any;
}

const Dendrogram: React.FC<DendrogramProps> = ({ newick, eFPLinks, seq, scc, genomes }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const data: DendrogramProps = {newick, eFPLinks, seq, scc, genomes};

  useEffect(() => {
    if (!containerRef.current || !data) return;

    // We'll need to wait for d3.phylogram to be available
    const initializePhylogram = () => {
      if (!(window as any).d3?.phylogram) {
        setTimeout(initializePhylogram, 100);
        return;
      }

      const lineHeight = 30;
      const numLines = Object.keys(data.genomes).length + 1;

      // Clear previous content
      containerRef.current!.innerHTML = '';

      // Use d3.phylogram
      (window as any).d3.phylogram.build(
        containerRef.current,
        (window as any).Newick.parse(data.newick),
        'query', // Replace with actual query
        data.eFPLinks,
        data.genomes,
        data.scc,
        data.seq,
        {
          width: 160,
          height: lineHeight * numLines,
        }
      );
    };

    initializePhylogram();
  }, [data]);

  return (
    <>
      <Helmet>
        <script src="/path/to/d3-phylogram.js" type="text/javascript" />
        <script src="/path/to/newick.js" type="text/javascript" />
      </Helmet>
      <div 
        ref={containerRef}
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'relative',
          top: '30px',
          overflow: 'auto',
          backgroundColor: '#ffffff'
        }}
      />
    </>
  );
};

export default Dendrogram;