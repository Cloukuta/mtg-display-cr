export type SellerDiscoverySignals={
  verified:boolean;
  featured:boolean;
  confirmedSales:number;
  reviewCount:number;
  reviewAverage:number|null;
};

export type SellerDiscoveryCandidate<T>={seller:T;signals:SellerDiscoverySignals};

export const EMPTY_SELLER_DISCOVERY_SIGNALS:SellerDiscoverySignals={
  verified:false,
  featured:false,
  confirmedSales:0,
  reviewCount:0,
  reviewAverage:null,
};

/**
 * Discovery ranking inputs intentionally exclude subscription tier.
 * Paying for a larger storefront should not directly buy placement in seller discovery.
 *
 * This module only defines the trusted reputation signals for the future ranking layer.
 * Weighting/ranking is deliberately not activated until the platform has enough review
 * and completed-sale data to choose fair weights without hiding new sellers.
 */
export function normalizeSellerDiscoverySignals(input:Partial<SellerDiscoverySignals>|null|undefined):SellerDiscoverySignals{
  const confirmedSales=Math.max(0,Math.trunc(Number(input?.confirmedSales)||0));
  const reviewCount=Math.max(0,Math.trunc(Number(input?.reviewCount)||0));
  const rawAverage=input?.reviewAverage;
  const reviewAverage=rawAverage==null||!Number.isFinite(Number(rawAverage))?null:Math.min(5,Math.max(0,Number(rawAverage)));
  return{
    verified:Boolean(input?.verified),
    featured:Boolean(input?.featured),
    confirmedSales,
    reviewCount,
    reviewAverage:reviewCount>0?reviewAverage:null,
  };
}

/**
 * Deterministic comparison reserved for filtered/search result ordering once reputation
 * ranking is enabled. It is not used by the random unfiltered Home rotation yet.
 * Review volume is considered before average so a single 5-star review cannot by itself
 * dominate a seller with an established review history.
 */
export function compareSellerReputation(a:SellerDiscoverySignals,b:SellerDiscoverySignals){
  if(a.verified!==b.verified)return a.verified?-1:1;
  if(a.featured!==b.featured)return a.featured?-1:1;
  if(a.confirmedSales!==b.confirmedSales)return b.confirmedSales-a.confirmedSales;
  if(a.reviewCount!==b.reviewCount)return b.reviewCount-a.reviewCount;
  return(b.reviewAverage??0)-(a.reviewAverage??0);
}
