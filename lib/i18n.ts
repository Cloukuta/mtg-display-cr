export type Language = "es" | "en";

export const DEFAULT_LANGUAGE: Language = "es";
export const LANGUAGE_STORAGE_KEY = "mtg-display-cr-language";

export const translations = {
  es: {
    common: {
      spanish: "Español",
      english: "English",
      save: "Guardar",
      saving: "Guardando...",
      backToDashboard: "Volver al panel",
      openCatalog: "Abrir catálogo",
      loading: "Cargando...",
    },

    navigation: {
  seller: "Vendedor",
  dashboard: "Panel",
  catalog: "Mi catálogo",
  importCards: "Importar cartas",
  pricingSettings: "Configuración de precios",
  preferences: "Preferencias",
  language: "Idioma",
  theme: "Tema",
  viewPublicStore: "Ver tienda pública",
  copyStoreLink: "Copiar enlace de la tienda",
  catalogManagement: "Administrar catálogo",
  signOut: "Cerrar sesión",
  storeNotConfigured: "Tienda pública no configurada",
  menu: "Menú",
},

    pricing: {
      eyebrow: "Configuración del vendedor",
      title: "Configuración de precios",
      description:
        "Controla cómo los precios en dólares de Card Kingdom se convierten en tus precios de venta en colones costarricenses.",

      exchangeTitle: "Conversión USD → CRC",
      exchangeDescription:
        "Elige el valor en colones que deseas utilizar por cada dólar estadounidense en tu catálogo.",
      crcPerUsd: "₡ CRC por $1 USD",
      exchangeHelp:
        "Cambiar este valor modifica automáticamente los precios calculados como Predeterminado y Descuento. Los precios personalizados no se ven afectados.",

      discountTitle: "Descuento / Bulk",
      discountDescription:
        "Define el descuento aplicado a las cartas que utilizan el modo de precio Descuento.",
      discountPercentage: "Porcentaje de descuento",
      discountHelp:
        "Puedes cambiar este valor cuando quieras. Solo afecta a las cartas que utilizan el modo Descuento.",

      saveButton: "Guardar configuración de precios",
      saved:
        "Configuración guardada. Los precios Predeterminado y Descuento utilizarán estos valores.",

      exchangeError:
        "La conversión USD → CRC debe ser mayor que ₡0.",
      discountError:
        "El descuento debe estar entre 0% y 100%.",

      liveExample: "Ejemplo en vivo",
      exampleTitle: "Carta de $10 en Card Kingdom",
      cardKingdom: "Card Kingdom",
      default: "Predeterminado",
      discount: "Descuento",
      custom: "Personalizado ⚠",
      offDefault: "de descuento sobre Predeterminado",

      customWarning:
        "Los precios personalizados permanecen sin cambios cuando cambia el valor del dólar, el descuento o el precio de Card Kingdom.",

      ckPricing: "Precios de Card Kingdom",
      ckDescription:
        "Las actualizaciones automáticas de precios de Card Kingdom se conectarán en la siguiente etapa del sistema de precios.",
      status: "Estado:",
      pendingIntegration: "Integración pendiente",

      supabaseRequired: "Se requiere conexión con Supabase",
      signInDescription:
        "Inicia sesión desde tu panel para administrar los precios.",
      goToDashboard: "Ir al panel",
      loading: "Cargando configuración de precios...",
    },

    catalog: {
  eyebrow: "Inventario del vendedor",
  title: "Tu catálogo",
  privateCatalog: "listados en tu catálogo privado",

  all: "Todos",
  default: "Predeterminado",
  custom: "Personalizado ⚠",
  discount: "Descuento",

  search: "Buscar cartas...",
  selectVisible: "Seleccionar visibles",
  shown: "mostradas",
  selected: "seleccionadas",
  currentValue: "Valor actual",

  setDefault: "Asignar Predeterminado",
  setCustom: "Asignar Personalizado ⚠",
  setDiscount: "Asignar Descuento",

  quantity: "Cant.",
  available: "Disponible",
  hidden: "Oculta",

  cardKingdom: "Card Kingdom",
  salePrice: "Precio de venta",
  pending: "Pendiente",

  noListings: "No se encontraron cartas.",
  noImage: "Sin imagen",
  unknownCard: "Carta desconocida",

  customWarning:
    "⚠ Los precios personalizados no se actualizan automáticamente.",

  usdToCrc: "USD → CRC",
  discountSetting: "Descuento",

  loading: "Cargando catálogo…",

  supabaseRequired: "Se requiere conexión con Supabase",
  backToDashboard: "Volver al panel",

  sellerCatalog: "Catálogo del vendedor",
  signInDescription:
    "Inicia sesión desde tu panel para administrar tu catálogo.",
  goToDashboard: "Ir al panel",

  listingMoved: "listado movido a",
  listingsMoved: "listados movidos a",

  qty: "Cant.",
},
  },

  en: {
    common: {
      spanish: "Español",
      english: "English",
      save: "Save",
      saving: "Saving...",
      backToDashboard: "Back to Dashboard",
      openCatalog: "Open Catalog",
      loading: "Loading...",
    },

    navigation: {
  seller: "Seller",
  dashboard: "Dashboard",
  catalog: "My Catalog",
  importCards: "Import Cards",
  pricingSettings: "Pricing Settings",
  preferences: "Preferences",
  language: "Language",
  theme: "Theme",
  viewPublicStore: "View Public Store",
  copyStoreLink: "Copy Store Link",
  catalogManagement: "Catalog Management",
  signOut: "Sign out",
  storeNotConfigured: "Public store not configured",
  menu: "Menu",
},

    pricing: {
      eyebrow: "Seller configuration",
      title: "Pricing Settings",
      description:
        "Control how Card Kingdom USD prices are converted into your Costa Rican colón selling prices.",

      exchangeTitle: "USD → CRC Exchange Rate",
      exchangeDescription:
        "Choose the colón value you want to use for each US dollar in your catalog.",
      crcPerUsd: "₡ CRC per $1 USD",
      exchangeHelp:
        "Changing this value automatically changes calculated Default and Discount prices. Custom prices are not affected.",

      discountTitle: "Discount / Bulk",
      discountDescription:
        "Set the discount applied to cards using Discount pricing mode.",
      discountPercentage: "Discount percentage",
      discountHelp:
        "This value can be changed whenever you want. Only listings using Discount mode are affected.",

      saveButton: "Save Pricing Settings",
      saved:
        "Pricing settings saved. Default and Discount prices will use these values.",

      exchangeError:
        "USD → CRC must be greater than ₡0.",
      discountError:
        "Discount must be between 0% and 100%.",

      liveExample: "Live example",
      exampleTitle: "$10 Card Kingdom card",
      cardKingdom: "Card Kingdom",
      default: "Default",
      discount: "Discount",
      custom: "Custom ⚠",
      offDefault: "off Default",

      customWarning:
        "Manual CRC prices remain unchanged when the exchange rate, discount, or Card Kingdom price changes.",

      ckPricing: "Card Kingdom Pricing",
      ckDescription:
        "Automatic Card Kingdom price updates will be connected in the next pricing stage.",
      status: "Status:",
      pendingIntegration: "Pending integration",

      supabaseRequired: "Supabase connection required",
      signInDescription:
        "Sign in from your dashboard to manage pricing.",
      goToDashboard: "Go to Dashboard",
      loading: "Loading pricing settings...",
    },

    catalog: {
  eyebrow: "Seller inventory",
  title: "Your Catalog",
  privateCatalog: "listings in your private catalog",

  all: "All",
  default: "Default",
  custom: "Custom ⚠",
  discount: "Discount",

  search: "Search cards...",
  selectVisible: "Select visible",
  shown: "shown",
  selected: "selected",
  currentValue: "Current value",

  setDefault: "Set Default",
  setCustom: "Set Custom ⚠",
  setDiscount: "Set Discount",

  quantity: "Qty",
  available: "Available",
  hidden: "Hidden",

  cardKingdom: "Card Kingdom",
  salePrice: "Sale price",
  pending: "Pending",

  noListings: "No listings found.",
  noImage: "No image",
  unknownCard: "Unknown card",

  customWarning:
    "⚠ Custom prices do not update automatically.",

  usdToCrc: "USD → CRC",
  discountSetting: "Discount",

  loading: "Loading catalog…",

  supabaseRequired: "Supabase connection required",
  backToDashboard: "Back to Dashboard",

  sellerCatalog: "Seller catalog",
  signInDescription:
    "Sign in from your dashboard to manage your catalog.",
  goToDashboard: "Go to Dashboard",

  listingMoved: "listing moved to",
  listingsMoved: "listings moved to",

  qty: "Qty",
},
  },
} as const;

export function getTranslation(language: Language) {
  return translations[language];
}