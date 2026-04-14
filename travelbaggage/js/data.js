const AIRLINE_DATA = {
  lastUpdated: "2026-04",
  currencyNote: "Prices are approximate one-way add-on prices in USD where the airline publishes a stable starting fee or common baseline. Use null where fees are too route-dependent or require a calculator.",
  airlines: [
    {
      name: "American Airlines",
      iata: "AA",
      baggage: {
        personal: { dimensionsCm: [45, 35, 20], weightKg: null },
        carryOn: { dimensionsCm: [56, 36, 23], weightKg: null },
        checked: { dimensionsCm: [158], weightKg: 23 }
      },
      ticketTiers: [
        {
          name: "Basic Economy",
          included: { personal: true, carryOn: true, checked: 0 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 40 }
        },
        {
          name: "Main Cabin",
          included: { personal: true, carryOn: true, checked: 0 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 40 }
        },
        {
          name: "Premium Economy",
          included: { personal: true, carryOn: true, checked: 2 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "Business / First",
          included: { personal: true, carryOn: true, checked: 2 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        }
      ],
      notes: "Basic/Main usually pay for checked bags. Personal item max 45x35x20 cm."
    },
    {
      name: "Delta Air Lines",
      iata: "DL",
      baggage: {
        personal: { dimensionsCm: null, weightKg: null },
        carryOn: { dimensionsCm: [56, 36, 23], weightKg: null },
        checked: { dimensionsCm: [158], weightKg: 23 }
      },
      ticketTiers: [
        {
          name: "Basic Economy",
          included: { personal: true, carryOn: true, checked: 0 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 35 }
        },
        {
          name: "Main Cabin / Comfort+",
          included: { personal: true, carryOn: true, checked: 0 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 35 }
        },
        {
          name: "Premium Select",
          included: { personal: true, carryOn: true, checked: 2 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "First / Delta One",
          included: { personal: true, carryOn: true, checked: 2 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        }
      ],
      notes: "Carry-on + personal item free even on Basic. Personal item size not formally listed."
    },
    {
      name: "United Airlines",
      iata: "UA",
      baggage: {
        personal: { dimensionsCm: [43, 25, 22], weightKg: null },
        carryOn: { dimensionsCm: [56, 35, 23], weightKg: null },
        checked: { dimensionsCm: [158], weightKg: 23 }
      },
      ticketTiers: [
        {
          name: "Basic Economy",
          included: { personal: true, carryOn: false, checked: 0 },
          avgAddOnPriceUsd: { carryOn: 45, checked: 45 }
        },
        {
          name: "Economy",
          included: { personal: true, carryOn: true, checked: 0 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 45 }
        },
        {
          name: "Premium Plus",
          included: { personal: true, carryOn: true, checked: 2 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "Business / First",
          included: { personal: true, carryOn: true, checked: 2 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        }
      ],
      notes: "Basic Economy generally gets only a personal item; carry-on starts at $45 if prepaid."
    },
    {
      name: "Ryanair",
      iata: "FR",
      baggage: {
        personal: { dimensionsCm: [40, 30, 20], weightKg: null },
        carryOn: { dimensionsCm: [55, 40, 20], weightKg: 10 },
        checked: { dimensionsCm: null, weightKg: 10 }
      },
      ticketTiers: [
        {
          name: "Basic",
          included: { personal: true, carryOn: false, checked: 0 },
          avgAddOnPriceUsd: { carryOn: 26, checked: 29 }
        },
        {
          name: "Regular / Plus",
          included: { personal: true, carryOn: false, checked: 1 },
          avgAddOnPriceUsd: { carryOn: 26, checked: 0 }
        },
        {
          name: "Priority",
          included: { personal: true, carryOn: true, checked: 0 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 29 }
        },
        {
          name: "Flexi Plus",
          included: { personal: true, carryOn: true, checked: 0 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 29 }
        }
      ],
      notes: "Strict sizer enforcement. Personal bag 40x30x20 cm; Priority adds 10kg cabin bag. 10kg and 20kg checked options sold separately."
    },
    {
      name: "easyJet",
      iata: "U2",
      baggage: {
        personal: { dimensionsCm: [45, 36, 20], weightKg: 15 },
        carryOn: { dimensionsCm: [56, 45, 25], weightKg: null },
        checked: { dimensionsCm: null, weightKg: 15 }
      },
      ticketTiers: [
        {
          name: "Standard",
          included: { personal: true, carryOn: false, checked: 0 },
          avgAddOnPriceUsd: { carryOn: 9, checked: 22 }
        },
        {
          name: "Standard Plus",
          included: { personal: true, carryOn: true, checked: 0 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 22 }
        },
        {
          name: "ESSENTIAL / FLEXI",
          included: { personal: true, carryOn: true, checked: 0 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 22 }
        }
      ],
      notes: "Everyone gets one under-seat bag. Large cabin bag is usually paid unless bundled. Hold-bag options start at 15kg; 23kg is standard."
    },
    {
      name: "Lufthansa",
      iata: "LH",
      baggage: {
        personal: { dimensionsCm: null, weightKg: null },
        carryOn: { dimensionsCm: [56, 36, 23], weightKg: 8 },
        checked: { dimensionsCm: [158], weightKg: 23 }
      },
      ticketTiers: [
        {
          name: "Economy Light",
          included: { personal: true, carryOn: true, checked: 0 },
          avgAddOnPriceUsd: { carryOn: 0, checked: null }
        },
        {
          name: "Economy Classic / Flex",
          included: { personal: true, carryOn: true, checked: 1 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "Premium Economy",
          included: { personal: true, carryOn: true, checked: 1 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "Business / First",
          included: { personal: true, carryOn: true, checked: 2 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        }
      ],
      notes: "Economy Light usually excludes checked bags. Optional checked-bag pricing is route-dependent via baggage calculator."
    },
    {
      name: "Air France",
      iata: "AF",
      baggage: {
        personal: { dimensionsCm: [40, 30, 15], weightKg: null },
        carryOn: { dimensionsCm: [55, 35, 25], weightKg: 12 },
        checked: { dimensionsCm: [158], weightKg: 23 }
      },
      ticketTiers: [
        {
          name: "Economy Light",
          included: { personal: true, carryOn: false, checked: 0 },
          avgAddOnPriceUsd: { carryOn: null, checked: null }
        },
        {
          name: "Economy Standard / Flex",
          included: { personal: true, carryOn: true, checked: 1 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "Premium",
          included: { personal: true, carryOn: true, checked: 2 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "Business / La Premiere",
          included: { personal: true, carryOn: true, checked: 2 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        }
      ],
      notes: "Economy cabin baggage is 0-1 hand bag depending on fare plus 1 small bag; 12kg combined cabin weight. Light fares can exclude cabin bag on some channels."
    },
    {
      name: "Emirates",
      iata: "EK",
      baggage: {
        personal: { dimensionsCm: null, weightKg: null },
        carryOn: { dimensionsCm: [55, 38, 22], weightKg: 7 },
        checked: { dimensionsCm: null, weightKg: 20 }
      },
      ticketTiers: [
        {
          name: "Economy Special",
          included: { personal: false, carryOn: true, checked: 1 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "Economy Saver",
          included: { personal: false, carryOn: true, checked: 1 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "Economy Flex",
          included: { personal: false, carryOn: true, checked: 1 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "Economy Flex Plus",
          included: { personal: false, carryOn: true, checked: 1 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        }
      ],
      notes: "Economy uses weight concept on most routes: Special 20kg, Saver 25kg, Flex 30kg, Flex Plus 35kg. Cabin bag is one 55x38x22 cm piece up to 7kg."
    },
    {
      name: "Singapore Airlines",
      iata: "SQ",
      baggage: {
        personal: { dimensionsCm: null, weightKg: null },
        carryOn: { dimensionsCm: [115], weightKg: 7 },
        checked: { dimensionsCm: null, weightKg: 25 }
      },
      ticketTiers: [
        {
          name: "Economy Lite",
          included: { personal: true, carryOn: true, checked: 1 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "Economy Value",
          included: { personal: true, carryOn: true, checked: 1 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "Economy Standard",
          included: { personal: true, carryOn: true, checked: 1 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "Economy Flexi",
          included: { personal: true, carryOn: true, checked: 1 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        }
      ],
      notes: "Economy allows 1 cabin bag up to 7kg and 115cm total dimensions. Checked allowance is usually 25kg (Lite/Value) or 30kg (Standard/Flexi) outside the USA."
    },
    {
      name: "ANA",
      iata: "NH",
      baggage: {
        personal: { dimensionsCm: null, weightKg: null },
        carryOn: { dimensionsCm: [115], weightKg: 10 },
        checked: { dimensionsCm: [158], weightKg: 23 }
      },
      ticketTiers: [
        {
          name: "Economy Light / Value",
          included: { personal: true, carryOn: true, checked: 1 },
          avgAddOnPriceUsd: { carryOn: 0, checked: null }
        },
        {
          name: "Economy Basic / Standard",
          included: { personal: true, carryOn: true, checked: 2 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "Premium Economy",
          included: { personal: true, carryOn: true, checked: 2 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        },
        {
          name: "Business / First",
          included: { personal: true, carryOn: true, checked: 2 },
          avgAddOnPriceUsd: { carryOn: 0, checked: 0 }
        }
      ],
      notes: "Most travellers get 1 carry-on + 1 personal item; total cabin weight 10kg. Economy Light/Value routes often drop from 2 free checked bags to 1."
    }
  ]
};
