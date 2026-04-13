import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./css/MapPage.css";
import { flushSync } from "react-dom";

/* ─── ICONS ─── */
const faMarker = (iconClass, color) =>
  L.divIcon({
    html: `<div class="animated-marker" style="background:${color};width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);position:relative">
      <i class="${iconClass}" style="color:white;font-size:16px;position:absolute;top:8px;left:9px;transform:rotate(45deg)"></i>
    </div>`,
    iconSize: [36, 36], iconAnchor: [18, 36], className: "",
  });

const ICONS = {
  center:         faMarker("fa-solid fa-location-dot", "#facc15"),
  hospital:       faMarker("fa-solid fa-hospital",     "#dc2626"),
  clinic:         faMarker("fa-solid fa-user-doctor",  "#cf16cfff"),
  pharmacy:       faMarker("fa-solid fa-square-plus",  "var(--color-g)"),
  pharmacyNoData: faMarker("fa-solid fa-square-plus",  "#9ca3af"),
};

const CATEGORY_OPTIONS = [
  { key: "hospital", label: "Hospitals", icon: "fa-hospital"    },
  { key: "clinic",   label: "Clinics",   icon: "fa-user-doctor" },
  { key: "pharmacy", label: "Pharmacy",  icon: "fa-square-plus" },
];

const FETCH_RADIUS         = 2500;
const DEFAULT_RADIUS       = 2500;
const CLUSTER_DISABLE_ZOOM = 16;
const FALLBACK_LAT         = 19.076;
const FALLBACK_LON         = 72.877;

// Overpass mirrors — tried in order, first to respond wins
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/* ─── Overpass helper: race mirrors with a timeout ─── */
async function fetchOverpass(query, signal, timeoutMs = 8000) {
  const controller = new AbortController();
  // Tie our abort signal into the internal one
  signal?.addEventListener("abort", () => controller.abort());
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Race all mirrors — first successful response wins
    const result = await Promise.any(
      OVERPASS_MIRRORS.map((url) =>
        axios.post(url, new URLSearchParams({ data: query }), { signal: controller.signal })
          .then((res) => {
            if (!res.data?.elements) throw new Error("empty");
            return res.data.elements;
          })
      )
    );
    return result;
  } catch {
    return []; // all mirrors failed or timed out — return empty gracefully
  } finally {
    clearTimeout(timer);
  }
}

/* ─── SIDEBAR STYLES ─── */
const SB = {
  wrap: {
    height: "100vh", width: "100vw", display: "flex",
    overflow: "hidden", position: "relative",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  sidebar: {
    width: "300px", minWidth: "300px", height: "100vh",
    background: "#0f172a", display: "flex", flexDirection: "column",
    zIndex: 1000, boxShadow: "4px 0 24px rgba(0,0,0,0.35)", overflow: "hidden",
  },
  header:      { padding: "16px 16px 12px", borderBottom: "1px solid #1e293b", flexShrink: 0 },
  categoryRow: { display: "flex", gap: "6px", padding: "10px 12px", borderBottom: "1px solid #1e293b", flexShrink: 0 },
  catBtn: (active, key) => ({
    flex: 1, padding: "6px 4px", border: "none", borderRadius: "8px", cursor: "pointer",
    fontSize: "11px", fontWeight: 600, transition: "background 0.15s, color 0.15s",
    background: active ? (key === "hospital" ? "#dc2626" : key === "clinic" ? "#cf16cfff" : "var(--color-g)") : "#1e293b",
    color: active ? "white" : "#94a3b8",
  }),
  radiusRow: { padding: "10px 14px", borderBottom: "1px solid #1e293b", flexShrink: 0 },
  poiList:   { flex: 1, overflowY: "auto", padding: "8px 0" },
  poiItem:   {
    padding: "10px 14px", display: "flex", gap: "10px", alignItems: "flex-start",
    cursor: "pointer", borderBottom: "1px solid #1e293b", transition: "background 0.12s",
  },
  footer: {
    padding: "12px", borderTop: "1px solid #1e293b",
    flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px",
  },
};

/* ─── popup builder ─── */
const buildPopup = (p, category, isMedicineMode) => {
  const isReg = p.source === "registered";
  if (category === "pharmacy" && isReg && isMedicineMode) {
    return `<div style="min-width:190px;font-size:13px">
      <b style="color:var(--color-g)">${p.tags.name}</b><br/>
      <span style="color:#6b7280">${p.tags.address || ""}</span><br/>
      ${p.tags.phone ? `📞 ${p.tags.phone}<br/>` : ""}
      <span style="color:#6b7280">📍 ${p.tags.distance}m away</span>
      <hr style="margin:6px 0"/>
      <b>✅ In stock:</b><br/>
      ${p.tags.matchedItems.map(i => `<span>• ${i.medicineName} — qty: ${i.quantity}${i.price ? ` @ ₹${i.price}` : ""}</span>`).join("<br/>")}
    </div>`;
  }
  if (category === "pharmacy" && !isReg && isMedicineMode) {
    return `<div style="font-size:13px"><b style="color:#374151">${p.tags.name}</b><br/><span style="color:#9ca3af">⚠️ Not on MediFind — availability unknown</span></div>`;
  }
  const addr    = p.tags?.["addr:full"] || p.tags?.["addr:street"] || p.tags?.address || "";
  const phone   = p.tags?.phone || p.tags?.["contact:phone"] || "";
  const website = p.tags?.website || p.tags?.["contact:website"] || "";
  const opening = p.tags?.opening_hours || "";
  return `<div style="font-size:13px;min-width:160px">
    <b style="color:#111827">${p.tags?.name || "Unnamed"}</b><br/>
    <span style="color:#6b7280;text-transform:capitalize;font-size:11px">${category}</span>
    ${addr    ? `<br/><span style="color:#6b7280;font-size:11px">📍 ${addr}</span>`                             : ""}
    ${phone   ? `<br/><span style="font-size:11px">📞 ${phone}</span>`                                          : ""}
    ${opening ? `<br/><span style="color:#6b7280;font-size:11px">🕐 ${opening}</span>`                          : ""}
    ${website ? `<br/><a href="${website}" target="_blank" style="font-size:11px;color:#2563eb">🌐 Website</a>` : ""}
  </div>`;
};

/* ════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════ */
export default function MapPage() {
  const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
  const BASE_URL = RAW_BASE.replace(/\/+$/, "");
  const navigate = useNavigate();

  const [params, setSearchParams]          = useSearchParams();
  const [previewCoords, setPreviewCoords]  = useState(null);
  const [searchCoords,  setSearchCoords]   = useState(null);
  const [radius,        setRadius]         = useState(DEFAULT_RADIUS);
  const [currentAddress,setCurrentAddress] = useState(null);
  const [allPOIs,       setAllPOIs]        = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(params.get("category") || "hospital");
  const [areaDirty,     setAreaDirty]      = useState(false);
  const [showHint,      setShowHint]       = useState(false);
  const [loadingPOIs,   setLoadingPOIs]    = useState(false);
  const [coordsReady,   setCoordsReady]    = useState(false);
  const [mapReady,      setMapReady]       = useState(false);
  const [travelMode,    setTravelMode]     = useState("foot");
  const [showRefine,    setShowRefine]     = useState(false);
  const [refineMode,    setRefineMode]     = useState("medicine");
  const [refineMedicine,setRefineMedicine] = useState("");
  const [refineCategory,setRefineCategory] = useState("hospital");
  const [medicineSuggestions,    setMedicineSuggestions]    = useState([]);
  const [loadingSuggestions,     setLoadingSuggestions]     = useState(false);
  const [refinePlace,            setRefinePlace]            = useState("");
  const [refinePlaceSuggestions, setRefinePlaceSuggestions] = useState([]);
  const [showRefinePlaceSugg,    setShowRefinePlaceSugg]    = useState(false);
  const [loadingRefinePlaceSugg, setLoadingRefinePlaceSugg] = useState(false);
  const [refineResolvedCoords,   setRefineResolvedCoords]   = useState(null);

  const mapRef          = useRef(null);
  const centerMarkerRef = useRef(null);
  const circleRef       = useRef(null);
  const clustersRef     = useRef({ hospital: null, clinic: null, pharmacy: null });
  const markerCache     = useRef(new Map());
  const routeRef        = useRef(null);
  const abortRef        = useRef(null);
  const pendingCategoryRef = useRef(null);
  const refineDebounce      = useRef(null);
  const refinePlaceDebounce = useRef(null);

  const latParam      = params.get("lat");
  const lonParam      = params.get("lon");
  const placeParam    = params.get("place");
  const modeParam     = params.get("mode");
  const medicineParam = params.get("medicine");
  const isMedicineMode = modeParam === "medicine" && !!medicineParam;

  /* ── Initial geo ── */
  useEffect(() => {
    if (latParam && lonParam) {
      const lat = parseFloat(latParam), lon = parseFloat(lonParam);
      if (!isNaN(lat) && !isNaN(lon)) {
        setPreviewCoords({ lat, lon }); setSearchCoords({ lat, lon }); setCoordsReady(true); return;
      }
    }
    if (placeParam) {
      // Show map immediately at fallback, fly to real coords when geocode resolves
      setPreviewCoords({ lat: FALLBACK_LAT, lon: FALLBACK_LON });
      setCoordsReady(true);
      axios.get("https://nominatim.openstreetmap.org/search", {
        params: { q: placeParam, format: "json", limit: 1 },
      }).then((res) => {
        if (!res.data?.[0]) return;
        const coords = { lat: parseFloat(res.data[0].lat), lon: parseFloat(res.data[0].lon) };
        setPreviewCoords(coords); setSearchCoords(coords);
        if (mapRef.current) mapRef.current.flyTo([coords.lat, coords.lon], 13, { duration: 0.8 });
      });
      return;
    }
    if (!latParam && !lonParam && !placeParam) setSearchParams({ place: "Mumbai", category: "hospital" });
  }, [latParam, lonParam, placeParam]);

  /* ── Map init ── */
  useEffect(() => {
    if (!coordsReady || !previewCoords || isNaN(previewCoords.lat) || isNaN(previewCoords.lon)) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null; centerMarkerRef.current = null; circleRef.current = null;
      clustersRef.current = { hospital: null, clinic: null, pharmacy: null };
    }
    setMapReady(false);

    const map = L.map("map", { preferCanvas: true, zoomAnimation: true, fadeAnimation: true })
      .setView([previewCoords.lat, previewCoords.lon], 13);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap", keepBuffer: 4,
      updateWhenIdle: false, updateWhenZooming: false,
    }).addTo(map);

    const clusterOpts = {
      disableClusteringAtZoom: CLUSTER_DISABLE_ZOOM, chunkedLoading: true,
      chunkInterval: 50, chunkDelay: 50, maxClusterRadius: 60,
      spiderfyOnMaxZoom: true, showCoverageOnHover: false,
    };
    clustersRef.current = {
      hospital: L.markerClusterGroup(clusterOpts),
      clinic:   L.markerClusterGroup(clusterOpts),
      pharmacy: L.markerClusterGroup(clusterOpts),
    };
    // Only add the active category layer
    map.addLayer(clustersRef.current[selectedCategory] || clustersRef.current.hospital);
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null; centerMarkerRef.current = null; circleRef.current = null;
      clustersRef.current = { hospital: null, clinic: null, pharmacy: null };
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordsReady, searchCoords]);

  /* ── Preview marker + circle ── */
  useEffect(() => {
    if (!mapRef.current || !previewCoords || isNaN(previewCoords.lat) || isNaN(previewCoords.lon)) return;
    if (!centerMarkerRef.current) {
      centerMarkerRef.current = L.marker([previewCoords.lat, previewCoords.lon], { draggable: true, icon: ICONS.center }).addTo(mapRef.current);
      centerMarkerRef.current.on("dragend", (e) => {
        const { lat, lng } = e.target.getLatLng();
        setPreviewCoords({ lat, lon: lng }); setAreaDirty(true); setShowHint(true);
        if (routeRef.current) { mapRef.current.removeLayer(routeRef.current); routeRef.current = null; }
      });
    } else {
      centerMarkerRef.current.setLatLng([previewCoords.lat, previewCoords.lon]);
    }
    if (!circleRef.current) {
      circleRef.current = L.circle([previewCoords.lat, previewCoords.lon], { radius, color: "#2563eb", fillOpacity: 0.15 }).addTo(mapRef.current);
    } else {
      circleRef.current.setLatLng([previewCoords.lat, previewCoords.lon]);
    }
  }, [previewCoords, coordsReady]);

  useEffect(() => { if (circleRef.current) circleRef.current.setRadius(radius); }, [radius]);

  const handleSearchThisArea = () => {
    setSearchCoords(previewCoords); setAreaDirty(false); setShowHint(false);
    const np = { lat: previewCoords.lat.toFixed(6), lon: previewCoords.lon.toFixed(6), category: selectedCategory };
    if (isMedicineMode) { np.mode = "medicine"; np.medicine = medicineParam; }
    setSearchParams(np);
  };
  const handleGoBack = () => { setPreviewCoords(searchCoords); setAreaDirty(false); setShowHint(false); };

  /* ── Reverse geo ── */
  useEffect(() => {
    if (!searchCoords) return;
    setCurrentAddress(null);
    axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: { lat: searchCoords.lat, lon: searchCoords.lon, format: "json" },
    }).then((res) => setCurrentAddress(res.data?.display_name || null));
  }, [searchCoords]);

  /* ── POI fetch ── */
  useEffect(() => {
    if (!searchCoords || !coordsReady) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadingPOIs(true);
    // NOTE: intentionally NOT clearing allPOIs here — stale markers are hidden
    // by the loading overlay and clearing early breaks the cluster swap logic.

    if (isMedicineMode) {
      const osmQuery = `[out:json][timeout:12];node["amenity"="pharmacy"](around:${FETCH_RADIUS},${searchCoords.lat},${searchCoords.lon});out;`;

      // Fire both requests simultaneously — don't wait for one before starting the other
      const regPromise = axios.get(`${BASE_URL}/api/public/pharmacies/search`, {
        params: { lat: searchCoords.lat, lon: searchCoords.lon, radius: FETCH_RADIUS, medicine: medicineParam },
        signal: controller.signal,
      }).then((r) => r.data || []).catch((err) => {
        if (axios.isCancel(err) || err.name === "CanceledError") throw err; // re-throw aborts
        return []; // backend error → treat as zero registered results, OSM still shows
      });

      const osmPromise = fetchOverpass(osmQuery, controller.signal, 10000);

      // ── Wave 1: show registered pharmacies the moment backend responds ──
      regPromise.then((regData) => {
        if (controller.signal.aborted) return;
        const registeredPOIs = regData.map((p) => ({
          id: `reg_${p._id}`, lat: p.location.coordinates[1], lon: p.location.coordinates[0],
          source: "registered",
          tags: { amenity: "pharmacy", name: p.name, address: p.address, phone: p.phone,
                  distance: Math.round(p.distance), matchedItems: p.matchedItems || [] },
        }));
        // Show whatever we have (even empty) — clears previous area's pins
        setAllPOIs(registeredPOIs);
        // Keep spinner on — OSM still loading, grey pins not shown yet
      }).catch(() => {});

      // ── Wave 2: once BOTH resolve, do final authoritative merge ──
      Promise.all([regPromise, osmPromise]).then(([regData, osmElements]) => {
        if (controller.signal.aborted) return;

        const registeredPOIs = regData.map((p) => ({
          id: `reg_${p._id}`, lat: p.location.coordinates[1], lon: p.location.coordinates[0],
          source: "registered",
          tags: {
            amenity: "pharmacy", name: p.name, address: p.address, phone: p.phone,
            distance: Math.round(p.distance), matchedItems: p.matchedItems || [],
          },
        }));

        const regCoords = registeredPOIs.map((r) => ({ lat: r.lat, lon: r.lon }));
        const osmPOIs = osmElements
          .filter((o) => !regCoords.some((r) =>
            Math.hypot((r.lat - o.lat) * 111320, (r.lon - o.lon) * 111320 * Math.cos(r.lat * Math.PI / 180)) < 50
          ))
          .map((o) => ({
            id: `osm_${o.id}`, lat: o.lat, lon: o.lon, source: "osm",
            tags: {
              amenity: "pharmacy",
              name: o.tags?.name || "Pharmacy",
              address: o.tags?.["addr:full"]
                || [
                    o.tags?.["addr:housenumber"],
                    o.tags?.["addr:street"],
                    o.tags?.["addr:suburb"],
                    o.tags?.["addr:city"],
                  ].filter(Boolean).join(", ")
                || o.tags?.["addr:street"]
                || null,
              phone: o.tags?.phone || o.tags?.["contact:phone"] || "",
            },
          }));

        pendingCategoryRef.current = "pharmacy";
          flushSync(() => {
            setAllPOIs([...registeredPOIs, ...osmPOIs]);
            setSelectedCategory("pharmacy");
          });
          pendingCategoryRef.current = null;
      }).catch((err) => {
        if (axios.isCancel(err) || err.name === "CanceledError") return;
      }).finally(() => {
        if (!controller.signal.aborted) setLoadingPOIs(false);
      });

      return;
    }

    // ── Category mode: Overpass for all three amenities ──────────────────
    const osmQuery = `[out:json][timeout:12];(
      node["amenity"="hospital"](around:${FETCH_RADIUS},${searchCoords.lat},${searchCoords.lon});
      node["amenity"="clinic"](around:${FETCH_RADIUS},${searchCoords.lat},${searchCoords.lon});
      node["amenity"="pharmacy"](around:${FETCH_RADIUS},${searchCoords.lat},${searchCoords.lon});
    );out;`;

    fetchOverpass(osmQuery, controller.signal, 10000).then((elements) => {
      if (controller.signal.aborted) return;
      setAllPOIs(elements.map((el) => ({ ...el, source: "osm" })));
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingPOIs(false);
    });

  }, [searchCoords, coordsReady, isMedicineMode, medicineParam]);

  /* ── swapClusterLayer: remove all, add only the active one ── */
  const swapClusterLayer = useCallback((cat) => {
    if (!mapRef.current || !clustersRef.current[cat]) return;
    const map = mapRef.current;
    Object.values(clustersRef.current).forEach((c) => { if (map.hasLayer(c)) map.removeLayer(c); });
    map.addLayer(clustersRef.current[cat]);
  }, []);

  /* ── Render ALL cluster groups when POIs change, then swap to active ── */
  const renderAllMarkers = useCallback((pois, medMode, activeCat) => {
    const clusters = clustersRef.current;
    if (!clusters.hospital) return;

    Object.values(clusters).forEach((c) => c.clearLayers());
    markerCache.current.clear();

    pois.forEach((p) => {
      const cat = p.tags?.amenity;
      if (!clusters[cat] || isNaN(p.lat) || isNaN(p.lon)) return;

      const isRegistered = p.source === "registered";
      const useGreyIcon  = !isRegistered && medMode && cat === "pharmacy";
      const icon         = useGreyIcon ? ICONS.pharmacyNoData : (ICONS[cat] || ICONS.pharmacy);
      const marker       = L.marker([p.lat, p.lon], { icon })
        .bindPopup(buildPopup(p, cat, medMode), { maxWidth: 260 });

      markerCache.current.set(p.id || `${p.lat}_${p.lon}`, { marker, category: cat });
      clusters[cat].addLayer(marker);
    });

    // Always re-swap after rebuilding so the active cluster is guaranteed on the map
    swapClusterLayer(activeCat);
  }, [swapClusterLayer]);

  useEffect(() => {
    if (!mapReady || areaDirty || !searchCoords || allPOIs.length === 0) return;
    const cat = pendingCategoryRef.current || selectedCategory;
    renderAllMarkers(allPOIs, isMedicineMode, cat);
  }, [allPOIs, mapReady, areaDirty, isMedicineMode, renderAllMarkers]);

  /* ── Category tab switch: swap layer (markers already built) ── */
  useEffect(() => {
    if (!mapReady) return;
    swapClusterLayer(selectedCategory);
  }, [selectedCategory, mapReady, swapClusterLayer]);

  /* ── Radius filter ── */
  useEffect(() => {
    if (!searchCoords || markerCache.current.size === 0) return;
    const center = L.latLng(searchCoords.lat, searchCoords.lon);
    markerCache.current.forEach(({ marker, category }) => {
      const cluster = clustersRef.current[category];
      if (!cluster) return;
      const inRadius  = center.distanceTo(marker.getLatLng()) <= radius;
      const inCluster = cluster.hasLayer(marker);
      if (inRadius && !inCluster) cluster.addLayer(marker);
      else if (!inRadius && inCluster) cluster.removeLayer(marker);
    });
  }, [radius, searchCoords]);

  /* ── Category counts ── */
  const categoryCounts = useMemo(() => {
    const counts = { hospital: 0, clinic: 0, pharmacy: 0 };
    allPOIs.forEach((p) => { if (counts[p.tags?.amenity] !== undefined) counts[p.tags.amenity]++; });
    return counts;
  }, [allPOIs]);

  /* ── Sorted visible POIs ── */
  const sortedVisiblePOIs = useMemo(() => {
    if (!searchCoords) return [];
    return allPOIs
      .filter((p) => p.tags?.amenity === selectedCategory && !isNaN(p.lat) && !isNaN(p.lon))
      .map((p) => {
        const distM = p.tags?.distance != null
          ? p.tags.distance
          : Math.round(Math.hypot(
              (searchCoords.lat - p.lat) * 111320,
              (searchCoords.lon - p.lon) * 111320 * Math.cos(searchCoords.lat * Math.PI / 180)
            ));
        return { ...p, distM };
      })
      .filter((p) => p.distM <= radius)
      .sort((a, b) => a.distM - b.distM);
  }, [allPOIs, selectedCategory, searchCoords, radius]);

  /* ── Route ── */
  const handleShowRoute = useCallback(async () => {
    if (!previewCoords || !sortedVisiblePOIs.length) return;
    if (routeRef.current) { mapRef.current.removeLayer(routeRef.current); routeRef.current = null; }

    const nextMode = travelMode === "foot" ? "driving" : "foot";
    setTravelMode(nextMode);
    const mode = travelMode;

    const results = (await Promise.all(
      sortedVisiblePOIs.slice(0, 5).map((poi) =>
        axios.get(
          `https://router.project-osrm.org/route/v1/${mode}/${previewCoords.lon},${previewCoords.lat};${poi.lon},${poi.lat}?overview=full&geometries=geojson`,
          { timeout: 8000 }
        ).then((res) => ({ poi, route: res.data.routes[0], distanceM: res.data.routes[0].distance, durationS: res.data.routes[0].duration }))
         .catch(() => null)
      )
    )).filter(Boolean);

    if (!results.length) { alert("Unable to calculate route."); return; }
    results.sort((a, b) => a.durationS - b.durationS);
    const best   = results[0];
    const coords = best.route.geometry.coordinates.map((c) => [c[1], c[0]]);

    routeRef.current = L.polyline(coords, {
      color: mode === "foot" ? "#cf16cfff" : "#2563eb", weight: 4, opacity: 0.9,
      dashArray: mode === "foot" ? "6,4" : null,
    }).addTo(mapRef.current);

    const mid = coords[Math.floor(coords.length / 2)];
    L.popup({ closeButton: false, className: "route-popup" })
      .setLatLng(mid)
      .setContent(`<div style="font-size:13px;font-weight:600;text-align:center">
        ${mode === "foot" ? "🚶" : "🚗"} <b>${best.poi.tags?.name || "Destination"}</b><br/>
        <span style="color:#6b7280">${(best.distanceM / 1000).toFixed(1)} km · ~${Math.ceil(best.durationS / 60)} min</span>
      </div>`)
      .openOn(mapRef.current);

    mapRef.current.fitBounds(routeRef.current.getBounds(), { padding: [60, 60] });
  }, [previewCoords, sortedVisiblePOIs, travelMode]);

  const handleCategoryChange = useCallback((key) => {
    setSelectedCategory(key);
    if (routeRef.current) { mapRef.current?.removeLayer(routeRef.current); routeRef.current = null; }
  }, []);

  const flyToMarker = useCallback((poi) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([poi.lat, poi.lon], 16, { duration: 0.6 });
    const cached = markerCache.current.get(poi.id || `${poi.lat}_${poi.lon}`);
    if (cached?.marker) setTimeout(() => cached.marker.openPopup(), 700);
  }, []);

  /* ── Refine handlers ── */
  const handleRefineMedicineChange = (e) => {
    const val = e.target.value;
    setRefineMedicine(val);
    if (refineDebounce.current) clearTimeout(refineDebounce.current);
    if (val.trim().length < 2) { setMedicineSuggestions([]); return; }
    setLoadingSuggestions(true);
    refineDebounce.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/medicinesearch/medicines`, { params: { q: val } });
        setMedicineSuggestions(res.data.map((m) => m.name || m));
      } catch { setMedicineSuggestions([]); }
      finally { setLoadingSuggestions(false); }
    }, 300);
  };

  const handleRefinePlaceChange = (e) => {
    const val = e.target.value;
    setRefinePlace(val); setRefineResolvedCoords(null);
    if (refinePlaceDebounce.current) clearTimeout(refinePlaceDebounce.current);
    if (val.trim().length < 2) { setRefinePlaceSuggestions([]); setShowRefinePlaceSugg(false); return; }
    setShowRefinePlaceSugg(true); setLoadingRefinePlaceSugg(true);
    refinePlaceDebounce.current = setTimeout(async () => {
      try {
        const res = await axios.get("https://nominatim.openstreetmap.org/search", {
          params: { q: val, format: "json", limit: 5, countrycodes: "in" },
        });
        setRefinePlaceSuggestions(res.data);
      } catch { setRefinePlaceSuggestions([]); }
      finally { setLoadingRefinePlaceSugg(false); }
    }, 400);
  };

  const handleRefinePlaceSelect = (s) => {
    setRefinePlace(s.display_name);
    setRefineResolvedCoords({ lat: parseFloat(s.lat), lon: parseFloat(s.lon) });
    setRefinePlaceSuggestions([]); setShowRefinePlaceSugg(false);
  };

  const handleRefineUseMyLocation = () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      setRefineResolvedCoords({ lat, lon });
      try {
        const res = await axios.get("https://nominatim.openstreetmap.org/reverse", { params: { lat, lon, format: "json" } });
        setRefinePlace(res.data?.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      } catch { setRefinePlace(`${lat.toFixed(4)}, ${lon.toFixed(4)}`); }
    }, () => alert("Unable to get location"));
  };

  const handleRefineSubmit = () => {
    const coords = refineResolvedCoords || searchCoords;
    if (!coords) return alert("Location not available");
    const base = `lat=${coords.lat.toFixed(6)}&lon=${coords.lon.toFixed(6)}`;
    if (refineMode === "medicine") {
      if (!refineMedicine.trim()) return alert("Enter a medicine name");
      navigate(`/mappage?mode=medicine&medicine=${encodeURIComponent(refineMedicine.trim())}&${base}`);
    } else {
      navigate(`/mappage?category=${refineCategory}&${base}`);
    }
    setShowRefine(false);
  };

  /* ── Loading screen ── */
  if (!coordsReady) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", border: "4px solid #1e293b", borderTopColor: "var(--color-g)", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>Locating on map…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ════════════════════════ RENDER ════════════════════════ */
  return (
    <div style={SB.wrap}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ═══════ SIDEBAR ═══════ */}
      <div style={SB.sidebar}>
        <div style={SB.header}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <Link to="/" style={{ color: "#94a3b8", fontSize: "12px", textDecoration: "none" }}>← Home</Link>
          </div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "white", textTransform: "capitalize", lineHeight: 1.2 }}>
            {isMedicineMode
              ? `💊 ${medicineParam}`
              : `${selectedCategory === "hospital" ? "🏥" : selectedCategory === "clinic" ? "🩺" : "💊"} ${selectedCategory}s`}
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            📍 {currentAddress || "Locating…"}
          </div>
        </div>

        <div style={SB.categoryRow}>
          {CATEGORY_OPTIONS.map((opt) => (
            <button key={opt.key} disabled={areaDirty} onClick={() => handleCategoryChange(opt.key)} style={SB.catBtn(selectedCategory === opt.key, opt.key)}>
              <i className={`fa-solid ${opt.icon}`} style={{ display: "block", fontSize: "14px", marginBottom: "2px" }} />
              {opt.label.slice(0, -1)}<br />
              <span style={{ fontSize: "10px", opacity: 0.8 }}>({categoryCounts[opt.key]})</span>
            </button>
          ))}
        </div>

        <div style={SB.radiusRow}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
            <span>Search radius</span>
            <span style={{ color: "white", fontWeight: 600 }}>{(radius / 1000).toFixed(1)} km</span>
          </div>
          <input type="range" min="500" max="2500" step="250" value={radius}
            onChange={(e) => setRadius(+e.target.value)}
            style={{ width: "100%", accentColor: "var(--color-g)" }}
          />
        </div>

        {isMedicineMode && (
          <div style={{ padding: "8px 14px", borderBottom: "1px solid #1e293b", display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11px", color: "#c4b5fd" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-g)", flexShrink: 0, display: "inline-block" }} />
              Has {medicineParam} in stock
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11px", color: "#64748b" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#475569", flexShrink: 0, display: "inline-block" }} />
              Availability unknown
            </div>
          </div>
        )}

        <div style={SB.poiList}>
          {sortedVisiblePOIs.length === 0 && !loadingPOIs && (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "#475569", fontSize: "13px" }}>
              No {selectedCategory}s within {(radius / 1000).toFixed(1)} km
            </div>
          )}
          {sortedVisiblePOIs.map((poi, i) => {
            const isReg      = poi.source === "registered";
            const distLabel  = poi.distM >= 1000 ? `${(poi.distM / 1000).toFixed(1)} km` : `${poi.distM} m`;
            const useGreyDot = !isReg && isMedicineMode && selectedCategory === "pharmacy";
            const dotColor   = useGreyDot ? "#475569"
              : selectedCategory === "hospital" ? "#dc2626"
              : selectedCategory === "clinic"   ? "#cf16cfff"
              : "var(--color-g)";
            return (
              <div key={poi.id || i} onClick={() => flyToMarker(poi)} style={SB.poiItem}
                onMouseEnter={(e) => e.currentTarget.style.background = "#1e293b"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: dotColor, marginTop: "5px", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: "white", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {poi.tags?.name || "Unnamed"}
                  </div>
                  <a href={`https://www.google.com/maps?q=${poi.lat},${poi.lon}`}
                    target="_blank" rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: "#475569", fontSize: "11px", marginTop: "1px",
                      display: "block", textDecoration: "none" }}>
                    📍 {poi.lat.toFixed(5)}, {poi.lon.toFixed(5)}
                  </a>
                </div>
                <span style={{ flexShrink: 0, fontSize: "11px", fontWeight: 700, color: (isReg || !isMedicineMode) ? "#a78bfa" : "#475569", marginTop: "3px" }}>
                  {distLabel}
                </span>
              </div>
            );
          })}
        </div>

        <div style={SB.footer}>
          {sortedVisiblePOIs.length > 0 && !areaDirty && (
            <button onClick={handleShowRoute} style={{
              width: "100%", padding: "10px", border: "none", borderRadius: "10px", cursor: "pointer",
              background: travelMode === "foot" ? "#16cf44ff" : "#2563eb",
              color: "white", fontSize: "13px", fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}>
              {travelMode === "foot" ? "🚶 Walk to nearest" : "🚗 Drive to nearest"} {selectedCategory}
              <span style={{ opacity: 0.6, fontSize: "11px" }}>({travelMode === "foot" ? "→ drive" : "→ walk"})</span>
            </button>
          )}
          <button onClick={() => setShowRefine(true)} style={{
            width: "100%", padding: "10px", border: "1px solid #334155", borderRadius: "10px",
            background: "transparent", color: "#94a3b8", fontSize: "13px", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          }}>
            🔍 Refine Search
          </button>
        </div>
      </div>

      {/* ═══════ MAP ═══════ */}
      <div style={{ flex: 1, position: "relative" }}>
        {loadingPOIs && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 500,
            backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
            background: "rgba(15,23,42,0.45)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", pointerEvents: "all",
          }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", border: "4px solid rgba(124,58,237,0.25)", borderTopColor: "var(--color-g)", animation: "spin 0.7s linear infinite" }} />
            <div style={{ background: "rgba(15,23,42,0.85)", borderRadius: "10px", padding: "8px 18px", color: "white", fontSize: "14px", fontWeight: 600 }}>
              {isMedicineMode ? `Finding ${medicineParam}…` : `Loading ${selectedCategory}s…`}
            </div>
          </div>
        )}
        <div id="map" style={{ height: "100%", width: "100%" }} />
        {showHint && (
          <div className="Mappage_overlay">
            <button onClick={handleSearchThisArea}>Search this area</button>
            <button onClick={handleGoBack}>Go back</button>
          </div>
        )}
      </div>

      {/* ═══════ REFINE MODAL ═══════ */}
      {showRefine && (
        <>
          <div onClick={() => setShowRefine(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, backdropFilter: "blur(2px)" }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: "min(420px, 90vw)", background: "white", borderRadius: "16px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)", zIndex: 2001, padding: "24px",
            display: "flex", flexDirection: "column", gap: "14px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Refine Search</h3>
              <button onClick={() => setShowRefine(false)} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: "8px", background: "#f3f4f6", borderRadius: "10px", padding: "4px" }}>
              {["medicine", "place"].map((m) => (
                <button key={m} onClick={() => setRefineMode(m)} style={{
                  flex: 1, padding: "8px", border: "none", borderRadius: "8px", cursor: "pointer",
                  fontSize: "13px", fontWeight: 600, transition: "all 0.15s",
                  background: refineMode === m ? "white" : "transparent",
                  color: refineMode === m ? "#111827" : "#9ca3af",
                  boxShadow: refineMode === m ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                }}>
                  {m === "medicine" ? "💊 Medicine" : "🏥 Hospital / Clinic"}
                </button>
              ))}
            </div>
            {refineMode === "medicine" ? (
              <div style={{ position: "relative" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "6px" }}>Medicine Name</label>
                <input value={refineMedicine} onChange={handleRefineMedicineChange} placeholder="e.g. Paracetamol"
                  style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: "10px", fontSize: "14px", boxSizing: "border-box", outline: "none" }} />
                {loadingSuggestions && <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>Loading…</div>}
                {medicineSuggestions.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                    {medicineSuggestions.map((m, i) => (
                      <li key={i} onClick={() => { setRefineMedicine(m); setMedicineSuggestions([]); }}
                        style={{ padding: "9px 14px", cursor: "pointer", fontSize: "13px", borderBottom: "1px solid #f3f4f6", color:"black" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f9fafb"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "white"}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "6px" }}>Category</label>
                <select value={refineCategory} onChange={(e) => setRefineCategory(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: "10px", fontSize: "14px", boxSizing: "border-box" }}>
                  <option value="hospital">🏥 Hospital</option>
                  <option value="clinic">🩺 Clinic</option>
                  <option value="pharmacy">💊 Pharmacy</option>
                </select>
              </div>
            )}
            <div style={{ position: "relative" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "6px" }}>
                Location <span style={{ color: "#9ca3af", fontWeight: 400 }}>— optional</span>
              </label>
              <div style={{ display: "flex", gap: "6px" }}>
                <input value={refinePlace} onChange={handleRefinePlaceChange}
                  onFocus={() => refinePlace.length >= 2 && setShowRefinePlaceSugg(true)}
                  onBlur={() => setTimeout(() => setShowRefinePlaceSugg(false), 150)}
                  placeholder="Leave blank to use current area"
                  style={{ flex: 1, padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: "10px", fontSize: "13px", outline: "none" }} />
                <button onClick={handleRefineUseMyLocation} title="Use my location"
                  style={{ padding: "10px 12px", border: "1.5px solid #e5e7eb", borderRadius: "10px", cursor: "pointer", background: "white", fontSize: "16px" }}>📍</button>
              </div>
              {refineResolvedCoords && <p style={{ color: "#cf16cfff", fontSize: "11px", margin: "4px 0 0" }}>✅ Location set</p>}
              {!refineResolvedCoords && !refinePlace && <p style={{ color: "#9ca3af", fontSize: "11px", margin: "4px 0 0" }}>Using current map position</p>}
              {showRefinePlaceSugg && (
                <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0", border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", position: "absolute", background: "white", zIndex: 10, width: "calc(100% - 52px)", maxHeight: "160px", overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                  {loadingRefinePlaceSugg && <li style={{ padding: "8px 12px", color: "#9ca3af", fontSize: "13px" }}>Loading…</li>}
                  {!loadingRefinePlaceSugg && refinePlaceSuggestions.map((s, i) => (
                    <li key={i} onClick={() => handleRefinePlaceSelect(s)}
                      style={{ padding: "9px 14px", cursor: "pointer", fontSize: "12px", borderBottom: "1px solid #f3f4f6" ,color:"black"}}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f9fafb"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "white"}>
                      {s.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button onClick={handleRefineSubmit} style={{
              width: "100%", padding: "12px", background: "var(--color-g)", color: "white",
              border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 700, cursor: "pointer",
            }}>Search</button>
          </div>
        </>
      )}
    </div>
  );
}