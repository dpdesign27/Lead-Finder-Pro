import { GoogleGenAI, Type } from "@google/genai";
import { Business, LatLng, ScrapedData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

function parseLeads(markdown: string): Business[] {
    const leads: Business[] = [];
    const businesses = markdown.split('---').filter(b => b.trim() !== '');

    businesses.forEach((bizText, index) => {
        const lines = bizText.trim().split('\n');
        const name = lines[0].replace(/\*\*/g, '').trim();
        
        const lead: Business = {
            id: `${Date.now()}-${index}`,
            name: name,
            address: '',
            type: '',
        };

        lines.slice(1).forEach(line => {
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('address:')) {
                lead.address = line.substring(line.indexOf(':') + 1).trim();
            } else if (lowerLine.includes('type:') || lowerLine.includes('category:')) {
                lead.type = line.substring(line.indexOf(':') + 1).trim();
            } else if (lowerLine.includes('phone:')) {
                lead.phone = line.substring(line.indexOf(':') + 1).trim();
            } else if (lowerLine.includes('website:')) {
                lead.website = line.substring(line.indexOf(':') + 1).trim();
            } else if (lowerLine.includes('coordinates:')) {
                 try {
                    const coordsText = line.substring(line.indexOf(':') + 1).trim();
                    const [lat, lng] = coordsText.split(',').map(c => parseFloat(c.trim()));
                    if (!isNaN(lat) && !isNaN(lng)) {
                       lead.latitude = lat;
                       lead.longitude = lng;
                    }
                } catch (e) {
                    console.error("Could not parse coordinates:", e);
                }
            } else if (lowerLine.includes('rating:')) {
                try {
                    const ratingText = line.substring(line.indexOf(':') + 1).trim();
                    const ratingMatch = ratingText.match(/(\d\.\d|\d)/);
                    const reviewsMatch = ratingText.match(/\((\d+)/);
                    if(ratingMatch) lead.rating = parseFloat(ratingMatch[0]);
                    if(reviewsMatch) lead.reviews = parseInt(reviewsMatch[1]);
                } catch(e) {
                    console.error("Could not parse rating:", e);
                }
            }
        });

        if (lead.name && lead.address) {
            leads.push(lead);
        }
    });

    return leads;
}


export const searchLeads = async (query: string, location: LatLng | null): Promise<Business[]> => {
    try {
        const prompt = `Find businesses matching '${query}'. For each business, provide its name, full address, category/type, main phone number, average star rating, number of reviews, official website URL, and geographic coordinates (latitude, longitude). Format each business entry clearly, separated by '---'. Example:
**Business Name**
- Address: 123 Main St, City, State, ZIP
- Category: Category Type
- Phone: (555) 555-5555
- Rating: 4.5 (123 reviews)
- Website: https://example.com
- Coordinates: 40.7128, -74.0060
---
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleMaps: {} }],
                ...(location && {
                    toolConfig: {
                        retrievalConfig: {
                            latLng: location
                        }
                    }
                })
            },
        });
        
        const markdownResponse = response.text;
        return parseLeads(markdownResponse);

    } catch (error) {
        console.error("Error searching for leads:", error);
        throw new Error("Failed to fetch leads from Gemini API.");
    }
};

export const scrapeContacts = async (websiteUrl: string): Promise<ScrapedData> => {
    if(!websiteUrl || !websiteUrl.startsWith('http')) {
        throw new Error("Invalid or missing website URL.");
    }
    
    try {
        const prompt = `Analyze the content of the website ${websiteUrl} and extract contact information. I need all unique email addresses, phone numbers, and social media profile links (specifically for Facebook, Instagram, LinkedIn, and Twitter). Provide the output strictly as a JSON object. The JSON object must have three keys: "emails", "phones", and "socials", where each key holds an array of unique strings. If no information is found for a key, provide an empty array.`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        emails: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                        phones: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                        socials: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                    },
                },
            },
        });

        const jsonString = response.text;
        const data = JSON.parse(jsonString);

        return {
            emails: data.emails || [],
            phones: data.phones || [],
            socials: data.socials || [],
        };

    } catch (error) {
        console.error("Error scraping website:", error);
        throw new Error(`Failed to scrape contacts for ${websiteUrl}.`);
    }
};