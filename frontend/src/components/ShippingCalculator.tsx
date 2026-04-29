import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getDistance } from 'geolib';
import { Truck, MapPin, ExternalLink, Navigation, Search, Loader2, X, Zap, ShieldCheck, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import RouteMap from './RouteMap';

const ORIGIN_COORDS = { latitude: 1.4931, longitude: 124.8413 }; // Tridjaya Manado
const ORIGIN_MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=1.4931,124.8413';

interface LocationResult {
  display_name: string;
  lat: string;
  lon: string;
}

const RATE_PER_KM = 4300;
const FREE_SHIPPING_RADIUS_KM = 15;
const FUEL_PRICE = 10000; // Harga BBM estimasi per liter
const PICKUP_EFFICIENCY = 10; // km per liter (Pickup truck)

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const ShippingCalculator: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.length < 3) return;
    
    setIsSearching(true);
    setError(null);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Sulawesi Utara')}&limit=5`
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (err) {
      setError('Gagal mencari lokasi. Silakan coba lagi.');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery && !selectedLocation) {
        handleSearch(searchQuery);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedLocation, handleSearch]);

  const shippingResult = useMemo(() => {
    if (!selectedLocation) return null;

    const lat = parseFloat(selectedLocation.lat);
    const lon = parseFloat(selectedLocation.lon);

    const distanceMeters = getDistance(ORIGIN_COORDS, {
      latitude: lat,
      longitude: lon,
    });

    const distanceKm = distanceMeters / 1000;

    if (distanceKm <= FREE_SHIPPING_RADIUS_KM) {
      return {
        distance: distanceKm,
        cost: 0,
        isFree: true,
      };
    }

    const cost = Math.ceil((distanceKm * RATE_PER_KM) / 1000) * 1000;
    
    // Rincian Operasional untuk Justifikasi Harga (Unit Pickup)
    const fuelUsedLiters = (distanceKm * 2) / PICKUP_EFFICIENCY;
    const fuelCost = Math.ceil((fuelUsedLiters * FUEL_PRICE) / 500) * 500;
    
    // Estimasi biaya penyusutan kendaraan & perawatan Pickup (Ban, Oli, Sparepart khusus unit angkut)
    // Estimasi Rp 1.500 per KM Pulang Pergi
    const maintenanceCost = Math.ceil((distanceKm * 2 * 1500) / 500) * 500;
    
    // Jasa Pengantaran & Penanganan Logistik (Driver, Kernet, Bongkar Muat, Safety Tie-down)
    const serviceFee = Math.max(0, cost - fuelCost - maintenanceCost);

    return {
      distance: distanceKm,
      cost,
      fuelUsedLiters,
      fuelCost,
      maintenanceCost,
      serviceFee,
      isFree: false,
    };
  }, [selectedLocation]);

  const directionsUrl = selectedLocation 
    ? `https://www.google.com/maps/dir/?api=1&origin=${ORIGIN_COORDS.latitude},${ORIGIN_COORDS.longitude}&destination=${selectedLocation.lat},${selectedLocation.lon}&travelmode=driving`
    : '';

  return (
    <div className="glass-card rounded-2xl p-5 border border-outline-variant/10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 border-b border-outline-variant/10 pb-3">
        <span className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-surface shadow-neon-cyan-sm">
          <Truck className="w-4 h-4" />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-title-md font-bold text-white">Cek Ongkos Kirim</h3>
          <p className="text-label-xs text-on-surface-variant">
            Dari <a href={ORIGIN_MAPS_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
              Toko Tridjaya, Manado <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <label className="text-label-sm text-on-surface-variant font-semibold mb-1.5 block">
            Cari Lokasi Pengiriman (Kelurahan/Kecamatan/Jalan)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </span>
            <input
              type="text"
              value={selectedLocation ? selectedLocation.display_name : searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (selectedLocation) setSelectedLocation(null);
                setShowMap(false);
              }}
              placeholder="Contoh: Malalayang, Tikala, Paal Dua..."
              className="w-full pl-10 pr-10 py-2.5 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md text-white transition-all"
            />
            {(searchQuery || selectedLocation) && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setSelectedLocation(null);
                  setSearchResults([]);
                  setShowMap(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          <AnimatePresence>
            {!selectedLocation && searchResults.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-50 w-full mt-2 bg-surface-container border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md"
              >
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedLocation(result);
                      setSearchResults([]);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-white/5 border-b border-outline-variant/5 last:border-0 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 mt-1 text-on-surface-variant group-hover:text-primary transition-colors" />
                      <span className="text-body-sm text-on-surface-variant group-hover:text-white line-clamp-2">
                        {result.display_name}
                      </span>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {error && <p className="text-label-xs text-error mt-1">{error}</p>}
        </div>

        {/* Result & Math Breakdown */}
        <AnimatePresence>
          {shippingResult && selectedLocation && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-4 rounded-xl border ${shippingResult.isFree ? 'bg-primary/10 border-primary/20' : 'bg-surface-high border-outline-variant/10'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-label-sm text-on-surface-variant">Estimasi Ongkos Kirim</div>
                  <div className={`font-display text-headline-sm font-bold mt-0.5 ${shippingResult.isFree ? 'text-primary' : 'text-white'}`}>
                    {shippingResult.isFree ? 'Gratis Ongkir' : formatCurrency(shippingResult.cost)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">Jarak Akurat</div>
                  <div className="font-bold text-body-sm text-on-surface">{shippingResult.distance.toFixed(2)} km</div>
                </div>
              </div>

              {/* Transparent Calculation Breakdown */}
              {!shippingResult.isFree && (
                <div className="space-y-3 mb-4">
                  {/* Shipping Breakdown - Transparency Focus */}
                  <div className="bg-surface-high rounded-xl p-4 space-y-3 border border-outline-variant/20 shadow-inner">
                    <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-wider mb-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Rincian Biaya Logistik Profesional
                    </div>
                    
                    <div className="bg-primary/10 rounded-lg p-2.5 flex justify-between items-center border border-primary/20 mb-1">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Tarif Standar Pickup</span>
                      <span className="text-body-xs font-bold text-white">{formatCurrency(RATE_PER_KM)} / km</span>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center group">
                        <div className="flex flex-col">
                          <span className="text-body-xs text-on-surface flex items-center gap-1.5">
                            Konsumsi BBM ({shippingResult.fuelUsedLiters?.toFixed(1)} L)
                            <span className="group-hover:opacity-100 opacity-0 transition-opacity"><Info className="w-3 h-3 text-on-surface-variant/50" /></span>
                          </span>
                          <span className="text-[9px] text-on-surface-variant/60">Estimasi unit Pickup untuk { (shippingResult.distance * 2).toFixed(1) }km PP</span>
                        </div>
                        <span className="text-body-xs text-white font-medium">{formatCurrency(shippingResult.fuelCost || 0)}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-body-xs text-on-surface">Perawatan Unit Pickup</span>
                          <span className="text-[9px] text-on-surface-variant/60">Biaya ban, oli, & perawatan mobil angkut</span>
                        </div>
                        <span className="text-body-xs text-white font-medium">{formatCurrency(shippingResult.maintenanceCost || 0)}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-body-xs text-on-surface">Jasa Driver & Bongkar Muat</span>
                          <span className="text-[9px] text-on-surface-variant/60">Layanan pengantaran hingga ke dalam rumah</span>
                        </div>
                        <span className="text-body-xs text-white font-medium">{formatCurrency(shippingResult.serviceFee || 0)}</span>
                      </div>

                      <div className="h-px bg-outline-variant/20 my-1" />
                      
                      <div className="flex justify-between items-end pt-1">
                        <span className="text-title-xs font-bold text-primary">Total Ongkos Kirim</span>
                        <div className="text-right">
                           <div className="text-title-sm font-bold text-primary leading-none mb-1">{formatCurrency(shippingResult.cost)}</div>
                           <div className="text-[9px] text-on-surface-variant/50 font-medium">{shippingResult.distance.toFixed(1)} km x {formatCurrency(RATE_PER_KM)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fuel Comparison (Personal) */}
                  <div className="bg-yellow-500/5 rounded-lg p-3 border border-yellow-500/10">
                    <div className="flex items-center gap-2 text-yellow-500 font-bold text-[10px] uppercase tracking-wider mb-2">
                      <Zap className="w-3 h-3" /> Jika Anda Ambil Sendiri (Mobil)
                    </div>
                    <div className="space-y-2 text-label-xs">
                      <div className="flex justify-between text-on-surface-variant">
                        <span>Biaya Bensin (Estimasi PP)</span>
                        <span className="text-white">± {formatCurrency(shippingResult.fuelCost || 0)}</span>
                      </div>
                      <div className="flex flex-col gap-1 px-2 border-l-2 border-yellow-500/20 py-1">
                        <div className="flex items-center gap-1.5 text-[9px] text-on-surface-variant/80">
                          <span className="w-1 h-1 rounded-full bg-yellow-500/50" />
                          Risiko barang rusak/lecet di jalan
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-on-surface-variant/80">
                          <span className="w-1 h-1 rounded-full bg-yellow-500/50" />
                          Tenaga bongkar muat mandiri (Berat)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {shippingResult.isFree && (
                <p className="text-label-xs text-primary/80 mb-4 italic">
                  Berhasil! Lokasi berada dalam radius gratis ongkir ({"<"} {FREE_SHIPPING_RADIUS_KM}km).
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowMap(!showMap)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary/30 text-primary font-display text-title-xs font-bold hover:bg-primary/5 transition-all"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {showMap ? 'Sembunyikan Peta' : 'Lihat Rute di Peta'}
                </button>

                {showMap && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 300 }}
                    className="w-full rounded-xl overflow-hidden border border-outline-variant/20"
                  >
                    <RouteMap 
                      origin={ORIGIN_COORDS} 
                      destination={{ 
                        latitude: parseFloat(selectedLocation.lat), 
                        longitude: parseFloat(selectedLocation.lon) 
                      }} 
                    />
                  </motion.div>
                )}

                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-primary text-surface font-display text-title-xs font-bold hover:shadow-neon-cyan transition-all"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Cek Rute Lengkap (Google Maps)
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!selectedLocation && !isSearching && (
          <div className="text-center py-4 px-2 border-2 border-dashed border-outline-variant/20 rounded-xl">
            <p className="text-label-xs text-on-surface-variant">
              Masukkan alamat atau nama daerah untuk mendapatkan perhitungan jarak transparan dan akurat.
            </p>
          </div>
        )}

        {/* Transparency note */}
        <div className="text-[10px] leading-tight text-on-surface-variant/50 flex items-start gap-1.5 pt-1">
          <span className="text-primary/50">ⓘ</span>
          <span>
            Transparansi Harga: Biaya dihitung otomatis berdasarkan koordinat GPS yang Anda cari. 
            Mendukung akurasi titik maps hingga ke tingkat jalan/perumahan.
          </span>
        </div>
      </div>
    </div>
  );
};

