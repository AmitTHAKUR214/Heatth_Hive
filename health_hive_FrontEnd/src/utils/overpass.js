// src/utils/overpass.js
const fetchMedicalPOIs = async (lat, lon, radius = 5000) => {
  try {
    const query = `
      [out:json];
      (
        node["amenity"~"hospital|clinic|pharmacy"](around:${radius},${lat},${lon});
        way["amenity"~"hospital|clinic|pharmacy"](around:${radius},${lat},${lon});
        relation["amenity"~"hospital|clinic|pharmacy"](around:${radius},${lat},${lon});
      );
      out center;
    `;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });

    const data = await res.json();

    return data.elements.map((el) => ({
      lat: el.lat || el.center?.lat,
      lon: el.lon || el.center?.lon,
      name: el.tags?.name,
    }));
  } catch (err) {
    console.error("Overpass fetch error:", err);
    return [];
  }
};

export default fetchMedicalPOIs;
