import type { PatientLocation } from "@/lib/patient-location-cache";

export const GHANA_REGIONS = [
  "Ahafo Region",
  "Ashanti Region",
  "Bono Region",
  "Bono East Region",
  "Central Region",
  "Eastern Region",
  "Greater Accra Region",
  "North East Region",
  "Northern Region",
  "Oti Region",
  "Savannah Region",
  "Upper East Region",
  "Upper West Region",
  "Volta Region",
  "Western Region",
  "Western North Region",
] as const;

export const CENTRAL_REGION_DISTRICTS = [
  "Abura-Asebu-Kwamankese",
  "Agona East",
  "Agona West",
  "Ajumako-Enyan-Essiam",
  "Asikuma-Odoben-Brakwa",
  "Assin Central",
  "Assin North",
  "Assin South",
  "Awutu-Senya East",
  "Awutu-Senya West",
  "Cape Coast Metropolitan",
  "Effutu",
  "Ekumfi",
  "Gomoa Central",
  "Gomoa East",
  "Gomoa West",
  "Hemang Lower Denkyira",
  "Komenda-Edina-Eguafo-Abirem",
  "Mfantseman",
  "Twifo-Atti Morkwaa",
  "Upper Denkyira East",
  "Upper Denkyira West",
] as const;

export const ASIKUMA_ODOBEN_BRAKWA_TOWNS = [
  "Breman Asikuma",
  "Odoben",
  "Breman Brakwa",
  "Breman Kuntunase",
  "Breman Bedum",
  "Breman Jamra",
  "Breman Kokoso",
  "Breman Fosuansa",
  "Breman Nwomaso",
  "Breman Amoanda",
  "Breman Anhwiam",
  "Breman Ayipey",
  "Breman Benin",
  "Breman Baako",
  "Breman Nyamebekyere",
  "Breman Okyesoa",
  "Amanfopong",
  "Nankese",
  "Sowotuom",
  "Supunso",
  "Towoboase",
  "Domeabra",
  "Ayiakwaa",
  "Asentem",
  "Kwaman",
  "South Sinkyrenmu",
  "Krobo",
  "Esiawkwaa",
  "Nyansakyere",
  "Fankyenko",
  "Esikafo Abatem",
  "Ofabir",
  "Ato Dauda",
  "Breman Esaadze",
  "Ekurakese",
  "Nsuakyir",
  "Amanbete",
  "Besease",
  "Eniehu",
  "Fankyeakor",
  "Tweredua",
  "Brakwa Eshiem",
  "Kweku Ninsi",
] as const;

export const ODOBEN_AREAS = [
  "Awendadze",
  "Asomdweekrom",
  "Zongo",
  "Nhyirakrom",
  "Anaafo",
  "Mpantoase",
  "Kokwado",
  "Mmoum",
  "Newtown",
  "Odumase",
  "Oforikrom",
] as const;

function uniqueOptions(options: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  return options.flatMap((option) => {
    const value = option?.trim();
    const key = value?.toLocaleLowerCase();
    if (!value || !key || seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [value];
  });
}

function matches(value: string | null | undefined, expected: string | undefined): boolean {
  return Boolean(expected && value?.trim().toLocaleLowerCase() === expected.trim().toLocaleLowerCase());
}

export function getDistrictSuggestions(locations: PatientLocation[], region: string): string[] {
  return uniqueOptions([
    ...(matches(region, "Central Region") ? CENTRAL_REGION_DISTRICTS : []),
    ...locations.filter((location) => matches(location.region, region)).map((location) => location.district),
  ]);
}

export function getTownSuggestions(locations: PatientLocation[], region: string, district: string): string[] {
  return uniqueOptions([
    ...(matches(district, "Asikuma-Odoben-Brakwa") ? ASIKUMA_ODOBEN_BRAKWA_TOWNS : []),
    ...locations
      .filter((location) => matches(location.region, region) && matches(location.district, district))
      .map((location) => location.town),
  ]);
}

export function getAreaSuggestions(
  locations: PatientLocation[],
  region: string,
  district: string,
  town: string
): string[] {
  return uniqueOptions([
    ...(matches(town, "Odoben") ? ODOBEN_AREAS : []),
    ...locations
      .filter((location) =>
        matches(location.region, region) &&
        matches(location.district, district) &&
        matches(location.town, town)
      )
      .map((location) => location.area),
  ]);
}
