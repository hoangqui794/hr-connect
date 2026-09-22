export type Locale = 'vi' | 'en';

export interface Translations {
  locale: Locale;
  common: {
    brandName: string;
    tagline: string;
    aiPowered: string;
    loading: string;
  };
  nav: {
    jobs: string;
    forEmployers: string;
    forAffiliates: string;
    pricing: string;
    signIn: string;
    register: string;
    dashboard: string;
    logout: string;
  };
  hero: {
    badge: string;
    titleMain: string;
    titleHighlight: string;
    subtitle: string;
    ctaPostJob: string;
    ctaJoinAffiliate: string;
    searchKeywordPlaceholder: string;
    searchIndustryPlaceholder: string;
    searchLocationPlaceholder: string;
    searchLocationAll: string;
    searchButton: string;
    locationHanoi: string;
    locationHcm: string;
    locationDanang: string;
    locationRemote: string;
  };
  services: {
    badge: string;
    title: string;
    subtitle: string;
    popularBadge: string;
    cod: {
      code: string;
      badgeTitle: string;
      title: string;
      subtitle: string;
      description: string;
      features: string[];
      cta: string;
    };
    sourcing: {
      code: string;
      badgeTitle: string;
      title: string;
      subtitle: string;
      description: string;
      features: string[];
      cta: string;
    };
    application: {
      code: string;
      badgeTitle: string;
      title: string;
      subtitle: string;
      description: string;
      features: string[];
      cta: string;
    };
  };
  features: {
    badge: string;
    title: string;
    subtitle: string;
    f1: {
      title: string;
      desc: string;
      tag: string;
    };
    f2: {
      title: string;
      desc: string;
      tag: string;
    };
    f3: {
      title: string;
      desc: string;
      tag: string;
    };
    f4: {
      title: string;
      desc: string;
      tag: string;
    };
  };
  stats: {
    candidates: string;
    industries: string;
    placementRate: string;
    commissions: string;
  };
  ctaSection: {
    title: string;
    subtitle: string;
    btnPost: string;
    btnJoin: string;
  };
  footer: {
    copyright: string;
    privacy: string;
    terms: string;
    contact: string;
    about: string;
  };
}
