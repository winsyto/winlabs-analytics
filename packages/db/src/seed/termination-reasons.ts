export const TERMINATION_REASONS = [
  { code: "VOLUNTARY_RESIGNATION", name: "Renuncia voluntaria", category: "voluntary" },
  { code: "BETTER_OFFER", name: "Mejor oferta laboral", category: "voluntary" },
  { code: "DISMISSAL", name: "Despido sin causa", category: "involuntary" },
  { code: "DISMISSAL_WITH_CAUSE", name: "Despido con causa", category: "involuntary" },
  { code: "END_OF_CONTRACT", name: "Fin de contrato", category: "end_of_contract" },
  { code: "RETIREMENT", name: "Jubilación", category: "retirement" },
  { code: "MUTUAL_AGREEMENT", name: "Mutuo acuerdo", category: "other" },
] as const;
