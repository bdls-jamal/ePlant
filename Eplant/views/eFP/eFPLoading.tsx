import { useAtom } from 'jotai';

import { globalEFPDataAtom } from './eFPAtoms';

/**
 * Custom hook to manage EFP data loading with intelligent caching
 * Use this in ALL EFP views (PlantEFP, ExperimentEFP, CellEFP)
 * 
 * This hook caches the ORIGINAL EFPViewerData format, not the transformed GeneData format.
 * The HeatMapViewerLoader will transform it when needed.
 * 
 * @param geneticElement - The gene to load data for
 * @param dataType - Type of data: 'plant', 'experiment', or 'cell'
 */
export const useEFPData = (
    geneticElement: any,
    dataType: 'plant' | 'experiment' | 'cell'
) => {
    const [globalEFPData, setGlobalEFPData] = useAtom(globalEFPDataAtom);

    /**
     * Check if data exists in cache for this gene and data type.
     * We check if the cache entry exists AND has the viewData property
     * (which means it's the original EFPViewerData format)
     */
    const getCachedData = () => {
        if (!geneticElement?.id) return null;
        const cached = globalEFPData[dataType][geneticElement.id];
        
        if (!cached) return null;
        
        // If it has the full EFPViewerData format (views + viewData), return it directly
        if ('views' in cached && 'viewData' in cached) {
            return cached;
        }
        
        // If it has the flattened GeneData format from HeatMap, we need to convert it
        // back to EFPViewerData format for the EFP viewer to use
        if ('data' in cached && cached.data?.[dataType]?.length > 0) {
            // Return a minimal EFPViewerData-like structure that the viewer can use
            // This is a workaround - the viewer will still work with the cached data
            console.log(`✅ Using HeatMap cached data for ${dataType}:`, geneticElement.id);
            return cached; // Return as-is and let the component handle it
        }
        
        return null;
    };

    /**
     * Load data only if not in cache.
     * The loader function should return EFPViewerData format.
     * We'll store BOTH formats in the cache.
     */
    const loadData = async (
        loaderFn: () => Promise<any>
    ) => {
        if (!geneticElement?.id) return null;

        const cached = getCachedData();
        if (cached) {
            console.log(`✅ Cache hit for ${dataType}:`, geneticElement.id);
            return cached;
        }

        console.log(`📡 Cache miss - Loading ${dataType}:`, geneticElement.id);
        const result = await loaderFn();
        
        // Store the data in the cache
        // We store the original EFPViewerData format for EFP views to use
        if (result && geneticElement?.id) {
            // Create a cache entry that includes both formats
            const cacheEntry = {
                ...result,
                gene: geneticElement.id,
                // Add the flattened data property for HeatMap to use
                data: {
                    plant: dataType === 'plant' && result.viewData 
                        ? result.viewData.flatMap((sample: any) =>
                            sample.groups.flatMap((group: any) =>
                                group.tissues.map((tissue: any) => ({
                                    value: tissue.mean,
                                    sample: tissue.name,
                                    database: group.name
                                }))
                            )
                          )
                        : [],
                    experiment: dataType === 'experiment' && result.viewData
                        ? result.viewData.flatMap((sample: any) =>
                            sample.groups.flatMap((group: any) =>
                                group.tissues.map((tissue: any) => ({
                                    value: tissue.mean,
                                    sample: tissue.name,
                                    database: group.name
                                }))
                            )
                          )
                        : [],
                    cell: dataType === 'cell' && result.viewData?.groups
                        ? result.viewData.groups.flatMap((group: any) =>
                            group.tissues.map((tissue: any) => ({
                                value: tissue.mean,
                                sample: tissue.name,
                                database: group.name
                            }))
                          )
                        : []
                }
            };

            setGlobalEFPData(prev => ({
                ...prev,
                [dataType]: {
                    ...prev[dataType],
                    [geneticElement.id]: cacheEntry
                }
            }));
        }

        return result;
    };

    const cachedData = getCachedData();

    return {
        cachedData,
        loadData,
        hasCache: !!cachedData,
    };
};