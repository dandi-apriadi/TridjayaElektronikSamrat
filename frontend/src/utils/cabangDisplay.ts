import type { CabangItem } from '../types';

export interface CabangLookup {
  byId: Map<string, CabangItem>;
  byName: Map<string, CabangItem>;
  byUniqueCity: Map<string, CabangItem>;
}

export interface CabangDisplay {
  label: string;
  detail: string;
  filterLabel: string;
  searchText: string;
  isKnown: boolean;
}

const normalizeKey = (value?: string | null) => (value || '').trim().toLowerCase();

const compactParts = (parts: Array<string | undefined | null>) =>
  parts.map((part) => (part || '').trim()).filter(Boolean);

export const createCabangLookup = (items: CabangItem[]): CabangLookup => {
  const byId = new Map<string, CabangItem>();
  const byName = new Map<string, CabangItem>();
  const cityGroups = new Map<string, CabangItem[]>();

  items.forEach((item) => {
    const idKey = normalizeKey(item.id);
    const nameKey = normalizeKey(item.nama);
    const cityKey = normalizeKey(item.kota);

    if (idKey) byId.set(idKey, item);
    if (nameKey) byName.set(nameKey, item);
    if (cityKey) {
      cityGroups.set(cityKey, [...(cityGroups.get(cityKey) || []), item]);
    }
  });

  const byUniqueCity = new Map<string, CabangItem>();
  cityGroups.forEach((group, cityKey) => {
    if (group.length === 1) byUniqueCity.set(cityKey, group[0]);
  });

  return { byId, byName, byUniqueCity };
};

export const getCabangDisplay = (rawValue: string | undefined | null, lookup: CabangLookup): CabangDisplay => {
  const raw = (rawValue || '').trim();
  const key = normalizeKey(raw);
  const item = key ? lookup.byId.get(key) || lookup.byName.get(key) || lookup.byUniqueCity.get(key) : undefined;

  if (!item) {
    const label = raw || 'Cabang belum diatur';
    return {
      label,
      detail: raw ? 'Nama cabang belum tersambung ke master cabang' : 'Master cabang karyawan belum tersedia',
      filterLabel: label,
      searchText: `${label} ${raw}`.toLowerCase(),
      isKnown: false,
    };
  }

  const detailParts = compactParts([item.kota, item.alamat]);
  const detail = detailParts.join(' · ');
  const filterLabel = compactParts([item.nama, item.kota]).join(' · ') || item.nama;

  return {
    label: item.nama || raw || 'Cabang belum diatur',
    detail,
    filterLabel,
    searchText: compactParts([item.id, item.nama, item.kota, item.alamat, raw]).join(' ').toLowerCase(),
    isKnown: true,
  };
};
