module.exports = {
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "granted" }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: -26.2041, longitude: 28.0473, accuracy: 10 },
  }),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([
    {
      name: "Sandton City",
      street: "Sandton Drive",
      city: "Sandton",
      region: "Gauteng",
    },
  ]),
  Accuracy: { Balanced: 3 },
};
