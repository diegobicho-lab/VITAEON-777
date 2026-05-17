"use client";

import { useCallback, useEffect, useState } from "react";
import { clientApi } from "@/services/client/api";
import type { CurrentUser, DoctorListItem } from "@/types/domain";

export type SpecialtyClient = { id: string; name: string; description?: string | null; doctorsCount: number };
export type HospitalClient = { id: string; name: string; city: string; address?: string | null; doctorsCount: number };

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUser(await clientApi<CurrentUser>("/api/auth/me"));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { user, setUser, loading, refresh };
}

export function useCatalogs() {
  const [specialties, setSpecialties] = useState<SpecialtyClient[]>([]);
  const [hospitals, setHospitals] = useState<HospitalClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextSpecialties, nextHospitals] = await Promise.all([
        clientApi<SpecialtyClient[]>("/api/specialties"),
        clientApi<HospitalClient[]>("/api/hospitals")
      ]);
      setSpecialties(nextSpecialties);
      setHospitals(nextHospitals);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cargar catálogos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { specialties, hospitals, loading, error, refresh };
}

export function useDoctors(filters: { specialtyId?: string; hospitalId?: string; query?: string }) {
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filters.specialtyId) params.set("specialtyId", filters.specialtyId);
      if (filters.hospitalId) params.set("hospitalId", filters.hospitalId);
      if (filters.query?.trim()) params.set("query", filters.query.trim());
      setDoctors(await clientApi<DoctorListItem[]>(`/api/doctors?${params.toString()}`));
    } catch (caught) {
      setDoctors([]);
      setError(caught instanceof Error ? caught.message : "No fue posible cargar médicos.");
    } finally {
      setLoading(false);
    }
  }, [filters.hospitalId, filters.query, filters.specialtyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { doctors, loading, error, empty: !loading && doctors.length === 0, refresh };
}
