
import React, { useState } from 'react';
import { Business, ScrapedData } from '../types';
import { EmailIcon, PhoneIcon, SocialIcon, WebsiteIcon, StarIcon, CopyIcon, CheckIcon, LoadingSpinner, SocialMediaIcon } from './icons';

interface ResultCardProps {
    business: Business;
    onScrape: (businessId: string, websiteUrl: string) => void;
}

const ContactItem: React.FC<{ icon: React.ReactNode; text: string; link: string }> = ({ icon, text, link }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex items-center justify-between text-sm text-gray-700 py-1.5 group">
            <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center min-w-0">
                <span className="text-gray-400 mr-2">{icon}</span>
                <span className="truncate group-hover:underline">{text}</span>
            </a>
            <button onClick={handleCopy} className="ml-2 p-1 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-all">
                {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
            </button>
        </div>
    );
};


const ScrapedDataSection: React.FC<{ title: string; items: string[]; icon: React.ReactNode; linkPrefix?: string; isSocial?: boolean }> = ({ title, items, icon, linkPrefix = '', isSocial = false }) => (
    <div>
        <h4 className="flex items-center font-semibold text-gray-600 text-sm mb-2">
            {icon}
            <span className="ml-2">{title} ({items.length})</span>
        </h4>
        <div className="space-y-1">
            {items.map((item, index) => {
                const link = isSocial ? item : `${linkPrefix}${item}`;
                return <ContactItem key={index} icon={ isSocial ? <SocialMediaIcon url={item} className="w-4 h-4 fill-current"/> : icon} text={item} link={link} />;
            })}
        </div>
    </div>
);

export const ResultCard: React.FC<ResultCardProps> = ({ business, onScrape }) => {
    
    const handleScrapeClick = () => {
        if (business.website) {
            onScrape(business.id, business.website);
        }
    };
    
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-4">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">{business.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{business.address}</p>
                    <p className="text-xs text-gray-400 mt-1">{business.type}</p>
                </div>
                <button 
                    onClick={handleScrapeClick} 
                    disabled={!business.website || business.isScraping}
                    className="flex items-center bg-green-500 text-white font-semibold px-4 py-2 rounded-md hover:bg-green-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed">
                     {business.isScraping ? <LoadingSpinner className="w-4 h-4 mr-2" /> : null}
                     {business.isScraping ? 'Scraping...' : 'Scrape'}
                </button>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">
                {business.phone && <div className="flex items-center"><PhoneIcon className="w-4 h-4 mr-1.5 text-blue-500"/> {business.phone}</div>}
                {business.rating && business.reviews && (
                    <div className="flex items-center">
                        <StarIcon className="w-4 h-4 mr-1.5 text-yellow-400"/> 
                        <span className="font-medium">{business.rating}</span>
                        <span className="text-gray-400 ml-1">({business.reviews})</span>
                    </div>
                )}
                {business.website && <a href={business.website} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 hover:underline"><WebsiteIcon className="w-4 h-4 mr-1.5"/> Website</a>}
            </div>

            {business.scrapeError && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
                    {business.scrapeError}
                </div>
            )}

            {business.scrapedData && (
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ScrapedDataSection title="Emails" items={business.scrapedData.emails} icon={<EmailIcon className="w-5 h-5" />} linkPrefix="mailto:" />
                    <ScrapedDataSection title="Phone Numbers" items={business.scrapedData.phones} icon={<PhoneIcon className="w-5 h-5" />} linkPrefix="tel:" />
                    <ScrapedDataSection title="Social Media" items={business.scrapedData.socials} icon={<SocialIcon className="w-5 h-5" />} isSocial={true} />
                </div>
            )}
        </div>
    );
};
