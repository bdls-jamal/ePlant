  // Initialize zoom behavior
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current as SVGSVGElement);
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        setTransform(event.transform);
      });

    // Apply zoom behavior with proper typing
    svg
      .call(zoom as any)  // Type assertion needed due to d3's typing limitations
      .call(
        zoom.transform as any, 
        d3.zoomIdentity.translate(MARGIN.left, MARGIN.top)
      );

    // Add zoom reset on double click
    svg.on('dblclick.zoom', () => {
      svg
        .transition()
        .duration(750)
        .call(
          zoom.transform as any,
          d3.zoomIdentity.translate(MARGIN.left, MARGIN.top)
        );
    });

    // Cleanup
    return () => {
      svg.on('.zoom', null);
    };
  }, [dimensions.width, dimensions.height]);