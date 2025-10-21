import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Business, LatLng, SearchHistoryItem } from './types';
import { searchLeads, scrapeContacts } from './services/geminiService';
import { ResultCard } from './components/ResultCard';
import { LogoIcon, ExportIcon, SearchIcon, LoadingSpinner } from './components/icons';

const RESULTS_PER_PAGE = 10;

const Header: React.FC<{ onExport: () => void }> = ({ onExport }) => (
    <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center">
                <LogoIcon className="h-8 w-8 text-indigo-600" />
                <h1 className="text-2xl font-bold text-gray-800 ml-3">Lead Finder Pro</h1>
            </div>
            <div className="flex items-center space-x-6">
                <div className="text-sm text-gray-600">Credits: <span className="font-semibold text-gray-800">48712</span></div>
                <button 
                    onClick={onExport}
                    className="flex items-center bg-indigo-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-indigo-700 transition">
                    <ExportIcon className="w-5 h-5 mr-2" />
                    Export All
                </button>
            </div>
        </div>
    </header>
);

const SearchBar: React.FC<{ 
    query: string;
    setQuery: (q: string) => void;
    onSubmit: () => void;
    isLoading: boolean;
}> = ({ query, setQuery, onSubmit, isLoading }) => {
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSubmit();
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Google Maps Search</h2>
            <form onSubmit={handleSubmit} className="flex items-center space-x-4">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g., plumbers in new york"
                    className="flex-grow w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
                <select className="px-4 py-2 border border-gray-300 rounded-md bg-white focus:ring-indigo-500 focus:border-indigo-500">
                    <option>500 results</option>
                    <option>1000 results</option>
                    <option>2000 results</option>
                </select>
                <button type="submit" disabled={isLoading} className="flex items-center justify-center bg-blue-600 text-white font-semibold px-6 py-2 rounded-md hover:bg-blue-700 transition disabled:bg-blue-300 w-32">
                    {isLoading ? <LoadingSpinner className="w-5 h-5" /> : <><SearchIcon className="w-5 h-5 mr-2" /> Search</>}
                </button>
            </form>
        </div>
    );
};

const MapView: React.FC<{ leads: Business[], userLocation: LatLng | null }> = ({ leads, userLocation }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            const L = (window as any).L;
            if (!L) {
                console.error("Leaflet is not loaded");
                return;
            }
            const initialCoords: [number, number] = userLocation 
                ? [userLocation.latitude, userLocation.longitude] 
                : [34.0522, -118.2437]; 
            
            const map = L.map(mapContainerRef.current).setView(initialCoords, 10);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);
            mapRef.current = map;
        }
    }, [userLocation]);

    useEffect(() => {
        const L = (window as any).L;
        if (!mapRef.current || !L) return;

        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        const validLeads = leads.filter(lead => lead.latitude != null && lead.longitude != null);

        if (validLeads.length > 0) {
            const markerGroup = L.featureGroup();
            
            validLeads.forEach(lead => {
                const marker = L.marker([lead.latitude!, lead.longitude!])
                    .bindPopup(`<b>${lead.name}</b><br>${lead.address}`);
                marker.addTo(markerGroup);
                markersRef.current.push(marker);
            });
            
            markerGroup.addTo(mapRef.current);
            if (markerGroup.getBounds().isValid()) {
                mapRef.current.fitBounds(markerGroup.getBounds().pad(0.1));
            }
        } else if (userLocation) {
            mapRef.current.setView([userLocation.latitude, userLocation.longitude], 10);
        }

    }, [leads, userLocation]);

    return (
         <div ref={mapContainerRef} className="bg-gray-200 h-96 rounded-md" />
    );
};

const App: React.FC = () => {
    const [leads, setLeads] = useState<Business[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('current');
    const [userLocation, setUserLocation] = useState<LatLng | null>(null);
    const [searchQuery, setSearchQuery] = useState('dietitian las vegas');
    const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
    const [isScrapingAll, setIsScrapingAll] = useState(false);
    const [visibleLeadsCount, setVisibleLeadsCount] = useState(RESULTS_PER_PAGE);

    useEffect(() => {
        try {
            const storedHistory = localStorage.getItem('leadFinderHistory');
            if (storedHistory) {
                setSearchHistory(JSON.parse(storedHistory));
            }
        } catch (e) {
            console.error("Failed to parse search history from localStorage", e);
            setSearchHistory([]);
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            (err) => {
                console.warn(`ERROR(${err.code}): ${err.message}`);
            },
            {
                timeout: 10000,
                maximumAge: 0,
            }
        );
    }, []);
    
    const updateSearchHistory = (newHistory: SearchHistoryItem[]) => {
        setSearchHistory(newHistory);
        localStorage.setItem('leadFinderHistory', JSON.stringify(newHistory));
    };

    const handleSearch = useCallback(async (query: string) => {
        if (!query) return;
        setIsLoading(true);
        setError(null);
        setLeads([]);
        setVisibleLeadsCount(RESULTS_PER_PAGE);
        try {
            const results = await searchLeads(query, userLocation);
            setLeads(results);
            
            const newHistoryItem: SearchHistoryItem = { id: `${Date.now()}`, query, timestamp: Date.now(), resultCount: results.length };
            const updatedHistory = [newHistoryItem, ...searchHistory.filter(h => h.query !== query)].slice(0, 20);
            updateSearchHistory(updatedHistory);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    }, [userLocation, searchHistory]);

    const handleScrape = useCallback(async (businessId: string, websiteUrl: string) => {
        setLeads(prevLeads => prevLeads.map(lead =>
            lead.id === businessId ? { ...lead, isScraping: true, scrapeError: undefined } : lead
        ));

        try {
            const scrapedData = await scrapeContacts(websiteUrl);
            setLeads(prevLeads => prevLeads.map(lead =>
                lead.id === businessId ? { ...lead, isScraping: false, scrapedData } : lead
            ));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Scraping failed.';
            setLeads(prevLeads => prevLeads.map(lead =>
                lead.id === businessId ? { ...lead, isScraping: false, scrapeError: errorMessage } : lead
            ));
        }
    }, []);
    
    const handleExportAll = useCallback(() => {
        if (leads.length === 0) {
            alert("No leads to export.");
            return;
        }

        const headers = ["Name", "Address", "Type", "Phone", "Rating", "Reviews", "Website", "Scraped Emails", "Scraped Phones", "Scraped Socials"];
        const escapeCsvCell = (cellData: any) => {
            const stringData = String(cellData || '');
            if (stringData.includes(',')) return `"${stringData.replace(/"/g, '""')}"`;
            return stringData;
        };
        const csvRows = leads.map(lead => [
            escapeCsvCell(lead.name), escapeCsvCell(lead.address), escapeCsvCell(lead.type),
            escapeCsvCell(lead.phone), escapeCsvCell(lead.rating), escapeCsvCell(lead.reviews),
            escapeCsvCell(lead.website), escapeCsvCell(lead.scrapedData?.emails.join('; ') || ''),
            escapeCsvCell(lead.scrapedData?.phones.join('; ') || ''), escapeCsvCell(lead.scrapedData?.socials.join('; ') || '')
        ].join(','));
        const csvContent = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute("download", "leads.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [leads]);
    
    const handleScrapeAll = async () => {
        setIsScrapingAll(true);
        for (const lead of leads) {
            if (lead.website && !lead.scrapedData && !lead.scrapeError) {
                await handleScrape(lead.id, lead.website);
            }
        }
        setIsScrapingAll(false);
    };

    const handleLoadMore = () => {
        setVisibleLeadsCount(prevCount => prevCount + RESULTS_PER_PAGE);
    };

    const handleRerunSearch = (query: string) => {
        setActiveTab('current');
        setSearchQuery(query);
        handleSearch(query);
    };

    const handleClearHistory = () => {
        updateSearchHistory([]);
    };


    return (
        <div className="min-h-screen bg-gray-100">
            <Header onExport={handleExportAll} />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-8">
                    <SearchBar query={searchQuery} setQuery={setSearchQuery} onSubmit={() => handleSearch(searchQuery)} isLoading={isLoading} />
                    
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                            <button onClick={() => setActiveTab('current')} className={`${activeTab === 'current' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                Current Results
                            </button>
                            <button onClick={() => setActiveTab('history')} className={`${activeTab === 'history' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                Search History
                            </button>
                        </nav>
                    </div>

                    {activeTab === 'current' && (
                        <div className="space-y-8">
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <h2 className="text-lg font-semibold text-gray-700 mb-4">Map View</h2>
                                <MapView leads={leads} userLocation={userLocation} />
                            </div>

                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-semibold text-gray-700">{leads.length > 0 ? `${leads.length} results` : 'Search Results'}</h2>
                                    {leads.length > 0 && 
                                        <button onClick={handleScrapeAll} disabled={isScrapingAll} className="bg-green-100 text-green-700 font-semibold px-4 py-2 rounded-md hover:bg-green-200 transition disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center">
                                            {isScrapingAll && <LoadingSpinner className="w-4 h-4 mr-2" />}
                                            {isScrapingAll ? 'Scraping All...' : 'Scrape All Websites'}
                                        </button>
                                    }
                                </div>
                                {isLoading && <div className="text-center py-10"><LoadingSpinner className="w-8 h-8 mx-auto text-blue-600" /></div>}
                                {error && <div className="text-center py-10 text-red-500">{error}</div>}
                                
                                <div className="space-y-4">
                                    {!isLoading && leads.length === 0 && !error && <div className="text-center py-10 text-gray-500">Search to see results here.</div>}
                                    {leads.slice(0, visibleLeadsCount).map(business => (
                                        <ResultCard key={business.id} business={business} onScrape={handleScrape} />
                                    ))}
                                </div>

                                {visibleLeadsCount < leads.length && (
                                    <div className="text-center mt-8">
                                        <button onClick={handleLoadMore} className="bg-gray-100 text-gray-700 font-semibold px-6 py-2 rounded-md hover:bg-gray-200 transition">
                                            Load More
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'history' && (
                         <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                             <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-gray-700">Search History</h2>
                                {searchHistory.length > 0 && 
                                    <button onClick={handleClearHistory} className="text-sm text-red-500 hover:underline">Clear History</button>}
                             </div>
                             {searchHistory.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No search history yet.</p>
                             ) : (
                                 <ul className="divide-y divide-gray-200">
                                     {searchHistory.map(item => (
                                         <li key={item.id} className="py-3 flex justify-between items-center">
                                             <div>
                                                 <p className="font-medium text-gray-800">{item.query}</p>
                                                 <p className="text-sm text-gray-500">
                                                     {new Date(item.timestamp).toLocaleString()} - {item.resultCount} results
                                                 </p>
                                             </div>
                                             <button onClick={() => handleRerunSearch(item.query)} className="bg-gray-100 text-gray-700 font-semibold px-4 py-1.5 rounded-md text-sm hover:bg-gray-200 transition">
                                                Rerun
                                            </button>
                                         </li>
                                     ))}
                                 </ul>
                             )}
                         </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default App;
