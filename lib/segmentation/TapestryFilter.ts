/**
 * TapestryFilter - ESRI Tapestry Segmentation Filter Engine
 *
 * Filters precincts based on ESRI Tapestry segments, LifeMode groups,
 * and demographic/political characteristics of segments.
 *
 * Tapestry Segmentation classifies US neighborhoods into 67 unique segments
 * based on socioeconomic and demographic characteristics.
 */

import type {
    TapestryFilters,
    TapestrySegment,
    PrecinctTapestry,
} from './types';

/**
 * TapestryFilter - Filter precincts by Tapestry segments
 */
export class TapestryFilter {
    private segments: Map<string, TapestrySegment>;
    private precinctTapestry: Map<string, PrecinctTapestry>;

    constructor(segments: TapestrySegment[], precinctTapestry: PrecinctTapestry[]) {
        this.segments = new Map(segments.map(seg => [seg.code, seg]));
        this.precinctTapestry = new Map(precinctTapestry.map(pt => [pt.precinctId, pt]));
    }

    /**
     * Filter precincts based on Tapestry criteria
     */
    filterPrecincts(precinctIds: string[], filters: TapestryFilters): string[] {
        return precinctIds.filter(id => {
            const tapestry = this.precinctTapestry.get(id);
            if (!tapestry) return false;

            const segment = this.segments.get(tapestry.dominantSegment);
            if (!segment) return false;

            // Filter by specific segments
            if (filters.tapestrySegments && filters.tapestrySegments.length > 0) {
                if (!filters.tapestrySegments.includes(tapestry.dominantSegment)) {
                    return false;
                }
            }

            // Filter by LifeMode groups
            if (filters.lifeModeGroups && filters.lifeModeGroups.length > 0) {
                if (!filters.lifeModeGroups.includes(segment.lifeModeGroup)) {
                    return false;
                }
            }

            // Filter by urbanization
            if (filters.urbanization && filters.urbanization.length > 0) {
                if (!filters.urbanization.includes(segment.urbanization)) {
                    return false;
                }
            }

            // Filter by lifestage
            if (filters.lifestage && filters.lifestage.length > 0) {
                if (!filters.lifestage.includes(segment.lifestage as any)) {
                    return false;
                }
            }

            // Filter by affluence
            if (filters.affluence && filters.affluence.length > 0) {
                if (!filters.affluence.includes(segment.affluence)) {
                    return false;
                }
            }

            // Filter by expected partisan lean
            if (filters.expectedPartisanLean) {
                const leanMatches = this.matchesPartisanLean(
                    segment.expectedPartisanLean,
                    filters.expectedPartisanLean
                );
                if (!leanMatches) return false;
            }

            // Filter by Tapestry diversity
            if (filters.minTapestryDiversity !== undefined) {
                if (tapestry.diversityScore < filters.minTapestryDiversity) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Get segment by code
     */
    getSegment(code: string): TapestrySegment | undefined {
        return this.segments.get(code);
    }

    /**
     * Get all segments in a LifeMode group
     */
    getSegmentsByLifeMode(groupNumber: number): TapestrySegment[] {
        return Array.from(this.segments.values()).filter(
            seg => seg.lifeModeGroup === groupNumber
        );
    }

    /**
     * Get segments by characteristic
     */
    getSegmentsByCharacteristic(char: string, value: string): TapestrySegment[] {
        return Array.from(this.segments.values()).filter(seg => {
            switch (char) {
                case 'urbanization':
                    return seg.urbanization === value;
                case 'lifestage':
                    return seg.lifestage === value;
                case 'affluence':
                    return seg.affluence === value;
                default:
                    return false;
            }
        });
    }

    /**
     * Get precinct Tapestry assignment
     */
    getPrecinctTapestry(precinctId: string): PrecinctTapestry | undefined {
        return this.precinctTapestry.get(precinctId);
    }

    /**
     * Get dominant segment for a precinct
     */
    getDominantSegmentForPrecinct(precinctId: string): string | undefined {
        return this.precinctTapestry.get(precinctId)?.dominantSegment;
    }

    /**
     * Get segment distribution across precincts
     */
    getSegmentDistribution(precinctIds: string[]): Record<string, number> {
        const distribution: Record<string, number> = {};

        precinctIds.forEach(id => {
            const tapestry = this.precinctTapestry.get(id);
            if (tapestry) {
                const code = tapestry.dominantSegment;
                distribution[code] = (distribution[code] || 0) + 1;
            }
        });

        return distribution;
    }

    /**
     * Get LifeMode group distribution across precincts
     */
    getLifeModeDistribution(precinctIds: string[]): Record<string, number> {
        const distribution: Record<string, number> = {};

        precinctIds.forEach(id => {
            const tapestry = this.precinctTapestry.get(id);
            if (tapestry) {
                const segment = this.segments.get(tapestry.dominantSegment);
                if (segment) {
                    const groupName = segment.lifeModeGroupName;
                    distribution[groupName] = (distribution[groupName] || 0) + 1;
                }
            }
        });

        return distribution;
    }

    /**
     * Estimate partisan lean for a segment
     */
    estimatePartisanLean(tapestryCode: string): number {
        const segment = this.segments.get(tapestryCode);
        return segment ? segment.expectedPartisanLean : 0;
    }

    /**
     * Get segments aligned with a political lean
     */
    getPoliticallyAlignedSegments(leanType: string): string[] {
        const segments = Array.from(this.segments.values());

        return segments
            .filter(seg => {
                switch (leanType) {
                    case 'strong_dem':
                        return seg.expectedPartisanLean >= 20;
                    case 'lean_dem':
                        return seg.expectedPartisanLean >= 5 && seg.expectedPartisanLean < 20;
                    case 'toss_up':
                        return seg.expectedPartisanLean > -5 && seg.expectedPartisanLean < 5;
                    case 'lean_rep':
                        return seg.expectedPartisanLean <= -5 && seg.expectedPartisanLean > -20;
                    case 'strong_rep':
                        return seg.expectedPartisanLean <= -20;
                    default:
                        return false;
                }
            })
            .map(seg => seg.code);
    }

    /**
     * Check if segment partisan lean matches filter
     */
    private matchesPartisanLean(
        segmentLean: number,
        filterLean: 'strong_dem' | 'lean_dem' | 'toss_up' | 'lean_rep' | 'strong_rep'
    ): boolean {
        switch (filterLean) {
            case 'strong_dem':
                return segmentLean >= 20;
            case 'lean_dem':
                return segmentLean >= 5 && segmentLean < 20;
            case 'toss_up':
                return segmentLean > -5 && segmentLean < 5;
            case 'lean_rep':
                return segmentLean <= -5 && segmentLean > -20;
            case 'strong_rep':
                return segmentLean <= -20;
            default:
                return true;
        }
    }

    /**
     * Get segment summary for display
     */
    getSegmentSummary(code: string): string | undefined {
        const segment = this.segments.get(code);
        if (!segment) return undefined;

        return `${segment.name} (${segment.code}) - ${segment.lifeModeGroupName} - ${segment.urbanization}, ${segment.affluence} affluence`;
    }

    /**
     * Get all segment codes
     */
    getAllSegmentCodes(): string[] {
        return Array.from(this.segments.keys());
    }

    /**
     * Get all LifeMode groups
     */
    getAllLifeModeGroups(): Array<{ number: number; name: string }> {
        const groups = new Map<number, string>();

        this.segments.forEach(seg => {
            groups.set(seg.lifeModeGroup, seg.lifeModeGroupName);
        });

        return Array.from(groups.entries()).map(([number, name]) => ({
            number,
            name,
        }));
    }
}

/**
 * Helper function to create TapestryFilter instance
 */
export async function createTapestryFilter(): Promise<TapestryFilter> {
    // Load segment definitions
    const segmentsResponse = await fetch('/data/tapestry/tapestry_segments.json');
    const segments: TapestrySegment[] = await segmentsResponse.json();

    // Load precinct assignments
    const precinctTapestryResponse = await fetch('/data/tapestry/precinct_tapestry.json');
    const precinctTapestry: PrecinctTapestry[] = await precinctTapestryResponse.json();

    return new TapestryFilter(segments, precinctTapestry);
}

/**
 * Helper function to get segment display name
 */
export function getSegmentDisplayName(code: string, segments: TapestrySegment[]): string {
    const segment = segments.find(s => s.code === code);
    return segment ? `${segment.name} (${segment.code})` : code;
}

/**
 * Helper function to get LifeMode display name
 */
export function getLifeModeDisplayName(groupNumber: number, segments: TapestrySegment[]): string {
    const segment = segments.find(s => s.lifeModeGroup === groupNumber);
    return segment ? segment.lifeModeGroupName : `LifeMode ${groupNumber}`;
}