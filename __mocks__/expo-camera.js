module.exports = {
  Camera: () => null,
  CameraType: { front: "front", back: "back" },
  requestCameraPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "granted" }),
};
