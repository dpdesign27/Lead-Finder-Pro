export interface Business {
  id: string;
  name: string;
  address: string;
  type: string;
  phone?: string;
  rating?: number;
  reviews?: number;
  website?: string;
  latitude?: number;
  longitude?: number;
  scrapedData?: ScrapedData;
  isScraping?: boolean;
  scrapeError?: string;
}

export interface ScrapedData {
  emails: string[];
  phones: string[];
  socials: string[];
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  resultCount: number;
}
