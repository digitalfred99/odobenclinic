"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { Patient, PatientListResponse } from "@/types/patient";

const CACHE_KEY = "patient-location-cache-v1";
const CHANGE_EVENT = "patient-location-cache-change";
const PAGE_LIMIT = 100;
const PAGE_CONCURRENCY = 4;

export type PatientLocation = Pick<Patient, "region" | "district" | "town" | "area">;
export type LocationSyncStatus = "idle" | "loading" | "ready" | "error";

let syncStatus: LocationSyncStatus = "idle";
let refreshPromise: Promise<PatientLocation[]> | null = null;

function normalizeLocation(location: PatientLocation): PatientLocation | null {
  const normalized = {
    region: location.region?.trim() || null,
    district: location.district?.trim() || null,
    town: location.town?.trim() || null,
    area: location.area?.trim() || null,
  };
  return Object.values(normalized).some(Boolean) ? normalized : null;
}

function uniqueLocations(locations: PatientLocation[]): PatientLocation[] {
  const seen = new Set<string>();
  return locations.flatMap((location) => {
    const normalized = normalizeLocation(location);
    if (!normalized) {
      return [];
    }
    const key = [normalized.region, normalized.district, normalized.town, normalized.area]
      .map((value) => value?.toLocaleLowerCase() ?? "")
      .join("\u0000");
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [normalized];
  });
}

function toPatientLocation(patient: Patient): PatientLocation {
  return {
    region: patient.region,
    district: patient.district,
    town: patient.town,
    area: patient.area,
  };
}

function isPatientLocation(value: unknown): value is PatientLocation {
  if (!value || typeof value !== "object") {
    return false;
  }
  const location = value as Record<string, unknown>;
  return ["region", "district", "town", "area"].every((key) =>
    location[key] === null || location[key] === undefined || typeof location[key] === "string"
  );
}

function notifyCacheChanged() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function readPatientLocationCache(): PatientLocation[] {
  try {
    const cached = window.localStorage.getItem(CACHE_KEY);
    if (!cached) {
      return [];
    }
    const parsed: unknown = JSON.parse(cached);
    if (!Array.isArray(parsed)) {
      throw new Error("Location cache must contain an array.");
    }
    return uniqueLocations(parsed.filter(isPatientLocation));
  } catch (error) {
    console.error("Unable to read cached patient locations.", error);
    try {
      window.localStorage.removeItem(CACHE_KEY);
    } catch (removeError) {
      console.error("Unable to clear the invalid patient location cache.", removeError);
    }
    return [];
  }
}

function writePatientLocationCache(locations: PatientLocation[]) {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(uniqueLocations(locations)));
  notifyCacheChanged();
}

function getPatients(response: PatientListResponse, page: number): Patient[] {
  if (!Array.isArray(response.patients) || !Number.isInteger(response.pagination?.totalPages)) {
    throw new Error(`The patient list response for page ${page} is missing pagination data.`);
  }
  return response.patients;
}

async function fetchPatientPage(page: number): Promise<PatientListResponse> {
  return apiRequest<PatientListResponse>(`/patients?page=${page}&limit=${PAGE_LIMIT}`);
}

export function refreshPatientLocationCache(): Promise<PatientLocation[]> {
  if (refreshPromise) {
    return refreshPromise;
  }

  syncStatus = "loading";
  notifyCacheChanged();

  refreshPromise = (async () => {
    try {
      const firstPage = await fetchPatientPage(1);
      const totalPages = firstPage.pagination?.totalPages;
      if (typeof totalPages !== "number" || !Number.isInteger(totalPages) || totalPages < 1) {
        throw new Error("The patient list response is missing a valid totalPages value.");
      }

      const locations = getPatients(firstPage, 1).map(toPatientLocation);
      for (let firstPageInBatch = 2; firstPageInBatch <= totalPages; firstPageInBatch += PAGE_CONCURRENCY) {
        const pageNumbers = Array.from(
          { length: Math.min(PAGE_CONCURRENCY, totalPages - firstPageInBatch + 1) },
          (_, index) => firstPageInBatch + index
        );
        const pages = await Promise.all(pageNumbers.map(fetchPatientPage));
        pages.forEach((response, index) => {
          const pageNumber = pageNumbers[index];
          if (pageNumber === undefined) {
            throw new Error("Unable to resolve a patient location page number.");
          }
          locations.push(...getPatients(response, pageNumber).map(toPatientLocation));
        });
      }

      const unique = uniqueLocations(locations);
      writePatientLocationCache(unique);
      syncStatus = "ready";
      notifyCacheChanged();
      return unique;
    } catch (error) {
      syncStatus = "error";
      notifyCacheChanged();
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export function getPatientLocationSyncStatus(): LocationSyncStatus {
  return syncStatus;
}

export function cachePatientLocation(patient: Patient): void {
  const location = normalizeLocation(patient);
  if (!location) {
    return;
  }

  try {
    writePatientLocationCache([...readPatientLocationCache(), location]);
  } catch (error) {
    console.error("Patient was saved, but its location could not be added to this browser's cache.", error);
  }
}

export function usePatientLocationCache() {
  const [locations, setLocations] = useState<PatientLocation[]>([]);
  const [status, setStatus] = useState<LocationSyncStatus>("idle");

  useEffect(() => {
    const refreshFromBrowserCache = () => {
      setLocations(readPatientLocationCache());
      setStatus(syncStatus);
    };
    const refreshFromAnotherTab = () => refreshFromBrowserCache();

    refreshFromBrowserCache();
    window.addEventListener(CHANGE_EVENT, refreshFromBrowserCache);
    window.addEventListener("storage", refreshFromAnotherTab);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refreshFromBrowserCache);
      window.removeEventListener("storage", refreshFromAnotherTab);
    };
  }, []);

  return { locations, status };
}
