// Cinematic intro state — plain module flag read every frame.
// While active: PlayerController skips its camera writes (the IntroCameraRig
// owns the camera) and DayNightCycle uses timeWeatherState.hourOverride so the
// intro always plays at golden hour.
export const introState = { active: false }
