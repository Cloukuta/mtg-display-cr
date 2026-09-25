export type PricingMode="default"|"custom"|"discount";
export type PriceSource="cardkingdom"|"tcgplayer";

export type MarketPrice={
  scryfall_id:string;
  finish:string;
  condition:string;
  price_usd:number;
};

export type VisualPricingResult={
  priceCrc:number|null;
  referenceCrc:number|null;
  marketPriceUsd:number|null;
  discountPercent:number|null;
  source:PriceSource;
};

const resolvedUsdReferences=new Map<string,number>();
function referenceKey(priceCrc:number|null,referenceCrc:number|null,pricingMode:PricingMode){return `${pricingMode}:${priceCrc??"null"}:${referenceCrc??"null"}`}
export function rememberVisualPricing(result:VisualPricingResult,pricingMode:PricingMode){
  if(result.marketPriceUsd!=null&&result.marketPriceUsd>0)resolvedUsdReferences.set(referenceKey(result.priceCrc,result.referenceCrc,pricingMode),result.marketPriceUsd);
  return result;
}
export function getRememberedMarketPriceUsd(priceCrc:number|null,referenceCrc:number|null,pricingMode:PricingMode){
  return resolvedUsdReferences.get(referenceKey(priceCrc,referenceCrc,pricingMode))??null;
}

export function normalizePricingFinish(value:string){
  const finish=value.trim().toLowerCase().replace(/[ _-]+/g,"");
  return finish==="normal"||finish==="nonfoil"?"nonfoil":finish;
}

export function resolveVisualPricing(input:{
  scryfallId:string;
  finish:string;
  condition:string;
  pricingMode:PricingMode;
  customPriceCrc:number|null;
  prices:MarketPrice[];
  usdToCrc:number;
  discountPercent:number;
  source?:PriceSource;
}):VisualPricingResult{
  const source=input.source??"cardkingdom";
  const finish=normalizePricingFinish(input.finish);
  const condition=input.condition.trim().toUpperCase();
  const market=input.prices.find(price=>
    price.scryfall_id===input.scryfallId&&
    normalizePricingFinish(price.finish)===finish&&
    price.condition.trim().toUpperCase()===condition
  );
  const marketPriceUsd=market?Number(market.price_usd):null;
  const referenceCrc=marketPriceUsd!=null?Math.round(marketPriceUsd*input.usdToCrc):null;

  if(input.pricingMode==="custom"){
    return rememberVisualPricing({priceCrc:input.customPriceCrc,referenceCrc,marketPriceUsd,discountPercent:null,source},input.pricingMode);
  }
  if(referenceCrc==null){
    return {priceCrc:null,referenceCrc:null,marketPriceUsd:null,discountPercent:input.pricingMode==="discount"?input.discountPercent:null,source};
  }
  if(input.pricingMode==="discount"){
    return rememberVisualPricing({priceCrc:Math.round(referenceCrc*(1-input.discountPercent/100)),referenceCrc,marketPriceUsd,discountPercent:input.discountPercent,source},input.pricingMode);
  }
  return rememberVisualPricing({priceCrc:referenceCrc,referenceCrc,marketPriceUsd,discountPercent:null,source},input.pricingMode);
}
