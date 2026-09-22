export interface IndustryNode {
  value: string;
  title: string;
  children?: IndustryNode[];
  isLeaf?: boolean;
}

// 785 LinkedIn Industries organized into sector groups
export const LINKEDIN_INDUSTRIES: IndustryNode[] = [
  {
    value: 'technology',
    title: 'Technology & Software',
    children: [
      { value: 'tech-software', title: 'Software Development', isLeaf: true },
      { value: 'tech-it-services', title: 'IT Services & IT Consulting', isLeaf: true },
      { value: 'tech-cloud', title: 'Cloud Computing', isLeaf: true },
      { value: 'tech-ai', title: 'Artificial Intelligence', isLeaf: true },
      { value: 'tech-cybersecurity', title: 'Computer and Network Security', isLeaf: true },
      { value: 'tech-data', title: 'Data Infrastructure & Analytics', isLeaf: true },
      { value: 'tech-blockchain', title: 'Blockchain & Cryptocurrency', isLeaf: true },
      { value: 'tech-iot', title: 'Internet of Things (IoT)', isLeaf: true },
      { value: 'tech-hardware', title: 'Computer Hardware Manufacturing', isLeaf: true },
      { value: 'tech-semiconductor', title: 'Semiconductor Manufacturing', isLeaf: true },
      { value: 'tech-telecom', title: 'Telecommunications', isLeaf: true },
      { value: 'tech-mobile', title: 'Mobile App Development', isLeaf: true },
      { value: 'tech-gaming', title: 'Computer Games', isLeaf: true },
      { value: 'tech-saas', title: 'SaaS — Software as a Service', isLeaf: true },
      { value: 'tech-ecommerce', title: 'E-Commerce Platform', isLeaf: true },
      { value: 'tech-fintech', title: 'Financial Technology (FinTech)', isLeaf: true },
      { value: 'tech-edtech', title: 'Education Technology (EdTech)', isLeaf: true },
      { value: 'tech-healthtech', title: 'Health Technology (HealthTech)', isLeaf: true },
      { value: 'tech-legaltech', title: 'Legal Technology (LegalTech)', isLeaf: true },
      { value: 'tech-proptech', title: 'Property Technology (PropTech)', isLeaf: true },
      { value: 'tech-hrtech', title: 'HR Technology (HRTech)', isLeaf: true },
      { value: 'tech-martech', title: 'Marketing Technology (MarTech)', isLeaf: true },
    ],
  },
  {
    value: 'finance',
    title: 'Finance & Banking',
    children: [
      { value: 'fin-banking', title: 'Banking', isLeaf: true },
      { value: 'fin-investment', title: 'Investment Management', isLeaf: true },
      { value: 'fin-insurance', title: 'Insurance', isLeaf: true },
      { value: 'fin-capital-markets', title: 'Capital Markets', isLeaf: true },
      { value: 'fin-venture', title: 'Venture Capital & Private Equity', isLeaf: true },
      { value: 'fin-accounting', title: 'Accounting', isLeaf: true },
      { value: 'fin-audit', title: 'Audit & Compliance', isLeaf: true },
      { value: 'fin-credit', title: 'Credit Services', isLeaf: true },
      { value: 'fin-wealth', title: 'Wealth Management', isLeaf: true },
      { value: 'fin-payments', title: 'Payments & Digital Wallets', isLeaf: true },
      { value: 'fin-leasing', title: 'Leasing & Finance', isLeaf: true },
      { value: 'fin-microfinance', title: 'Microfinance', isLeaf: true },
    ],
  },
  {
    value: 'healthcare',
    title: 'Healthcare & Life Sciences',
    children: [
      { value: 'hc-hospitals', title: 'Hospitals & Healthcare Systems', isLeaf: true },
      { value: 'hc-pharma', title: 'Pharmaceutical Manufacturing', isLeaf: true },
      { value: 'hc-biotech', title: 'Biotechnology Research', isLeaf: true },
      { value: 'hc-medical-devices', title: 'Medical Equipment Manufacturing', isLeaf: true },
      { value: 'hc-clinical', title: 'Clinical Research', isLeaf: true },
      { value: 'hc-dental', title: 'Dental Practices', isLeaf: true },
      { value: 'hc-veterinary', title: 'Veterinary Services', isLeaf: true },
      { value: 'hc-wellness', title: 'Wellness & Fitness Services', isLeaf: true },
      { value: 'hc-mental-health', title: 'Mental Health Services', isLeaf: true },
      { value: 'hc-diagnostics', title: 'Medical Laboratories & Diagnostics', isLeaf: true },
      { value: 'hc-telehealth', title: 'Telemedicine', isLeaf: true },
    ],
  },
  {
    value: 'manufacturing',
    title: 'Manufacturing & Industrial',
    children: [
      { value: 'mfg-auto', title: 'Automobile Manufacturing', isLeaf: true },
      { value: 'mfg-auto-parts', title: 'Automobile Parts Manufacturing', isLeaf: true },
      { value: 'mfg-aerospace', title: 'Aviation & Aerospace', isLeaf: true },
      { value: 'mfg-electronics', title: 'Electronics Manufacturing', isLeaf: true },
      { value: 'mfg-textile', title: 'Textile & Apparel Manufacturing', isLeaf: true },
      { value: 'mfg-food', title: 'Food & Beverage Manufacturing', isLeaf: true },
      { value: 'mfg-chemicals', title: 'Chemical Manufacturing', isLeaf: true },
      { value: 'mfg-plastics', title: 'Plastics & Rubber Manufacturing', isLeaf: true },
      { value: 'mfg-metals', title: 'Metal & Steel Manufacturing', isLeaf: true },
      { value: 'mfg-packaging', title: 'Packaging & Containers', isLeaf: true },
      { value: 'mfg-machinery', title: 'Industrial Machinery Manufacturing', isLeaf: true },
      { value: 'mfg-furniture', title: 'Furniture & Home Furnishings', isLeaf: true },
      { value: 'mfg-paper', title: 'Paper & Forest Products', isLeaf: true },
      { value: 'mfg-glass', title: 'Glass, Ceramics & Concrete Manufacturing', isLeaf: true },
    ],
  },
  {
    value: 'retail',
    title: 'Retail & Consumer Goods',
    children: [
      { value: 'ret-fashion', title: 'Apparel & Fashion', isLeaf: true },
      { value: 'ret-luxury', title: 'Luxury Goods & Jewelry', isLeaf: true },
      { value: 'ret-grocery', title: 'Grocery Retail', isLeaf: true },
      { value: 'ret-eretail', title: 'Online Retail', isLeaf: true },
      { value: 'ret-cosmetics', title: 'Cosmetics & Personal Care', isLeaf: true },
      { value: 'ret-sporting', title: 'Sporting Goods', isLeaf: true },
      { value: 'ret-home', title: 'Home Improvement Retail', isLeaf: true },
      { value: 'ret-electronics', title: 'Consumer Electronics Retail', isLeaf: true },
      { value: 'ret-convenience', title: 'Convenience Stores', isLeaf: true },
      { value: 'ret-franchise', title: 'Franchise Networks', isLeaf: true },
    ],
  },
  {
    value: 'consulting',
    title: 'Professional Services & Consulting',
    children: [
      { value: 'con-management', title: 'Management Consulting', isLeaf: true },
      { value: 'con-strategy', title: 'Strategy & Business Design', isLeaf: true },
      { value: 'con-hr', title: 'Human Resources Services', isLeaf: true },
      { value: 'con-legal', title: 'Legal Services', isLeaf: true },
      { value: 'con-marketing', title: 'Marketing Services', isLeaf: true },
      { value: 'con-pr', title: 'Public Relations & Communications', isLeaf: true },
      { value: 'con-research', title: 'Market Research', isLeaf: true },
      { value: 'con-executive', title: 'Executive Search', isLeaf: true },
      { value: 'con-staffing', title: 'Staffing & Recruiting', isLeaf: true },
      { value: 'con-outsourcing', title: 'Outsourcing & Offshoring', isLeaf: true },
    ],
  },
  {
    value: 'education',
    title: 'Education & Training',
    children: [
      { value: 'edu-primary', title: 'Primary & Secondary Education', isLeaf: true },
      { value: 'edu-higher', title: 'Higher Education', isLeaf: true },
      { value: 'edu-vocational', title: 'Vocational & Trade Schools', isLeaf: true },
      { value: 'edu-elearning', title: 'E-Learning & Online Education', isLeaf: true },
      { value: 'edu-corporate', title: 'Corporate Training & L&D', isLeaf: true },
      { value: 'edu-language', title: 'Language & Language Schools', isLeaf: true },
    ],
  },
  {
    value: 'realestate',
    title: 'Real Estate & Construction',
    children: [
      { value: 're-residential', title: 'Residential Real Estate', isLeaf: true },
      { value: 're-commercial', title: 'Commercial Real Estate', isLeaf: true },
      { value: 're-construction', title: 'Construction', isLeaf: true },
      { value: 're-architecture', title: 'Architecture & Planning', isLeaf: true },
      { value: 're-civil-eng', title: 'Civil Engineering', isLeaf: true },
      { value: 're-interior', title: 'Interior Design', isLeaf: true },
      { value: 're-property-mgmt', title: 'Property Management', isLeaf: true },
    ],
  },
  {
    value: 'media',
    title: 'Media, Entertainment & Creative',
    children: [
      { value: 'med-broadcasting', title: 'Broadcasting Media', isLeaf: true },
      { value: 'med-print', title: 'Book & Periodical Publishing', isLeaf: true },
      { value: 'med-digital', title: 'Digital Media & Online Publishing', isLeaf: true },
      { value: 'med-film', title: 'Motion Picture & Film', isLeaf: true },
      { value: 'med-music', title: 'Music Production', isLeaf: true },
      { value: 'med-animation', title: 'Animation & Post-Production', isLeaf: true },
      { value: 'med-advertising', title: 'Advertising Services', isLeaf: true },
      { value: 'med-graphic', title: 'Graphic Design', isLeaf: true },
      { value: 'med-photography', title: 'Photography', isLeaf: true },
      { value: 'med-events', title: 'Events Services', isLeaf: true },
      { value: 'med-sports', title: 'Spectator Sports', isLeaf: true },
    ],
  },
  {
    value: 'logistics',
    title: 'Logistics, Transport & Supply Chain',
    children: [
      { value: 'log-freight', title: 'Freight & Logistics Services', isLeaf: true },
      { value: 'log-trucking', title: 'Trucking & Transportation', isLeaf: true },
      { value: 'log-maritime', title: 'Maritime Shipping', isLeaf: true },
      { value: 'log-aviation', title: 'Airlines & Aviation', isLeaf: true },
      { value: 'log-warehousing', title: 'Warehousing & Storage', isLeaf: true },
      { value: 'log-courier', title: 'Package/Freight Delivery', isLeaf: true },
      { value: 'log-supply', title: 'Supply Chain Management', isLeaf: true },
      { value: 'log-customs', title: 'Import & Export', isLeaf: true },
      { value: 'log-railway', title: 'Railroad Equipment Manufacturing', isLeaf: true },
    ],
  },
  {
    value: 'energy',
    title: 'Energy & Environment',
    children: [
      { value: 'eng-oil-gas', title: 'Oil and Gas', isLeaf: true },
      { value: 'eng-renewable', title: 'Renewable Energy & Solar', isLeaf: true },
      { value: 'eng-utilities', title: 'Utilities — Electric, Water, Gas', isLeaf: true },
      { value: 'eng-nuclear', title: 'Nuclear Electric Power Generation', isLeaf: true },
      { value: 'eng-environment', title: 'Environmental Services', isLeaf: true },
      { value: 'eng-mining', title: 'Mining & Metals', isLeaf: true },
    ],
  },
  {
    value: 'hospitality',
    title: 'Hospitality & Tourism',
    children: [
      { value: 'hos-hotels', title: 'Hotels & Resorts', isLeaf: true },
      { value: 'hos-restaurants', title: 'Restaurants & Food Services', isLeaf: true },
      { value: 'hos-travel', title: 'Travel Agencies', isLeaf: true },
      { value: 'hos-tourism', title: 'Leisure, Travel & Tourism', isLeaf: true },
      { value: 'hos-airlines', title: 'Airlines & Aviation', isLeaf: true },
      { value: 'hos-recreation', title: 'Amusement Parks & Attractions', isLeaf: true },
    ],
  },
  {
    value: 'government',
    title: 'Government & Public Sector',
    children: [
      { value: 'gov-federal', title: 'Government Administration', isLeaf: true },
      { value: 'gov-defense', title: 'Armed Forces', isLeaf: true },
      { value: 'gov-law', title: 'Law Enforcement', isLeaf: true },
      { value: 'gov-public-safety', title: 'Public Safety', isLeaf: true },
      { value: 'gov-international', title: 'International Affairs', isLeaf: true },
      { value: 'gov-policy', title: 'Public Policy Offices', isLeaf: true },
    ],
  },
  {
    value: 'nonprofit',
    title: 'Non-Profit & Social Impact',
    children: [
      { value: 'npo-charity', title: 'Philanthropic Fundraising Services', isLeaf: true },
      { value: 'npo-civic', title: 'Civic and Social Organizations', isLeaf: true },
      { value: 'npo-international', title: 'International Trade & Development', isLeaf: true },
      { value: 'npo-environment', title: 'Environmental Non-profit', isLeaf: true },
      { value: 'npo-health', title: 'Health & Medical Non-profit', isLeaf: true },
      { value: 'npo-education', title: 'Education Non-profit', isLeaf: true },
    ],
  },
  {
    value: 'agriculture',
    title: 'Agriculture & Food Science',
    children: [
      { value: 'agr-farming', title: 'Farming & Animal Husbandry', isLeaf: true },
      { value: 'agr-aqua', title: 'Aquaculture', isLeaf: true },
      { value: 'agr-food-science', title: 'Food Science & Technology', isLeaf: true },
      { value: 'agr-forestry', title: 'Forestry & Logging', isLeaf: true },
      { value: 'agr-agritech', title: 'Agricultural Technology (AgriTech)', isLeaf: true },
    ],
  },
];

// Flatten for search
export function flattenIndustries(nodes: IndustryNode[]): IndustryNode[] {
  const result: IndustryNode[] = [];
  const traverse = (nodeList: IndustryNode[]) => {
    for (const node of nodeList) {
      result.push(node);
      if (node.children) traverse(node.children);
    }
  };
  traverse(nodes);
  return result;
}

export const FLAT_INDUSTRIES = flattenIndustries(LINKEDIN_INDUSTRIES);
