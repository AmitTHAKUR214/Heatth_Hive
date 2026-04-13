// src/utils/geocode.js
const getCoordinates = async (place) => {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}&limit=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MedConnectApp/1.0 (your_email@example.com)",
      },
    });

    const data = await res.json();
    if (data.length === 0) return null;

    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  } catch (err) {
    console.error("Error in geocoding:", err);
    return null;
  }
};

export default getCoordinates;
