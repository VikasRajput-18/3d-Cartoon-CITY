// Shared mutable state — written by DayNightCycle + WeatherSystem, read anywhere.
export const timeWeatherState = {
  timeOfDay:     12,       // 0-24 (starts at noon)
  isNight:       false,
  lampOn:        false,
  weather:       'clear',  // 'clear' | 'cloudy' | 'rainy' | 'foggy'
  rainIntensity: 0,        // 0-1
  fogDensity:    0,        // 0-1
  cloudOpacity:  0,        // 0-1
  rainSpeedMult: 1,        // NPC walk-speed multiplier (>1 when raining)
  forcedWeather: null,     // set by TimeWeatherHUD from real-world API; consumed by WeatherSystem
}
