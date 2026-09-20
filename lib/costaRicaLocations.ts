export const COSTA_RICA_LOCATIONS = {
  "San José": ["San José","Escazú","Desamparados","Puriscal","Tarrazú","Aserrí","Mora","Goicoechea","Santa Ana","Alajuelita","Vázquez de Coronado","Acosta","Tibás","Moravia","Montes de Oca","Turrubares","Dota","Curridabat","Pérez Zeledón","León Cortés Castro"],
  "Alajuela": ["Alajuela","San Ramón","Grecia","San Mateo","Atenas","Naranjo","Palmares","Poás","Orotina","San Carlos","Zarcero","Sarchí","Upala","Los Chiles","Guatuso","Río Cuarto"],
  "Cartago": ["Cartago","Paraíso","La Unión","Jiménez","Turrialba","Alvarado","Oreamuno","El Guarco"],
  "Heredia": ["Heredia","Barva","Santo Domingo","Santa Bárbara","San Rafael","San Isidro","Belén","Flores","San Pablo","Sarapiquí"],
  "Guanacaste": ["Liberia","Nicoya","Santa Cruz","Bagaces","Carrillo","Cañas","Abangares","Tilarán","Nandayure","La Cruz","Hojancha"],
  "Puntarenas": ["Puntarenas","Esparza","Buenos Aires","Montes de Oro","Osa","Quepos","Golfito","Coto Brus","Parrita","Corredores","Garabito","Monteverde","Puerto Jiménez"],
  "Limón": ["Limón","Pococí","Siquirres","Talamanca","Matina","Guácimo"],
} as const;

export type CostaRicaProvince = keyof typeof COSTA_RICA_LOCATIONS;
export const COSTA_RICA_PROVINCES = Object.keys(COSTA_RICA_LOCATIONS) as CostaRicaProvince[];

export function parseCostaRicaLocation(value:string){
  const [province="",canton="",country=""] = value.split(",").map(part=>part.trim());
  if(country!=="Costa Rica" || !COSTA_RICA_PROVINCES.includes(province as CostaRicaProvince)) return {province:"",canton:""};
  const cantons=COSTA_RICA_LOCATIONS[province as CostaRicaProvince] as readonly string[];
  return {province,canton:cantons.includes(canton)?canton:""};
}

export function formatCostaRicaLocation(province:string,canton:string){
  return province&&canton?`${province}, ${canton}, Costa Rica`:"";
}
