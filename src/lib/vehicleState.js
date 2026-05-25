// Shared vehicle state — written by PlayerController (local driver) and by
// useMultiplayer (remote broadcast receiver). Read by RemoteVehicle and by
// PlayerController (occupancy / passenger checks).
// Default positions match the spawn points in WorldCanvas.
export const vehicleState = {
  car: {
    x: 8, z: 20, facing: 0, speed: 0,
    driverId: null, driverName: null, driverOutfit: 'casual', driverSkin: '#F4C08A',
    passengerId: null, passengerName: null, passengerOutfit: 'casual', passengerSkin: '#F4C08A',
  },
  bike: {
    x: -18, z: 6, facing: 0, speed: 0,
    driverId: null, driverName: null, driverOutfit: 'casual', driverSkin: '#F4C08A',
    passengerId: null, passengerName: null, passengerOutfit: 'casual', passengerSkin: '#F4C08A',
  },
}
