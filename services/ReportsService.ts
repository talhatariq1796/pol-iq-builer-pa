// Centralized reports service - single source of truth for all report dialogs
export interface Report {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  categories: string[];
  type?: string;
}

// Custom reports that are always added to the list - minimal to avoid duplicates
const CUSTOM_REPORTS: Report[] = [
  // Removed Quebec Housing Market Analysis Report as requested
  // No custom reports currently included
];

// Reports and templates to exclude from display - focus on removing test/brand-specific content
const DO_NOT_DISPLAY_LIST: Set<string> = new Set([
  // Test/Demo reports
  'test',
  'Test',
  'TEST',
  'test123',
  'Blank test',
  'Test Report',
  'Test Template',
  'Demo Report',
  'Sample Report',
  'Draft',
  'DRAFT',
  'Duplicate',
  'DUPLICATE',

  // Brand-specific reports (not for general use)
  'Market Analysis for Nike',
  'Market Analysis for Red Bull',
  'Nike',
  'Nike Report',
  'Nike Competitive Market Report',
  'Accenture',
  'custom invesco',
  'H&R Block',
  'Custom template',
  'Invesco',
  'Invesco Index',
  'minority',
  'Mitsubishi',
  'OLG',
  'Visible Minority, Religion, Mother Tongue',

  // Exclude the Quebec Housing Market Analysis Report as requested
  'Quebec Housing Market Analysis Report',
  'market-intelligence-report',

  // Crime/jurisdiction reports (not relevant for housing market)
  'BC Crime Stats by Policing Jurisdiction',
  'Community Profile (Standard)',
  'Crime by Metro Area',
  'Crime by Policing Jurisdiction',

  // Redundant custom reports (we have these built-in)
  'AI Endpoint Scoring Analysis',
  'AI-Powered Market Intelligence Report',

  // Additional reports to exclude (user requested 2025-01-16)
  'Business Summary Report - NAICS (Tabular 2024)',
  'Demographic Summary',
  'Nonprofit Charitable Profile',
  'Retail Demand by Industry (Tabular)',
  'Retail Demand Outlook Report (Tabular 2024)'
]);

// Canadian terms to prioritize in titles (now we WANT these reports)
const CANADIAN_TERMS = [
  'canada', 'canadian', 'bc ', 'ontario', 'quebec', 'alberta', 'manitoba', 
  'saskatchewan', 'nova scotia', 'new brunswick', 'newfoundland', 'prince edward', 
  'yukon', 'northwest territories', 'nunavut', 'postal code', 'fsa',
  'toronto', 'vancouver', 'calgary', 'ottawa', 'montreal', 'winnipeg',
  'halifax', 'victoria', 'edmonton', 'prizm'
];

// US-specific terms and data sources to exclude (won't work with Canadian data)
const US_SPECIFIC_INDICATORS = [
  // Geographic terms
  'united states', 'usa', 'us ', 'american', 'zip code', 'zip ', 'county',
  'state of', 'florida', 'california', 'texas', 'new york', 'illinois',
  'pennsylvania', 'ohio', 'georgia', 'north carolina', 'michigan', 'new jersey',
  
  // US Census/Government data sources
  'acs', 'american community survey', 'census 2020', '2020 census', 'census redistricting',
  'title vi', 'elections and voting', 'electoral', 'voting overview', 
  
  // US-specific demographic/social programs  
  'civilian labor force', 'labor force profile', 'health care for at-risk',
  'disaster impact', 'emergency information', 'childhood and female equity',
  
  // US business/economic indicators
  'consumer expenditure', 'retail goods and services expenditure',
  'eating places', 'restaurant', 'spending patterns', 'market potential',
  
  // US lifestyle/segmentation (designed for US data)
  'tapestry segmentation', 'tapestry profile', 'tapestry', 'dominant tapestry',
  'customer purchasing behaviors', 'environmental preferences'
];

interface ArcGISItem {
  id: string;
  title?: string;
  description?: string;
  tags?: string[];
  properties?: {
    countries?: string;
  };
  thumbnail?: string;
  snippet?: string;
}

// Assign categories to reports based on content
const assignCategories = (item: ArcGISItem): string[] => {
  const assigned: Set<string> = new Set();
  const titleLower = item.title?.toLowerCase() || '';
  const descLower = item.description?.toLowerCase() || '';
  const tagsLower = (item.tags || []).map((t: string) => t.toLowerCase());
  const owner = (item as any)?.owner || '';
  const textCorpus = `${titleLower} ${descLower} ${tagsLower.join(' ')}`;

  // Priority categorization for Synapse54 branded reports
  if (owner === 'Synapse54') {
    assigned.add('Synapse54 Branded');
  }
  
  // PRIZM and lifestyle segmentation
  if (textCorpus.includes('prizm') || textCorpus.includes('tapestry') || textCorpus.includes('lifestyle') || textCorpus.includes('segmentation')) {
    assigned.add('PRIZM & Lifestyle');
  }
  
  // Canadian-specific
  if (textCorpus.includes('canada') || textCorpus.includes('canadian') || textCorpus.includes('quebec') || textCorpus.includes('ontario')) {
    assigned.add('Canadian Reports');
  }

  // Standard categories
  if (textCorpus.includes('demographic') || textCorpus.includes('population') || textCorpus.includes('income')) {
    assigned.add('Demographics');
  }
  if (textCorpus.includes('market') || textCorpus.includes('business') || textCorpus.includes('consumer') || textCorpus.includes('spending')) {
    assigned.add('Market Analysis');
  }
  if (textCorpus.includes('community') || textCorpus.includes('neighborhood') || textCorpus.includes('neighbourhood') || textCorpus.includes('profile')) {
    assigned.add('Community Profiles');
  }
  if (textCorpus.includes('housing') || textCorpus.includes('real estate') || textCorpus.includes('homeowner')) {
    assigned.add('Housing & Real Estate');
  }
  if (textCorpus.includes('health') || textCorpus.includes('risk') || textCorpus.includes('emergency') || textCorpus.includes('poverty')) {
    assigned.add('Health & Risk');
  }
  if (textCorpus.includes('transportation') || textCorpus.includes('transit')) {
    assigned.add('Transportation');
  }
  if (textCorpus.includes('retail') || textCorpus.includes('shopping') || textCorpus.includes('commercial')) {
    assigned.add('Retail & Commercial');
  }

  return assigned.size > 0 ? Array.from(assigned) : ['Other'];
};

// Main function to fetch and filter reports
export const fetchReports = async (): Promise<Report[]> => {
  try {
    console.log('[ReportsService] Fetching reports from ArcGIS servers...');
    
    const token = (process.env.NEXT_PUBLIC_ARCGIS_API_KEY || '').trim();
    if (!token) {
      throw new Error('NEXT_PUBLIC_ARCGIS_API_KEY is not set in the environment.');
    }

    const tokenQ = encodeURIComponent(token);

    // Paginate through all Synapse54 Report Templates since API has 100-item limit
    const allItems: ArcGISItem[] = [];
    const successfulEndpoints: string[] = [];
    
    try {
      console.log('[ReportsService] Fetching all Synapse54 Report Templates with pagination...');
      
      let start = 1;
      let totalFetched = 0;
      let hasMore = true;
      
      while (hasMore && totalFetched < 300) { // Safety limit
        const url = `https://www.arcgis.com/sharing/rest/search?q=owner:Synapse54 AND type:"Report Template"&f=pjson&token=${tokenQ}&num=100&start=${start}&sortField=title&sortOrder=asc`;
        
        console.log(`[ReportsService] Fetching page starting at ${start}...`);
        const response = await fetch(url);
        
        if (!response.ok) {
          console.warn(`[ReportsService] Request failed with status ${response.status}`);
          break;
        }
        
        const data = await response.json();
        
        if (!data.results || !Array.isArray(data.results)) {
          console.warn('[ReportsService] No results in response');
          break;
        }
        
        const items = data.results;
        console.log(`[ReportsService] Page ${Math.floor(start/100) + 1}: Got ${items.length} items (total so far: ${totalFetched + items.length})`);
        
        allItems.push(...items);
        totalFetched += items.length;
        
        // Check if we have more pages
        hasMore = items.length === 100 && data.nextStart;
        start = data.nextStart || start + 100;
        
        if (items.length < 100) {
          console.log('[ReportsService] Reached end of results');
          hasMore = false;
        }
      }
      
      console.log(`[ReportsService] Pagination complete: fetched ${totalFetched} total items`);
      successfulEndpoints.push(`Synapse54 Report Templates (${totalFetched} items)`);
      
    } catch (error) {
      console.error('[ReportsService] Error with pagination:', error);
    }
    
    console.log(`[ReportsService] Total items from all endpoints: ${allItems.length}`);
    console.log(`[ReportsService] Successful endpoints: ${successfulEndpoints.join(', ')}`);
    
    // Advanced duplicate removal - remove by ID and similar titles
    const uniqueItems = allItems.reduce((acc: ArcGISItem[], current: ArcGISItem) => {
      // Check for exact ID duplicates
      const existingById = acc.find(item => item.id === current.id);
      if (existingById) {
        return acc;
      }
      
      // Check for very similar titles (fuzzy duplicate detection)
      const currentTitleNormalized = (current.title || '').toLowerCase().trim()
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' '); // Normalize whitespace
      
      const existingByTitle = acc.find(item => {
        const existingTitleNormalized = (item.title || '').toLowerCase().trim()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, ' ');
        
        // Consider items duplicates if titles are very similar
        const similarity = calculateSimilarity(currentTitleNormalized, existingTitleNormalized);
        return similarity > 0.85; // 85% similarity threshold
      });
      
      if (existingByTitle) {
        // For similar titles, prefer 2025 over 2024, then newer versions
        const currentTitle = current.title || '';
        const existingTitle = existingByTitle.title || '';
        
        const currentHas2025 = currentTitle.includes('Esri 2025');
        const existingHas2025 = existingTitle.includes('Esri 2025');
        const currentHas2024 = currentTitle.includes('Esri 2024');
        const existingHas2024 = existingTitle.includes('Esri 2024');
        
        // Prefer 2025 over 2024
        if (currentHas2025 && existingHas2024) {
          const index = acc.indexOf(existingByTitle);
          acc[index] = current;
          console.log(`[ReportsService] Replacing 2024 version "${existingTitle}" with 2025 version: "${currentTitle}"`);
          return acc;
        } else if (existingHas2025 && currentHas2024) {
          console.log(`[ReportsService] Keeping 2025 version "${existingTitle}", skipping 2024 version: "${currentTitle}"`);
          return acc;
        }
        
        // If both are same version type, prefer the more recent
        const currentModified = (current as any).modified || 0;
        const existingModified = (existingByTitle as any).modified || 0;
        
        if (currentModified > existingModified) {
          const index = acc.indexOf(existingByTitle);
          acc[index] = current;
          console.log(`[ReportsService] Replacing older version "${existingTitle}" with newer: "${currentTitle}"`);
        } else {
          console.log(`[ReportsService] Keeping existing version "${existingTitle}", skipping: "${currentTitle}"`);
        }
        return acc;
      }
      
      acc.push(current);
      return acc;
    }, []);
    
    console.log(`[ReportsService] Unique items after advanced deduplication: ${uniqueItems.length}`);
    
    // Helper function for title similarity
    function calculateSimilarity(str1: string, str2: string): number {
      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;
      
      if (longer.length === 0) return 1.0;
      
      const distance = levenshteinDistance(longer, shorter);
      return (longer.length - distance) / longer.length;
    }
    
    function levenshteinDistance(str1: string, str2: string): number {
      const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
      
      for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
      for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
      
      for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
          const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
          matrix[j][i] = Math.min(
            matrix[j][i - 1] + 1,
            matrix[j - 1][i] + 1,
            matrix[j - 1][i - 1] + cost
          );
        }
      }
      
      return matrix[str2.length][str1.length];
    }
    
    // Since we're only fetching Synapse54 content, just filter out test/demo reports
    const filteredItems = uniqueItems.filter((item: ArcGISItem) => {
      const titleLower = (item.title || '').toLowerCase();
      const owner = (item as any)?.owner || '';
      
      // Only Synapse54 content should be coming through anyway, but double-check
      if (owner !== 'Synapse54') {
        console.log(`[ReportsService] EXCLUDING non-Synapse54: "${item.title}" (owner: ${owner})`);
        return false;
      }
      
      console.log(`[ReportsService] INCLUDING Synapse54 report: "${item.title}"`);
      return true;
    });
    
    console.log(`[ReportsService] Filtered items after prioritization: ${filteredItems.length}`);
    
    // Apply exclusion filtering
    const finalFilteredItems = filteredItems.filter(item => {
      const trimmedTitle = item.title?.trim() || '';
      const titleLower = trimmedTitle.toLowerCase();
      const descLower = (item.description || '').toLowerCase();
      const textContent = `${titleLower} ${descLower}`;
      
      // Check exact matches in exclusion set
      if (DO_NOT_DISPLAY_LIST.has(trimmedTitle)) {
        console.log(`[ReportsService] Excluding by exact match: "${trimmedTitle}"`);
        return false;
      }
      
      // Exclude Esri 2025 versions as requested
      if (trimmedTitle.includes('(Esri 2025)')) {
        console.log(`[ReportsService] Excluding Esri 2025 template: "${trimmedTitle}"`);
        return false;
      }
      
      // Additional checks for empty or problematic titles
      if (!trimmedTitle || trimmedTitle.length < 3) {
        console.log(`[ReportsService] Excluding report with empty/short title: "${trimmedTitle}"`);
        return false;
      }
      
      // Check for US-specific indicators that won't work with Canadian data
      if (US_SPECIFIC_INDICATORS.some(term => textContent.includes(term))) {
        console.log(`[ReportsService] Excluding US-specific template: "${trimmedTitle}"`);
        return false;
      }
      
      // Keep reports that are explicitly Canadian or generic/international
      const isCanadian = CANADIAN_TERMS.some(term => textContent.includes(term));
      const isGenericUseful = titleLower.includes('housing') || 
                             titleLower.includes('market') ||
                             titleLower.includes('demographic') ||
                             titleLower.includes('community') ||
                             titleLower.includes('population') ||
                             titleLower.includes('business') ||
                             titleLower.includes('economic') ||
                             titleLower.includes('neighbourhood') ||
                             titleLower.includes('neighborhood') ||
                             titleLower.includes('profile') ||
                             titleLower.includes('lifestyle') ||
                             titleLower.includes('prizm') ||
                             titleLower.includes('retail') ||
                             titleLower.includes('consumer');
      
      if (isCanadian) {
        console.log(`[ReportsService] Including Canadian report: "${trimmedTitle}"`);
        return true;
      }
      
      if (isGenericUseful) {
        console.log(`[ReportsService] Including generic useful report: "${trimmedTitle}"`);
        return true;
      }
      
      console.log(`[ReportsService] Excluding report (not Canadian/generic): "${trimmedTitle}"`);
      return false;
    });
    
    console.log(`[ReportsService] Items after exclusion filtering: ${finalFilteredItems.length}`);
    
    // Sort items by priority: Housing/Market reports first, then alphabetical
    const sortedItems = finalFilteredItems.sort((a, b) => {
      const aTitle = (a.title || '').toLowerCase();
      const bTitle = (b.title || '').toLowerCase();
      
      // Housing and Market reports first
      const aHousing = aTitle.includes('housing') || aTitle.includes('market');
      const bHousing = bTitle.includes('housing') || bTitle.includes('market');
      if (aHousing && !bHousing) return -1;
      if (bHousing && !aHousing) return 1;
      
      // PRIZM/Tapestry reports second  
      const aPrizm = aTitle.includes('prizm') || aTitle.includes('tapestry');
      const bPrizm = bTitle.includes('prizm') || bTitle.includes('tapestry');
      if (aPrizm && !bPrizm) return -1;
      if (bPrizm && !aPrizm) return 1;
      
      // Demographic reports third
      const aDemographic = aTitle.includes('demographic') || aTitle.includes('population') || aTitle.includes('community');
      const bDemographic = bTitle.includes('demographic') || bTitle.includes('population') || bTitle.includes('community');
      if (aDemographic && !bDemographic) return -1;
      if (bDemographic && !aDemographic) return 1;
      
      // Alphabetical order for the rest
      return aTitle.localeCompare(bTitle);
    });
    
    // Convert to Report format
    const formattedReports = sortedItems.map(item => {
      // Construct proper thumbnail URL
      let thumbnailUrl = '';
      if (item.thumbnail) {
        if (!item.thumbnail.startsWith('http')) {
          thumbnailUrl = `https://www.arcgis.com/sharing/rest/content/items/${item.id}/info/${item.thumbnail}?token=${tokenQ}`;
        } else {
          thumbnailUrl = item.thumbnail;
        }
      } else {
        thumbnailUrl = `https://www.arcgis.com/sharing/rest/content/items/${item.id}/info/thumbnail/thumbnail.png?token=${tokenQ}`;
      }
      
      return {
        id: item.id,
        title: item.title || 'Untitled Report',
        description: item.snippet || item.description || 'No description available',
        thumbnail: thumbnailUrl,
        categories: assignCategories(item)
      };
    });
    
    // Add custom reports at the beginning (currently empty, but structure remains)
    const finalReports = [...CUSTOM_REPORTS, ...formattedReports];
    
    // Ensure we have a good variety of useful reports
    if (finalReports.length === 0) {
      console.warn('[ReportsService] No reports found after filtering. This may indicate API issues.');
    } else if (finalReports.length < 5) {
      console.warn(`[ReportsService] Only ${finalReports.length} reports found. Consider relaxing filters.`);
    }
    
    console.log(`[ReportsService] Final report count (including custom): ${finalReports.length}`);
    console.log(`[ReportsService] Final report titles:`, finalReports.map(r => r.title));
    
    // Log detailed breakdown for debugging
    console.log(`[ReportsService] Report breakdown by category:`);
    const categoryBreakdown = finalReports.reduce((acc: Record<string, number>, report) => {
      report.categories.forEach(cat => {
        acc[cat] = (acc[cat] || 0) + 1;
      });
      return acc;
    }, {});
    console.log(categoryBreakdown);
    
    return finalReports;
    
  } catch (error) {
    console.error('[ReportsService] Error fetching reports:', error);
    if (
      error instanceof Error &&
      error.message.includes('NEXT_PUBLIC_ARCGIS_API_KEY is not set')
    ) {
      throw error;
    }
    // Return just custom reports if fetch fails
    return CUSTOM_REPORTS;
  }
};